const { EmbedBuilder, Discord } = require('discord.js');
const Command = require('../../structures/Command');

module.exports = class monitorar extends Command {

	constructor(client) {
		super(client, {
			name: "monitorar",
			category: "moderation",
			aliases: ['monitor', 'monitoramento', 'acompanhar', 'mnt'],
			UserPermission: ["MANAGE_MESSEGES"],
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
	 async run({ message, args, client, server}) {
     
        if (!message.member.hasPermission('MANAGE_MESSAGES')) return error.mngMsg(message);

      let monitored = message.mentions.members.first() || message.guild.members.cache.get(args[0])

        if(!monitored) {
        let embedH = new EmbedBuilder()
        .setTitle('<:hanako_what1:572426031370338315> | **Ajuda: Monitoramento**')
        .setDescription(`Quer ficar de olho nas mensagens de algum infrator junior? Utilize \`${server.prefix}monitor <user>\` e ative o monitoramento de mensagens dele, onde o bot criará um canal com o username dele numa categoria pré-definida e lá enviará todas as mensagens do usuário. \n \n É restrito aos que possuirem o cargo de moderação apenas, verifique o \`${server.prefix}painel ver\` \n \n Para retirar um monitoramento utilize o comando novamente mencionando o usuário desejado e siga as instruções.`)
        .setTimestamp()

        message.channel.send(embedH);

        return

      }

      const auth = await message.guild.members.cache.get(message.author.id)


      const userData = await this.client.database.userData.findById(monitored.id)

      if(!userData) {

        this.client.database.userData({
          _id: monitored.id,
          uid: message.author.id,
          uName: message.author.username,
          uServer: message.guild.id
        }).save()

      }

      if(userData.monitor == 'ativado') { 

        let antiMonitor = new EmbedBuilder()
        .setColor('RANDOM')
        .setTitle('**Este usuário já está sendo monitorado.**')
        .setDescription('Deseja retirar o monitoramento? \n \n <a:verify:695070409787310170> | Sim. \n \n <a:negativo:563096795907883010> | Não.')
        .setTimestamp()

        message.channel.send(antiMonitor).then(msg => {
          msg.react('695070409787310170')
          msg.react('563096795907883010')

          let filtro1 = (reaction, usuario) => reaction.emoji.name === "verify" && usuario.id === message.author.id;
          const coletor1 = msg.createReactionCollector(filtro1, {max: 1, time: 360000});

          let filtro2 = (reaction, usuario) => reaction.emoji.name === "negativo" && usuario.id === message.author.id;
          const coletor2 = msg.createReactionCollector(filtro2, {max: 1, time: 360000});

          coletor1.on("collect", em => {

            msg.delete()

            message.guild.channels.cache.get(`${userData.monitorChannelId}`).delete()

            userData.monitor = 'desativado'
            userData.save()

            message.channel.send(`<a:verify:695070409787310170> **O monitoramento de ${monitored} foi retirado com sucesso!**`)

          })

          coletor2.on("collect", em => {

            msg.delete()

            message.channel.send('**Ação cancelada com sucesso, continuarei vigiando.**')

          })

        })

      }else {

	let category = message.guild.channels.cache.find(c => c.id == server.monitorCategory && c.type == "category");

         if(!category) return message.channel.send(`**ERRO: Configure a categoria de monitoramento através do comando \`${server.prefix}painel ver\` e tente novamente.**`)
	      
        message.guild.channels.create(`${monitored.displayName}`).then(channel => {

              channel.setParent(category.id)

              channel.updateOverwrite(message.guild.roles.everyone.id, {
                VIEW_CHANNEL: false
              })

              let staff = server.staffRole
              if(staff = 'Não definido') channel.send(`**O cargo de moderação não está definido, então o chat está apenas para administradores. Configure usando \`${server.prefix}painel ver\`.**`)

              channel.updateOverwrite(staffRole.replace(/[<@&>]/g, ""), {
                VIEW_CHANNEL: true
              })

              userData.monitor = 'ativado'
              userData.monitorChannelId = channel.id
              userData.save()

              message.channel.send(`**Monitoramento para \`${monitored.displayName}\` ativado.** \n \n ${channel}`)

        }).catch(console.error);

      }
     
     
   }
}
