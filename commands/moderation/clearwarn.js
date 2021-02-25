const Discord = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')
const color = require('../../api/colors.json')

module.exports = class clearwarn extends Command {

	constructor(client) {
		super(client, {
			name: "clearwarn",
			category: "moderation",
			aliases: ["limparavisos","clearavisos"],
			UserPermission: ['MANAGE_MESSAGES'],
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
 async run({ message, args, client, server}) {
   
   let wUser = message.guild.member(message.mentions.users.first()) || message.guild.members.cache.get(args[0]);
  if(!wUser) return error.noUser(message)
  
  let warn = await this.client.database.Punish.find({uid: wUser.id, servidor: message.guild.id })
  if(!warn) return message.channel.send('**Este usuário não possui nenhum aviso**')
  
  const mb = message.guild.members.cache.get(message.author.id)
  const canal = message.guild.roles.cache.get(`${server.cPunicoes}`.replace(/[<#>]/g, ""))
  
  let rolestaff = server.staffRole

  let modRole = message.guild.roles.cache.get(rolestaff.replace(/[<@&>]/g, ""))
  
   if(!message.member.roles.cache.has(modRole.id)) return error.noStaffRole(message)

   if(wUser === mb) return error.autoClearWarn(message)
   if(warn.warnNumber == '0') return error.noWarn(message)
   
   let embed = new Discord.MessageEmbed()
   .setTitle('**Punição | Galatic Bot**')
   .setDescription(`Todos os avisos de ${wUser} foram retirados por ${mb}.`)
   .setTimestamp()
   .setThumbnail('https://i.pinimg.com/originals/a1/1f/a3/a11fa3cdbfd567f934b6c0151c6a6d8b.gif')
   .setImage('https://cdn.discordapp.com/attachments/462634982175932428/675871123094634526/C.gif')
   .setFooter('Galatic Bot - Punições');

  warn.warnNumber = '0'
  warn.save()
  
  
  message.channel.send(`***Todos os avisos de ${wUser} Foram retirados !***`)
  canal.send(embed) 
   
   
 }
  
    getCategory(category, prefix) {
		return this.client.commands.filter(c => c.config.category === category).map(c => `\`${prefix}${c.config.name}\``).join(", ")
	}
	
	
	getCommmandSize(category) {
		return this.client.commands.filter(c => c.config.category === category).size
	}
  
}
