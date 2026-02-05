const { InteractionType } = require('discord.js');

// Importa os novos handlers de interação
const { handleLoreInteraction } = require('./loreInteraction.js');
const { handleAppearanceInteraction } = require('./appearanceInteraction.js');
const { handleFichaInteraction } = require('./fichaInteraction.js');
const { handleQuestInteraction } = require('./questInteraction.js');
const { handleLojaInteraction } = require('./lojaInteraction.js');
const { handleEmbedEditInteraction } = require('./embedInteraction.js');

module.exports = class {
    constructor(client) {
        this.client = client;
    }

    async run(interaction) {
        try {
            if (this.client.maintenance && !this.client.owners.includes(interaction.user.id)) {
                if (interaction.isRepliable()) {
                    return interaction.reply({ content: '🛠️ O bot está em modo de manutenção/desenvolvimento. Por favor, aguarde.', ephemeral: true }).catch(() => {});
                }
                return;
            }

            if (interaction.isChatInputCommand()) {
                const command = this.client.slashCommands.get(interaction.commandName);
                if (!command) {
                    await interaction.reply({ content: 'Comando não encontrado.', flags: 64 });
                    return;
                }

                await command.execute(interaction);
            } else if (interaction.isAutocomplete()) {
                const command = this.client.slashCommands.get(interaction.commandName);
                if (!command || !command.autocomplete) return;
                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    console.error(`Erro no autocomplete para o comando ${interaction.commandName}:`, error);
                }
            } else if (interaction.type === InteractionType.MessageComponent || interaction.type === InteractionType.ModalSubmit) {
                const customId = interaction.customId;

                if (customId.startsWith('lore_') || customId.startsWith('delete_chapter_') || customId.startsWith('add_chapter_modal_') || customId.startsWith('edit_page_modal_') || customId.startsWith('add_image_modal_')) {
                    await handleLoreInteraction(interaction, this.client);
                } else if (customId.startsWith('approve_quest_') || customId.startsWith('reject_quest_')) {
                    await handleQuestInteraction(interaction, this.client);
                } else if (
                    customId.startsWith('edit_appearance_') || 
                    customId.startsWith('delete_appearance_') || 
                    customId.startsWith('confirm_delete_ap_') || 
                    customId.startsWith('modal_edit_appearance_')
                ) {
                    await handleAppearanceInteraction(interaction, this.client);
                } else if (
                    customId.startsWith('loja') || customId.startsWith('approve_loja_') || customId.startsWith('reject_loja_') || customId.startsWith('categoria_') || customId.startsWith('prev_item_') || customId.startsWith('next_item_') || customId.startsWith('buy_item_')
                ) {
                    await handleLojaInteraction(interaction, this.client);
                } else if (
                    customId.startsWith('modal_edit_ficha_') || 
                    customId.startsWith('modal_edit_habilidade_') ||
                    customId.startsWith('modal_edit_subhab_') ||
                    customId.startsWith('modal_add_image_hab_') ||
                    customId.startsWith('modal_add_image_subhab_')
                ) {
                    await handleFichaInteraction(interaction, this.client);
                }else if(customId === 'btn_edit') {
                    await handleEmbedEditInteraction(interaction, this.client);
                }
            }
        } catch (err) {
            if (err.code === 10062 || err.code === 40060) {
                console.warn(`[INTERACTION] Erro ${err.code} ao processar interação (ignorado): ${err.message}`);
                return;
            }
            console.error('Erro global ao processar interação:', err);
            if (interaction.replied || interaction.deferred) return;
            await interaction.reply({ content: 'Ocorreu um erro ao executar este comando!', flags: 64 }).catch(() => {});
        }
    }
};