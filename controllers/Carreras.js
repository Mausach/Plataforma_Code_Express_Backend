const Carreras_Model = require("../models/Carreras_Model");


// 1. CREAR CARRERA
const crearCarrera = async (req, res) => {
    try {
        const {
            nombre,
            descripcion,
            duracion,
            clases_por_semana,
            duracion_de_cada_clase,
            titulo_certificacion,
            precio,
            modalidad,
            requisitos = [],
            modulos = [],
            estado
        } = req.body;

        // Validar que el nombre sea único
        const carreraExistente = await Carreras_Model.findOne({ 
            nombre: { $regex: new RegExp(`^${nombre}$`, 'i') } 
        });

        if (carreraExistente) {
            return res.status(400).json({
                ok: false,
                msg: 'Ya existe una carrera con ese nombre'
            });
        }

        // Validar modalidad
        const modalidadesValidas = ["part-time", "full-time", "grabado"];
        if (!modalidadesValidas.includes(modalidad)) {
            return res.status(400).json({
                ok: false,
                msg: 'Modalidad inválida. Use: part-time, full-time o grabado'
            });
        }

        // Procesar requisitos
        let requisitosArray = [];
        if (typeof requisitos === 'string') {
            requisitosArray = requisitos.split(',').map(req => req.trim()).filter(req => req !== '');
        } else if (Array.isArray(requisitos)) {
            requisitosArray = requisitos.map(req => req.trim()).filter(req => req !== '');
        }

        // ===== CAMBIO CLAVE: Procesar módulos SIN estados =====
        const modulosProcesados = modulos.map((modulo, index) => {
            const orden = modulo.orden || index + 1;
            
            // Contenidos SIN estado booleano
            const contenidosProcesados = modulo.contenidos?.map((contenido, idxContenido) => ({
                // _id se auto-genera en el modelo
                nombre: contenido.nombre?.trim() || `Contenido ${idxContenido + 1}`,
                // ⚠️ ELIMINADO: estado: contenido.estado (NO va aquí)
                
                // Recursos (se mantienen igual)
                clase: {
                    diapositivas: Array.isArray(contenido.clase?.diapositivas) 
                        ? contenido.clase.diapositivas.filter(url => url.trim() !== '')
                        : []
                },
                autoaprendizaje: {
                    guia_estudio: contenido.autoaprendizaje?.guia_estudio?.trim() || ''
                },
                tutoria: {
                    diapositivas: Array.isArray(contenido.tutoria?.diapositivas) 
                        ? contenido.tutoria.diapositivas.filter(url => url.trim() !== '')
                        : [],
                    apoyo: contenido.tutoria?.apoyo?.trim() || '',
                    proyectos: Array.isArray(contenido.tutoria?.proyectos) 
                        ? contenido.tutoria.proyectos.map(proyecto => ({
                            tarea: proyecto.tarea?.trim() || '',
                            solucion: proyecto.solucion?.trim() || ''
                        }))
                        : []
                }
            })) || [];

            return {
                // _id se auto-genera en el modelo
                nombre: modulo.nombre?.trim() || `Módulo ${orden}`,
                descripcion: modulo.descripcion?.trim() || '',
                orden: orden,
                // ⚠️ ELIMINADO: estado (NO va aquí)
                contenidos: contenidosProcesados
            };
        });

        // Ordenar módulos por orden
        modulosProcesados.sort((a, b) => a.orden - b.orden);

        // ===== NUEVO: Generar versión automática =====
        const fecha = new Date();
        const version = `${fecha.getFullYear()}.${fecha.getMonth() + 1}.0`;

        // Crear nueva carrera
        const nuevaCarrera = new Carreras_Model({
            nombre: nombre.trim(),
            descripcion: descripcion.trim(),
            duracion: duracion.trim(),
            clases_por_semana: parseInt(clases_por_semana) || 1,
            duracion_de_cada_clase: duracion_de_cada_clase.trim(),
            titulo_certificacion: titulo_certificacion.trim(),
            precio: precio.trim(),
            modalidad: modalidad,
            requisitos: requisitosArray,
            modulos: modulosProcesados,
            version: version, // NUEVO
            estado: estado || 'En desarrollo'
        });

        await nuevaCarrera.save();

        // Preparar respuesta
        const carreraResponse = {
            id: nuevaCarrera._id,
            nombre: nuevaCarrera.nombre,
            descripcion: nuevaCarrera.descripcion,
            duracion: nuevaCarrera.duracion,
            version: nuevaCarrera.version, // NUEVO
            clases_por_semana: nuevaCarrera.clases_por_semana,
            duracion_de_cada_clase: nuevaCarrera.duracion_de_cada_clase,
            titulo_certificacion: nuevaCarrera.titulo_certificacion,
            precio: nuevaCarrera.precio,
            modalidad: nuevaCarrera.modalidad,
            requisitos: nuevaCarrera.requisitos,
            modulos: nuevaCarrera.modulos.length,
            estado: nuevaCarrera.estado,
            fecha_creacion: nuevaCarrera.fecha_creacion,
            fecha_version: nuevaCarrera.fecha_version // NUEVO
        };

        res.status(201).json({
            ok: true,
            msg: 'Carrera creada exitosamente',
            carrera: carreraResponse
        });

    } catch (error) {
        console.error('Error al crear carrera:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                ok: false,
                msg: 'El nombre de la carrera ya existe'
            });
        }
        
        if (error.name === 'ValidationError') {
            const errores = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                ok: false,
                msg: 'Error de validación',
                errores: errores
            });
        }
        
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// 2. OBTENER TODAS LAS CARRERAS (método básico, lo completaremos después)
const obtenerCarreras = async (req, res) => {
    try {
        // Elimina el .select() para obtener TODOS los campos del documento
        const carreras = await Carreras_Model.find()
            .sort({ fecha_creacion: -1 });
        
        res.json({
            ok: true,
            carreras
        });
        
    } catch (error) {
        console.error('Error al obtener carreras:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

//3. EDITAR CARRERA
const actualizarCarrera = async (req, res) => {
    const { _id } = req.body;

    try {
        // 1. Verificar existencia
        const carreraExistente = await Carreras_Model.findById(_id);
        if (!carreraExistente) {
            return res.status(404).json({ 
                ok: false, 
                msg: "Carrera no encontrada" 
            });
        }

        // 2. Preparar updates
        const updates = {};
        const camposUnicos = ['nombre'];
        
        const camposNoEditables = [
            '_id', 
            'fecha_creacion', 
            '__v',
            'modulos._id',     // NUEVO: IDs de módulos NO se pueden cambiar
            'modulos.contenidos._id' // NUEVO: IDs de contenidos NO se pueden cambiar
        ];
        
        Object.entries(req.body).forEach(([key, value]) => {
            if (!camposNoEditables.includes(key)) {
                if (value !== undefined && value !== null) {
                    // ===== CAMBIO CLAVE: Preservar IDs existentes =====
                    if (key === 'modulos' && Array.isArray(value)) {
                        updates[key] = value.map((modulo, index) => {
                            // Buscar módulo existente por orden o nombre
                            const moduloExistente = carreraExistente.modulos.find(
                                m => m._id.toString() === (modulo._id || '') || 
                                     m.orden === modulo.orden ||
                                     m.nombre === modulo.nombre
                            );
                            
                            const moduloId = moduloExistente?._id || new mongoose.Types.ObjectId();
                            const orden = modulo.orden || index + 1;
                            
                            // Procesar contenidos preservando IDs
                            const contenidos = modulo.contenidos?.map((contenido, idxCont) => {
                                const contenidoExistente = moduloExistente?.contenidos?.find(
                                    c => c._id.toString() === (contenido._id || '') ||
                                         c.nombre === contenido.nombre
                                );
                                
                                const contenidoId = contenidoExistente?._id || new mongoose.Types.ObjectId();
                                
                                return {
                                    _id: contenidoId, // Preservar o generar nuevo ID
                                    nombre: contenido.nombre?.trim() || `Contenido ${idxCont + 1}`,
                                    // ⚠️ ELIMINADO: estado
                                    clase: {
                                        diapositivas: Array.isArray(contenido.clase?.diapositivas) 
                                            ? contenido.clase.diapositivas
                                                .filter(diapo => diapo && diapo.trim() !== '')
                                                .map(diapo => diapo.trim())
                                            : []
                                    },
                                    autoaprendizaje: {
                                        guia_estudio: contenido.autoaprendizaje?.guia_estudio?.trim() || ''
                                    },
                                    tutoria: {
                                        diapositivas: Array.isArray(contenido.tutoria?.diapositivas)
                                            ? contenido.tutoria.diapositivas
                                                .filter(diapo => diapo && diapo.trim() !== '')
                                                .map(diapo => diapo.trim())
                                            : [],
                                        apoyo: contenido.tutoria?.apoyo?.trim() || '',
                                        proyectos: Array.isArray(contenido.tutoria?.proyectos)
                                            ? contenido.tutoria.proyectos
                                                .filter(proyecto => proyecto.tarea && proyecto.tarea.trim() !== '')
                                                .map(proyecto => ({
                                                    tarea: proyecto.tarea.trim(),
                                                    solucion: proyecto.solucion?.trim() || ''
                                                }))
                                            : []
                                    }
                                };
                            }) || [];
                            
                            return {
                                _id: moduloId, // Preservar ID existente
                                nombre: modulo.nombre?.trim() || `Módulo ${orden}`,
                                descripcion: modulo.descripcion?.trim() || '',
                                orden: orden,
                                // ⚠️ ELIMINADO: estado
                                contenidos: contenidos
                            };
                        });
                    } 
                    // ===== NUEVO: Incrementar versión si hay cambios importantes =====
                    else if (key === 'modulos' || key === 'nombre' || key === 'duracion') {
                        updates[key] = value;
                        // Marcar para incrementar versión
                        updates.version = incrementarVersion(carreraExistente.version);
                    }
                    else if (Array.isArray(value)) {
                        updates[key] = value;
                    } 
                    else if (typeof value === 'string') {
                        updates[key] = value.trim();
                    } 
                    else {
                        updates[key] = value;
                    }
                }
            }
        });

        // 3. Validar unicidad
        for (const campo of camposUnicos) {
            if (updates[campo] !== undefined && updates[campo] !== null) {
                if (updates[campo] !== carreraExistente[campo]) {
                    const existe = await Carreras_Model.findOne({ 
                        [campo]: updates[campo],
                        _id: { $ne: _id }
                    });
                    if (existe) {
                        return res.status(400).json({ 
                            ok: false, 
                            msg: `El nombre "${updates[campo]}" ya está en uso por otra carrera` 
                        });
                    }
                }
            }
        }

        // 4. Validar estructura
        if (updates.modulos !== undefined) {
            for (let i = 0; i < updates.modulos.length; i++) {
                if (!updates.modulos[i].nombre || updates.modulos[i].nombre.trim() === '') {
                    return res.status(400).json({
                        ok: false,
                        msg: `El módulo ${i + 1} debe tener un nombre`
                    });
                }
                
                for (let j = 0; j < updates.modulos[i].contenidos.length; j++) {
                    if (!updates.modulos[i].contenidos[j].nombre || 
                        updates.modulos[i].contenidos[j].nombre.trim() === '') {
                        return res.status(400).json({
                            ok: false,
                            msg: `El contenido ${j + 1} del módulo "${updates.modulos[i].nombre}" debe tener un nombre`
                        });
                    }
                }
            }
        }

        // 5. Construir operación de actualización
        const updateOperation = {};
        
        if (Object.keys(updates).length > 0) {
            updateOperation.$set = {};
            Object.entries(updates).forEach(([key, value]) => {
                if (value !== undefined) {
                    updateOperation.$set[key] = value;
                }
            });
        }
        
        // Siempre actualizar fecha de actualización y versión
        updateOperation.$set = {
            ...updateOperation.$set,
            fecha_actualizacion: new Date(),
            fecha_version: new Date()
        };

        // 6. Ejecutar actualización
        const carreraActualizada = await Carreras_Model.findByIdAndUpdate(
            _id,
            updateOperation,
            { 
                new: true,
                runValidators: true,
                context: 'query'
            }
        );

        res.json({
            ok: true,
            msg: "Carrera actualizada correctamente",
            carrera: {
                id: carreraActualizada._id,
                nombre: carreraActualizada.nombre,
                version: carreraActualizada.version, // NUEVO
                estado: carreraActualizada.estado,
                fecha_actualizacion: carreraActualizada.fecha_actualizacion,
                fecha_version: carreraActualizada.fecha_version // NUEVO
            }
        });

    } catch (error) {
        console.error("Error en actualizarCarrera:", error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                ok: false,
                msg: "El nombre de la carrera ya está en uso por otra carrera"
            });
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                ok: false,
                msg: "Error de validación en los datos de la carrera",
                errors: errors
            });
        }

        if (error.name === 'CastError') {
            return res.status(400).json({
                ok: false,
                msg: "ID de carrera inválido"
            });
        }

        res.status(500).json({
            ok: false,
            msg: "Error interno del servidor al actualizar la carrera",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===== FUNCIÓN AUXILIAR: Incrementar versión =====
const incrementarVersion = (versionActual) => {
    if (!versionActual) return '1.0.0';
    
    const partes = versionActual.split('.').map(Number);
    if (partes.length < 3) return '1.0.0';
    
    // Incrementar revisión (último número)
    partes[2] = (partes[2] || 0) + 1;
    
    // Si revisión >= 10, incrementar minor y resetear revisión
    if (partes[2] >= 10) {
        partes[2] = 0;
        partes[1] = (partes[1] || 0) + 1;
    }
    
    // Si minor >= 10, incrementar major y resetear minor
    if (partes[1] >= 10) {
        partes[1] = 0;
        partes[0] = (partes[0] || 0) + 1;
    }
    
    return partes.join('.');
};

const obtenerCarreraCompleta = async (req, res) => {
    try {
        const { id } = req.params;
        
        const carrera = await Carreras_Model.findById(id)
            .select('nombre descripcion duracion version modulos._id modulos.nombre modulos.orden modulos.contenidos._id modulos.contenidos.nombre modulos.contenidos.clase modulos.contenidos.autoaprendizaje modulos.contenidos.tutoria')
            .lean();
        
        if (!carrera) {
            return res.status(404).json({
                ok: false,
                msg: 'Carrera no encontrada'
            });
        }
        
        // Calcular estadísticas
        const estadisticas = {
            total_modulos: carrera.modulos.length,
            total_contenidos: carrera.modulos.reduce((total, modulo) => 
                total + (modulo.contenidos?.length || 0), 0)
        };
        
        res.json({
            ok: true,
            carrera: carrera
        });
        
    } catch (error) {
        console.error('Error al obtener carrera completa:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

module.exports = {
    crearCarrera,
    obtenerCarreras,
    actualizarCarrera,
    obtenerCarreraCompleta
};