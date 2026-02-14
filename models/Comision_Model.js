const { model, Schema } = require('mongoose');

const comisionSchema = Schema({
    // Información básica
    nombre: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },

    fecha_inicio: {
        type: Date,
        required: true
    },

    fecha_fin: {
        type: Date,
        required: true
    },

    // RELACIÓN CON CARRERA
    // ===== CARRERA CON VERSIÓN =====
    carrera: {
        id: {
            type: Schema.Types.ObjectId,
            ref: 'Carrera',
            required: true,
            index: true
        },
        version: {
            type: String,
            required: true,
            default: "1.0.0"
        }
    },

    // Datos mínimos de la carrera snapshot
    carrera_info: {
        version: {
            type: String,
            required: true
        },
        fecha_snapshot: {
            type: Date,
            default: Date.now
        },
        nombre: {
            type: String,
            trim: true
        },
        duracion: {
            type: String
        },
        titulo_certificacion: {
            type: String,
            trim: true
        },
        modalidad: {
            type: String,
            enum: ["part-time", "full-time", "grabado"]
        }
    },

    // Configuración de horario
    horario_comision: {
        dias_semana: [{
            type: Number, // 0=Domingo, 1=Lunes, 2=Martes, etc.
            min: 0,
            max: 6
        }],
        hora_inicio: { type: String, trim: true },
        hora_fin: { type: String, trim: true }
    },

    modalidad: {
        type: String,
        enum: ["Full-Time", "Part-Time"],
        default: "Full-Time"
    },

    total_clases_generadas: { type: Number, default: 0 },
    total_alumnos: { type: Number, default: 0 },
    total_profesores: { type: Number, default: 0 },

    // PROGRESO DE CARRERA (SIMPLIFICADO)
    // ===== PROGRESO DE CARRERA (por IDs) =====
    progreso_carrera: [{
        modulo_id: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true
        },
        orden_modulo: {
            type: Number,
            required: true
        },
        nombre_modulo: {
            type: String,
            required: true,
            trim: true
        },
        estado_modulo: {
            type: Boolean,
            default: false,//para hacerlo desactivado.

        },


        contenidos: [{
            contenido_id: {
                type: Schema.Types.ObjectId,
                required: true,
                index: true
            },
            nombre_contenido: {
                type: String,
                required: true,
                trim: true
            },
            estado_contenido: {
                type: Boolean,
                default: false,//desactivado

            },

        }]
    }],

    // COORDINADOR
    // ===== PERSONAL (SOLO REFERENCIAS) =====
    coordinador_id: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario',
        index: true
    },

    // Estado
    estado: {
        type: String,
        enum: ["Programada", "En curso", "Finalizada", "Cancelada"],
        default: "Programada"
    },

    // Auditoría
    creado_por: {
        type: Schema.Types.ObjectId,
        ref: 'Usuario'
    },
    fecha_creacion: {
        type: Date,
        default: Date.now
    },
    ultima_actualizacion: {
        type: Date,
        default: Date.now
    }

});


module.exports = model('Comision', comisionSchema);