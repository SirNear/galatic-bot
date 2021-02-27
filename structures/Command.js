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
		}
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
