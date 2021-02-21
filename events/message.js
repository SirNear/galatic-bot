const Discord = require('discord.js')

module.exports = {
  name: 'message',
  run: async (client) => {
    
    client.on("message", async message => {
    
       if(message.author.bot) return;
   
  let server = await client.database.Guilds.findById(message.guild.id)
  let userData = await client.database.userData.findById(message.author.id)
  
    if (!server) {
    server = client.database.Guilds({
      _id: message.guild.id
    })
    
    server.save()
  }

  if(!userData) {
    uD = client.database.userData({
      _id: message.author.id,
      uid: message.author.id,
      uName: message.author.username,
      uServer: message.guild.id
    })

    uD.save()

  }

  if(userData.monitor == 'ativado') {

    if(!message.guild.channels.cache.get(`${userData.monitorChannelId}`)) {
      userData.monitor = 'desativado'
      userData.save()

    }else {


      let embedMonitor = new Discord.MessageEmbed()
      .setTitle(`<:nani:572425789178642472> | **Nova mensagem de ${message.author.username}** | <:nani:572425789178642472>`)
      .setDescription(message.content)
      .addField(`**Canal:**`, message.channel)
      .setTimestamp()


    message.guild.channels.cache.get(`${userData.monitorChannelId}`).send(embedMonitor)

  }

  }
    
    }
  
  }

}
