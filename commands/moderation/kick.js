const Discord = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')

module.exports = class kick extends Command {

	constructor(client) {
		super(client, {
			name: "kick",
			category: "moderation",
			aliases: ['kickar','chutar','k'],
			UserPermission: ["KICK_MEMBERS"],
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
async run({ message, args, client, server}) {
     
       let canal = server.cPunicoes

      let reason2 = args.slice(2).join(' ')
      let rMember = message.guild.members.cache.get(message.author);

      const mb = await message.guild.members.cache.get(message.author.id)
      if(member == mb) return error.autoPuni(message)//tentar se punir
      if(mb.roles.highest.rawPosition < member.roles.highest.rawPosition) return error.highRole(message)
      if(mb.roles.highest.rawPosition == member.roles.highest.rawPosition) return error.equalRole(message)

      let infrator = message.guild.members.cache.get(message.mentions.users.first() || message.guild.members.cache.get(args[0]) || message.guild.members.cache.get(args[1]))
        if (!infrator) return message.channel.send(`<:error_2:676239899065843722> | *${message.author.username} desculpe, não encontrei nem uma menção ou ID em seu comando, tente novamente* ` + `*usando:* \n \`${server.prefix}kick @user/Id Motivo\``);


        const embeddmK = new Discord.MessageEmbed()
            .setTitle('Punição | Galatic Bot')
            .setThumbnail('https://i.pinimg.com/originals/a1/1f/a3/a11fa3cdbfd567f934b6c0151c6a6d8b.gif')
            .setDescription(`Você foi \`Kickado\` do servidor ${message.guild.name} \n **Staff:** ` + `${rMember} ` + ' \n **Motivo:** ' + `${reason2}`)
            .setImage('https://cdn.discordapp.com/attachments/462634982175932428/675871123094634526/C.gif')
            .setFooter('Galatic Bot - Punições');

      const embedK = new Discord.MessageEmbed()
            .setTitle("Punição | Galatic Bot")
            .setThumbnail('https://i.pinimg.com/originals/a1/1f/a3/a11fa3cdbfd567f934b6c0151c6a6d8b.gif')
            .setDescription('**Tipo da punição:** `Kick` \n ⠀ \n **Usuário punido: **' + `${infrator.user.username} **|** ID: ${infrator.id} ` + ' \n ⠀ \n **Staff:** ' + `${message.author.username} **|** ID: ${message.author.id} ` + '\n ⠀ \n **Motivo:** ' + `${reason2}`)
            .setImage('https://cdn.discordapp.com/attachments/462634982175932428/675871123094634526/C.gif')
            .setFooter('Galatic Bot - Punições')

      if (!rMember.roles.has(staff.id)) return message.channel.send(`<:error_2:676239899065843722> | *${message.author} sem permissão!*`)

                infrator.send(embeddmK)
                infrator.kick()
                canal.send(embedK)
                message.channel.send('Usuário punido por sucesso!')
			
     
   }
}
