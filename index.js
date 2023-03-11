const Client = require('./GalaticClient')
const config = require('./config')
const client = new Client({
   disableMentions: "everyone",
   intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildEmojisAndStickers, GatewayIntentBits.MessageContent]
})


client.loadCommands('./commands')
client.loadEvents('./events')
client.login(config.token)
   console.log("Acordei!!")
