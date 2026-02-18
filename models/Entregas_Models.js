// models/Entrega.js
const { model, Schema } = require('mongoose');

const entregaSchema = Schema({
    // ===== ALUMNO (datos embebidos para evitar joins) =====
    alumno: {
        usuario_id: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario',
            required: true,
            index: true
        },
        nombres: {
            type: String,
            required: true,
            trim: true
        },
        apellido: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            trim: true
        },
        dni: {
            type: String,
            trim: true
        }
    },

    // ===== COMISIÓN (datos embebidos) =====
    comision: {
        comision_id: {
            type: Schema.Types.ObjectId,
            ref: 'Comision',
            required: true,
            index: true
        },
        nombre: {
            type: String,
            required: true,
            trim: true
        }
    },

    // ===== MIEMBROS DEL GRUPO (para trabajos grupales) =====
    es_grupal: {
        type: Boolean,
        default: false,
        index: true
    },

    miembros: [{
        usuario_id: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario'
        },
        nombres: String,
        apellido: String,
        email: String,
        // Por si no está registrado en el sistema
        es_registrado: {
            type: Boolean,
            default: true
        }
    }],

    // ===== 🆕 MÓDULO ESPECÍFICO =====
    modulo: {
        modulo_id: {
            type: Schema.Types.ObjectId,
            ref: 'Modulo',  // Asumiendo que tienes un modelo de Módulos
            index: true
        },
        nombre: {
            type: String,
            trim: true
        },
        orden: {
            type: Number
        }
    },

    // ===== 🆕 CONTENIDO ESPECÍFICO =====
    contenido: {
        contenido_id: {
            type: Schema.Types.ObjectId,
            ref: 'Contenido',  // Asumiendo que tienes un modelo de Contenidos
            index: true
        },
        nombre: {
            type: String,
            trim: true
        },
        // Para mantener consistencia con el ID que viene del front
        contenido_id_str: {
            type: String,
            trim: true
        }
    },

    // ===== INFORMACIÓN DE LA ENTREGA =====
    trabajo_nombre: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    descripcion: {
        type: String,
        trim: true
    },

    tipo_entrega: {
        type: String,
        enum: ["github", "archivo"],
        required: true,
        index: true
    },

    // Para entrega tipo GitHub
    github_url: {
        type: String,
        trim: true,
    },

    archivo_url: {
        type: String,
        trim: true,
    },

    // ===== COMENTARIOS DEL ALUMNO =====
    comentarios: {
        type: String,
        trim: true
    },

    // ===== CALIFICACIÓN =====
    calificacion: {
        puntaje: {
            type: Number,
            min: 0,
            max: 100
        },
        comentario: {
            type: String,
            trim: true
        },
        fecha_calificacion: {
            type: Date
        },
        calificado_por: {
            type: Schema.Types.ObjectId,
            ref: 'Usuario'
        }
    },

    // ===== FEEDBACK (campo simple para compatibilidad) =====
    feedback: {
        type: String,
        trim: true
    },

    // ===== ESTADO DE LA ENTREGA =====
    estado: {
        type: String,
        enum: ["Borrador", "Entregado", "En revisión", "Calificado", "Rechazado", "Modificado"],
        default: "Borrador",
        index: true
    },

    // ===== FECHAS IMPORTANTES =====
    fecha_limite: {
        type: Date,
        index: true
    },

    fecha_entrega: {
        type: Date,
        default: Date.now,
        index: true
    },

}, {
    timestamps: { 
        createdAt: 'fecha_creacion', 
        updatedAt: 'ultima_actualizacion' 
    }
});



module.exports = model('Entrega', entregaSchema);