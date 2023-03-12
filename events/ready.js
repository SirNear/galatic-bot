const ActivityType = require('discord.js')

module.exports = class {

	constructor(client) {
		this.client = client
	}

	async run() {
		/*
		
		const guildR = await this.client.database.gReacts.findById()

		if(!guildR) return

		 guildR.forEach(async => {
			let user = this.client.guild.members.cache.get(this.client.guild.ownerId)
			let mensagemEdit = user.user.dmChannel.messages.fetch(guildR.msgId)

            const leaveMessage = new Discord.MessageEmbed()
            .setColor('RANDOM')
            .setTitle('<:GadgetLeave:821521172956053513> | **Espero que não seja um adeus...**')
            .setDescription(`Percebi que me expulsou de seu servidor ${this.client.guild.name}, espero que não seja eterno e que eu não tenha feito nada de errado.`)
            .addField('**Excluir configurações do banco de dados?**', 'Reaja com "<:blackcheck:757662908548382740>" para excluir o servidor do banco de dados do bot. Caso adicione novamente, você terá que configurar novamente.', 'Reaja com "<:errorYaro:816811156512440331>" para cancelar a operação.')
            .addField(`**Convite do Bot**`, "[CLIQUE AQUI](https://discord.com/oauth2/authorize?client_id=INSERT_CLIENT_ID_HERE&scope=bot&permissions=8)")

			mensagemEdit.edit(leaveMessage).then(msg => {
                msg.react('757662908548382740')
                msg.react('816811156512440331')

				guildR.excludeDBFil,
				guildR.excludeDBCol,
				guildR.cancelExFil,
				guildR.cancelExCol

				coletorExcluir.on("collect", em => {
					msg.delete()
					server.delete()
					guildR.delete()
					msg.send('<:blackcheck:757662908548382740> | **Todos os dados do servidor no banco de dados foi apagado. Espero que eu possa voltar um dia.**')

				})

				coletorCancelar.on("collect", em => {
					msg.delete()
					guildR.delete()
					msg.send('<:blackcheck:757662908548382740> | **Os dados do servidor foram mantidos no banco de dados. Espero que eu possa voltar um dia.**')
				})
			})

		})
		
		*/
		
		this.client.owner = await this.client.users.fetch("395788326835322882")

		console.log([
			`Logado em ${this.client.user.tag}`,
			`${this.client.commands.size} comandos carregados!`,
		].join('\n'));
		
		let status = [ 	
			{name: `Pó de café na pia`, type: ActivityType.Playing},
			{name: 'Me mencione para saber mais sobre mim!', type: ActivityType.Playing},
			{name: `${this.client.guilds.size} universos diferentes!`, type: ActivityType.Watching},
			{name: 'Observou bugs? Tem sugestões ou dúvidas? Envie uma DM ao meu criador: Near#7447', type: ActivityType.Playing},
			{name: 'Servidor de suporte em andamento.', type: ActivityType.Playing}
		]
		
		setInterval(() => {
			let randomStatus = status[Math.floor(Math.random() * status.length)]
			this.client.user.setPresence({ activities: [randomStatus.name, {type: randomStatus.type}]})
		}, 10000)
		
	}
  
};
