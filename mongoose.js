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


let Guilds = mongoose.model("Guilds", Guild)
module.exports.Guilds = Guilds

let Punish = mongoose.model("Punish", Puni)
module.exports.Punish = Punish

let userData = mongoose.model("userData", uD)
module.exports.userData = userData
