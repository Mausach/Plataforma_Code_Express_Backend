const mongoose = require("mongoose");
const Carreras_Model = require("../models/Carreras_Model");
const Clases_Model = require("../models/Clases_Model");
const Comision_Model = require("../models/Comision_Model");


// ========== HELPER FUNCTIONS ==========
const numeroADia = (numero) => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[numero] || 'Desconocido';
};

// Calcular fechas de clases
const calcularFechasClases = (fechaInicio, fechaFin, diasSemana) => {
    const fechas = [];
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    
    // Asegurar que la fecha inicial sea un día de clase
    let fechaActual = new Date(inicio);
    while (fechaActual <= fin && !diasSemana.includes(fechaActual.getDay())) {
        fechaActual.setDate(fechaActual.getDate() + 1);
    }
    
    // Generar todas las fechas
    while (fechaActual <= fin) {
        const diaSemana = fechaActual.getDate();
        
        if (diasSemana.includes(fechaActual.getDay())) {
            fechas.push(new Date(fechaActual));
        }
        
        fechaActual.setDate(fechaActual.getDate() + 1);
    }
    
    return fechas;
};

// ========== CONTROLLER  ==========

// 4. GENERAR CLASES PARA COMISIÓN - SEPARADO (OPTIMIZADO)
const generarClasesParaComision = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            dias_semana, 
            hora_inicio, 
            hora_fin,
            modulos_carrera 
        } = req.body;

        // SOLO 2 CONSULTAS: Comisión y verificar si ya tiene clases
        const [comision, clasesExistentes] = await Promise.all([
            Comision_Model.findById(id)
                .select('fecha_inicio fecha_fin modalidad carrera.id')
                .lean(),
            Clases_Model.findOne({ id }).select('_id').lean()
        ]);

        if (!comision) {
            return res.status(404).json({
                ok: false,
                msg: 'Comisión no encontrada'
            });
        }

        if (clasesExistentes) {
            return res.status(400).json({
                ok: false,
                msg: 'Esta comisión ya tiene clases generadas'
            });
        }

        if (comision.modalidad === 'grabado') {
            return res.status(400).json({
                ok: false,
                msg: 'Comisiones grabadas no requieren clases programadas'
            });
        }

        // Calcular fechas
        const fechasClases = calcularFechasClases(
            comision.fecha_inicio,
            comision.fecha_fin,
            dias_semana || [1, 3, 5] // Por defecto: Lunes, Miércoles, Viernes
        );

        if (fechasClases.length === 0) {
            return res.status(400).json({
                ok: false,
                msg: 'No se pudieron generar fechas de clase con los parámetros dados'
            });
        }

        // Obtener módulos de carrera si no vienen en request
        let modulos = modulos_carrera;
        if (!modulos) {
            const carrera = await Carreras_Model.findById(comision.carrera.id)
                .select('modulos')
                .lean();
            modulos = carrera?.modulos || [];
        }

        // Preparar bulk insert de clases (MUCHO MÁS EFICIENTE)
        const clasesParaInsertar = [];
        let indiceModulo = 0;
        let indiceContenido = 0;
        const tieneModulos = modulos.length > 0;

        for (let i = 0; i < fechasClases.length; i++) {
            let tema = `Clase ${i + 1}`;
            
            if (tieneModulos) {
                const modulo = modulos[indiceModulo];
                if (modulo && modulo.contenidos && modulo.contenidos.length > indiceContenido) {
                    tema = `${modulo.nombre} - ${modulo.contenidos[indiceContenido].nombre}`;
                } else {
                    tema = modulo?.nombre || tema;
                }
                
                indiceContenido++;
                if (!modulo?.contenidos || indiceContenido >= modulo.contenidos.length) {
                    indiceContenido = 0;
                    indiceModulo = (indiceModulo + 1) % modulos.length;
                }
            }
            
            clasesParaInsertar.push({
                comision_id: id,
                fecha: fechasClases[i],
                horario_inicio: hora_inicio || '09:00',
                horario_fin: hora_fin || '13:00',
                tema: tema,
                estado: "Programada"
            });
        }

        // INSERT MASIVO (1 operación)
        if (clasesParaInsertar.length > 0) {
            await Clases_Model.insertMany(clasesParaInsertar);
            
            // Actualizar comisión (1 operación más)
            await Comision_Model.findByIdAndUpdate(id, {
                total_clases_generadas: clasesParaInsertar.length,
                'horario_comision.dias_semana': dias_semana,
                'horario_comision.hora_inicio': hora_inicio,
                'horario_comision.hora_fin': hora_fin,
                ultima_actualizacion: new Date()
            });
        }

        res.json({
            ok: true,
            msg: 'Clases generadas exitosamente',
            total_clases: clasesParaInsertar.length,
            primera_clase: fechasClases[0],
            ultima_clase: fechasClases[fechasClases.length - 1],
            dias_semana: (dias_semana || []).map(numeroADia),
            horario: `${hora_inicio || '09:00'} - ${hora_fin || '13:00'}`
        });

    } catch (error) {
        console.error('❌ Error en generarClasesParaComision:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno al generar clases'
        });
    }
};


