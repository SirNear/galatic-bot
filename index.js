const Client = require('./GalaticClient')
const GatewayIntentBits = require('discord.js')
const config = require('./config')
const client = new Client({
   intents: ["MessageContent"],
   disableMentions: "everyone",
})


client.loadCommands('./commands')
client.loadEvents('./events')
client.login(config.token)
.then(() => console.log("Acordei"))
.catch((err) => console.log(`Erro ao iniciar: ${err.message}`));
