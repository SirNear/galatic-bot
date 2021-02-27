const Event = require('../structures/EventManager');

module.exports = class extends Event {

	constructor(client) {
		this.client = client
	}

	async run() {
		
		this.client.owner = await this.client.users.fetch("395788326835322882")

		console.log([
			`Logado em ${this.client.user.tag}`,
			`${this.client.commands.size} comandos carregados!`,
			`${this.client.events.size} eventos carregados!`
		].join('\n'));
		
		let status [ 	
			{name: `Pó de café na pia`, type: 'PLAYING'},
			{name: 'Me mencione para saber mais sobre mim!', type: 'PLAYING'},
			{name: `${this.client.guilds.size} universos diferentes!`, type: 'WATCHING'},
			{name: 'Observou bugs? Tem sugestões ou dúvidas? Envie uma DM ao meu criador: Near#7447', type: 'PLAYING'},
			{name: 'Servidor de suporte em andamento.', type: 'PLAYING'}
		]
		
		setInterval(() => {
			let randomStatus = status[Math.floor(Math.random() * status.length)]
			this.client.user.setPresence({ activity: randomStatus })
		}, 30000)
		
	}
  
};