const obtenerClasesPorComision = async (req, res) => {
    try {
        const { comisionId } = req.params;
        

        // 1. Validar ID
        if (!mongoose.Types.ObjectId.isValid(comisionId)) {
            console.log('❌ ID no válido:', comisionId);
            return res.status(400).json({
                success: false,
                msg: 'ID de comisión no válido'
            });
        }

        // 2. Buscar clases - SIN populate, SIN lean, SIN nada raro
        const clases = await Clases_Model.find({ 
            comision_id: comisionId 
        }).sort({ 
            fecha: -1 
        });

        

        // 3. Responder
        return res.json({
            success: true,
            count: clases.length,
            data: clases
        });

    } catch (error) {
        // 4. Error detallado
    
        return res.status(500).json({
            success: false,
            msg: 'Error al obtener las clases',
            error: error.message // Temporal para debug
        });
    }
};

const actualizarClase = async (req, res) => {
    try {
        const { claseId } = req.params;
        const { 
            tema, 
            descripcion, 
            fecha, 
            horario_inicio, 
            horario_fin, 
            estado 
        } = req.body;


        // 1. Validar ID
        if (!mongoose.Types.ObjectId.isValid(claseId)) {
            console.log('❌ ID de clase no válido:', claseId);
            return res.status(400).json({
                success: false,
                msg: 'ID de clase no válido'
            });
        }

        // 2. Verificar que la clase existe
        const claseExistente = await Clases_Model.findById(claseId);
        if (!claseExistente) {
            console.log('❌ Clase no encontrada:', claseId);
            return res.status(404).json({
                success: false,
                msg: 'Clase no encontrada'
            });
        }

        // 3. Preparar objeto de actualización (solo campos que vienen)
        const datosActualizados = {};
        
        if (tema !== undefined) datosActualizados.tema = tema;
        if (descripcion !== undefined) datosActualizados.descripcion = descripcion;
        if (fecha !== undefined) datosActualizados.fecha = new Date(fecha);
        if (horario_inicio !== undefined) datosActualizados.horario_inicio = horario_inicio;
        if (horario_fin !== undefined) datosActualizados.horario_fin = horario_fin;
        if (estado !== undefined) datosActualizados.estado = estado;

        // 4. Si el estado cambia a "Realizada", registrar fecha de realización
        if (estado === 'Realizada' && claseExistente.estado !== 'Realizada') {
            datosActualizados.fecha_realizacion = new Date();
        }

        // 5. Si el estado cambia a "Cancelada" y no hay motivo, poner uno por defecto
        if (estado === 'Cancelada' && !req.body.motivo_cancelacion) {
            datosActualizados.motivo_cancelacion = 'Cancelada por administrador';
        }

      

        // 6. Actualizar la clase
        const claseActualizada = await Clases_Model.findByIdAndUpdate(
            claseId,
            datosActualizados,
            { 
                new: true,           // Devuelve el documento actualizado
                runValidators: true  // Ejecuta validaciones del schema
            }
        );

       

        // 7. Responder con éxito
        return res.status(200).json({
            success: true,
            msg: 'Clase actualizada correctamente',
            data: claseActualizada
        });

    } catch (error) {
        console.error('💥 Error en actualizarClase:', {
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
            msg: 'Error interno del servidor al actualizar la clase'
        });
    }
};



module.exports = {
    
    generarClasesParaComision,
    obtenerClasesPorComision,
    actualizarClase
    
};