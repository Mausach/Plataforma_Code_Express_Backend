const express = require('express');

const { check } = require('express-validator');


const { validarCampos } = require('../midelwares/ValidarCampos');
const { loginUsuario } = require('../controllers/Users');
const { obtenerComisionesCompletasDeUsuario } = require('../controllers/Comisiones');
const { validarJWTAlu_Profe } = require('../midelwares/ValidarJWTProfes');
const { cargarEntregasDeUsuario, guardarEntrega } = require('../controllers/Entregas');

const routerAuth = express.Router();


//para logear usuario
routerAuth.post('/login',
    [
        check("email", "El email o nombre de usuario es obligatorio").not().isEmpty(),
        check("password", "La contraseña es obligatoria").not().isEmpty(),
        validarCampos
    ],
    loginUsuario
);

routerAuth.get('/usuario/:usuarioId/comisiones-completas', 
    validarJWTAlu_Profe, 
    obtenerComisionesCompletasDeUsuario
);

routerAuth.get('/entregas/usuario/:usuarioId', validarJWTAlu_Profe, cargarEntregasDeUsuario);

// POST /api/entregas - Guardar nueva entrega
routerAuth.post('/new-entrega', validarJWTAlu_Profe, guardarEntrega);

module.exports = routerAuth;