const {
    ModalBuilder,
    EmbedBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const { google } = require("googleapis");

async function handleAppearanceInteraction(interaction, client) {
    const auth = new google.auth.GoogleAuth({
        keyFile: "./api/regal-primacy-233803-4fc7ea1a8a5a.json",
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo";

    if (interaction.isButton()) {
        if (interaction.customId.startsWith('edit_appearance_') || interaction.customId.startsWith('delete_appearance_')) {
            const parts = interaction.customId.split('_');
            const appearanceAction = parts[0];
            const rowIndex = parseInt(parts[parts.length - 1], 10);

            if (isNaN(rowIndex)) {
                console.error("Erro: rowIndex inválido ao processar aparência. CustomID:", interaction.customId);
                return interaction.reply({ content: '❌ Ocorreu um erro ao processar esta ação (ID de linha inválido).', flags: 64 });
            }

            const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `INDIVIDUAIS!A${rowIndex}:D${rowIndex}` });
            const rowData = res.data.values?.[0];
            if (!rowData) return interaction.reply({ content: '❌ Não foi possível encontrar os dados desta aparência. Pode ter sido movida ou excluída.', flags: 64 });

            const [aparencia, universo] = rowData;

            if (appearanceAction === 'edit') {
                const modal = new ModalBuilder().setCustomId(`modal_edit_appearance_${rowIndex}`).setTitle('Editar Aparência');
                const nomeInput = new TextInputBuilder().setCustomId('edit_ap_nome').setLabel("Nome da Aparência").setStyle(TextInputStyle.Short).setValue(aparencia || '').setRequired(true);
                const universoInput = new TextInputBuilder().setCustomId('edit_ap_universo').setLabel("Universo de Origem").setStyle(TextInputStyle.Short).setValue(universo || '').setRequired(true);
                const personagemInput = new TextInputBuilder().setCustomId('edit_ap_personagem').setLabel("Personagem do RPG").setStyle(TextInputStyle.Short).setValue(rowData[2] || '').setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(nomeInput), new ActionRowBuilder().addComponents(universoInput), new ActionRowBuilder().addComponents(personagemInput));
                await interaction.showModal(modal);
            } else if (appearanceAction === 'delete') {
                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`confirm_delete_ap_${rowIndex}`).setLabel('Sim, liberar aparência').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('cancel_delete_ap').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
                );
                await interaction.reply({ content: `Tem certeza que deseja liberar a aparência **${aparencia}** do universo **${universo}**? Esta ação não pode ser desfeita.`, components: [confirmRow], flags: 64 });
            }
        }

        if (interaction.customId.startsWith('confirm_delete_ap_') || interaction.customId === 'cancel_delete_ap') {
            if (interaction.customId === 'cancel_delete_ap') {
                return interaction.update({ content: 'Operação cancelada.', components: [] });
            }

            await interaction.deferUpdate();
            const rowIndex = parseInt(interaction.customId.split('_')[3], 10);

            const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `INDIVIDUAIS!A${rowIndex}:D${rowIndex}` });
            const rowData = res.data.values?.[0];

            await sheets.spreadsheets.values.clear({ spreadsheetId, range: `INDIVIDUAIS!A${rowIndex}:D${rowIndex}` });
            const userDb = await client.database.userData.findOne({ uid: user.id, uServer: guild.id });

            userDb.tokenAp += 1;
            await userDb.save();
            
            await interaction.editReply({ content: `✅ Aparência liberada com sucesso! Você tem agora ${userDb.tokenAp} token(s) de aparência para registrar novas.`, components: [] });

            if (rowData) {
                const [aparencia, universo] = rowData;
                const logChannel = await client.channels.fetch('1435999188230996091').catch(() => null);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder().setColor('Red').setTitle('🗑️ Aparência Liberada')
                        .addFields(
                            { name: 'Aparência', value: aparencia || 'N/A' },
                            { name: 'Universo', value: universo || 'N/A' },
                            { name: 'Liberada por', value: `${interaction.user.tag} (${interaction.user.id})` }
                        ).setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('modal_edit_appearance_')) {
            const rowIndex = parseInt(interaction.customId.split('_')[3], 10);
            const novoNome = interaction.fields.getTextInputValue('edit_ap_nome');
            const novoUniverso = interaction.fields.getTextInputValue('edit_ap_universo');
            const novoPersonagem = interaction.fields.getTextInputValue('edit_ap_personagem');

            await interaction.deferReply({ flags: 64 });

            const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `INDIVIDUAIS!D${rowIndex}:D${rowIndex}` });
            const jogador = res.data.values?.[0]?.[0] || '';

            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `INDIVIDUAIS!A${rowIndex}:D${rowIndex}`,
                valueInputOption: "USER_ENTERED",
                resource: {
                    values: [[novoNome, novoUniverso, novoPersonagem, jogador]],
                },
            });

            await interaction.editReply({ content: '✅ Os dados da aparência foram atualizados com sucesso!' });
        }
    }
}

module.exports = { handleAppearanceInteraction };