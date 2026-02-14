const mongoose = require("mongoose");
const Comision_Model = require("../models/Comision_Model");
const Inscripcion = require("../models/Inscripcion_Model");
const Usuario_Model = require("../models/Usuario_Model");

// obtiene todos los datos de todos los alumnos inscriptos de una comision.
// controllers/Inscripciones.js - MODIFICAR
const getInscripcionesComisionCompletas = async (req, res) => {
    try {
        const { id } = req.params;


        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                msg: 'ID de comisión no válido'
            });
        }

        const comisionObjectId = new mongoose.Types.ObjectId(id);

        // ✅ IMPORTANTE: Incluir fecha_baja y motivo_baja en el select
        const inscripciones = await Inscripcion.find({
            comision_id: comisionObjectId
            // ⚠️ NOTA: Quitamos el filtro por estado "activo" para traer TODAS
        })
            .populate({
                path: 'usuario_id',
                select: 'nombres apellido email dni telefono rol',
                match: { estado: true }
            })
            .select('estado fecha_inscripcion fecha_baja motivo_baja') // ← AGREGAR campos
            .lean();

        // Filtrar usuarios nulos
        const inscripcionesValidas = inscripciones.filter(ins => ins.usuario_id);

        const alumnos = [];
        const profesores = [];

        inscripcionesValidas.forEach(inscripcion => {
            const usuario = inscripcion.usuario_id;
            const item = {
                inscripcion_id: inscripcion._id,
                usuario_id: usuario._id,
                nombre_completo: `${usuario.nombres} ${usuario.apellido}`,
                email: usuario.email,
                dni: usuario.dni,
                telefono: usuario.telefono,
                rol: usuario.rol,
                fecha_inscripcion: inscripcion.fecha_inscripcion,
                estado_inscripcion: inscripcion.estado,  // ← Este es el campo clave
                fecha_baja: inscripcion.fecha_baja,      // ← NUEVO
                motivo_baja: inscripcion.motivo_baja     // ← NUEVO
            };

            if (usuario.rol === "Alumno") {
                alumnos.push(item);
            } else if (usuario.rol === "profe") {
                profesores.push(item);
            }
        });

        return res.json({
            success: true,
            alumnos,
            profesores,
            total: inscripcionesValidas.length
        });

    } catch (error) {
        console.error('💥 ERROR en getInscripcionesComisionCompletas:', error);
        return res.status(500).json({
            success: false,
            msg: 'Error interno del servidor'
        });
    }
};

// 1. INSCRIBIR USUARIO A COMISIÓN

