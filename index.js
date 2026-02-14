const express = require('express')
const { DBconection } = require('./DB/configDB')
const cors= require("cors");
const app = express()
require('dotenv').config()

// hacer acordar a mauro sobre el cors 
//const cors= require("cors");



app.listen(process.env.PORT ,()=> {
    console.log(`server corriendo en ${process.env.PORT}`)
})

//base de datos
DBconection();

cors
app.use(cors());

//directorio publico
app.use(express.static('public'));

//lectura y parseo del body
app.use(express.json());

//para el admin
app.use("/admin",require('./rutes/admin'))

//para los alumnos o profesores
app.use("/auth",require('./rutes/auth'))