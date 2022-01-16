const config = require('./config.json')
const mongoose = require('mongoose')
mongoose.connect(config.mongoose, { useNewUrlParser: true}, (err) => { //Vamos fazer o bot se conectar no banco de dados
  if (err) console.error(`Não foi possível se conectar ao banco de dados ${err}`) //Caso dê algum erro, Whoops.
})

let Guild = new mongoose.Schema({ 
  _id: {type: String}, 
  prefix: {type: String, default: "g!"},
  cPunicoes: {type: String, default: '#punições'},
  cargoMute: {type: String, default: '@mutado'},
  warnTag: {type: String, default: 'Desativado'},
  warnNumber: {type: String, default: '3'},
  uGlobal: {type: String, default: 'Desativado'},
  staffRole: {type: String, default: 'Não definido'},
  monitorCategory: {type: String, default: 'Não definido'}
})

let guildReact = new mongoose.Schema({
  _id: {type: String},
  ownerId: {type: String},
  msgId: {type: String},
  excludeDBFil: {type: String, default: 'let filtroExcluir = (reaction, usuario) => reaction.emoji.name === "blackcheck" && usuario.id === message.author.id;'},
  excludeDBCol: {type: String, default: 'const coletorExcluir = msg.createReactionCollector(filtroExcluir, {max: 1, time: 360000});'},
  cancelExFil: {type: String, default: 'let filtroCancelar = (reaction, usuario) => reaction.emoji.name === "errorYaro" && usuario.id === message.author.id;'},
  cancelExCol: {type: String, default: 'const coletorCancelar = msg.createReactionCollector(filtroCancelar, {max: 1, time: 360000});'}
})

let Puni = new mongoose.Schema({
  _id: {type: String},
  usuario: {type: String},
  uid: {type: String},
  id: {type: String},
  motivo: {type: String, default: 'Sem motivo'},
  staff: {type: String},
  staffid: {type: String},
  servidor: {type: String},
  punicao: {type: String},
  warnNumber: {type: String},
  data: {type: String}

})

let uD = new mongoose.Schema({
  _id: {type: String}, 
  uid: {type: String},
  uName: {type: String},
  uServer: {type: String},
  monitor: {type: String, default: 'Desativado'},
  monitorChannelId: {type: String},
  punishNumber: {type: String}

})

let Bot = new mongoose.Schema({
	_id: { type: String },
	maintenance: { type: Boolean, default: false },
	maintenanceReason: { type: String, default: "" }
})

let rpgFicha = new mongoose.Schema({
	_id:{type: String},
	nome: {type: String},
	idade: {type: Number},
	coins: {type: Number},
	moradia: {type: String},
	pokemons: {type: Map, of: String},
	aprovada:{type: Boolean, default: 0}
})


let Guilds = mongoose.model("Guilds", Guild)
module.exports.Guilds = Guilds

let gReacts = mongoose.model("gReacts", guildReact)
module.exports.gReacts = gReacts

let Punish = mongoose.model("Punish", Puni)
module.exports.Punish = Punish

let userData = mongoose.model("userData", uD)
module.exports.userData = userData

let Bots = mongoose.model("Bots", Bot)
module.exports.Bots = Bots

let Ficha = mongoose.model("Ficha", rpgFicha)
module.exports.Ficha = Ficha
