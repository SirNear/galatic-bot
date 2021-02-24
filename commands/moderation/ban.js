const Discord = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')
const color = require('../../api/colors.json')

module.exports = class ajuda extends Command {

	constructor(client) {
		super(client, {
			name: "ban",
			category: "moderation",
			aliases: ["banir"],
			UserPermission: ['BAN_MEMBERS'],
			clientPermission: ["BAN_MEMBERS", "EMBED_LINKS"],
			OnlyDevs: false
		})
	}
  
 async run({ message, args, client, server}) {
     
     const embedh = new Discord.MessageEmbed()
.setTitle(`<:DuvidaMario:566084477114384387> | **AJUDA: COMANDO BAN** | <:DuvidaMario:566084477114384387>`)
.setDescription(`Utilize \`${server.prefix}ban <usuario> <motivo>\``)
.setFooter('Você sabia que se adicionar *force* ao final do motivo, não irá receber confirmação?')
.setColor('RANDOM');

if(!args[0]||args[0].includes("help","ajuda")) return message.channel.send(embedh)

let member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

let sChannel = message.guild.channels.cache.get(`${server.cPunicoes}`.replace(/[<#>]/g, ""))  
if(!sChannel) return message.reply('***O canal ' + `${server.cPunicoes}` + ' não foi encontrado. Crie-o para que eu possa registrar os eventos de punição por lá. ***')

if(!member)return message.reply("Não encontrei esse usuário neste servidor");
if (!member.bannable) return error.botLow(message)

let reason = args.slice(1).join(' ');
if(!reason) reason = "Sem motivo";

  const mb = await message.guild.members.cache.get(message.author.id)
  if(member == mb) return error.autoPuni(message)//tentar se punir
  if(mb.roles.highest.rawPosition < member.roles.highest.rawPosition) return error.highRole(message)
  if(mb.roles.highest.rawPosition == member.roles.highest.rawPosition) return error.equalRole(message)
  
  const sucesso = new Discord.MessageEmbed()
  .setTitle("Ban | Sucesso!")
  .setDescription(`O membro ${member} foi banido com sucesso do servidor por ${message.author}`)
  .setColor(color.moderation)
  
const reactembed = new Discord.MessageEmbed()
.setDescription(`**Deseja banir permanentemente o(a) ${member} do servidor?**`)
.addField('**Se sim, clique na reação:**', '**"<:sun_ban:589205510000082947>"**')
.setColor(color.moderation);

if(reason.includes('force')) {

  reason = reason.split("force")

           const dmembed = new Discord.MessageEmbed()
        .setThumbnail(member.user.avatarURL)
        .setAuthor(`${message.guild.name}`, message.guild.iconURL)
        .setDescription(`Você foi banido do ${message.guild.name} por desrespeitar as regras!`)
        .setTitle("*** Punição | Banimento***")
        .addField("👮🏻 |*** Staff***", `${message.author.username}`)
        .addField("🔧 | ***ID do staff***", `${message.author.id}`)
        .addField("📑 | ***Motivo***", reason)
        .setColor(color.moderation)
        .setTimestamp(new Date());

        
    const banembed = new Discord.MessageEmbed()

        .setThumbnail(member.user.avatarURL)
        .setAuthor(`${message.guild.name}`, message.guild.iconURL)
        .setDescription(`O usuário foi punido(a) por desrespeitar as regras do servidor!`)
        .setTitle("*** Punição | Banimento***")
        .addField("👮🏻 |*** Staff***", `${message.author.username}`)
        .addField("🔧 | ***ID do staff***", `${message.author.id}`)
        .addField("👤 | ***Usuário***", `${member}`)
        .addField("⚙️ | ***ID do usuário***:", `${member.id}`)
        .addField("📑 | ***Motivo***", reason)
        .setColor(color.moderation)
        .setTimestamp(new Date());

       member.send(dmembed).catch(error => message.reply(`Desculpe-me não consigo enviar mensagem a ele: ${error}`))
      setTimeout(function() {
       member.ban({days: 7, reason: reason})
          }, 2000)
      message.channel.send(sucesso)
      sChannel.send(banembed)
  

}else {

message.channel.send(reactembed).then(msg =>{
    msg.react("589205510000082947");

    let filtro = (reaction, usuario) => reaction.emoji.name === "sun_ban" && usuario.id === message.author.id;
    const coletor = msg.createReactionCollector(filtro, {max: 1, time: 360000});

    coletor.on("collect", em =>{

        msg.delete()
       member.send(dmembed).catch(error => message.reply(`Desculpe-me não consigo enviar mensagem a ele: ${error}`))
      setTimeout(function() {
       member.ban({days: 7, reason: reason})
          }, 2000)
      message.channel.send(sucesso)
      sChannel.send(banembed)
    })

})

}
     
     
     
     
   }
  
  
  getCategory(category, prefix) {
		return this.client.commands.filter(c => c.config.category === category).map(c => `\`${prefix}${c.config.name}\``).join(", ")
	}
	
	
	getCommmandSize(category) {
		return this.client.commands.filter(c => c.config.category === category).size
	}
  
}
