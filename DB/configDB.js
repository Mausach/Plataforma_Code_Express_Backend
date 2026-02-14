const mongoose = require('mongoose')

const DBconection = async () => {
try {
    await mongoose.connect(process.env.URLDBMONGO)
    console.log('Conectado :D ')
} catch (error) {
    console.log(error)
    throw new Error('Error al conectar DB')
}
}


module.exports = {DBconection}