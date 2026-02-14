const { model, Schema } = require('mongoose')

const usuarioSchema = Schema({
    
    nombres: {
        type: String,
        require: true,
    },

    apellido: {
        type: String,
        require: true,
    },

    dni: {
        type: String,
        require: true,
    },

    fecha_nacimiento: {
        type: String,
        require: true,
    },

    genero: {
        type: String,
        require: true,
    },

    telefono: {
        type: String,
        require: true,
    },

    provincia: {
        type: String,
        require: true,
    },

    rol: {
        type: String,
        enum: ["admin", "acompañante", "cordinador", "corrector", "profe", "alumno"],
        default: 'alumno',
    },

    email: {
        type: String,
        require: true,
        unique: true,
    },

    password: {
        type: String,
        require: true,
    },

    estado: {
        type: Boolean,
        default: true,
    },


});

module.exports = model('Usuario', usuarioSchema);