const Event = require('../structures/EventManager');

module.exports = class extends Event {

	constructor(...args) {
		super(...args, {
			once: true
		});
	}

	run() {
		console.log([
			`Logado em ${this.client.user.tag}`,
			`${this.client.commands.size} comandos carregados!`,
			`${this.client.events.size} eventos carregados!`
		].join('\n'));
	}
  
};
