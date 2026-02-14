// models/Asistencia.js
const { model, Schema } = require('mongoose');

const asistenciaSchema = Schema({
    // ===== REFERENCIAS PRINCIPALES =====
    clase_id: {
        type: Schema.Types.ObjectId,
        ref: 'Clase',
        required: true,
        index: true
    },
    
    usuario_id: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        index: true
    },
    
    
    presente: {
        type: Boolean,
        default: false,
        index: true
    },
    
   

});

module.exports = model('Asistencia', asistenciaSchema);