const Discord = require("discord.js");
const error = require('../api/error.js')

module.exports.run = async (client, message, args) => {

	
  let wUser = message.guild.member(message.mentions.users.first()) || message.guild.members.cache.get(args[0]);
  if(!wUser) return error.noUser(message)
  
  let warn = await client.database.Punish.find({uid: wUser.id, servidor: message.guild.id })
  let server = await client.database.Guilds.findById(message.guild.id)
  
  const mb = message.guild.members.cache.get(message.author.id)
  const canal = message.guild.roles.cache.get(`${server.cPunicoes}`.replace(/[<#>]/g, ""))
  
  let modRole = message.guild.roles.cache.get(`${server.staffRole}`.replace(/[<@&>]/g, ""))
  
   if(!mb.member.roles.has(modRole) return error.noStaffRole(message)
   if(wUser === mb) return error.autoClearWarn(message)
   if(warn.warnNumber == '0') return error.noWarn(message)
   
   let embed = new Discord.MessageEmbed()
   .setTitle('**Punição | Galatic Bot**')
   .setDescription(`Todos os avisos de ${wUser} foram retirados por ${mb}.`)
   .setTimestamp()
   .setThumbnail('https://i.pinimg.com/originals/a1/1f/a3/a11fa3cdbfd567f934b6c0151c6a6d8b.gif')
   .setImage('https://cdn.discordapp.com/attachments/462634982175932428/675871123094634526/C.gif')
   .setFooter('Galatic Bot - Punições');

  warn.warnNumber = 0
  warn.save()
  
  
  message.channel.send(`***Todos os avisos de ${wUser} Foram retirados !***`)
  canal.send(embed)
  
    
}

exports.config = {
  name: 'clearwarn',
  aliases: ['limparwarn','cwarn','limparavisos',clearavisos','la'],
  category: 'moderation'
}
