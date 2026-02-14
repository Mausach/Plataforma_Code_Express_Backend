const jwt = require('jsonwebtoken');

//se encarga de ver que el tokene ste vigente o expiro
const validarJWT = (req, res, next) => {
	//x-token headers
	const token = req.header('x-token');

	if (!token) {
		return res.status(401).json({
			ok: false,
			msg: 'usted no tiene acceso',
		});
	}

	try {
		const payload = jwt.verify(token, process.env.SECRET_JWT);

		req.id = payload.id;
		req.name = payload.name;
	} catch (error) {
		return res.status(401).json({
			ok: false,
			msg: 'token no valido',
		});
	}

	next();
};

module.exports = {
	validarJWT,
};