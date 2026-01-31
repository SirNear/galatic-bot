const { SlashCommandBuilder } = require('discord.js');
const Command = require('../../structures/Command');
const { BotConfig } = require('../../mongoose');

module.exports = class Dev extends Command {
    constructor(client) {
        super(client, {
            name: "dev",
            description: "Ativa/Desativa o modo de manutenção do bot.",
            category: "dev",
            aliases: ["manutencao"],
            UserPermission: [],
            clientPermission: [],
            OnlyDevs: true,
            slash: true,
        });

        if (this.config.slash) {
            this.data = new SlashCommandBuilder()
                .setName(this.config.name)
                .setDescription(this.config.description);
        }
    }

    async execute(interaction) {
        if (!this.client.owners.includes(interaction.user.id)) {
            return interaction.reply({ content: '❌ Apenas desenvolvedores podem usar este comando.', ephemeral: true });
        }

        let config = await BotConfig.findById('global');
        if (!config) {
            config = new BotConfig({ _id: 'global', maintenance: false });
        }

        config.maintenance = !config.maintenance;
        await config.save();
        
        this.client.maintenance = config.maintenance;

        const status = this.client.maintenance ? "ATIVADO 🔴" : "DESATIVADO 🟢";
        await interaction.reply({ content: `🛠️ Modo de desenvolvimento (manutenção) **${status}**.`, ephemeral: true });
    }
}
