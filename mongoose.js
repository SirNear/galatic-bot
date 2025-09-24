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

const habilidadeSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    descricao: { type: String, required: true },
    categoria: { type: String, required: true },
    custo: { type: String, required: false, default: 'Nenhum' },
    subHabilidades: [{
        nome: { type: String },
        descricao: { type: String }
    }]
});

const fichaSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    nome: { type: String, required: true }, // Remove unique: true
    reino: { type: String, required: true },
    raca: { type: String, required: true },
    aparencia: { type: String, required: true },
    imagemURL: { type: String, required: false },
    habilidades: [habilidadeSchema],
    createdAt: { type: Date, default: Date.now } // Adiciona timestamp
});

// Garante que um usuário não pode ter duas fichas com o mesmo nome no mesmo servidor.
fichaSchema.index({ userId: 1, guildId: 1, nome: 1 }, { unique: true });

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

let Ficha = mongoose.model("Ficha", fichaSchema);
module.exports.Ficha = Ficha;

let reactionRole = new mongoose.Schema({
    messageId: { type: String, required: true },
    emoji: { type: String, required: true },
    roleId: { type: String, required: true },
    guildId: { type: String, required: true }
});

let ReactionRoles = mongoose.model("ReactionRoles", reactionRole)
module.exports.ReactionRoles = ReactionRoles