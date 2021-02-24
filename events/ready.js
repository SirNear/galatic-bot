const Event = require('../structures/EventManager');

module.exports = class extends Event {

	constructor(...args) {
		super(...args, {
			once: true
		});
	}

	async run() {
		
		this.client.owner = await this.client.users.fetch("395788326835322882")

		console.log([
			`Logado em ${this.client.user.tag}`,
			`${this.client.commands.size} comandos carregados!`,
			`${this.client.events.size} eventos carregados!`
		].join('\n'));
	}
  
};
