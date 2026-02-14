// models/Clase.js
const { model, Schema } = require('mongoose');

const claseSchema = Schema({
    // ===== REFERENCIA A COMISIÓN =====
    comision_id: {
        type: Schema.Types.ObjectId,
        ref: 'Comision',
        required: true,
        index: true
    },
    
    // ===== FECHA Y HORARIO =====
    fecha: {
        type: Date,
        required: true,
        index: true
    },
    
    horario_inicio: {
        type: String,
        required: true,
        trim: true,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    
    horario_fin: {
        type: String,
        required: true,
        trim: true,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    
    // ===== CONTENIDO DE LA CLASE =====
    tema: {
        type: String,
        trim: true
    },
    
    descripcion: {
        type: String,
        trim: true
    },
    
    
    // ===== PROFESOR RESPONSABLE =====
    profesor_id: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario'
    },
    
    profesor_nombre_cache: {  // Cache para display rápido
        type: String,
        trim: true
    },
    
    // ===== ESTADO =====
    estado: {
        type: String,
        enum: ["Programada", "Realizada", "Cancelada", "Reprogramada", "En curso"],
        default: "Programada",
        index: true
    },
    
    fecha_realizacion: {  // Si fue reprogramada
        type: Date
    },
    
    motivo_cancelacion: {
        type: String,
        trim: true
    },
    

});


module.exports = model('Clase', claseSchema);