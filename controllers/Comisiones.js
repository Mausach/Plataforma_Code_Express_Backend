const mongoose = require("mongoose");
const Carreras_Model = require("../models/Carreras_Model");
const Comision_Model = require("../models/Comision_Model");
const Inscripcion_Model = require("../models/Inscripcion_Model");



// 1. OBTENER COMISIONES (LISTA) - OPTIMIZADO

const obtenerComisiones = async (req, res) => {
    try {
        const {
            estado,
            carrera_id,
            page = 1,
            limit = 20,
            coordinador_id
        } = req.query;

        // Construir filtro dinámico
        const filtro = {};
        if (estado) filtro.estado = estado;
        if (carrera_id) filtro['carrera.id'] = carrera_id;
        if (coordinador_id) filtro.coordinador_id = coordinador_id;

        const skip = (page - 1) * limit;

        const [comisiones, total] = await Promise.all([
            // Campos específicos necesarios para PanelProgreso
            Comision_Model.find(filtro)
                .select(`
                    nombre 
                    fecha_inicio 
                    fecha_fin 
                    estado 
                    modalidad 
                    carrera 
                    carrera_info 
                    progreso_carrera
                    coordinador_id 
                    total_clases_generadas 
                    total_alumnos 
                    total_profesores 
                    fecha_creacion
                    ultima_actualizacion
                    horario_comision
                    creado_por
                `)
                .populate({
                    path: 'coordinador_id',
                    select: 'nombres apellido email',
                    options: { lean: true }
                })
                .populate({
                    path: 'creado_por',
                    select: 'nombres apellido email',
                    options: { lean: true }
                })
                .sort({ fecha_creacion: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),

            Comision_Model.countDocuments(filtro)
        ]);

        // Formatear para frontend
        const comisionesFormateadas = comisiones.map(comision => ({
            id: comision._id,
            _id: comision._id,
            nombre: comision.nombre,
            fecha_inicio: comision.fecha_inicio,
            fecha_fin: comision.fecha_fin,
            estado: comision.estado,
            modalidad: comision.modalidad,
            carrera: comision.carrera, // Objeto completo {id, version}
            carrera_id: comision.carrera?.id, // También el ID por separado
            carrera_info: comision.carrera_info,
            progreso_carrera: comision.progreso_carrera || [], // CRÍTICO para PanelProgreso
            coordinador: comision.coordinador_id ? {
                id: comision.coordinador_id._id,
                nombres: comision.coordinador_id.nombres,
                apellido: comision.coordinador_id.apellido,
                email: comision.coordinador_id.email
            } : null,
            total_clases_generadas: comision.total_clases_generadas || 0,
            total_alumnos: comision.total_alumnos || 0,
            total_profesores: comision.total_profesores || 0,
            fecha_creacion: comision.fecha_creacion,
            ultima_actualizacion: comision.ultima_actualizacion,
            horario_comision: comision.horario_comision,
            creado_por: comision.creado_por ? {
                id: comision.creado_por._id,
                nombres: comision.creado_por.nombres,
                apellido: comision.creado_por.apellido,
                email: comision.creado_por.email
            } : null
        }));

        res.json({
            ok: true,
            comisiones: comisionesFormateadas,
            paginacion: {
                total,
                pagina_actual: parseInt(page),
                total_paginas: Math.ceil(total / limit),
                limite: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('❌ Error en obtenerComisiones:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

// 2. OBTENER COMISIÓN POR ID - OPTIMIZADO
const obtenerComisionPorId = async (req, res) => {
    try {
        const { _id } = req.query;

        if (!_id) {
            return res.status(400).json({
                ok: false,
                msg: 'ID de comisión requerido'
            });
        }

        // SOLO 2 CONSULTAS PARALELAS
        const [comision, clasesCount] = await Promise.all([
            // Consulta principal optimizada
            Comision_Model.findById(_id)
                .populate({
                    path: 'coordinador_id',
                    select: 'nombres apellido email telefono dni'
                })
                .populate({
                    path: 'creado_por',
                    select: 'nombres apellido email'
                })
                .lean(),

            // Contar clases (separado porque puede ser grande)
            Clase_Model.countDocuments({ comision_id: _id })
        ]);

        if (!comision) {
            return res.status(404).json({
                ok: false,
                msg: 'Comisión no encontrada'
            });
        }

        // Generar progreso si no existe
        if (!comision.progreso_carrera || comision.progreso_carrera.length === 0) {
            // Solo hacemos esta consulta SI ES NECESARIO
            const carrera = await Carreras_Model.findById(comision.carrera.id)
                .select('modulos')
                .lean();

            if (carrera) {
                comision.progreso_carrera = generarProgresoDesdeCarrera(carrera);
            }
        }

        // Obtener estadísticas de clases (1 consulta más si es modalidad presencial)
        let estadisticasClases = {};
        if (comision.modalidad !== 'grabado') {
            const pipeline = [
                { $match: { comision_id: _id } },
                {
                    $group: {
                        _id: '$estado',
                        count: { $sum: 1 }
                    }
                }
            ];

            const resultado = await Clase_Model.aggregate(pipeline);
            estadisticasClases = resultado.reduce((acc, curr) => {
                acc[`clases_${curr._id.toLowerCase()}`] = curr.count;
                return acc;
            }, { total_clases: clasesCount });
        }

        // Datos calculados en memoria
        const diasTexto = comision.horario_comision?.dias_semana?.map(numeroADia) || [];

        res.json({
            ok: true,
            comision: {
                ...comision,
                dias_semana_texto: diasTexto,
                estadisticas: {
                    total_clases: clasesCount,
                    ...estadisticasClases
                }
            }
        });

    } catch (error) {
        console.error('❌ Error en obtenerComisionPorId:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};



// Crear comisión con clases automáticas
const crearComision = async (req, res) => {
    try {
        const {
            nombre,
            fecha_inicio,
            fecha_fin,
            carrera_id,
            modalidad = "Full-Time",
            coordinador_id,
            dias_semana = [],
            hora_inicio,
            hora_fin,
            creado_por
        } = req.body;

        // ===== 1. VALIDACIONES BÁSICAS =====
        if (!nombre || !fecha_inicio || !fecha_fin || !carrera_id) {
            return res.status(400).json({
                ok: false,
                msg: 'Nombre, fechas y carrera son requeridos'
            });
        }

        // Validar fechas
        const fechaInicio = new Date(fecha_inicio);
        const fechaFin = new Date(fecha_fin);

        if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
            return res.status(400).json({
                ok: false,
                msg: 'Fechas inválidas'
            });
        }

        if (fechaInicio >= fechaFin) {
            return res.status(400).json({
                ok: false,
                msg: 'Fecha de inicio debe ser anterior a fecha de fin'
            });
        }

        // Validar modalidad
        const modalidadesValidas = ["Full-Time", "Part-Time"];
        if (!modalidadesValidas.includes(modalidad)) {
            return res.status(400).json({
                ok: false,
                msg: `Modalidad inválida. Use: ${modalidadesValidas.join(', ')}`
            });
        }

        // Validar días de semana si se proporcionan
        if (dias_semana && dias_semana.length > 0) {
            const diasInvalidos = dias_semana.filter(dia => dia < 0 || dia > 6);
            if (diasInvalidos.length > 0) {
                return res.status(400).json({
                    ok: false,
                    msg: 'Días de semana inválidos. Use números 0-6 (0=Domingo)'
                });
            }
        }

        // ===== 2. VERIFICAR EXISTENCIAS =====
        // Verificar que la carrera existe
        const carrera = await Carreras_Model.findById(carrera_id)
            .select('nombre duracion titulo_certificacion modalidad version modulos')
            .lean();

        if (!carrera) {
            return res.status(404).json({
                ok: false,
                msg: 'Carrera no encontrada'
            });
        }

        // Verificar nombre único
        const comisionExistente = await Comision_Model.findOne({ nombre }).lean();
        if (comisionExistente) {
            return res.status(400).json({
                ok: false,
                msg: 'Ya existe una comisión con ese nombre'
            });
        }

        // ===== 3. GENERAR PROGRESO DE CARRERA =====
        let progreso_carrera = [];

        if (carrera.modulos && carrera.modulos.length > 0) {
            progreso_carrera = carrera.modulos
                .sort((a, b) => (a.orden || 0) - (b.orden || 0))
                .map(modulo => ({
                    modulo_id: modulo._id,
                    orden_modulo: modulo.orden || 0,
                    nombre_modulo: modulo.nombre || 'Sin nombre',
                    estado_modulo: false, // Siempre false al inicio
                    contenidos: modulo.contenidos?.map(contenido => ({
                        contenido_id: contenido._id,
                        nombre_contenido: contenido.nombre || 'Sin nombre',
                        estado_contenido: false // Siempre false al inicio
                    })) || []
                }));
        }

        // ===== 4. PREPARAR HORARIO =====
        let horario_comision = null;

        // Solo crear horario si se proporcionan datos
        if (dias_semana && dias_semana.length > 0 && hora_inicio && hora_fin) {
            // Validar formato de hora
            const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!horaRegex.test(hora_inicio) || !horaRegex.test(hora_fin)) {
                return res.status(400).json({
                    ok: false,
                    msg: 'Formato de hora inválido. Use HH:MM (24 horas)'
                });
            }

            horario_comision = {
                dias_semana: [...dias_semana].sort((a, b) => a - b), // Ordenar días
                hora_inicio: hora_inicio.trim(),
                hora_fin: hora_fin.trim()
            };
        }

        // ===== 5. CREAR COMISIÓN =====
        const nuevaComision = new Comision_Model({
            nombre: nombre.trim(),
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            carrera: {
                id: carrera_id,
                version: carrera.version || "1.0.0"
            },
            carrera_info: {
                version: carrera.version || "1.0.0",
                fecha_snapshot: new Date(),
                nombre: carrera.nombre || '',
                duracion: carrera.duracion || '',
                titulo_certificacion: carrera.titulo_certificacion || '',
                modalidad: carrera.modalidad || 'part-time'
            },
            horario_comision: horario_comision,
            modalidad: modalidad,
            total_clases_generadas: 0, // Inicialmente cero
            progreso_carrera: progreso_carrera,
            coordinador_id: coordinador_id || null,
            estado: "Programada",
            creado_por: creado_por || null,
            fecha_creacion: new Date(),
            ultima_actualizacion: new Date()
        });

        // ===== 6. GUARDAR =====
        await nuevaComision.save();

        // ===== 7. RESPUESTA SIMPLE =====
        res.status(201).json({
            ok: true,
            msg: 'Comisión creada exitosamente',
            comision: {
                id: nuevaComision._id,
                nombre: nuevaComision.nombre,
                fecha_inicio: nuevaComision.fecha_inicio,
                fecha_fin: nuevaComision.fecha_fin,
                modalidad: nuevaComision.modalidad,
                estado: nuevaComision.estado,
                total_modulos: nuevaComision.progreso_carrera.length,
                necesita_clases: horario_comision !== null // Indica si necesita generar clases después
            }
        });

    } catch (error) {
        console.error('❌ Error en crearComision:', error);

        // Manejo específico de errores de MongoDB
        if (error.code === 11000) {
            return res.status(400).json({
                ok: false,
                msg: 'Ya existe una comisión con ese nombre'
            });
        }

        if (error.name === 'ValidationError') {
            const errores = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                ok: false,
                msg: 'Error de validación en los datos',
                errores: errores
            });
        }

        // Error genérico
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor al crear la comisión'
        });
    }
};

const numeroADia = (numero) => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[numero];
};

/**
 * ACTUALIZAR PROGRESO DE CARRERA EN COMISIÓN
 */
const actualizarProgresoComision = async (req, res) => {
    try {
        const { id } = req.params; // ID de la comisión
        const { progreso_carrera } = req.body;

        // Validar que progreso_carrera sea un array
        if (!Array.isArray(progreso_carrera)) {
            return res.status(400).json({
                ok: false,
                msg: 'progreso_carrera debe ser un array'
            });
        }

        // Validar estructura básica
        for (const moduloProg of progreso_carrera) {
            if (!moduloProg.modulo_id || !moduloProg.nombre_modulo) {
                return res.status(400).json({
                    ok: false,
                    msg: 'Cada módulo debe tener modulo_id y nombre_modulo'
                });
            }
        }

        // Buscar y actualizar la comisión
        const comisionActualizada = await Comision_Model.findByIdAndUpdate(
            id,
            {
                $set: {
                    progreso_carrera: progreso_carrera,
                    ultima_actualizacion: Date.now()
                }
            },
            {
                new: true, // Retornar el documento actualizado
                runValidators: true // Ejecutar validadores del esquema
            }
        ).select('nombre estado progreso_carrera carrera_info');

        if (!comisionActualizada) {
            return res.status(404).json({
                ok: false,
                msg: 'Comisión no encontrada'
            });
        }

        res.json({
            ok: true,
            msg: 'Progreso actualizado correctamente',
            comision: {
                id: comisionActualizada._id,
                nombre: comisionActualizada.nombre,
                estado: comisionActualizada.estado,
                progreso_carrera: comisionActualizada.progreso_carrera,
                carrera_info: comisionActualizada.carrera_info
            }
        });

    } catch (error) {
        console.error('❌ Error en actualizarProgresoComision:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

/**
 * OBTENER PROGRESO DE UNA COMISIÓN
 */
const obtenerProgresoComision = async (req, res) => {
    try {
        const { id } = req.params;

        const comision = await Comision_Model.findById(id)
            .select('progreso_carrera nombre estado carrera_info')
            .lean();

        if (!comision) {
            return res.status(404).json({
                ok: false,
                msg: 'Comisión no encontrada'
            });
        }

        res.json({
            ok: true,
            progreso: comision.progreso_carrera || [],
            comision: {
                id: comision._id,
                nombre: comision.nombre,
                estado: comision.estado,
                carrera_info: comision.carrera_info
            }
        });

    } catch (error) {
        console.error('❌ Error en obtenerProgresoComision:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

//obtiene todas las comisiones donde esta un usuario
const obtenerComisionesCompletasDeUsuario = async (req, res) => {
    try {
        const { usuarioId } = req.params;
        
      

        // Validar ID
        if (!mongoose.Types.ObjectId.isValid(usuarioId)) {
            return res.status(400).json({
                ok: false,
                msg: 'ID de usuario inválido'
            });
        }

        const usuarioObjectId = new mongoose.Types.ObjectId(usuarioId);

        // 1️⃣ Buscar TODAS las inscripciones del usuario (sin filtro de estado)
        const inscripciones = await Inscripcion_Model.find({
            usuario_id: usuarioObjectId
        })
        .select('comision_id fecha_inscripcion estado motivo_baja fecha_baja')
        .lean();

        

        // 2️⃣ Si no hay inscripciones, devolver array vacío
        if (!inscripciones.length) {
            return res.json({
                ok: true,
                comisiones: [],
                metadata: {
                    total: 0,
                    usuario_id: usuarioId,
                    mensaje: 'El usuario no tiene inscripciones en ninguna comisión'
                }
            });
        }

        // 3️⃣ Extraer IDs de comisiones
        const comisionesIds = inscripciones.map(insc => insc.comision_id);

        // 4️⃣ Buscar TODAS las comisiones (sin filtro de estado)
        const comisiones = await Comision_Model.find({
            _id: { $in: comisionesIds }
        })
        .populate({
            path: 'coordinador_id',
            select: 'nombres apellido email'
        })
        .populate({
            path: 'creado_por',
            select: 'nombres apellido email'
        })
        .select(`
            _id
            nombre
            fecha_inicio
            fecha_fin
            carrera
            carrera_info
            horario_comision
            modalidad
            estado
            total_alumnos
            total_profesores
            total_clases_generadas
            progreso_carrera
            coordinador_id
            creado_por
            fecha_creacion
            ultima_actualizacion
        `)
        .sort({ fecha_creacion: -1 })
        .lean();

        

        // 5️⃣ Formatear las comisiones (similar a obtenerComisiones)
        const comisionesFormateadas = comisiones.map(comision => {
            // Buscar la inscripción correspondiente
            const inscripcion = inscripciones.find(
                insc => insc.comision_id.toString() === comision._id.toString()
            );

            return {
                id: comision._id,
                _id: comision._id,
                nombre: comision.nombre,
                fecha_inicio: comision.fecha_inicio,
                fecha_fin: comision.fecha_fin,
                estado: comision.estado,
                modalidad: comision.modalidad,
                carrera: comision.carrera,
                carrera_id: comision.carrera?.id,
                carrera_info: comision.carrera_info,
                horario_comision: comision.horario_comision,
                progreso_carrera: comision.progreso_carrera || [],
                
                // Datos de inscripción
                inscripcion: {
                    fecha: inscripcion?.fecha_inscripcion,
                    estado: inscripcion?.estado,
                    motivo_baja: inscripcion?.motivo_baja,
                    fecha_baja: inscripcion?.fecha_baja
                },
                
                // Coordinador
                coordinador: comision.coordinador_id ? {
                    id: comision.coordinador_id._id,
                    nombres: comision.coordinador_id.nombres,
                    apellido: comision.coordinador_id.apellido,
                    email: comision.coordinador_id.email
                } : null,
                
                // Creado por
                creado_por: comision.creado_por ? {
                    id: comision.creado_por._id,
                    nombres: comision.creado_por.nombres,
                    apellido: comision.creado_por.apellido,
                    email: comision.creado_por.email
                } : null,
                
                // Estadísticas
                total_alumnos: comision.total_alumnos || 0,
                total_profesores: comision.total_profesores || 0,
                total_clases_generadas: comision.total_clases_generadas || 0,
                
                // Fechas
                fecha_creacion: comision.fecha_creacion,
                ultima_actualizacion: comision.ultima_actualizacion
            };
        });

        // 6️⃣ Agrupar por estado de inscripción para métricas
        const metricas = {
            total_inscripciones: inscripciones.length,
            activas: inscripciones.filter(i => i.estado === 'activo').length,
            inactivas: inscripciones.filter(i => i.estado === 'inactivo').length,
            egresados: inscripciones.filter(i => i.estado === 'egresado').length,
            abandono: inscripciones.filter(i => i.estado === 'abandono').length,
            suspendidos: inscripciones.filter(i => i.estado === 'suspendido').length
        };

        return res.json({
            ok: true,
            comisiones: comisionesFormateadas,
            metadata: {
                total_comisiones: comisionesFormateadas.length,
                total_inscripciones: inscripciones.length,
                usuario_id: usuarioId,
                metricas
            }
        });

    } catch (error) {
        console.error('❌ Error en obtenerComisionesCompletasDeUsuario:', error);
        return res.status(500).json({
            ok: false,
            msg: 'Error al obtener las comisiones del usuario',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};



module.exports = {
    crearComision,
    obtenerComisiones,
    obtenerComisionPorId,
    actualizarProgresoComision,
    obtenerProgresoComision,
    obtenerComisionesCompletasDeUsuario

};