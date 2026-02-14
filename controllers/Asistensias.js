// controllers/asistenciaController.js
const mongoose = require('mongoose');
const Clases_Model = require('../models/Clases_Model');
const Asistencias_Models = require('../models/Asistencias_Models');


const guardarAsistenciaBatch = async (req, res) => {
    try {
        const { claseId } = req.params;
        const { asistencias } = req.body;

        // ===== 1. VALIDACIONES =====
        if (!mongoose.Types.ObjectId.isValid(claseId)) {
            return res.status(400).json({
                success: false,
                msg: 'ID de clase no válido'
            });
        }

        if (!asistencias || !Array.isArray(asistencias) || asistencias.length === 0) {
            return res.status(400).json({
                success: false,
                msg: 'Debe enviar al menos una asistencia'
            });
        }

        // ===== 2. VERIFICAR QUE LA CLASE EXISTE =====
        const claseExistente = await Clases_Model.findById(claseId);
        if (!claseExistente) {
            return res.status(404).json({
                success: false,
                msg: 'Clase no encontrada'
            });
        }

        // ===== 3. VALIDAR CADA ASISTENCIA =====
        const asistenciasValidas = [];
        const errores = [];

        for (const [index, asistencia] of asistencias.entries()) {
            // Validar que tenga usuario_id
            if (!asistencia.usuario_id) {
                errores.push(`Fila ${index + 1}: Falta ID de usuario`);
                continue;
            }

            // Validar que el usuario_id sea válido
            if (!mongoose.Types.ObjectId.isValid(asistencia.usuario_id)) {
                errores.push(`Fila ${index + 1}: ID de usuario no válido`);
                continue;
            }

            // Validar que presente sea booleano
            if (asistencia.presente !== undefined && typeof asistencia.presente !== 'boolean') {
                errores.push(`Fila ${index + 1}: El valor de presente debe ser true o false`);
                continue;
            }

            asistenciasValidas.push({
                clase_id: claseId,
                usuario_id: asistencia.usuario_id,
                presente: asistencia.presente === true // false por defecto
            });
        }

        // Si hay errores de validación, responder con los errores
        if (errores.length > 0) {
            console.log('❌ Errores de validación:', errores);
            return res.status(400).json({
                success: false,
                msg: 'Error en los datos de asistencia',
                errores: errores
            });
        }

        // ===== 4. OPERACIÓN BATCH =====

        // Usamos Promise.all para operaciones en paralelo
        const operaciones = asistenciasValidas.map(asistencia =>
            Asistencias_Models.findOneAndUpdate(
                {
                    clase_id: asistencia.clase_id,
                    usuario_id: asistencia.usuario_id
                },
                {
                    $set: {
                        presente: asistencia.presente
                    }
                },
                {
                    upsert: true,        // Crear si no existe
                    new: true,          // Devolver el documento actualizado
                    runValidators: true // Ejecutar validaciones del schema
                }
            )
        );

        const resultados = await Promise.all(operaciones);


        // ===== 5. ACTUALIZAR ESTADO DE LA CLASE SI ES NECESARIO =====
        // Si la clase está "Programada" y se está tomando asistencia, la pasamos a "Realizada"
        if (claseExistente.estado === 'Programada' && asistenciasValidas.length > 0) {
            await Clase.findByIdAndUpdate(claseId, {
                estado: 'Realizada',
                fecha_realizacion: new Date()
            });
        }

        // ===== 6. CONTAR PRESENTES Y AUSENTES PARA RESPUESTA =====
        const presentes = resultados.filter(r => r.presente === true).length;
        const ausentes = resultados.filter(r => r.presente === false).length;

        // ===== 7. RESPUESTA EXITOSA =====
        return res.status(200).json({
            success: true,
            msg: 'Asistencia guardada correctamente',
            data: {
                clase_id: claseId,
                total_procesadas: resultados.length,
                total_presentes: presentes,
                total_ausentes: ausentes,
                asistencias: resultados.map(a => ({
                    _id: a._id,
                    usuario_id: a.usuario_id,
                    presente: a.presente,
                    clase_id: a.clase_id
                }))
            }
        });

    } catch (error) {
        console.error('💥 Error en guardarAsistenciaBatch:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        // Manejar errores de validación de Mongoose
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                msg: 'Error de validación',
                errors: errors
            });
        }

        // Error genérico
        return res.status(500).json({
            success: false,
            msg: 'Error interno del servidor al guardar la asistencia'
        });
    }
};


const obtenerAsistenciasPorClase = async (req, res) => {
    try {
        const { claseId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(claseId)) {
            return res.status(400).json({
                success: false,
                msg: 'ID de clase no válido'
            });
        }

        const asistencias = await Asistencias_Models.find({ clase_id: claseId })
            .populate({
                path: 'usuario_id',
                select: 'nombres apellido email dni'
            })
            .lean();

        // Formatear respuesta
        const asistenciasFormateadas = asistencias.map(a => ({
            _id: a._id,
            usuario_id: a.usuario_id._id,
            nombre_completo: `${a.usuario_id.nombres} ${a.usuario_id.apellido}`,
            dni: a.usuario_id.dni,
            email: a.usuario_id.email,
            presente: a.presente,
            clase_id: a.clase_id
        }));

        return res.json({
            success: true,
            count: asistenciasFormateadas.length,
            data: asistenciasFormateadas
        });

    } catch (error) {
        console.error('💥 Error en obtenerAsistenciasPorClase:', error);
        return res.status(500).json({
            success: false,
            msg: 'Error al obtener las asistencias'
        });
    }
};

module.exports = {
    guardarAsistenciaBatch,
    obtenerAsistenciasPorClase
};