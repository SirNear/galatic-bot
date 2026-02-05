const config = require('./config.json')
const mongoose = require('mongoose').config()

const connectionOptions = {
    connectTimeoutMS: 30000, // Aumenta o tempo de espera para conexão
    serverSelectionTimeoutMS: 30000, // Aumenta o tempo para o driver encontrar um servidor
    socketTimeoutMS: 45000, // Aumenta o tempo de inatividade do socket
    bufferCommands: false, // Desativa o buffer de comandos do Mongoose globalmente
};

async function connectToDatabase() {
    try {
        await mongoose.connect(config.mongoose, connectionOptions);
        console.log('MONGOOSE | Conectado ao banco de dados!');
    } catch (err) {
        console.error(`MONGOOSE | Erro ao conectar ao banco de dados: ${err}`);
        throw err; // Lança o erro para ser tratado no ponto de chamada
    }
}

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
  _id: {type: String, required: true}, 
  uid: {type: String , required: true},
  uName: {type: String},
  jogador: {type: String , default: 'nrpg'},
  uServer: {type: String , required: true},
  monitor: {type: String, default: 'Desativado'},
  monitorChannelId: {type: String},
  punishNumber: {type: String},
  aparencias: [{
    nome: { type: String },
    universo: { type: String },
    imagem: { type: String },
    personagem: { type: String }
  }],
  moeda: {
    type: Map,
    of: Number,
    default: { 'atrevicoins': 0 }
  },
  tokenAp: {type: Number, default: 0},
})

uD.index({ uid: 1, uServer: 1 });

const moedaConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    nome: { type: String, required: true },
    emoji: { type: String, required: false },
    creatorId: { type: String, required: true }
});
moedaConfigSchema.index({ guildId: 1, nome: 1 }, { unique: true });

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

const questSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    descricao: { type: String, required: true },
    regras: { type: String, required: true },
    recompensa: { type: String, required: false },
    maxPlayers: { type: Number, required: true },
    participantes: [{ type: String }], // Array de IDs de usuários
    status: { type: String, enum: ['aberta', 'em andamento', 'concluida'], default: 'aberta' },
    mestre: { type: String, required: true },
    dataInicio: { type: String, required: true },
    dataInicioTimestamp: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    messageId: { type: String, required: false },
    channelId: { type: String, required: false },
    forumChannelId: { type: String, required: false }, 
});

const pendingQuestSchema = new mongoose.Schema({
    creatorId: { type: String, required: true },
    nome: { type: String, required: true },
    descricao: { type: String, required: true },
    regras: { type: String, required: true },
    recompensa: { type: String, required: false },
    maxPlayers: { type: Number, required: true },
    dataInicio: { type: String, required: true },
    dataInicioTimestamp: { type: Number, required: true },
    approvalMessageId: { type: String, required: false },
    createdAt: { type: Date, default: Date.now }
});

const lojaSchema = new mongoose.Schema({
    messageId: { type: String, required: false, unique: true, sparse: true }, 
    nome: { type: String, required: true },
    createdBy: { type: String, required: true },
    canalId: { type: String, required: true },
    descricao: { type: String, required: true },
    status: { type: String, enum: ['pendente', 'aprovada', 'rejeitada'], default: 'pendente' },
    categorias: [{
        nome: { type: String, required: true },
        itens: [{
            nome: { type: String, required: true },
            descricao: { type: String, required: true },
            preco: { type: Number, required: true },
            moeda: { type: String, required: true }
        }]
    }]
})

const embedSchema = new mongoose.Schema({
    messageId: { type: String, required: false, unique: true, sparse: true },
    guildId: { type: String, required: true },
    titulo: { type: String, required: true },
    descricao: { type: String, required: true },
    cor: { type: String, required: true },
    footer: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, required: true },
    canal: { type: String, required: true },
    fields: [{
        name: { type: String, required: true },
        value: { type: String, required: true },
        inline: { type: Boolean, required: false }
    }],
    buttons: [{
        label: { type: String, required: true },
        url: { type: String, required: false },
        emoji: { type: String, required: false },
        id: { type: String, required: true },
        style: { type: String, required: true }
    }],
    selectMenus: [{
        id: { type: String, required: true },
        placeholder: { type: String, required: true },
        options: [{
            label: { type: String, required: true },
            value: { type: String, required: true },
            emoji: { type: String, required: false }
        }]
    }]

})

let EmbedModel = mongoose.model("Embed", embedSchema);
module.exports.EmbedModel = EmbedModel;

let LojaModel = mongoose.model("Loja", lojaSchema);
module.exports.LojaModel = LojaModel;

let MoedaConfig = mongoose.model("MoedaConfig", moedaConfigSchema);
module.exports.MoedaConfig = MoedaConfig;



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

let Quest = mongoose.model("Quest", questSchema);
module.exports.Quest = Quest;

let PendingQuest = mongoose.model("PendingQuest", pendingQuestSchema);
module.exports.PendingQuest = PendingQuest;

const PageSchema = new mongoose.Schema({
    content: { type: String, required: true },
    imageUrl: { type: String, required: false },
});

const ChapterSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Ex: "Capítulo 1: O Início"
    pages: [PageSchema],
});

const LoreSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    guildId: { type: String, required: true },
    createdBy: { type: String, required: true },
    title: { type: String, required: true },
    chapters: [ChapterSchema],
}, {
    timestamps: true
});

let Lore = mongoose.model('Lore', LoreSchema);
module.exports.Lore = Lore;

const botConfigSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    maintenance: { type: Boolean, default: false }
});
module.exports.BotConfig = mongoose.model("BotConfig", botConfigSchema);

module.exports.connect = connectToDatabase;