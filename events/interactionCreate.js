const { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder 
} = require('discord.js');

module.exports = class {
    constructor(client) {
        this.client = client;
    }

    async run(interaction) {
        try {
            if (!interaction.isCommand() && !interaction.isModalSubmit() && !interaction.isButton()) {
                return;
            }

            // Handle Modal Submits
            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('modal_edit_ficha_')) {
                    await this.handleFichaEdit(interaction);
                    return;
                }
                else if (interaction.customId.startsWith('modal_edit_habilidade_')) {
                    await this.handleHabilidadeEdit(interaction);
                    return;
                }
            }

            // Handle Button Interactions
            if (interaction.isButton()) {
                // A maior parte da lógica de botões é tratada dentro dos coletores nos próprios comandos.
            }

            // Handle Command Interactions
            if (interaction.isChatInputCommand()) {
                const command = this.client.slashCommands.get(interaction.commandName);
                if (!command) return;

                await command.execute(interaction);
            }
        } catch (err) {
            console.error('Erro ao processar interação:', err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'Ocorreu um erro ao executar este comando!',
                    flags: 64 // Substitui ephemeral: true
                });
            }
        }
    }

    async handleFichaEdit(interaction) {
        try {
            await interaction.deferReply({ flags: 64 });

            const fichaId = interaction.customId.split('_')[3];
            const ficha = await this.client.database.Ficha.findById(fichaId);

            if (!ficha || ficha.userId !== interaction.user.id) {
                return interaction.editReply({ content: "Erro: Ficha não encontrada ou você não tem permissão para editá-la." });
            }

            ficha.nome = interaction.fields.getTextInputValue('edit_nome');
            ficha.raca = interaction.fields.getTextInputValue('edit_raca');
            ficha.reino = interaction.fields.getTextInputValue('edit_reino');
            ficha.aparencia = interaction.fields.getTextInputValue('edit_aparencia');

            await ficha.save();

            await interaction.editReply({ content: `✅ Ficha **${ficha.nome}** atualizada com sucesso! Use \`/ficha ver\` para visualizar as alterações.` });

        } catch (err) {
            console.error('Erro ao editar ficha:', err);
            await interaction.editReply({ content: 'Ocorreu um erro ao salvar as alterações da ficha.' }).catch(() => {});
        }
    }

    async handleHabilidadeEdit(interaction) {
        try {
            await interaction.deferReply({ flags: 64 });

            const [,,, fichaId, habilidadeId] = interaction.customId.split('_');
            const ficha = await this.client.database.Ficha.findById(fichaId);

            if (!ficha || ficha.userId !== interaction.user.id) {
                return interaction.editReply({ content: "Erro: Ficha não encontrada ou você não tem permissão para editá-la." });
            }

            const habilidade = ficha.habilidades.id(habilidadeId);
            if (!habilidade) {
                return interaction.editReply({ content: "Erro: Habilidade não encontrada para edição." });
            }

            const nomeAntigo = habilidade.nome;

            habilidade.nome = interaction.fields.getTextInputValue('edit_hab_nome');
            habilidade.categoria = interaction.fields.getTextInputValue('edit_hab_categoria');
            habilidade.custo = interaction.fields.getTextInputValue('edit_hab_custo') || 'Nenhum';
            habilidade.descricao = interaction.fields.getTextInputValue('edit_hab_descricao');

            await ficha.save();

            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Habilidade Atualizada!')
                .setDescription(`A habilidade **${nomeAntigo}** (agora **${habilidade.nome}**) foi atualizada com sucesso na ficha de **${ficha.nome}**.`)
                .addFields(
                    { name: 'Nova Categoria', value: habilidade.categoria, inline: true },
                    { name: 'Novo Custo', value: habilidade.custo, inline: true }
                );

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('Erro ao editar habilidade:', err);
            await interaction.editReply({ content: 'Ocorreu um erro ao salvar as alterações da habilidade.' }).catch(() => {});
        }
    }
};