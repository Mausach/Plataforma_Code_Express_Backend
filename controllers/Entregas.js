// controllers/entregaController.js
const mongoose = require("mongoose");
const Comision_Model = require("../models/Comision_Model");
const Entregas_Models = require("../models/Entregas_Models");
const Usuario_Model = require("../models/Usuario_Model");

// ============================================
// 1. GUARDAR UNA ENTREGA (CREAR)
// ============================================
const guardarEntrega = async (req, res) => {
    try {
        const {
            comision_id,
            comision_nombre,
            trabajo_nombre,
            tipo_entrega,
            github_url,
            archivo_url,
            es_grupal,
            miembros,
            comentarios
        } = req.body;


        // ===== 1. VALIDACIONES BÁSICAS (SIN BD) =====
        if (!comision_id || !trabajo_nombre || !tipo_entrega) {
            return res.status(400).json({
                success: false,
                msg: 'Faltan campos requeridos: comision_id, trabajo_nombre y tipo_entrega'
            });
        }

        // Validar IDs
        if (!mongoose.Types.ObjectId.isValid(comision_id)) {
            return res.status(400).json({
                success: false,
                msg: 'El ID de comisión no es válido'
            });
        }

        // Validar tipo de entrega
        const tiposPermitidos = ["github", "archivo"];
        if (!tiposPermitidos.includes(tipo_entrega)) {
            return res.status(400).json({
                success: false,
                msg: `Tipo de entrega inválido. Use: ${tiposPermitidos.join(', ')}`
            });
        }

        // Validar URLs según tipo
        const esUrlValida = (url) => {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        };

        if (tipo_entrega === 'github') {
            if (!github_url) {
                return res.status(400).json({
                    success: false,
                    msg: 'La URL de GitHub es obligatoria'
                });
            }
            if (!esUrlValida(github_url) || !github_url.includes('github.com')) {
                return res.status(400).json({
                    success: false,
                    msg: 'La URL debe ser una URL válida de GitHub'
                });
            }
        }

        if (tipo_entrega === 'archivo') {
            if (!archivo_url) {
                return res.status(400).json({
                    success: false,
                    msg: 'La URL del archivo es obligatoria'
                });
            }
            if (!esUrlValida(archivo_url)) {
                return res.status(400).json({
                    success: false,
                    msg: 'La URL del archivo no es válida'
                });
            }
        }

        // Validar miembros para trabajos grupales
        if (es_grupal) {
            if (!miembros || !Array.isArray(miembros) || miembros.length === 0) {
                return res.status(400).json({
                    success: false,
                    msg: 'Los trabajos grupales deben tener al menos un miembro'
                });
            }

            // Validar que cada miembro tenga nombre y apellido
            for (const m of miembros) {
                if ((!m.nombres && !m.nombre) || !m.apellido) {
                    return res.status(400).json({
                        success: false,
                        msg: 'Cada miembro debe tener nombre y apellido'
                    });
                }
            }

            // Validar miembros duplicados
            const nombresSet = new Set();
            for (const m of miembros) {
                const nombreCompleto = `${m.nombres || m.nombre} ${m.apellido}`.trim();
                if (nombresSet.has(nombreCompleto)) {
                    return res.status(400).json({
                        success: false,
                        msg: `No puede haber miembros duplicados: ${nombreCompleto}`
                    });
                }
                nombresSet.add(nombreCompleto);
            }
        }

        // ===== 2. CONSULTAS EN PARALELO (OPTIMIZADAS) =====
        const [comisionExiste, usuarioExiste] = await Promise.all([
            // Verificar que la comisión existe (solo necesitamos saber si existe)
            Comision_Model.findById(comision_id).lean().select('_id nombre'),
            
            // Verificar que el usuario existe (necesitamos sus datos para embeber)
            Usuario_Model.findById(req.id).lean().select('nombres apellido email dni')
        ]);

        // 3. Verificar resultados de las consultas
        if (!comisionExiste) {
            return res.status(404).json({
                success: false,
                msg: 'La comisión especificada no existe'
            });
        }

        if (!usuarioExiste) {
            return res.status(404).json({
                success: false,
                msg: 'El usuario no existe'
            });
        }

        // ===== 4. PREPARAR DATOS EMBEBIDOS =====
        const alumnoData = {
            usuario_id: req.id,
            nombres: usuarioExiste.nombres || req.name || '',
            apellido: usuarioExiste.apellido || '',
            email: usuarioExiste.email || '',
            dni: usuarioExiste.dni || ''
        };

        const comisionData = {
            comision_id: comision_id,
            nombre: comision_nombre || comisionExiste.nombre || ''
        };

        // Preparar miembros
        let miembrosData = [];
        if (es_grupal) {
            miembrosData = miembros.map(m => ({
                usuario_id: m.usuario_id || null,
                nombres: m.nombres || m.nombre || '',
                apellido: m.apellido || '',
                email: m.email || '',
                es_registrado: m.es_registrado || false
            }));
        } else {
            miembrosData = [{
                usuario_id: req.id,
                nombres: usuarioExiste.nombres || req.name || '',
                apellido: usuarioExiste.apellido || '',
                email: usuarioExiste.email || '',
                es_registrado: true
            }];
        }

        // ===== 5. VERIFICAR SI EXISTE ENTREGA PREVIA =====
        const entregaExistente = await Entregas_Models.findOne({
            'alumno.usuario_id': req.id,
            'comision.comision_id': comision_id,
            trabajo_nombre: trabajo_nombre.trim()
        }).lean();

        if (entregaExistente) {
            return res.status(409).json({
                success: false,
                msg: 'Ya existe una entrega con este nombre para esta comisión'
            });
        }

        // ===== 6. CREAR NUEVA ENTREGA =====
        const nuevaEntrega = new Entregas_Models({
            alumno: alumnoData,
            comision: comisionData,
            es_grupal: es_grupal || false,
            miembros: miembrosData,
            trabajo_nombre: trabajo_nombre.trim(),
            tipo_entrega: tipo_entrega,
            ...(tipo_entrega === 'github' 
                ? { github_url: github_url.trim() }
                : { archivo_url: archivo_url.trim() }
            ),
            comentarios: comentarios?.trim() || '',
            estado: 'Entregado',
            fecha_entrega: new Date()
        });

        await nuevaEntrega.save();
        

        // ===== 7. RESPUESTA EXITOSA =====
        return res.status(201).json({
            success: true,
            msg: 'Entrega registrada correctamente',
            data: {
                id: nuevaEntrega._id,
                trabajo_nombre: nuevaEntrega.trabajo_nombre,
                tipo_entrega: nuevaEntrega.tipo_entrega,
                fecha_entrega: nuevaEntrega.fecha_entrega,
                estado: nuevaEntrega.estado,
                comision: nuevaEntrega.comision.nombre,
                alumno: `${nuevaEntrega.alumno.nombres} ${nuevaEntrega.alumno.apellido}`
            }
        });

    } catch (error) {
        console.error('💥 Error en guardarEntrega:', error);

        // Manejo de errores de validación de Mongoose
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                msg: 'Error de validación',
                errores: Object.values(error.errors).map(e => e.message)
            });
        }

        // Error de índice duplicado (por si acaso)
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                msg: 'Ya existe una entrega con estos datos'
            });
        }

        return res.status(500).json({
            success: false,
            msg: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// 2. CARGAR TODAS LAS ENTREGAS DE UNA COMISIÓN
// ============================================
const cargarEntregasDeComision = async (req, res) => {
    try {
        const { comisionId } = req.params;
        const {
            estado,
            tipo,
            alumno_id,
            desde,
            hasta,
            page = 1,
            limit = 50,
            ordenar_por = 'fecha_entrega',
            orden = 'desc'
        } = req.query;

        if (!comisionId) {
            return res.status(400).json({
                ok: false,
                msg: 'ID de comisión requerido'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(comisionId)) {
            return res.status(400).json({
                ok: false,
                msg: 'ID de comisión inválido'
            });
        }

        const comisionExiste = await Comision_Model.findById(comisionId)
            .select('nombre')
            .lean();

        if (!comisionExiste) {
            return res.status(404).json({
                ok: false,
                msg: 'Comisión no encontrada'
            });
        }

        const filtro = {
            'comision.comision_id': new mongoose.Types.ObjectId(comisionId)
        };

        if (estado) filtro.estado = estado;
        if (tipo) filtro.tipo_entrega = tipo;
        
        if (alumno_id) {
            if (!mongoose.Types.ObjectId.isValid(alumno_id)) {
                return res.status(400).json({
                    ok: false,
                    msg: 'ID de alumno inválido'
                });
            }
            filtro['alumno.usuario_id'] = new mongoose.Types.ObjectId(alumno_id);
        }

        if (desde || hasta) {
            filtro.fecha_entrega = {};
            if (desde) {
                const fechaDesde = new Date(desde);
                if (isNaN(fechaDesde.getTime())) {
                    return res.status(400).json({
                        ok: false,
                        msg: 'Formato de fecha "desde" inválido'
                    });
                }
                filtro.fecha_entrega.$gte = fechaDesde;
            }
            if (hasta) {
                const fechaHasta = new Date(hasta);
                if (isNaN(fechaHasta.getTime())) {
                    return res.status(400).json({
                        ok: false,
                        msg: 'Formato de fecha "hasta" inválido'
                    });
                }
                fechaHasta.setHours(23, 59, 59, 999);
                filtro.fecha_entrega.$lte = fechaHasta;
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const ordenamiento = {};
        ordenamiento[ordenar_por] = orden === 'desc' ? -1 : 1;

        const [entregas, total] = await Promise.all([
            Entregas_Models.find(filtro)
                .sort(ordenamiento)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),

            Entregas_Models.countDocuments(filtro)
        ]);

        let metricas = null;
        if (page == 1 && Object.keys(req.query).length === 0) {
            const metricasRaw = await Entregas_Models.aggregate([
                { $match: { 'comision.comision_id': new mongoose.Types.ObjectId(comisionId) } },
                {
                    $group: {
                        _id: null,
                        total_entregas: { $sum: 1 },
                        entregas_github: {
                            $sum: { $cond: [{ $eq: ['$tipo_entrega', 'github'] }, 1, 0] }
                        },
                        entregas_archivo: {
                            $sum: { $cond: [{ $eq: ['$tipo_entrega', 'archivo'] }, 1, 0] }
                        },
                        entregas_pendientes: {
                            $sum: { $cond: [{ $eq: ['$estado', 'Entregado'] }, 1, 0] }
                        },
                        entregas_calificadas: {
                            $sum: { $cond: [{ $eq: ['$estado', 'Calificado'] }, 1, 0] }
                        },
                        entregas_rechazadas: {
                            $sum: { $cond: [{ $eq: ['$estado', 'Rechazado'] }, 1, 0] }
                        },
                        promedio_puntaje: { $avg: '$calificacion.puntaje' }
                    }
                }
            ]);

            if (metricasRaw.length > 0) {
                metricas = metricasRaw[0];
            }
        }

        res.json({
            ok: true,
            comision: {
                id: comisionExiste._id,
                nombre: comisionExiste.nombre
            },
            entregas: entregas.map(entrega => ({
                id: entrega._id,
                trabajo_nombre: entrega.trabajo_nombre,
                tipo_entrega: entrega.tipo_entrega,
                estado: entrega.estado,
                fecha_entrega: entrega.fecha_entrega,
                alumno: entrega.alumno,
                es_grupal: entrega.es_grupal,
                miembros: entrega.miembros,
                calificacion: entrega.calificacion,
                feedback: entrega.feedback,
                archivo_url: entrega.archivo_url,
                github_url: entrega.github_url,
                comentarios: entrega.comentarios
            })),
            paginacion: {
                total,
                pagina_actual: parseInt(page),
                total_paginas: Math.ceil(total / limit),
                limite: parseInt(limit)
            },
            metricas: metricas
        });

    } catch (error) {
        console.error('❌ Error en cargarEntregasDeComision:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor al cargar las entregas'
        });
    }
};

// ============================================
// 3. CARGAR TODAS LAS ENTREGAS DE UN USUARIO
// ============================================
const cargarEntregasDeUsuario = async (req, res) => {
    try {
        const { usuarioId } = req.params;
        const {
            comision_id,
            estado,
            tipo,
            page = 1,
            limit = 20
        } = req.query;

        if (!usuarioId) {
            return res.status(400).json({
                ok: false,
                msg: 'ID de usuario requerido'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
            return res.status(400).json({
                ok: false,
                msg: 'ID de usuario inválido'
            });
        }

        const filtro = {
            'alumno.usuario_id': new mongoose.Types.ObjectId(usuarioId)
        };

        if (comision_id) {
            if (!mongoose.Types.ObjectId.isValid(comision_id)) {
                return res.status(400).json({
                    ok: false,
                    msg: 'ID de comisión inválido'
                });
            }
            filtro['comision.comision_id'] = new mongoose.Types.ObjectId(comision_id);
        }

        if (estado) filtro.estado = estado;
        if (tipo) filtro.tipo_entrega = tipo;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [entregas, total] = await Promise.all([
            Entregas_Models.find(filtro)
                .sort({ fecha_entrega: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),

            Entregas_Models.countDocuments(filtro)
        ]);

        const entregasPorComision = {};
        
        entregas.forEach(entrega => {
            const comisionIdStr = entrega.comision.comision_id.toString();
            
            if (!entregasPorComision[comisionIdStr]) {
                entregasPorComision[comisionIdStr] = {
                    comision_id: comisionIdStr,
                    comision_nombre: entrega.comision.nombre,
                    entregas: []
                };
            }
            
            entregasPorComision[comisionIdStr].entregas.push({
                id: entrega._id,
                trabajo_nombre: entrega.trabajo_nombre,
                tipo_entrega: entrega.tipo_entrega,
                estado: entrega.estado,
                fecha_entrega: entrega.fecha_entrega,
                calificacion: entrega.calificacion,
                feedback: entrega.feedback,
                archivo_url: entrega.archivo_url,
                github_url: entrega.github_url,
                comentarios: entrega.comentarios
            });
        });

        res.json({
            ok: true,
            usuario_id: usuarioId,
            total_entregas: total,
            entregas_por_comision: Object.values(entregasPorComision),
            paginacion: {
                total,
                pagina_actual: parseInt(page),
                total_paginas: Math.ceil(total / limit),
                limite: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('❌ Error en cargarEntregasDeUsuario:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor al cargar las entregas del usuario'
        });
    }
};

// ============================================
// 4. OBTENER UNA ENTREGA POR ID
// ============================================
const obtenerEntregaPorId = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                ok: false,
                msg: 'ID de entrega inválido'
            });
        }

        const entrega = await Entregas_Models.findById(id).lean();

        if (!entrega) {
            return res.status(404).json({
                ok: false,
                msg: 'Entrega no encontrada'
            });
        }

        res.json({
            ok: true,
            entrega: {
                id: entrega._id,
                ...entrega
            }
        });

    } catch (error) {
        console.error('❌ Error en obtenerEntregaPorId:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

// ============================================
// 5. ACTUALIZAR ESTADO/CALIFICACIÓN (OPTIMIZADO)
// ============================================
const calificarEntrega = async (req, res) => {
    try {
        const { id } = req.params;
        const { puntaje, comentario, estado } = req.body;

        

        // ===== 1. VALIDACIONES BÁSICAS (SIN BD) =====
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                msg: 'ID de entrega inválido'
            });
        }

        // Validar que quien califica existe (viene del middleware)
        if (!req.id && !req.usuario?._id) {
            return res.status(401).json({
                success: false,
                msg: 'Usuario no autorizado para calificar'
            });
        }

        // Validar puntaje si viene
        if (puntaje !== undefined) {
            if (typeof puntaje !== 'number' || puntaje < 0 || puntaje > 100) {
                return res.status(400).json({
                    success: false,
                    msg: 'El puntaje debe ser un número entre 0 y 100'
                });
            }
        }

        // Validar estado si viene
        const estadosPermitidos = ['Calificado', 'Rechazado', 'En revisión'];
        if (estado && !estadosPermitidos.includes(estado)) {
            return res.status(400).json({
                success: false,
                msg: `Estado inválido. Use: ${estadosPermitidos.join(', ')}`
            });
        }

        // Si no viene puntaje ni estado, ¿qué está haciendo?
        if (puntaje === undefined && !estado) {
            return res.status(400).json({
                success: false,
                msg: 'Debe proporcionar puntaje o estado para calificar'
            });
        }

        // ===== 2. VERIFICAR QUE LA ENTREGA EXISTE Y OBTENER SU ESTADO ACTUAL =====
        const entrega = await Entregas_Models.findById(id).lean();
        
        if (!entrega) {
            return res.status(404).json({
                success: false,
                msg: 'Entrega no encontrada'
            });
        }

        // ===== 3. VALIDACIONES DE NEGOCIO =====
        // No se puede calificar una entrega ya calificada (a menos que sea una re-calificación)
        if (entrega.estado === 'Calificado' && !estado) {
            return res.status(400).json({
                success: false,
                msg: 'Esta entrega ya está calificada. Use el estado para modificarla.'
            });
        }

        // No se puede calificar una entrega en borrador
        if (entrega.estado === 'Borrador') {
            return res.status(400).json({
                success: false,
                msg: 'No se puede calificar una entrega en estado Borrador'
            });
        }

        // Si viene puntaje, el estado debería ser 'Calificado' (o lo forzamos)
        const nuevoEstado = estado || (puntaje !== undefined ? 'Calificado' : entrega.estado);

        // ===== 4. PREPARAR DATOS DE ACTUALIZACIÓN =====
        const calificadoPorId = req.id || req.usuario?._id;
        
        // Objeto de actualización
        const updateData = {
            'calificacion.puntaje': puntaje,
            'calificacion.comentario': comentario?.trim() || '',
            'calificacion.fecha_calificacion': new Date(),
            'calificacion.calificado_por': calificadoPorId,
            feedback: comentario?.trim() || '',
            estado: nuevoEstado
        };

        // Si no hay puntaje, no actualizamos ese campo (borramos el que había)
        if (puntaje === undefined) {
            updateData['calificacion.puntaje'] = null;
        }

        // ===== 5. AGREGAR AL HISTORIAL (opcional pero recomendado) =====
        // Si el modelo tiene campo historial_estados, lo actualizamos
        const pushToHistory = {
            $push: {
                historial_estados: {
                    estado: nuevoEstado,
                    fecha: new Date(),
                    comentario: comentario?.trim() || '',
                    usuario_id: calificadoPorId
                }
            }
        };

        // ===== 6. ACTUALIZAR LA ENTREGA =====
        const entregaActualizada = await Entregas_Models.findByIdAndUpdate(
            id,
            {
                $set: updateData,
                ...pushToHistory  // Agregar al historial
            },
            { 
                new: true,
                runValidators: true,
                select: '_id trabajo_nombre estado calificacion feedback fecha_entrega'
            }
        ).lean();


        // ===== 7. RESPUESTA EXITOSA =====
        return res.json({
            success: true,
            msg: 'Entrega calificada correctamente',
            data: {
                id: entregaActualizada._id,
                trabajo_nombre: entregaActualizada.trabajo_nombre,
                estado: entregaActualizada.estado,
                calificacion: entregaActualizada.calificacion ? {
                    puntaje: entregaActualizada.calificacion.puntaje,
                    comentario: entregaActualizada.calificacion.comentario,
                    fecha: entregaActualizada.calificacion.fecha_calificacion
                } : null,
                feedback: entregaActualizada.feedback
            }
        });

    } catch (error) {
        console.error('💥 Error en calificarEntrega:', error);

        // Error de validación de Mongoose
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                msg: 'Error de validación',
                errores: Object.values(error.errors).map(e => e.message)
            });
        }

        return res.status(500).json({
            success: false,
            msg: 'Error interno del servidor al calificar',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    guardarEntrega,
    cargarEntregasDeComision,
    cargarEntregasDeUsuario,
    obtenerEntregaPorId,
    calificarEntrega
};