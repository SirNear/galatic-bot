const ActivityType = require('discord.js')

module.exports = class {

	constructor(client) {
		this.client = client
	}

	async run() {

		
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
			this.client.user.setActivity(randomStatus, {type: randomStatus} )
		}, 10000)
		
	}
  
};
