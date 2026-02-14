const bcryptjs = require('bcrypt');
const Usuario_Model = require('../models/Usuario_Model');
const jwt = require("jsonwebtoken");


// 1. CREAR USUARIO
const crearUsuario = async (req, res) => {
    try {
        const {
            nombres,
            apellido,
            dni,
            fecha_nacimiento,
            genero,
            telefono,
            provincia,
            rol,
            email,
            password
        } = req.body;

        // Verificar si el usuario ya existe
        const usuarioExistente = await Usuario_Model.findOne({ 
            $or: [{ email }, { dni }] 
        });

        if (usuarioExistente) {
            return res.status(400).json({
                ok: false,
                msg: 'El email o DNI ya están registrados'
            });
        }

        // Encriptar contraseña
        const salt = bcryptjs.genSaltSync(10);
        const passwordEncriptada = bcryptjs.hashSync(password, salt);

        // Crear nuevo usuario
        const nuevoUsuario = new Usuario_Model({
            nombres,
            apellido,
            dni,
            fecha_nacimiento,
            genero,
            telefono,
            provincia,
            rol: rol || 'Alumno',
            email,
            password: passwordEncriptada,
            estado: true
        });

        await nuevoUsuario.save();

        // No enviar password en la respuesta
        const usuarioResponse = nuevoUsuario.toObject();
        delete usuarioResponse.password;

        res.status(201).json({
            ok: true,
            msg: 'Usuario creado exitosamente',
            usuario: usuarioResponse
        });

    } catch (error) {
        console.error('Error al crear usuario:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

// 2. ACTUALIZAR USUARIO
const actualizarUsuario = async (req, res) => {
    const { _id } = req.body;

    try {
        // 1. Verificar existencia del usuario
        const usuarioExistente = await Usuario_Model.findById(_id);
        if (!usuarioExistente) {
            return res.status(404).json({ 
                ok: false, 
                msg: "Usuario no encontrado" 
            });
        }

        // 2. Preparar updates (convertir strings vacíos a undefined para campos opcionales)
        const updates = {};
        const camposUnicos = ['dni', 'email']; // Solo campos que deben ser únicos
        
        Object.entries(req.body).forEach(([key, value]) => {
            // Solo incluir campos que existen en el esquema (excepto _id)
            if (key !== '_id' && usuarioExistente.schema.paths[key]) {
                // Para campos únicos opcionales, convertir "" a undefined
                if (key === 'email' && value === "") {
                    // No asignar nada (undefined) para eliminar el campo
                } else {
                    updates[key] = value;
                }
            }
        });

        // 3. Validar unicidad solo para campos con valores definidos
        for (const campo of camposUnicos) {
            if (updates[campo] !== undefined && updates[campo] !== null) {
                if (updates[campo] !== usuarioExistente[campo]) {
                    const existe = await Usuario.findOne({ 
                        [campo]: updates[campo],
                        _id: { $ne: _id }
                    });
                    if (existe) {
                        return res.status(400).json({ 
                            ok: false, 
                            msg: `El ${campo} ya está en uso por otro usuario` 
                        });
                    }
                }
            }
        }

        // 4. Construir operación de actualización
        const updateOperation = {};
        
        // Encriptar nueva contraseña si se proporciona
        if (updates.password) {
            const salt = bcryptjs.genSaltSync(10);
            updates.password = bcryptjs.hashSync(updates.password, salt);
        }
        
        // Agregar solo campos con valores definidos al $set
        if (Object.keys(updates).length > 0) {
            updateOperation.$set = {};
            Object.entries(updates).forEach(([key, value]) => {
                if (value !== undefined) {
                    updateOperation.$set[key] = value;
                }
            });
        }

        // Para email vacío (si se quiere eliminar)
        if (req.body.email === "") {
            updateOperation.$unset = { email: "" };
        }

        // 5. Ejecutar actualización
        const usuarioActualizado = await Usuario_Model.findByIdAndUpdate(
            _id,
            updateOperation,
            { 
                new: true,
                runValidators: true,
                context: 'query',
                select: '-password -__v' // Excluir password y versión
            }
        );

        res.json({
            ok: true,
            msg: "Usuario actualizado correctamente",
            usuario: usuarioActualizado
        });

    } catch (error) {
        console.error("Error en actualizarUsuario:", error);
        
        // Manejar errores de duplicados
        if (error.code === 11000) {
            const campo = Object.keys(error.keyPattern)[0];
            let mensaje = `El ${campo} ya está registrado`;
            
            if (campo === 'dni') {
                mensaje = "El DNI ya está en uso por otro usuario";
            } else if (campo === 'email') {
                mensaje = "El email ya está registrado por otro usuario";
            }
            
            return res.status(400).json({
                ok: false,
                msg: mensaje
            });
        }

        // Manejar errores de validación de Mongoose
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                ok: false,
                msg: "Error de validación",
                errors: errors
            });
        }

        // Manejar otros errores
        res.status(500).json({
            ok: false,
            msg: "Error interno del servidor al actualizar usuario",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// 3. BAJA LÓGICA (cambiar estado a Inactivo)
const bajaLogicaUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        // Buscar usuario
        const usuario = await Usuario.findById(id);
        
        if (!usuario) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        // Verificar si ya está inactivo
        if (usuario.estado === false) {
            return res.status(400).json({
                ok: false,
                msg: 'El usuario ya se encuentra inactivo'
            });
        }

        // Cambiar estado a Inactivo
        usuario.estado = false;
        await usuario.save();

        // No enviar password en la respuesta
        const usuarioResponse = usuario.toObject();
        delete usuarioResponse.password;

        res.json({
            ok: true,
            msg: 'Usuario dado de baja exitosamente',
            usuario: usuarioResponse
        });

    } catch (error) {
        console.error('Error al dar de baja usuario:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

// 4. OPCIÓN EXTRA: Reactivar usuario
const reactivarUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        const usuario = await Usuario.findById(id);
        
        if (!usuario) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        if (usuario.estado === true) {
            return res.status(400).json({
                ok: false,
                msg: 'El usuario ya se encuentra activo'
            });
        }

        usuario.estado = true;
        await usuario.save();

        const usuarioResponse = usuario.toObject();
        delete usuarioResponse.password;

        res.json({
            ok: true,
            msg: 'Usuario reactivado exitosamente',
            usuario: usuarioResponse
        });

    } catch (error) {
        console.error('Error al reactivar usuario:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

const CambiarEstadoUsuario = async (req, res) => {
    try {
        // 1. Buscar usuario por ID
        const usuario = await Usuario_Model.findById(req.body._id); // Soporta ambos formatos

        // 2. Verificar existencia
        if (!usuario) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe ningún usuario con este ID',
            });
        }

       // 3. Alternar estado (true → false, false → true)
       usuario.estado = !usuario.estado;

       // 4. Guardar cambios
       await usuario.save();

       // 5. Respuesta con nuevo estado
       res.status(200).json({
           ok: true,
           msg: usuario.estado 
               ? 'Usuario habilitado correctamente' 
               : 'Usuario deshabilitado correctamente',
           usuario: {
               _id: usuario._id,
               nombre: usuario.nombre,
               estado: usuario.estado
           }
       });


    } catch (error) {
        console.error('Error al deshabilitar usuario:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno. Por favor contacte al administrador',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const obtenerUsuarios = async (req, res) => {
    try {
        const usuarios = await Usuario_Model.find()
            .select('-password')
            .sort({ nombres: 1 });
        
        res.json({
            ok: true,
            usuarios
        });
        
    } catch (error) {
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor'
        });
    }
};

const loginUsuario = async (req, res) => {

    const { email, password } = req.body;

    try {

        let user = await Usuario_Model.findOne({ email })

        if (!user) {
            return res.status(400).json({
                ok: false,
                msg: "el email o la contraseña no son validas"
            })
        }

        const validarpassword = bcryptjs.compareSync(password, user.password);

        if (!validarpassword) {
            return res.status(400).json({
                ok: false,
                msg: 'el email o la contraseña no son validas'
            });
        }

        if (user.estado != true) {
            return res.status(400).json({
                ok: false,
                msg: 'usted esta inhabilitado, contactese con el administrador'
            });
        }

        //generar nuestro JWT
        const payload = {
            id: user._id,
            nombres: user.nombres,
            rol: user.rol,
        };

        const token = jwt.sign(payload, process.env.SECRET_JWT, {
            expiresIn: "2h",
        });

        res.status(200).json({
            ok: true,
            id: user._id,
            email: user.email,
            nombres: user.nombres,
            apellido:user.apellido,
            rol: user.rol,
            usuario: user,
            token,
            msg: 'el usario se logueo',
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            ok: false,
            msg: "por favor contactarse con el administrador"
        })
    }
}



module.exports = {
    crearUsuario,
    actualizarUsuario,
   CambiarEstadoUsuario,
    obtenerUsuarios,
    loginUsuario,
};