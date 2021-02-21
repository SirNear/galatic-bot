module.exports = class Command {

	constructor(client, name, options = {}) {
		this.client = client;
		this.name = options.name || name;
		this.aliases = options.aliases || [];
		this.description = options.description || 'Sem descrição.';
		this.category = options.category || 'Indefinida';
		this.usage = options.usage || 'Sem uso escrito';
	}

	// eslint-disable-next-line no-unused-vars
	async run(message, args) {
		throw new Error(`Comando ${this.name} Não possui um método de inciar!`);
	}

};
