const express = require('express')

const { check } = require('express-validator');

const path = require('path');


//const { validarJWTAdmin } = require('../Midelwares/validarJwtAdmin');
//const { crearUsuario, inhabilitarUsuario, cargarAdmins, cargarProfesores, editarUsuario, habilitarUsuario, crearUnidadAcademica, editarUnidadAcademica, cargarUnidadesAcademicas } = require('../Controllers/admin');
//const multer = require('multer');
const { validarCampos } = require('../midelwares/ValidarCampos');
const { crearUsuario, actualizarUsuario, obtenerUsuarios, CambiarEstadoUsuario } = require('../controllers/Users');
const { obtenerCarreras, crearCarrera, actualizarCarrera, obtenerCarreraCompleta } = require('../controllers/Carreras');
const { validarJWTAdmin } = require('../midelwares/ValidarJWTAdmin');
const { obtenerComisiones, obtenerComisionPorId, crearComision, actualizarProgresoComision, obtenerProgresoComision } = require('../controllers/Comisiones');
const { generarClasesParaComision, obtenerClasesPorComision, actualizarClase } = require('../controllers/Clases');
const { getInscripcionesComisionCompletas, inscribirUsuario, darBajaInscripcion, getUsuariosDisponiblesParaComision, reactivarInscripcion } = require('../controllers/Inscripciones');
const { guardarAsistenciaBatch, obtenerAsistenciasPorClase } = require('../controllers/Asistensias');
const { validarJWTAdmin_profe } = require('../midelwares/ValidarJWTAdmin_profe');
const { cargarEntregasDeComision, calificarEntrega } = require('../controllers/Entregas');





const routerAdmin = express.Router();

//para crear usuario
routerAdmin.post('/new-user',validarJWTAdmin ,[
    check("nombres", "los nombres son onligatorios").not().isEmpty(),
    check("apellido", "el Apellido es onligatorios").not().isEmpty(),
    check("dni", "el DNI es onligatorios").not().isEmpty(),
    check("fecha_nacimiento", "la fecha de nacimiento es onligatoria").not().isEmpty(),
    check("genero", "el Genero es onligatorio").not().isEmpty(),
    check("telefono", "el Telefono es onligatorio").not().isEmpty(),
    check("provincia", "la Provincia es onligatoria").not().isEmpty(),
    check("rol", "el Rol o Ocupacion es onligatorio").not().isEmpty(),
    check("email", "el email es obligatorio").not().isEmpty(),
    check("password", "la pasword debe ser de minimo 5").isLength({
        min: 5,
    }),
    validarCampos
], crearUsuario);

//para editar usuario
routerAdmin.put('/update-user', validarJWTAdmin,[
    check("_id", "ID de usuario inválido").isMongoId(),
    check("nombres", "los nombres son obligatorios").optional().not().isEmpty(),
    check("apellido", "el Apellido es obligatorio").optional().not().isEmpty(),
    check("dni", "el DNI es obligatorio").optional().not().isEmpty(),
    check("fecha_nacimiento", "la fecha de nacimiento es obligatoria").optional().not().isEmpty(),
    check("genero", "el Genero es obligatorio").optional().not().isEmpty(),
    check("telefono", "el Telefono es obligatorio").optional().not().isEmpty(),
    check("provincia", "la Provincia es obligatoria").optional().not().isEmpty(),
    check("rol", "el Rol es obligatorio").optional().not().isEmpty(),
    check("email", "el email es obligatorio").optional().not().isEmpty(),
    validarCampos
], actualizarUsuario);



routerAdmin.get('/get-users',validarJWTAdmin ,obtenerUsuarios);
//routerAdmin.get('/productos/aleatorios', cargarProducto_Aleatorio);

//routerAdmin.put('/Deshabilitar', /*validarJWTAdmin*/ bajaLogicaUsuario);

//routerAdmin.put('/Habilitar', /*validarJWTAdmin,*/ reactivarUsuario);

routerAdmin.put('/change-state', validarJWTAdmin,CambiarEstadoUsuario);


//para carreras:


