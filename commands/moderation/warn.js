const { EmbedBuilder, Discord } = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')
const color = require('../../api/colors.json')
const mongoose = require('mongoose')
const moment = require('moment')
moment.updateLocale('pt-br')

module.exports = class warn extends Command {
	constructor(client) {
		super(client, {
			name: "warn",
			category: "moderation",
			aliases: [''],
			UserPermission: ["aviso",'avisar','w'],
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
async run({ message, args, client, server}) {
    const embedh = new EmbedBuilder()
  .setTitle(`<:DuvidaMario:566084477114384387> | **AJUDA: COMANDO MUTE** | <:DuvidaMario:566084477114384387>`)
  .setDescription(`Utilize \`${server.prefix}mute <usuario> <tempo> <motivo>\``)
  .setColor('#FFFF00');

  if(!args[0]||args[0].includes("help")||args[0].includes("ajuda")) return message.channel.send(embedh)

    if(!message.member.hasPermission("MUTE_MEMBERS")) return error.Mute(message)

    let wUser = message.guild.member(message.mentions.users.first()) || message.guild.members.cache.get(args[0])
    if(!wUser) return error.noUser(message)

    let warn = await this.client.database.Punish.find({uid: wUser.user.id, servidor: message.guild.id})

    let reason = args.slice(1).join(" ");
    if (!reason) return error.noReason(message)

      warn = new this.client.database.Punish({
          _id: mongoose.Types.ObjectId(),
          usuario: wUser.displayName,
          uid: wUser.user.id,
          motivo: reason,
          staff: message.author.username,
          staffid: message.author.id,
          servidor: message.guild.id,
          punicao: 'aviso',
          data: moment.utc(message.createdAt).format('LLLL'),

      })

    warn.save()

    let warnEmbed = new EmbedBuilder()
    .setTitle(`***Punição | Aviso - ${message.guild.name}***`)
    .setColor(color.moderation)
    .setThumbnail(message.author.displayAvatarURL)
    .addFields("***Usuário avisado***", `${wUser.user}`)
    .addFields("***Avisado por***",`${message.author}`)
    .addFields("***Avisado no canal***", message.channel)
    .addFields("***Motivo***", reason)
    .setFooter(`Usuário avisado ${wUser.id}`);

   let warnchannel = message.guild.channels.cache.get(`${server.cPunicoes}`.replace(/[<#>]/g, ""))  
  if(!warnchannel) return message.reply('***O canal ' + `${server.cPunicoes}` + ' não foi encontrado. Crie-o para que eu possa registrar os eventos de punição por lá. ***')

    warnchannel.send(warnEmbed)
    message.reply('***O usuário foi avisado com  sucesso!***')
    wUser.send(warnEmbed);

  if(server.warnTag === 'Ativado'){ 
    if(warn.warnNumber === server.warnNumber) {

          warn = new client.database.Punish({
          _id: wUser.user.id,
          usuario: wUser.nickname,
          motivo: `Excedeu ${server.warnNumber} avisos`,
          staff: 'auto',
          staffid: 'auto',
          servidor: message.guild.name,
          data: moment.utc(message.createdAt).format('LLLL'),


      })

      warn.save()

      let muterole = message.guild.roles.cache.find(`name`, "muted");

      if(!muterole) {

          muterole = await message.guild.createRole({
            name: "Mutado",
            color: "#070a0f",
            permissions:[]

          })

    }



      let mutetime = "2h";
      await(wUser.addRole(muterole.id));
      message.channel.send(`<@${wUser.id}> foi temporariamente mutado.`);

      setTimeout(function(){
        wUser.removeRole(muterole.id)
        message.channel.send(`<@${wUser.id}> foi desmutado.`)
      }, ms(mutetime))


	  }
	}
     }
}
