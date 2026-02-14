const { model, Schema } = require('mongoose');
const mongoose = require('mongoose');

const carreraSchema = Schema({
    // Información básica (igual)
    nombre: { type: String, required: true, trim: true, unique: true },
    descripcion: { type: String, required: true, trim: true },
    duracion: { type: String, required: true },
    clases_por_semana: { type: Number, required: true, min: 1 },
    duracion_de_cada_clase: { type: String, required: true },
    titulo_certificacion: { type: String, required: true, trim: true },
    precio: { type: String, required: true, trim: true },
    modalidad: { type: String, enum: ["part-time", "full-time", "grabado"], required: true },
    requisitos: [{ type: String, trim: true }],

    // ===== CAMBIO CLAVE: Módulos SIN estados de progreso =====
    modulos: [{
        _id: {  // 🔥 OBLIGATORIO: ID único para cada módulo
            type: Schema.Types.ObjectId,
            default: () => new mongoose.Types.ObjectId()
        },
        nombre: { type: String, required: true, trim: true },
        descripcion: { type: String, trim: true },
        orden: { type: Number, required: true },
        // ⚠️ ELIMINADO: estado (esto NO va aquí, va en la comisión)
        // estado: { type: String, enum: ["Activo", "Inactivo"] } ❌ QUITAR
        
        // Contenidos SIN estados booleanos
        contenidos: [{
            _id: {  // 🔥 OBLIGATORIO: ID único para cada contenido
                type: Schema.Types.ObjectId,
                default: () => new mongoose.Types.ObjectId()
            },
            nombre: { type: String, required: true, trim: true },
            // ⚠️ ELIMINADO: estado (esto NO va aquí, va en la comisión)
            // estado: { type: Boolean } ❌ QUITAR
            
            // Recursos (estos SÍ pueden estar aquí)
            clase: {
                diapositivas: [{ type: String }]
            },
            autoaprendizaje: {
                guia_estudio: { type: String }
            },
            tutoria: {
                diapositivas: [{ type: String }],
                apoyo: { type: String },
                proyectos: [{
                    tarea: { type: String, required: true },
                    solucion: { type: String }
                }]
            }
        }]
    }],

    // ===== NUEVO: Versionado OBLIGATORIO =====
    version: {
        type: String,
        required: true,
        default: "1.0.0"  // Formato: AÑO.MES.REVISION (ej: "2024.1.0")
    },
    fecha_version: {
        type: Date,
        default: Date.now
    },

    // Estado de la carrera como PRODUCTO (sí puede estar aquí)
    estado: {
        type: String,
        enum: ["Activo", "Inactivo", "En desarrollo", "Archivado"],
        default: 'En desarrollo'
    },

    // Fechas de auditoría
    fecha_creacion: { type: Date, default: Date.now },
    fecha_actualizacion: { type: Date, default: Date.now }

});

module.exports = model('Carrera', carreraSchema);