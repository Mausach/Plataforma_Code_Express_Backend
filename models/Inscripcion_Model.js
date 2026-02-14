// models/Inscripcion.js
const { model, Schema } = require('mongoose');

const inscripcionSchema = Schema({
    // ===== REFERENCIAS PRINCIPALES =====
    comision_id: {
        type: Schema.Types.ObjectId,
        ref: 'Comision',
        required: true,
        index: true
    },
    
    usuario_id: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        index: true
    },
    
    
    // ===== ESTADO EN ESTA COMISIÓN =====
    estado: {
        type: String,
        enum: ["activo", "inactivo", "egresado", "abandono", "suspendido"],
        default: "activo",
        index: true
    },
    
    fecha_inscripcion: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    fecha_baja: {
        type: Date
    },
    
    motivo_baja: {
        type: String,
        trim: true
    },
    

}, {
    timestamps: { createdAt: 'fecha_creacion', updatedAt: 'ultima_actualizacion' }
});


module.exports = model('Inscripcion', inscripcionSchema);