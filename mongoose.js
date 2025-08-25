const config = require('./config.json')
const mongoose = require('mongoose')

// Conectar ao banco de dados 
mongoose.connect(config.mongoose)
  .then(() => {
    console.log('MONGOOSE | Conectado ao banco de dados!');
  })
  .catch(err => {
    console.error(`'MONGOOSE | Erro ao conectar ao banco de dados: ${err}`);
  });

let Guild = new mongoose.Schema({ 
	_id: {type: String}, 
	prefix: {type: String, default: "g!"},
	cPunicoes: {type: String, default: '#punições'},
	cargoMute: {type: String, default: '@mutado'},
	warnTag: {type: String, default: 'Desativado'},
	warnNumber: {type: String, default: '3'},
	uGlobal: {type: String, default: 'Desativado'},
	staffRole: {type: String, default: 'Não definido'},
	monitorCategory: {type: String, default: 'Não definido'},
	pokeball: {type: Boolean, default: true},
	batalha: {type: Boolean, default: true},
	customPerm: {type: Boolean, default: false},
	banned: {type: Boolean, default: false},
	tryAdd: {type: Boolean, default: false},
	banReason: {type: String }
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
  uid: {type: String , required: true},
  uName: {type: String},
  jogador: {type: String , default: 'nrpg'},
  uServer: {type: String , required: true},
  monitor: {type: String, default: 'Desativado'},
  monitorChannelId: {type: String},
  punishNumber: {type: String}

})

uD.index({ uid: 1, uServer: 1 });


let pokemonFicha = new mongoose.Schema({
	_id: {type: String},
	pokeName: {type: String},
	pokeId: {type: Number},
	pokeMovesName: {type: Map, of: String}
})

let pokeRegistro = new mongoose.Schema({
	_id: {type: String},
	pokeName: {type: String},
	pokeDesc: {type: String},
	pokeType: {type: String},
	pokeTitle: {type: String}
})

let fichaCabecalho = new mongoose.Schema({
	_id: {type: String},
	nome: {type: String},
	reino: {type: String},
	raca: {type: String},
	aparencia: {type: String}
})

const habilidadeSubSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // id interno da habilidade (útil pra editar)
  nome: { type: String, required: true }, //nome da skill
  descricao: { type: String, required: true }, //descricao da skill
  tipo: { type: String, enum: ['magica','fisica','passiva'], required: true }
}, { _id: true });

let fichaHabilidades = new mongoose.Schema({ 
	_id: {type: String},
	nome: {type: String},
	descricao: {type: String},
	tipo: {type: String}
})

let pokeReg = mongoose.model("pokeReg", pokeRegistro)
module.exports.pokeReg = pokeReg

let pokeficha = mongoose.model("pokeficha", pokemonFicha)
module.exports.pokeficha = pokeficha

let Guilds = mongoose.model("Guilds", Guild)
module.exports.Guilds = Guilds

let Punish = mongoose.model("Punish", Puni)
module.exports.Punish = Punish

let userData = mongoose.model("userData", uD)
module.exports.userData = userData
