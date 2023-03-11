const Client = require('./GalaticClient')
const config = require('./config')
const client = new Client({
   disableMentions: "everyone",
})


client.loadCommands('./commands')
client.loadEvents('./events')
client.login(config.token)
   console.log("Acordei!!")
