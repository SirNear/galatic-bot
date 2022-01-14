const config = require('./config.json')
const mongoose = require('mongoose')
mongoose.connect(config.dbrpg, { useNewUrlParser: true}, (err) => { //Vamos fazer o bot se conectar no banco de dados
  if (err) console.error(`Não foi possível se conectar ao banco de dados ${err}`) //Caso dê algum erro, Whoops.
})
