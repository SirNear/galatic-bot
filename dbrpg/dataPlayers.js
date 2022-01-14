const config = require('../config.json')
const mongoose = require('mongoose')
mongoose.createConnection(config.dbrpgplay, { useNewUrlParser: true}, (err) => { //Vamos fazer o bot se conectar no banco de dados
  if (err) console.error(`Não foi possível se conectar ao banco de dados ${err}`) //Caso dê algum erro, Whoops.
})

let ficha = new mongoose.Schema({
  _id: {type: String},
  username: {type: String},
  idade: {type: String},
  região: {type: String},
  time: {type: String},
  aparencia: {type: String},
  isPoke: {type: Boolean, default: 0},
  pokeType: {type: String},
  pokeName: {type: String},
  pokeMoves: {type: String}
})

let pokedex = new mongoose.Schema({
  _id: {type: String},
  pokemons: {type: Map, of: String}
})

let fichaUser = mongoose.model("fichaUser", ficha)
module.exports.fichaUser = fichaUser

let pokeDex = mongoose.model("pokeDex", pokedex)
module.exports.pokeDex = pokeDex