// En tu archivo de rutas (ej: routes/carrera.routes.js)
routerAdmin.put('/update-carrera', [
    // Validaciones
    check("_id", "ID de carrera inválido").isMongoId(),
    check("nombre", "El nombre es obligatorio").optional().not().isEmpty(),
    check("descripcion", "La descripción es obligatoria").optional().not().isEmpty(),
    check("duracion", "La duración es obligatoria").optional().not().isEmpty(),
    check("clases_por_semana", "Las clases por semana son obligatorias").optional().isInt({ min: 1 }),
    check("duracion_de_cada_clase", "La duración de cada clase es obligatoria").optional().not().isEmpty(),
    check("titulo_certificacion", "El título de certificación es obligatorio").optional().not().isEmpty(),
    check("precio", "El precio es obligatorio").optional().not().isEmpty(),
    check("modalidad", "La modalidad es obligatoria").optional().isIn(["part-time", "full-time", "grabado"]),
    check("estado", "El estado es obligatorio").optional().isIn(["Activo", "Inactivo", "En desarrollo", "Archivado"]),
    
    // Validar estructura de módulos si se proporcionan
    check("modulos").optional().isArray().withMessage("Los módulos deben ser un array"),
    check("modulos.*.nombre").optional().not().isEmpty().withMessage("Cada módulo debe tener un nombre"),
    check("modulos.*.orden").optional().isInt({ min: 1 }).withMessage("El orden del módulo debe ser un número positivo"),
    check("modulos.*.estado").optional().isIn(["Activo", "Inactivo", "En desarrollo"]).withMessage("Estado de módulo inválido"),
    
    // Validar estructura de contenidos si se proporcionan
    check("modulos.*.contenidos").optional().isArray().withMessage("Los contenidos deben ser un array"),
    check("modulos.*.contenidos.*.nombre").optional().not().isEmpty().withMessage("Cada contenido debe tener un nombre"),
    check("modulos.*.contenidos.*.estado").optional().isBoolean().withMessage("El estado del contenido debe ser booleano"),
    
    validarCampos // Tu middleware de validación de campos
], actualizarCarrera);


// OBTENER TODAS LAS CARRERAS
routerAdmin.get('/get-carreras', validarJWTAdmin,obtenerCarreras);

// CREAR CARRERA (estilo "obligatorio" como el ejemplo)
routerAdmin.post('/new-carrera', [
    // TODOS obligatorios según el modelo
    check("nombre", "El nombre de la carrera es obligatorio").not().isEmpty(),
    check("descripcion", "La descripción es obligatoria").not().isEmpty(),
    check("duracion", "La duración es obligatoria").not().isEmpty(),
    check("clases_por_semana", "Las clases por semana son obligatorias").not().isEmpty(),
    check("duracion_de_cada_clase", "La duración de cada clase es obligatoria").not().isEmpty(),
    check("titulo_certificacion", "El título/certificación es obligatorio").not().isEmpty(),
    check("precio", "El precio es obligatorio").not().isEmpty(),
    check("modalidad", "La modalidad es obligatoria").not().isEmpty(),
    
    // Validaciones adicionales simples
    check("modalidad", "Modalidad inválida").isIn(['part-time', 'full-time', 'grabado']),
    check("clases_por_semana", "Las clases por semana deben ser un número").isNumeric(),
    
    validarCampos
], crearCarrera);

// OBTENER TODAS LAS COMISIONES
routerAdmin.get('/get-comisiones', validarJWTAdmin,obtenerComisiones);
routerAdmin.post('/get-comision', validarJWTAdmin, obtenerComisionPorId);

routerAdmin.get('/:id/completa', obtenerCarreraCompleta);

routerAdmin.post('/new-comision', validarJWTAdmin, [
    // VALIDACIONES ACTUALIZADAS:
    check("nombre", "El nombre de la comisión es obligatorio").not().isEmpty(),
    check("nombre", "El nombre debe tener al menos 3 caracteres").isLength({ min: 3 }),
    check("nombre", "El nombre debe tener máximo 100 caracteres").isLength({ max: 100 }),
    
    check("fecha_inicio", "La fecha de inicio es obligatoria").not().isEmpty(),
    check("fecha_inicio", "Fecha de inicio inválida").isISO8601(),
    
    check("fecha_fin", "La fecha de fin es obligatoria").not().isEmpty(),
    check("fecha_fin", "Fecha de fin inválida").isISO8601(),
    
    // CAMBIO IMPORTANTE: carrera_id en lugar de carrera
    check("carrera_id", "La carrera es obligatoria").not().isEmpty(),
    check("carrera_id", "El ID de carrera no es válido").isMongoId(),
    
    // Días de semana ahora es opcional (para modalidad grabada)
    check("dias_semana", "Debe ser un array de números")
        .optional()
        .isArray(),
    check("dias_semana.*", "Cada día debe ser número entre 0 y 6")
        .optional()
        .isInt({ min: 0, max: 6 }),
    
    // Horas ahora son opcionales (para modalidad grabada)
    check("hora_inicio", "La hora de inicio es obligatoria para comisiones presenciales")
        .optional()
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    check("hora_fin", "La hora de fin es obligatoria para comisiones presenciales")
        .optional()
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    
    check("modalidad", "La modalidad debe ser 'Full-Time' o 'Part-Time'")
        .isIn(['Full-Time', 'Part-Time']),
    
    // Nuevos campos opcionales:
    check("coordinador_id", "ID de coordinador inválido")
        .optional()
        .isMongoId(),
    check("creado_por", "ID de creador inválido")
        .optional()
        .isMongoId(),
    
    validarCampos
], crearComision);

