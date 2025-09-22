const { SlashCommandBuilder } = require('discord.js');

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
            slash: options.slash || false, // novo: indica se tem suporte a slash
            description: options.description || 'Sem descrição fornecida' // novo: descrição para slash
        }

        // Configuração do Slash Command se habilitado
        if (this.config.slash) {
            this.data = new SlashCommandBuilder()
                .setName(this.config.name.toLowerCase())
                .setDescription(this.config.description);
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
	
    // Método para comandos prefixados (mantém compatibilidade)
    async run({ message, args, client, server }) {
        throw new Error(`O comando ${this.config.name} não implementou o método run()`);
    }

    // Novo método para slash commands
    async execute(interaction) {
        throw new Error(`O comando ${this.config.name} não implementou o método execute()`);
    }

    // Helper para verificar se é slash command
    isSlash() {
        return this.config.slash === true;
    }
}
