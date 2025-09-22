const Client = require('./GalaticClient')
const { GatewayIntentBits } = require('discord.js') // Corrigido: desestruturação
const config = require('./config')

const client = new Client({
   intents: [
      GatewayIntentBits.Guilds,               // Necessário para slash commands
      GatewayIntentBits.GuildMessages,        // Para comandos por mensagem
      GatewayIntentBits.MessageContent,       // Para ler conteúdo das mensagens
      GatewayIntentBits.DirectMessages        // Se precisar de DMs
   ],
   disableMentions: "everyone",
})

client.loadCommands('./commands')
client.loadEvents('./events')

// O login já cuida dos slash commands graças às alterações no GalaticClient
client.login(config.token)
   .then(() => console.log("Bot online e slash commands registrados!"))
   .catch((err) => console.log(`Erro ao iniciar: ${err.message}`))