//para generar las clases
routerAdmin.post('/comisiones/:id/generar-clases', validarJWTAdmin, [
    check("dias_semana", "Debe especificar días de la semana").isArray(),
    check("dias_semana.*", "Cada día debe ser número entre 0 y 6").isInt({ min: 0, max: 6 }),
    check("hora_inicio", "Hora de inicio requerida").not().isEmpty(),
    check("hora_inicio", "Formato de hora inválido").matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    check("hora_fin", "Hora de fin requerida").not().isEmpty(),
    check("hora_fin", "Formato de hora inválido").matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    validarCampos
], generarClasesParaComision); // Necesitas crear este controller

routerAdmin.get('/comisiones/:id/inscripciones-completas',validarJWTAdmin_profe,getInscripcionesComisionCompletas)

routerAdmin.put('/comisiones/:id/progreso',validarJWTAdmin_profe, actualizarProgresoComision);
routerAdmin.get('/:id/progreso',validarJWTAdmin, obtenerProgresoComision);

//para inscripciones

routerAdmin.get('/disponibles-para-comision/:comisionId', 
    validarJWTAdmin,
    getUsuariosDisponiblesParaComision
);

routerAdmin.post('/nueva-inscripcion', validarJWTAdmin, [
    check('comision_id', 'El ID de la comisión es obligatorio').not().isEmpty(),
    check('comision_id', 'El ID de la comisión no es válido').isMongoId(),
    check('usuario_id', 'El ID del usuario es obligatorio').not().isEmpty(),
    check('usuario_id', 'El ID del usuario no es válido').isMongoId(),
    validarCampos
], inscribirUsuario);


routerAdmin.put('/inscripciones/baja/:id', validarJWTAdmin, [
    check('id', 'El ID de la inscripción no es válido').isMongoId(),
    check('estado', 'El estado es obligatorio').not().isEmpty(),
    check('estado', 'Estado no válido').isIn(['inactivo', 'egresado', 'abandono', 'suspendido']),
    check('motivo_baja', 'El motivo de baja debe ser un texto').optional().isString(),
    check('motivo_baja', 'El motivo de baja no puede exceder los 500 caracteres').optional().isLength({ max: 500 }),
    validarCampos
], darBajaInscripcion);

// Agrega esta ruta a tus rutas de inscripciones
routerAdmin.put('/inscripciones/:id/reactivar', validarJWTAdmin, reactivarInscripcion);


// Ruta para obtener clases de una comisión
routerAdmin.get('/clases/comision/:comisionId', validarJWTAdmin_profe, obtenerClasesPorComision);

routerAdmin.put('/clases/:claseId', validarJWTAdmin, actualizarClase);  // 👈 NUEVA RUTA

// ===== RUTAS DE ASISTENCIA =====
routerAdmin.post('/clases/:claseId/asistencia/batch', validarJWTAdmin_profe, guardarAsistenciaBatch);
routerAdmin.get('/clases/:claseId/asistencias', validarJWTAdmin, obtenerAsistenciasPorClase);

routerAdmin.get(
    '/entregas/comision/:comisionId', 
    validarJWTAdmin_profe, 
    cargarEntregasDeComision
);

// PUT /api/entregas/:id/calificar - Calificar una entrega
routerAdmin.put(
    '/entregas/:id/calificar', 
    validarJWTAdmin_profe, 
    calificarEntrega
);


//aclaras que se exporta todo lo trabajado con router
module.exports = routerAdmin;

