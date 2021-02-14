const Discord = require('discord.js')

module.exports.run = async (client, message, args) => { 
  
  const msg = await message.channel.send('**Calculando..**') 
  
  const embed = new Discord.MessageEmbed() 
    .setAuthor('Ping? Pong!')
    .setDescription(`Ping: \`\`${Math.round(client.ws.ping)}\`\`ms! \n Latência da API: \`\`${msg.createdTimestamp - message.createdTimestamp}\`\`ms! `)
    .setColor('36393e');
  
      msg.edit(embed)
      

} 

exports.config = {
    name: 'ping',
    aliases: [],
    category: 'moderation'
}
