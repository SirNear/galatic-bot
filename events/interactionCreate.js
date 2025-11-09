const { 
    ModalBuilder, 
    EmbedBuilder,
    TextInputBuilder, 
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    InteractionType,
    ComponentType
} = require('discord.js');
const { google } = require("googleapis");

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
                if (interaction.customId.startsWith('approve_quest_') || interaction.customId.startsWith('reject_quest_')) {
                    return this.client.handleQuestApproval(interaction);
                }

                if (interaction.customId.startsWith('lore_manage_')) {
                    const parts = interaction.customId.split('_');
                    const manageAction = parts[2];
                    const messageId = parts[3];
                    const lore = await this.client.database.Lore.findOne({ messageId: messageId });

                    if (!lore || interaction.user.id !== lore.createdBy) {
                        return interaction.reply({ content: '❌ Você não tem permissão para gerenciar esta lore.', ephemeral: true });
                    }

                    if (manageAction === 'edit-title') {
                        const modal = new ModalBuilder()
                            .setCustomId(`lore_edit_title_modal_${messageId}`)
                            .setTitle('Editar Título da Lore');
                        const titleInput = new TextInputBuilder()
                            .setCustomId('lore_title_input')
                            .setLabel("Novo Título da Lore")
                            .setStyle(TextInputStyle.Short)
                            .setValue(lore.title)
                            .setRequired(true);
                        modal.addComponents(new ActionRowBuilder().addComponents(titleInput));
                        await interaction.showModal(modal);
                    } else if (manageAction === 'delete-lore') {
                        const confirmRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`lore_delete_confirm_${messageId}`).setLabel('Sim, EXCLUIR TUDO!').setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId('lore_delete_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
                        );
                        await interaction.reply({
                            content: `⚠️ **ATENÇÃO!** Você tem certeza que deseja excluir **TODA** a lore **"${lore.title}"**? Esta ação é irreversível e apagará todos os capítulos e páginas.`,
                            components: [confirmRow],
                            ephemeral: true
                        });
                    }
                    return;
                }

                if (interaction.customId.startsWith('lore_delete_confirm_') || interaction.customId === 'lore_delete_cancel') {
                    if (interaction.customId.startsWith('lore_delete_confirm_')) {
                        const messageId = interaction.customId.split('_')[3];
                        const lore = await this.client.database.Lore.findOne({ messageId: messageId });

                        if (!lore || interaction.user.id !== lore.createdBy) {
                            return interaction.update({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', components: [] });
                        }

                        try {
                            const loreMessage = await interaction.channel.messages.fetch(messageId);
                            await loreMessage.delete();
                        } catch (error) {
                            console.warn(`Não foi possível deletar a mensagem da lore (ID: ${messageId}). Pode já ter sido deletada.`);
                        }

                        await this.client.database.Lore.deleteOne({ messageId: messageId });

                        await interaction.update({ content: `✅ A lore **"${lore.title}"** foi excluída permanentemente.`, components: [] });

                    } else if (interaction.customId === 'lore_delete_cancel') {
                        await interaction.update({ content: 'Operação de exclusão cancelada.', components: [] });
                    }
                    return;
                }


                    if (interaction.customId.startsWith('lore_')) { 
                    const parts = interaction.customId.split('_');

                    const action = parts[1];
                    let messageId;
                    if (action === 'read') { 
                        messageId = parts[2];
                    } else if (action === 'add' && parts[2] === 'chapter') { 
                        messageId = parts[3];
                    } else { 
                        messageId = parts[3]; 
                    }
                    const lore = await this.client.database.Lore.findOne({ messageId: messageId });


                    if (!lore) {
                        return interaction.reply({ content: '❌ Esta lore parece estar desatualizada ou corrompida.', ephemeral: true });
                    }

                    let chapterIndex = parseInt(parts[4] || '0', 10);
                    let pageIndex = parseInt(parts[5] || '0', 10);
                    switch (action) {
                        case 'prev':
                            if (parts[2] === 'page' && pageIndex > 0) {
                                pageIndex--;
                            } else if (parts[2] === 'chapter' && chapterIndex > 0) {
                                chapterIndex--;
                                pageIndex = 0;
                            }
                            break;
                        case 'next':
                            if (parts[2] === 'page' && pageIndex < lore.chapters[chapterIndex].pages.length - 1) { 
                            } else if (parts[2] === 'chapter' && chapterIndex < lore.chapters.length - 1) {
                                chapterIndex++;
                                pageIndex = 0;
                            }
                            break;
                        case 'edit':
                            if (parts[2] === 'page' && interaction.user.id === lore.createdBy) {
                                const editModal = new ModalBuilder()
                                    .setCustomId(`edit_page_modal_${messageId}_${chapterIndex}_${pageIndex}`)
                                    .setTitle('Editar Conteúdo da Página');
                                const pageContentInput = new TextInputBuilder()
                                    .setCustomId('page_content_input')
                                    .setLabel("Conteúdo da página")
                                    .setStyle(TextInputStyle.Paragraph) 
                                    .setValue(lore.chapters[chapterIndex].pages[pageIndex].content) 
                                    .setRequired(true);
                                editModal.addComponents(new ActionRowBuilder().addComponents(pageContentInput));
                                await interaction.showModal(editModal);
                                return;
                            }
                            break;
                        case 'delete':
                             if (parts[2] === 'chapter' && interaction.user.id === lore.createdBy) {
                                const confirmRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId(`delete_chapter_confirm_${messageId}_${chapterIndex}`).setLabel('Sim, excluir!').setStyle(ButtonStyle.Danger),
                                    new ButtonBuilder().setCustomId('delete_chapter_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
                                );
                                await interaction.reply({
                                    content: `Tem certeza que deseja excluir o capítulo **"${lore.chapters[chapterIndex].name}"**? Esta ação não pode ser desfeita.`,
                                    components: [confirmRow],
                                    ephemeral: true
                                });
                                return; 
                            }
                            break;
                        case 'add-image':
                            if (interaction.user.id === lore.createdBy) {
                                const imageModal = new ModalBuilder()
                                    .setCustomId(`add_image_modal_${messageId}_${chapterIndex}_${pageIndex}`)
                                    .setTitle('Adicionar Imagem à Página');
                                const imageUrlInput = new TextInputBuilder()
                                    .setCustomId('image_url_input')
                                    .setLabel("URL da Imagem")
                                    .setStyle(TextInputStyle.Short)
                                    .setPlaceholder('https://exemplo.com/imagem.png')
                                    .setRequired(true);
                                imageModal.addComponents(new ActionRowBuilder().addComponents(imageUrlInput));
                                await interaction.showModal(imageModal);
                            }
                            return;
                        case 'add': 
                            if (parts[1] === 'add' && parts[2] === 'chapter' && interaction.user.id !== lore.createdBy) {
                                return interaction.reply({ content: '❌ Você não tem permissão para adicionar capítulos a esta lore.', ephemeral: true });
                            }
                            const modal = new ModalBuilder()
                                .setCustomId(`add_chapter_modal_${lore.messageId}`)
                                .setTitle('Adicionar Novo Capítulo');
                            const chapterNameInput = new TextInputBuilder()
                                .setCustomId('chapter_name_input')
                                .setLabel("Nome do Novo Capítulo")
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('Ex: Capítulo 2: A Vingança')
                                .setRequired(true);
                            modal.addComponents(new ActionRowBuilder().addComponents(chapterNameInput));
                            await interaction.showModal(modal);
                            return; 
                        case 'read':
                            break;
                        default:
                            return; 
                    }

                    const generateEphemeralEmbed = (loreDoc, chapIdx, pIdx) => {
                        const chapter = loreDoc.chapters[chapIdx];
                        return new EmbedBuilder()
                            .setTitle(loreDoc.title)
                            .setColor('#0099ff')
                            .setAuthor({ name: `Lore por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() }) 
                            .setDescription(chapter.pages[pIdx].content)
                            .setImage(chapter.pages[pIdx].imageUrl || null)
                            .setFooter({ text: `${chapter.name} - Parte ${pIdx + 1} de ${chapter.pages.length}` })
                            .setTimestamp();
                    };

                    const getEphemeralButtons = (loreDoc, chapIdx, pIdx) => {
                        const totalChapters = loreDoc.chapters.length;
                        const totalPagesInChapter = loreDoc.chapters[chapIdx].pages.length;                        const chapterNavRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`lore_prev_chapter_${messageId}_${chapIdx}_${pIdx}`).setLabel('<< Cap. Anterior').setStyle(ButtonStyle.Secondary).setDisabled(chapIdx === 0),
                            new ButtonBuilder().setCustomId(`lore_next_chapter_${messageId}_${chapIdx}_${pIdx}`).setLabel('Cap. Próximo >>').setStyle(ButtonStyle.Secondary).setDisabled(chapIdx >= totalChapters - 1)
                        );
                        const pageNavRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`lore_prev_page_${messageId}_${chapIdx}_${pIdx}`).setLabel('◀️').setStyle(ButtonStyle.Primary).setDisabled(pIdx === 0),
                            new ButtonBuilder().setCustomId(`lore_next_page_${messageId}_${chapIdx}_${pIdx}`).setLabel('▶️').setStyle(ButtonStyle.Primary).setDisabled(pIdx >= totalPagesInChapter - 1)
                        );

                        const components = [chapterNavRow, pageNavRow];

                        if (interaction.user.id === loreDoc.createdBy) {
                            const ownerActionsRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId(`lore_add_chapter_${messageId}`).setLabel('Adicionar Capítulo').setStyle(ButtonStyle.Success).setEmoji('➕'),
                                new ButtonBuilder().setCustomId(`lore_edit_page_${messageId}_${chapIdx}_${pIdx}`).setLabel('Editar Texto').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
                                new ButtonBuilder().setCustomId(`lore_add-image_${messageId}_${chapIdx}_${pIdx}`).setLabel('Imagem').setStyle(ButtonStyle.Secondary).setEmoji('🌄'),
                                new ButtonBuilder().setCustomId(`lore_delete_chapter_${messageId}_${chapIdx}_${pIdx}`).setLabel('Excluir Capítulo').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(totalChapters <= 1) // Desabilitado se só houver 1 cap
                            );
                            components.unshift(ownerActionsRow);
                        }
                        return components;
                    };

                    const responseOptions = {
                        embeds: [generateEphemeralEmbed(lore, chapterIndex, pageIndex)],
                        components: getEphemeralButtons(lore, chapterIndex, pageIndex),
                        flags: 64 
                    };

                    if (action === 'read') {
                        await interaction.reply(responseOptions);
                    } else {
                        await interaction.update(responseOptions);
                    }
                    return; 
                }

                if (interaction.customId.startsWith('delete_chapter_')) {
                    if (interaction.customId.startsWith('delete_chapter_confirm_')) {
                        const parts = interaction.customId.split('_');
                        const messageId = parts[3];
                        const chapterIndex = parseInt(parts[4], 10);

                        const lore = await this.client.database.Lore.findOne({ messageId: messageId });
                        if (!lore || interaction.user.id !== lore.createdBy) {
                            return interaction.update({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', components: [] });
                        }
                        if (lore.chapters.length <= 1) {
                            return interaction.update({ content: '❌ Você não pode excluir o único capítulo da lore.', components: [] });
                        }

                        const chapterName = lore.chapters[chapterIndex].name;
                        lore.chapters.splice(chapterIndex, 1); 
                        await lore.save();

                        await interaction.update({
                            content: `✅ O capítulo **"${chapterName}"** foi excluído com sucesso. Você pode fechar esta mensagem.`,
                            components: []
                        });

                    } else if (interaction.customId === 'delete_chapter_cancel') {
                        await interaction.update({
                            content: 'Operação de exclusão cancelada.',
                            components: []
                        });
                    }
                    return;
                }

                // Lógica para botões de gerenciamento de aparência
                if (interaction.customId.startsWith('edit_appearance_') || interaction.customId.startsWith('delete_appearance_')) {
                    const parts = interaction.customId.split('_');
                    const appearanceAction = parts[0]; // 'edit' ou 'delete'
                    const rowIndex = parseInt(parts[parts.length - 1], 10); // Pega o último elemento, que é sempre o número da linha

                    const auth = new google.auth.GoogleAuth({
                        keyFile: "./api/regal-primacy-233803-4fc7ea1a8a5a.json",
                        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
                    });
                    const sheets = google.sheets({ version: "v4", auth });

                    if (isNaN(rowIndex)) {
                        console.error("Erro: rowIndex inválido ao processar aparência. CustomID:", interaction.customId);
                        return interaction.reply({ content: '❌ Ocorreu um erro ao processar esta ação (ID de linha inválido).', ephemeral: true });
                    }

                    const res = await sheets.spreadsheets.values.get({
                        spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                        range: `INDIVIDUAIS!A${rowIndex}:D${rowIndex}`,
                    });

                    const rowData = res.data.values ? res.data.values[0] : null;
                    if (!rowData) {
                        return interaction.reply({ content: '❌ Não foi possível encontrar os dados desta aparência. Pode ter sido movida ou excluída.', ephemeral: true });
                    }

                    const [aparencia, universo, personagem, jogador] = rowData;

                    if (appearanceAction === 'edit') {
                        const modal = new ModalBuilder()
                            .setCustomId(`modal_edit_appearance_${rowIndex}`)
                            .setTitle('Editar Aparência');

                        const nomeInput = new TextInputBuilder().setCustomId('edit_ap_nome').setLabel("Nome da Aparência").setStyle(TextInputStyle.Short).setValue(aparencia || '').setRequired(true);
                        const universoInput = new TextInputBuilder().setCustomId('edit_ap_universo').setLabel("Universo de Origem").setStyle(TextInputStyle.Short).setValue(universo || '').setRequired(true);
                        const personagemInput = new TextInputBuilder().setCustomId('edit_ap_personagem').setLabel("Personagem do RPG").setStyle(TextInputStyle.Short).setValue(personagem || '').setRequired(true);

                        modal.addComponents(
                            new ActionRowBuilder().addComponents(nomeInput),
                            new ActionRowBuilder().addComponents(universoInput),
                            new ActionRowBuilder().addComponents(personagemInput)
                        );
                        await interaction.showModal(modal);

                    } else if (appearanceAction === 'delete') {
                        const confirmRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`confirm_delete_ap_${rowIndex}`).setLabel('Sim, liberar aparência').setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId('cancel_delete_ap').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
                        );
                        await interaction.reply({
                            content: `Tem certeza que deseja liberar a aparência **${aparencia}** do universo **${universo}**? Esta ação não pode ser desfeita.`,
                            components: [confirmRow],
                            ephemeral: true
                        });
                    }
                    return;
                }

                if (interaction.customId.startsWith('confirm_delete_ap_') || interaction.customId === 'cancel_delete_ap') {
                    if (interaction.customId === 'cancel_delete_ap') {
                        return interaction.update({ content: 'Operação cancelada.', components: [] });
                    }

                    await interaction.deferUpdate();
                    const rowIndex = parseInt(interaction.customId.split('_')[3], 10);

                    const auth = new google.auth.GoogleAuth({
                        keyFile: "./api/regal-primacy-233803-4fc7ea1a8a5a.json",
                        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
                    });
                    const sheets = google.sheets({ version: "v4", auth });

                    // Pega os dados antes de deletar para usar no log
                    const res = await sheets.spreadsheets.values.get({
                        spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                        range: `INDIVIDUAIS!A${rowIndex}:D${rowIndex}`,
                    });
                    const rowData = res.data.values ? res.data.values[0] : null;

                    // Limpa a linha na planilha
                    await sheets.spreadsheets.values.clear({
                        spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                        range: `INDIVIDUAIS!A${rowIndex}:D${rowIndex}`,
                    });

                    await interaction.editReply({ content: '✅ Aparência liberada com sucesso!', components: [] });

                    // Envia o log
                    if (rowData) {
                        const [aparencia, universo] = rowData;
                        const logChannelId = '1435999188230996091';
                        const logChannel = await this.client.channels.fetch(logChannelId).catch(() => null);
                        if (logChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setColor('Red')
                                .setTitle('🗑️ Aparência Liberada')
                                .addFields(
                                    { name: 'Aparência', value: aparencia || 'N/A' },
                                    { name: 'Universo', value: universo || 'N/A' },
                                    { name: 'Liberada por', value: `${interaction.user.tag} (${interaction.user.id})` }
                                )
                                .setTimestamp();
                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    }
                    return;
                }

            } else if (interaction.isModalSubmit()) {

                if (interaction.customId.startsWith('add_chapter_modal_')) {
                    const messageId = interaction.customId.split('_')[3];
                    const newChapterName = interaction.fields.getTextInputValue('chapter_name_input');

                    await interaction.reply({ content: `Certo! Agora, para adicionar o capítulo **"${newChapterName}"**, reaja com ➕ na **primeira** mensagem do novo capítulo.`, flags: 64 });

                    const reactionFilter = (reaction, user) => user.id === interaction.user.id && reaction.message.channel.id === interaction.channelId;

                    const startCollectorFn = async (startReaction, user) => {
                        if (!reactionFilter(startReaction, user) || startReaction.emoji.name !== '➕') return;
                        this.client.removeListener('messageReactionAdd', startCollectorFn);
                        const newStartMessage = startReaction.message;

                        await interaction.editReply({ content: 'Ótimo! Agora reaja com ➖ na **última** mensagem do novo capítulo.' });

                        const endCollectorFn = async (endReaction, endUser) => {
                            if (!reactionFilter(endReaction, endUser) || endReaction.emoji.name !== '➖') return;
                            this.client.removeListener('messageReactionAdd', endCollectorFn);
                            const newEndMessage = endReaction.message;

                            if (newStartMessage.createdTimestamp > newEndMessage.createdTimestamp) {
                                return interaction.followUp({ content: '❌ A mensagem de início do capítulo deve ser anterior à de fim. Operação cancelada.', flags: 64 });
                            }

                            await interaction.editReply({ content: 'Processando e adicionando o novo capítulo... Isso pode levar um momento.' });

                            try {
                                const loreCommand = this.client.commands.get('lore');
                                const newMessages = await loreCommand.fetchMessagesBetween(interaction.channel, newStartMessage.id, newEndMessage.id);
                                const newContent = newMessages.filter(msg => msg.content.trim() !== '').map(msg => msg.content).join('\n\n');
                                const newPages = loreCommand.paginateText(newContent);
                                const newPagesAsObjects = newPages.map(content => ({
                                    content: content,
                                    imageUrl: null
                                }));
                                const loreDB = await this.client.database.Lore.findOne({ messageId: messageId });
                                if (!loreDB) return interaction.editReply({ content: '❌ Lore original não encontrada. Operação cancelada.' });

                                loreDB.chapters.push({ name: newChapterName, pages: newPagesAsObjects });
                                await loreDB.save();

                                await interaction.editReply({ content: '✅ Novo capítulo adicionado com sucesso! A mensagem da lore será atualizada.' });

                            } catch (error) {
                                console.error("Erro ao adicionar novo capítulo:", error);
                                await interaction.editReply({ content: '❌ Ocorreu um erro ao adicionar o novo capítulo.' });
                            }
                        };
                        this.client.on('messageReactionAdd', endCollectorFn);
                    };
                    this.client.on('messageReactionAdd', startCollectorFn);
                    return;
                }

                if (interaction.customId.startsWith('edit_chapter_modal_')) {

                    return interaction.reply({ content: 'Esta função foi atualizada para "Editar Página". Por favor, tente novamente.', ephemeral: true });
                }

                if (interaction.customId.startsWith('edit_page_modal_')) {
                    const parts = interaction.customId.split('_');
                    const messageId = parts[3];
                    const chapterIndex = parseInt(parts[4], 10);
                    const pageIndex = parseInt(parts[5], 10);
                    const newPageContent = interaction.fields.getTextInputValue('page_content_input');

                    const lore = await this.client.database.Lore.findOne({ messageId: messageId });
                    if (!lore || interaction.user.id !== lore.createdBy) {
                        return interaction.reply({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', ephemeral: true });
                    }

                    lore.chapters[chapterIndex].pages[pageIndex].content = newPageContent;
                    await lore.save();

                    const currentEmbed = interaction.message.embeds[0];
                    const updatedEmbed = EmbedBuilder.from(currentEmbed).setDescription(newPageContent);

                    await interaction.update({ embeds: [updatedEmbed] });
                    return;
                }

                if (interaction.customId.startsWith('add_image_modal_')) {
                    const parts = interaction.customId.split('_');
                    const messageId = parts[3];
                    const chapterIndex = parseInt(parts[4], 10);
                    const pageIndex = parseInt(parts[5], 10);
                    const imageUrl = interaction.fields.getTextInputValue('image_url_input');

                    const lore = await this.client.database.Lore.findOne({ messageId: messageId });
                    if (!lore || interaction.user.id !== lore.createdBy) {
                        return interaction.reply({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', ephemeral: true });
                    }

                    lore.chapters[chapterIndex].pages[pageIndex].imageUrl = imageUrl;
                    await lore.save();

                    const currentEmbed = interaction.message.embeds[0];
                    const updatedEmbed = EmbedBuilder.from(currentEmbed).setImage(imageUrl);

                    await interaction.update({ embeds: [updatedEmbed] });
                    return;
                }

                if (interaction.customId.startsWith('lore_edit_title_modal_')) {
                    const messageId = interaction.customId.split('_')[4];
                    const newTitle = interaction.fields.getTextInputValue('lore_title_input');

                    await this.client.database.Lore.updateOne({ messageId: messageId }, { $set: { title: newTitle } });

                    const loreMessage = await interaction.channel.messages.fetch(messageId);
                    const updatedEmbed = EmbedBuilder.from(loreMessage.embeds[0]).setTitle(newTitle);
                    await loreMessage.edit({ embeds: [updatedEmbed] });

                    await interaction.reply({ content: `✅ O título da lore foi atualizado com sucesso!`, ephemeral: true });
                    return;
                }


                if (interaction.customId === 'lore_modal_config') {
                    try {
                        await interaction.deferReply({ flags: 64 });

                        const title = interaction.fields.getTextInputValue('lore_title');
                        const chapter = interaction.fields.getTextInputValue('lore_chapter');

                        const loreState = this.client.fichaStates.get(interaction.user.id);
                        if (!loreState || !loreState.pages) {
                            return interaction.editReply({ content: '❌ Não foi possível encontrar a lore para salvar. Por favor, tente novamente.' });
                        }

                        const { pages } = loreState;

                        if (!interaction.channel || !interaction.channel.isTextBased()) {
                            return interaction.editReply({
                                content: '❌ Erro: Não foi possível enviar a lore neste canal.'
                            });
                        }

                        let currentPage = 0;

                        const generateEmbed = (pageIndex) => {
                            return new EmbedBuilder()
                                .setTitle(title)
                                .setColor('#0099ff')
                                .setAuthor({ name: `Lore por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                                .setDescription(pages[pageIndex].content)
                                .setFooter({ text: `${chapter} - Parte ${pageIndex + 1} de ${pages.length}` })
                                .setTimestamp();
                        };

                        const loreMessage = await interaction.channel.send({
                            embeds: [generateEmbed(currentPage)]
                        });

                        const publicButtons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`lore_read_${loreMessage.id}`)
                                .setLabel('📖 Ler Lore')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId(`lore_manage_edit-title_${loreMessage.id}`)
                                .setLabel('Editar Título').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
                            new ButtonBuilder()
                                .setCustomId(`lore_manage_delete-lore_${loreMessage.id}`)
                                .setLabel('Excluir Lore').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                        );

                        const initialButtons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`lore_read_${loreMessage.id}`) 
                                .setLabel('📖 Ler Lore')
                                .setStyle(ButtonStyle.Success)
                        );

                        await loreMessage.edit({ components: [publicButtons] });

                        await this.client.database.Lore.create({
                            messageId: loreMessage.id,
                            channelId: loreMessage.channel.id,
                            guildId: loreMessage.guild.id,
                            createdBy: interaction.user.id,
                            title: title,
                            chapters: [{ name: chapter, pages: pages }]
                        });

                        this.client.fichaStates.delete(interaction.user.id);
                        await interaction.editReply({ content: `✅ Sua lore foi salva com sucesso neste canal!` });
                    } catch (error) {
                        console.error("Erro ao processar o modal da lore:", error);
                    }
                }

                if (interaction.customId.startsWith('modal_edit_appearance_')) {
                    await interaction.deferReply({ ephemeral: true });
    
                    const rowIndex = parseInt(interaction.customId.split('_')[3], 10);
                    const novoNome = interaction.fields.getTextInputValue('edit_ap_nome');
                    const novoUniverso = interaction.fields.getTextInputValue('edit_ap_universo');
                    const novoPersonagem = interaction.fields.getTextInputValue('edit_ap_personagem');
    
                    const auth = new google.auth.GoogleAuth({
                        keyFile: "./api/regal-primacy-233803-4fc7ea1a8a5a.json",
                        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
                    });
                    const sheets = google.sheets({ version: "v4", auth });
    
                    // Pega o nome do jogador que já está na planilha para não sobrescrever
                    const res = await sheets.spreadsheets.values.get({
                        spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                        range: `INDIVIDUAIS!D${rowIndex}:D${rowIndex}`,
                    });
                    const jogador = res.data.values ? res.data.values[0][0] : '';
    
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                        range: `INDIVIDUAIS!A${rowIndex}:D${rowIndex}`,
                        valueInputOption: "USER_ENTERED",
                        resource: {
                            values: [[novoNome, novoUniverso, novoPersonagem, jogador]],
                        },
                    });
    
                    await interaction.editReply({ content: '✅ Os dados da aparência foram atualizados com sucesso!' });
                    return;
                }
            }


        } catch (err) {
            console.error('Erro global ao processar interação:', err);
            if (interaction.replied || interaction.deferred) return;
            await interaction.reply({ content: 'Ocorreu um erro ao executar este comando!', flags: 64 }).catch(() => {});
        }
    }
};