const inscribirUsuario = async (req, res) => {
    try {
        const { comision_id, usuario_id } = req.body;



        // Validaciones básicas
        if (!comision_id || !usuario_id) {
            return res.status(400).json({
                success: false,
                msg: 'Faltan campos requeridos: comision_id y usuario_id'
            });
        }

        // Validar IDs
        if (!mongoose.Types.ObjectId.isValid(comision_id) || !mongoose.Types.ObjectId.isValid(usuario_id)) {
            return res.status(400).json({
                success: false,
                msg: 'Uno o más IDs no son válidos'
            });
        }

        // 1. Verificar que la comisión existe
        const comisionExiste = await Comision_Model.findById(comision_id);
        if (!comisionExiste) {
            return res.status(404).json({
                success: false,
                msg: 'La comisión no existe'
            });
        }

        // 2. Verificar que el usuario existe
        const usuarioExiste = await Usuario_Model.findById(usuario_id);
        if (!usuarioExiste) {
            return res.status(404).json({
                success: false,
                msg: 'El usuario no existe'
            });
        }

        // 3. Verificar que el usuario está activo
        if (!usuarioExiste.estado) {
            return res.status(400).json({
                success: false,
                msg: 'El usuario no está activo en el sistema'
            });
        }

        // 4. Verificar que el usuario no esté ya inscrito (activo)
        const inscripcionExistente = await Inscripcion.findOne({
            comision_id: new mongoose.Types.ObjectId(comision_id),
            usuario_id: new mongoose.Types.ObjectId(usuario_id),
            estado: 'activo'
        });

        if (inscripcionExistente) {
            return res.status(409).json({
                success: false,
                msg: 'El usuario ya está inscrito en esta comisión'
            });
        }

        // 5. Verificar si existe una inscripción previa (inactiva)
        const inscripcionPrevia = await Inscripcion.findOne({
            comision_id: new mongoose.Types.ObjectId(comision_id),
            usuario_id: new mongoose.Types.ObjectId(usuario_id),
            estado: { $ne: 'activo' }
        });

        let nuevaInscripcion;

        if (inscripcionPrevia) {
            // Reactivar inscripción previa
            inscripcionPrevia.estado = 'activo';
            inscripcionPrevia.fecha_baja = null;
            inscripcionPrevia.motivo_baja = null;
            nuevaInscripcion = await inscripcionPrevia.save();

        } else {
            // Crear nueva inscripción
            nuevaInscripcion = new Inscripcion({
                comision_id: new mongoose.Types.ObjectId(comision_id),
                usuario_id: new mongoose.Types.ObjectId(usuario_id),
                estado: 'activo',
                fecha_inscripcion: new Date()
            });

            await nuevaInscripcion.save();

        }

        // 6. Populate para devolver datos completos
        const inscripcionCompleta = await Inscripcion.findById(nuevaInscripcion._id)
            .populate('usuario_id', 'nombres apellido email dni telefono rol')
            .populate('comision_id', 'nombre modalidad');

        return res.status(201).json({
            success: true,
            msg: 'Usuario inscrito correctamente',
            data: inscripcionCompleta
        });

    } catch (error) {
        console.error('💥 Error en inscribirUsuario:', error);
        return res.status(500).json({
            success: false,
            msg: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


// 2. DAR DE BAJA/MODIFICAR ESTADO DE INSCRIPCIÓN

const darBajaInscripcion = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, motivo_baja } = req.body;


        // Validar ID de inscripción
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                msg: 'ID de inscripción no válido'
            });
        }

        // Validaciones de estado
        if (!estado || !['inactivo', 'egresado', 'abandono', 'suspendido'].includes(estado)) {
            return res.status(400).json({
                success: false,
                msg: 'Estado no válido. Debe ser: inactivo, egresado, abandono o suspendido'
            });
        }

        // 1. Buscar la inscripción
        const inscripcion = await Inscripcion.findById(id);

        if (!inscripcion) {
            return res.status(404).json({
                success: false,
                msg: 'Inscripción no encontrada'
            });
        }

        // 2. Verificar que no esté ya dada de baja
        if (inscripcion.estado !== 'activo') {
            return res.status(400).json({
                success: false,
                msg: `La inscripción ya está en estado: ${inscripcion.estado}`
            });
        }

        // 3. Actualizar la inscripción
        inscripcion.estado = estado;
        inscripcion.fecha_baja = new Date();

        if (motivo_baja && motivo_baja.trim() !== '') {
            inscripcion.motivo_baja = motivo_baja.trim();
        }

        await inscripcion.save();


        // 4. Devolver datos actualizados
        const inscripcionActualizada = await Inscripcion.findById(id)
            .populate('usuario_id', 'nombres apellido email dni telefono rol')
            .populate('comision_id', 'nombre modalidad');

        return res.json({
            success: true,
            msg: `Inscripción actualizada a estado: ${estado}`,
            data: inscripcionActualizada
        });

    } catch (error) {
        console.error('💥 Error en darBajaInscripcion:', error);
        return res.status(500).json({
            success: false,
            msg: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


// 3. REACTIVAR INSCRIPCIÓN

const reactivarInscripcion = async (req, res) => {
    try {
        const { id } = req.params;


        // Validar ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                msg: 'ID de inscripción no válido'
            });
        }

        const inscripcion = await Inscripcion.findById(id);

        if (!inscripcion) {
            return res.status(404).json({
                success: false,
                msg: 'Inscripción no encontrada'
            });
        }

        // Solo se puede reactivar si no está activa
        if (inscripcion.estado === 'activo') {
            return res.status(400).json({
                success: false,
                msg: 'La inscripción ya está activa'
            });
        }

        // Reactivar
        inscripcion.estado = 'activo';
        inscripcion.fecha_baja = null;
        inscripcion.motivo_baja = null;

        await inscripcion.save();

        const inscripcionActualizada = await Inscripcion.findById(id)
            .populate('usuario_id', 'nombres apellido email dni telefono rol')
            .populate('comision_id', 'nombre modalidad');

        return res.json({
            success: true,
            msg: 'Inscripción reactivada correctamente',
            data: inscripcionActualizada
        });

    } catch (error) {
        console.error('💥 Error en reactivarInscripcion:', error);
        return res.status(500).json({
            success: false,
            msg: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// usuarios disponibles para inscripcion
const getUsuariosDisponiblesParaComision = async (req, res) => {
    try {
        const { comisionId } = req.params;
        const { rol } = req.query; // "Alumno" o "profe"

        // 1. Obtener IDs de usuarios YA inscritos en ESTA comisión
        const inscripciones = await Inscripcion.find({
            comision_id: comisionId,
            estado: "activo"
        }).select('usuario_id');

        const idsInscritos = inscripciones.map(i => i.usuario_id.toString());

        // 2. Buscar usuarios con ese rol NO inscritos
        const usuarios = await Usuario.find({
            rol: rol,
            estado: true,
            _id: { $nin: idsInscritos }
        }).select('nombres apellido email dni telefono');

        return res.json({
            success: true,
            usuarios,
            total: usuarios.length
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getInscripcionesComisionCompletas,
    inscribirUsuario,
    darBajaInscripcion,
    reactivarInscripcion,
    getUsuariosDisponiblesParaComision
};