const { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    InteractionType,
    ComponentType
} = require('discord.js');

module.exports = class {
    constructor(client) {
        this.client = client;
    }

    async run(interaction) {
        try {
            if (interaction.isChatInputCommand()) {
                const command = this.client.slashCommands.get(interaction.commandName);
                if (!command) {
                    await interaction.reply({ content: 'Comando não encontrado.', flags: 64 });
                    return;
                }

                await command.execute(interaction);
            } else if (interaction.isButton()) {
                // Roteia os botões de aprovação de quest para o handler correto
                if (interaction.customId.startsWith('approve_quest_') || interaction.customId.startsWith('reject_quest_')) {
                    return this.client.handleQuestApproval(interaction);
                }
            }
        } catch (err) {
            console.error('Erro global ao processar interação:', err);
            if (interaction.replied || interaction.deferred) return;
            await interaction.reply({ content: 'Ocorreu um erro ao executar este comando!', flags: 64 }).catch(() => {});
        }
    }
};