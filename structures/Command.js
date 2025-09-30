module.exports = class Command {
	constructor(client, options) {
		this.client = client

		this.config = {
			name: options.name || null,
			category: options.category || "util",
			aliases: options.aliases || [],
			UserPermission: options.UserPermission || null,
			ClientPermission: options.ClientPermission || null,
			OnlyDevs: options.OnlyDevs || false,
			debug: options.debug || false,
			structure: options.structure || null || '',
			slash: options.slash || false, // Adiciona a propriedade slash à configuração
			description: options.description || null
		}
	}

	// Método padrão para slash commands.
	// Se um comando não tiver um `execute` próprio, ele chamará o `run`.
	// Isso permite que comandos de prefixo e barra compartilhem a mesma lógica.
	async execute(interaction) {
		// `this.run` precisa ser chamado com o contexto correto.
		return this.run(interaction);
	}

	setT(t) {
		this.config.t = t
	}

	getT() {
		return this.config.t
	}
	
	getOption(message, yes = ["adicionar", "adc", "add", "insert"], no = ["remover", "remove", "delete", "deletar"]) {
		const cleanMessage = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
		if (yes.filter(a => a === cleanMessage)[0]) return "yes"
		if (no.filter(a => a === cleanMessage)[0]) return "no"
		return null
	}	
	
}
