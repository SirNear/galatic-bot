const { EmbedBuilder, Discord } = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')

module.exports = class mute extends Command {
	constructor(client) {
		super(client, {
			name: "mute",
			category: "moderation",
			aliases: ['silenciar','m'],
			description: "Silencia um usuário temporariamente por desrespeito às regras.",
			UserPermission: ["MANAGE_MESSAGES"],
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
async run({ message, args, client, server}) {
  
   const embedh = new EmbedBuilder()
  .setTitle(`<:DuvidaMario:566084477114384387> | **AJUDA: COMANDO MUTE** | <:DuvidaMario:566084477114384387>`)
  .setDescription(`Utilize \`${server.prefix}mute <usuario> <tempo> <motivo>\``)
  .setColor('RANDOM');

  if(!args[0]||args[0].includes("help")||args[0].includes("ajuda")) return message.channel.send(embedh)

  if (!message.member.hasPermission('MUTE_MEMBERS')) return error.Mute(message)
    let member = message.guild.member(message.mentions.users.first() || message.guild.members.cache.get(args[0]));

      if (!member) return message.reply("Não encontrei esse usuário neste servidor");

      let reason = args.slice(2).join(" ");
      if (!reason) return error.noReason(message)
    let mutetime = args.slice(1,2).join("");

      let muterole = message.guild.roles.cache.find(r => r.id === `${server.cargoMute}`.replace(/[<@&>]/g, ""));

        punish = new client.database.Punish({
          _id: mongoose.Types.ObjectId(),
          usuario: member.displayName,
          uid: member.user.id,
          motivo: reason,
          staff: message.author.username,
          staffid: message.author.id,
          servidor: message.guild.id,
          punição: 'silenciamento',
          data: moment.utc(message.createdAt).format('LLLL'),

      })

    punish.save()

      if (!muterole) {
               muterole = await message.guild.roles.create({
                 data: {
                  name: "Mutado",
                  color: "#3F0875",
                  permissions: []
                 }
              })
              message.guild.channels.cache.forEach(async (channel, id) => {
                  await channel.createOverwrite(muterole, {
                      SEND_MESSAGES: false,
                      ADD_REACTIONS: false,
                      SPEAK: false,
                  });
              });


      }


      const dmembed = new EmbedBuilder()
          .setThumbnail(message.guild.iconURL)
          .setAuthor(message.guild.name)
          .setDescription(`Você foi punido por desrespeitar as regras do servidor ${message.guild.name}`)
          .addFields("***Punição | Mutado***")
          .addFields("*** Staff***", `${message.author.username}`)
          .addFields("**Tempo**", `${mutetime}`)
          .addFields(" ***ID do staff***", `${message.author.id}`)
          .addFields(" ***Motivo***", reason)
          .setColor(color.moderation)


    const unmutem = new EmbedBuilder()
    .setThumbnail(member.user.avatarURL)
    .setTitle('***Punição | Desmutado***')
    .addFields('***Usuário***', member)
    .addFields('***ID do Usuário***', member.id)
    .addFields('***Motivo***', ' AUTO')
    .setColor(color.moderation)



      const muteembed = new EmbedBuilder()
          .setThumbnail(member.user.avatarURL)
          .setDescription(`O usuário foi punido(a) por desrespeitar as regras do servidor!`)
          .addFields("🚫 |*** Punição | Mute***")
          .addFields("👮🏻 | ***Staff***", `${message.author.username}`)
          .addFields("🔧 | ***ID do staff***", `${message.author.id}`)
          .addFields("👤 | ***Usuário***", `${member}`)
          .addFields("⚙️ | ***ID do usuário***:", `${member.id}`)
          .addFields("**Tempo**", `${mutetime}`)
          .addFields("📑 | ***Motivo***", reason)
          .setColor(color.moderation)
          .setTimestamp(new Date())

      let sChannel = message.guild.channels.cache.get(`${server.cPunicoes}`.replace(/[<#>]/g, ""))  
      if(!sChannel) return message.reply('***O canal ' + `${server.cPunicoes}` + ' não foi encontrado. Crie-o para que eu possa registrar os eventos de punição por lá. ***')

      sChannel.send(muteembed);
      message.channel.send(`<@${member.id}> está mutado por ${mutetime}`)
      member.roles.add(muterole.id);

          setTimeout(function() {
              message.guild.member(member).roles.remove(muterole.id)
              sChannel.send(unmutem)
          }, parse(mutetime));


  }
}
