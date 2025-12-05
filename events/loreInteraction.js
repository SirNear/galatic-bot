const {
    ModalBuilder,
    EmbedBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    AttachmentBuilder,
    ComponentType
} = require('discord.js');
const fetch = require('node-fetch');
const { messagesToTxt } = require('../api/messagesToTxt.js');

async function handleLoreInteraction(interaction, client) {
    // Lógica de botões da Lore
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('lore_manage_')) {
            const parts = interaction.customId.split('_');
            const manageAction = parts[2];
            const messageId = parts[3];
            const lore = await client.database.Lore.findOne({ messageId: messageId });

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
                const lore = await client.database.Lore.findOne({ messageId: messageId });

                if (!lore || interaction.user.id !== lore.createdBy) {
                    return interaction.update({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', components: [] });
                }

                try {
                    const loreMessage = await interaction.channel.messages.fetch(messageId);
                    await loreMessage.delete();
                } catch (error) {
                    console.warn(`Não foi possível deletar a mensagem da lore (ID: ${messageId}). Pode já ter sido deletada.`);
                }

                await client.database.Lore.deleteOne({ messageId: messageId });
                await interaction.update({ content: `✅ A lore **"${lore.title}"** foi excluída permanentemente.`, components: [] });
            } else if (interaction.customId === 'lore_delete_cancel') {
                await interaction.update({ content: 'Operação de exclusão cancelada.', components: [] });
            }
            return;
        }

        if (interaction.customId.startsWith('lore_')) {
            const parts = interaction.customId.split('_');
            const [prefix, action, type] = parts;

            let messageId;
            let chapterIndex, pageIndex, descPageIndex;

            // Lógica de extração de IDs simplificada
            if (['prev', 'next'].includes(action)) {
                messageId = parts[3];
                chapterIndex = parseInt(parts[4] || '0', 10); // O índice do capítulo está em parts[4]
                pageIndex = parseInt(parts[5] || '0', 10); // O índice da página está em parts[5]
                descPageIndex = parseInt(parts[6] || '0', 10); // O índice da descrição está em parts[6]
            } else if (['read', 'chapters-list'].includes(action)) {
                messageId = parts[2];
                chapterIndex = parseInt(parts[3] || '0', 10);
                pageIndex = parseInt(parts[4] || '0', 10);
                descPageIndex = parseInt(parts[5] || '0', 10);
            } else if (['add', 'move-chapter', 'delete', 'edit', 'add-image'].includes(action)) {
                messageId = parts[2]; // ID da mensagem é sempre o 3º elemento
                if (action === 'add' && type === 'chapter') messageId = parts[3];
                if (action === 'add' && type === 'backup') messageId = parts[3];
                if (action === 'move-chapter' || (action === 'delete' && type === 'chapter')) messageId = parts[3];
                if (['edit', 'delete', 'add-image'].includes(action) && type === 'page') messageId = parts[3];

                if (action === 'edit' && type === 'page') {
                    chapterIndex = parseInt(parts[4] || '0', 10);
                    pageIndex = parseInt(parts[5] || '0', 10);
                } else {
                    let idxPos = 3;
                    if (action === 'move-chapter') idxPos = 4;
                    if (action === 'delete' && type === 'chapter') idxPos = 4;

                    chapterIndex = parseInt(parts[idxPos] || '0', 10);
                    pageIndex = parseInt(parts[4] || '0', 10);
                }
                descPageIndex = 0;
            } else {
                 return; // Ação desconhecida
            }

            const lore = await client.database.Lore.findOne({ messageId: messageId }).lean();
            if (!lore) return interaction.reply({ content: '❌ Esta lore parece estar desatualizada ou corrompida.', ephemeral: true });

            switch (action) {
                case 'prev':
                    if (type === 'page' && pageIndex > 0) { pageIndex--; descPageIndex = 0; }
                    else if (type === 'chapter' && chapterIndex > 0) { chapterIndex--; pageIndex = 0; descPageIndex = 0; }
                    else if (type === 'desc' && descPageIndex > 0) { descPageIndex--; }
                    break;
                case 'next':
                    if (type === 'page' && pageIndex < lore.chapters[chapterIndex].pages.length - 1) { pageIndex++; descPageIndex = 0; }
                    else if (type === 'chapter' && chapterIndex < lore.chapters.length - 1) { chapterIndex++; pageIndex = 0; descPageIndex = 0; }
                    else if (type === 'desc') { descPageIndex++; }
                    break;
                case 'chapters-list': {
                    const isCreator = interaction.user.id === lore.createdBy;
                    const validChapters = lore.chapters.filter(c => c && c.name);

                    const chapterOptions = validChapters.map((chap, idx) => ({
                        label: chap.name.substring(0, 100),
                        description: `Capítulo ${idx + 1} com ${chap.pages.length} página(s).`,
                        value: idx.toString(),
                    }));
                    const selectMenu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`lore_select_chapter_${messageId}`).setPlaceholder(isCreator ? 'Selecione um capítulo para gerenciar' : 'Selecione um capítulo para ler').addOptions(chapterOptions));
                    const embListCap = new EmbedBuilder().setTitle(`📚 Lista de Capítulos - ${lore.title}`).setDescription(validChapters.map((chap, idx) => `**${idx + 1}.** ${chap.name}`).join('\n')).setFooter({ text: 'Selecione um capítulo no menu abaixo.' }).setColor('#2b2d31');
                    return interaction.reply({ embeds: [embListCap], components: [selectMenu], ephemeral: true });
                }
                case 'move-chapter': {
                    if (interaction.user.id !== lore.createdBy) return interaction.reply({ content: '❌ Você não tem permissão para gerenciar esta lore.', ephemeral: true });
                    const direction = type;
                    if (direction === 'up' && chapterIndex > 0) { [lore.chapters[chapterIndex], lore.chapters[chapterIndex - 1]] = [lore.chapters[chapterIndex - 1], lore.chapters[chapterIndex]]; chapterIndex--; }
                    else if (direction === 'down' && chapterIndex < lore.chapters.length - 1) { [lore.chapters[chapterIndex], lore.chapters[chapterIndex + 1]] = [lore.chapters[chapterIndex + 1], lore.chapters[chapterIndex]]; chapterIndex++; }
                    else return interaction.deferUpdate();
                    await client.database.Lore.updateOne({ messageId: messageId }, { $set: { chapters: lore.chapters } });
                    const chapterDescription = lore.chapters.map((chap, idx) => `${idx === chapterIndex ? '➡️' : `**${idx + 1}.**`} ${chap.name}`).join('\n');
                    const embed = new EmbedBuilder().setTitle(`📚 Gerenciando Capítulos - ${lore.title}`).setDescription(chapterDescription).setColor('#2b2d31');
                    const moveButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`lore_move-chapter_up_${messageId}_${chapterIndex}`).setEmoji('⬆️').setLabel('Mover para Cima').setStyle(ButtonStyle.Secondary).setDisabled(chapterIndex === 0),
                        new ButtonBuilder().setCustomId(`lore_move-chapter_down_${messageId}_${chapterIndex}`).setEmoji('⬇️').setLabel('Mover para Baixo').setStyle(ButtonStyle.Secondary).setDisabled(chapterIndex === lore.chapters.length - 1),
                        new ButtonBuilder().setCustomId(`lore_chapters-list_${messageId}`).setLabel('Voltar').setStyle(ButtonStyle.Danger)
                    );
                    return interaction.update({ embeds: [embed], components: [moveButtons] });
                }
                case 'edit': {
                    if (type === 'page' && interaction.user.id === lore.createdBy) {
                        const editModal = new ModalBuilder().setCustomId(`edit_page_modal_${messageId}_${chapterIndex}_${pageIndex}`).setTitle('Editar Capítulo e Página');
                        const chapterTitleInput = new TextInputBuilder().setCustomId('chapter_title_input').setLabel("Título do Capítulo").setStyle(TextInputStyle.Short).setValue(lore.chapters[chapterIndex].name).setRequired(true);
                        const pageContentInput = new TextInputBuilder().setCustomId('page_content_input').setLabel("Conteúdo da página").setStyle(TextInputStyle.Paragraph).setValue(lore.chapters[chapterIndex].pages[pageIndex].content).setRequired(true);
                        editModal.addComponents(new ActionRowBuilder().addComponents(chapterTitleInput), new ActionRowBuilder().addComponents(pageContentInput));
                        return interaction.showModal(editModal);
                    }
                    break;
                }
                case 'delete': {
                    if (type === 'chapter' && interaction.user.id === lore.createdBy) {
                        const confirmRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`delete_chapter_confirm_${messageId}_${chapterIndex}`).setLabel('Sim, excluir!').setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId('delete_chapter_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
                        );
                        return interaction.reply({ content: `Tem certeza que deseja excluir o capítulo **"${lore.chapters[chapterIndex].name}"**? Esta ação não pode ser desfeita.`, components: [confirmRow], ephemeral: true });
                    }
                    break;
                }
                case 'add-image': {
                    if (interaction.user.id === lore.createdBy) {
                        const imageModal = new ModalBuilder().setCustomId(`add_image_modal_${messageId}_${chapterIndex}_${pageIndex}`).setTitle('Adicionar Imagem à Página');
                        const imageUrlInput = new TextInputBuilder().setCustomId('image_url_input').setLabel("URL da Imagem").setStyle(TextInputStyle.Short).setPlaceholder('https://exemplo.com/imagem.png').setRequired(true);
                        imageModal.addComponents(new ActionRowBuilder().addComponents(imageUrlInput));
                        return interaction.showModal(imageModal);
                    }
                    break;
                }
                case 'add': {
                    if (interaction.user.id !== lore.createdBy) return interaction.reply({ content: '❌ Você não tem permissão para adicionar a esta lore.', ephemeral: true });
                    let modal = new ModalBuilder().setTitle('Adicionar Novo Capítulo');
                    const chapterNameInput = new TextInputBuilder().setCustomId('chapter_name_input').setLabel("Nome do Novo Capítulo").setStyle(TextInputStyle.Short).setPlaceholder('Ex: Capítulo 2: A Vingança').setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(chapterNameInput));
                    if (type === 'backup') {
                        modal.setCustomId(`lore_add_backup_modal_${messageId}`).setTitle('Adicionar Capítulo de Backup');
                    } else {
                        modal.setCustomId(`add_chapter_modal_${lore.messageId}`);
                    }
                    return interaction.showModal(modal);
                }
                case 'read': break;
                default: return;
            }

            // Funções Helper
            const splitText = (text, maxLength = 4096) => {
                if (!text) return [' '];
                const parts = []; let currentChunk = text;
                while (currentChunk.length > 0) {
                    if (currentChunk.length <= maxLength) { parts.push(currentChunk); break; }
                    let splitIndex = currentChunk.lastIndexOf('\n\n', maxLength);
                    if (splitIndex === -1) splitIndex = currentChunk.lastIndexOf('\n', maxLength);
                    if (splitIndex === -1) splitIndex = currentChunk.lastIndexOf(' ', maxLength);
                    if (splitIndex === -1) splitIndex = maxLength;
                    parts.push(currentChunk.substring(0, splitIndex));
                    currentChunk = currentChunk.substring(splitIndex).trim();
                }
                return parts;
            };
            const validateImageUrl = async (url) => { try { const response = await fetch(url); return response.ok && response.headers.get('content-type')?.startsWith('image/'); } catch { return false; } };

            // Geração de Embed
            const generateEphemeralEmbed = async (loreDoc, chapIdx, pIdx, descPIdx) => {
                try {
                    const chapter = loreDoc.chapters[chapIdx];
                    const page = chapter?.pages[pIdx];
                    if (!page || !page.content) return { embed: new EmbedBuilder().setColor('Red').setTitle('❌ Erro').setDescription('Página não encontrada ou sem conteúdo.'), files: [] };

                    const descriptionParts = splitText(page.content);
                    const currentDescription = descriptionParts[descPIdx] || descriptionParts[0] || ' ';
                    const footerParts = [`${chapter.name} - Página ${pIdx + 1} de ${chapter.pages.length}`];
                    if (descriptionParts.length > 1) footerParts.push(`Parte ${descPIdx + 1} de ${descriptionParts.length}`);

                    const embed = new EmbedBuilder().setTitle(loreDoc.title || 'Lore').setColor('#0099ff').setAuthor({ name: `Lore por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() }).setDescription(currentDescription).setFooter({ text: footerParts.join(' | ') }).setTimestamp();
                    let files = [];
                    if (page.imageUrl && await validateImageUrl(page.imageUrl)) {
                        try {
                            const response = await fetch(page.imageUrl);
                            const imageBuffer = Buffer.from(await response.arrayBuffer());
                            const attachment = new AttachmentBuilder(imageBuffer, { name: 'lore_image.png' });
                            files.push(attachment);
                            embed.setImage('attachment://lore_image.png');
                        } catch (fetchError) { console.error(`Falha ao baixar a imagem da URL: ${page.imageUrl}`, fetchError); }
                    }
                    return { embed, files };
                } catch (error) {
                    console.error('Erro ao gerar embed:', error);
                    return { embed: new EmbedBuilder().setColor('Red').setTitle('❌ Erro ao carregar página').setDescription('Ocorreu um erro ao carregar esta página da lore.'), files: [] };
                }
            };

            // Geração de Botões
            const getEphemeralButtons = (loreDoc, chapIdx, pIdx, descPIdx) => {
                const totalChapters = loreDoc.chapters.length;
                const totalPagesInChapter = loreDoc.chapters[chapIdx]?.pages.length || 0;
                const descriptionParts = splitText(loreDoc.chapters[chapIdx]?.pages[pIdx]?.content);
                const totalDescPages = descriptionParts.length;
                const components = [];

                if (interaction.user.id === loreDoc.createdBy) {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`lore_add_chapter_${messageId}`).setLabel('Adicionar Capítulo').setStyle(ButtonStyle.Success).setEmoji('➕'),
                        new ButtonBuilder().setCustomId(`lore_edit_page_${messageId}_${chapIdx}_${pIdx}`).setLabel('Editar Texto').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
                        new ButtonBuilder().setCustomId(`lore_add-image_${messageId}_${chapIdx}_${pIdx}`).setLabel('Imagem').setStyle(ButtonStyle.Secondary).setEmoji('🌄'),
                        new ButtonBuilder().setCustomId(`lore_add_backup_${messageId}`).setLabel('Adicionar de Backup').setStyle(ButtonStyle.Secondary).setEmoji('📥'),
                        new ButtonBuilder().setCustomId(`lore_delete_chapter_${messageId}_${chapIdx}`).setLabel('Excluir Capítulo').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(totalChapters <= 1)
                    ));
                }

                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`lore_prev_chapter_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('<< Cap. Anterior').setStyle(ButtonStyle.Secondary).setDisabled(chapIdx === 0),
                    new ButtonBuilder().setCustomId(`lore_next_chapter_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('Cap. Próximo >>').setStyle(ButtonStyle.Secondary).setDisabled(chapIdx >= totalChapters - 1)
                ));
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`lore_prev_page_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('◀️ Página').setStyle(ButtonStyle.Primary).setDisabled(pIdx === 0),
                    new ButtonBuilder().setCustomId(`lore_next_page_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('Página ▶️').setStyle(ButtonStyle.Primary).setDisabled(pIdx >= totalPagesInChapter - 1),
                    new ButtonBuilder().setCustomId(`lore_chapters-list_${messageId}`).setLabel('Lista de Capítulos').setStyle(ButtonStyle.Secondary).setEmoji('📚')
                ));

                if (totalDescPages > 1) {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`lore_prev_desc_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('◀ Descrição').setStyle(ButtonStyle.Secondary).setDisabled(descPIdx === 0),
                        new ButtonBuilder().setCustomId(`lore_next_desc_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('Descrição ▶').setStyle(ButtonStyle.Secondary).setDisabled(descPIdx >= totalDescPages - 1)
                    ));
                }
                return components;
            };

            const { embed, files } = await generateEphemeralEmbed(lore, chapterIndex, pageIndex, descPageIndex);
            const responseOptions = { embeds: [embed], files: files, components: getEphemeralButtons(lore, chapterIndex, pageIndex, descPageIndex), ephemeral: true };

            if (action === 'read') {
                await interaction.reply(responseOptions);
            } else {
                await interaction.update(responseOptions);
            }
        }

        if (interaction.customId.startsWith('delete_chapter_')) {
            if (interaction.customId.startsWith('delete_chapter_confirm_')) {
                const parts = interaction.customId.split('_');
                const messageId = parts[3];
                const chapterIndex = parseInt(parts[4], 10);

                const lore = await client.database.Lore.findOne({ messageId: messageId });
                if (!lore || interaction.user.id !== lore.createdBy) return interaction.update({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', components: [] });
                if (lore.chapters.length <= 1) return interaction.update({ content: '❌ Você não pode excluir o único capítulo da lore.', components: [] });

                const chapterName = lore.chapters[chapterIndex].name;
                lore.chapters.splice(chapterIndex, 1);
                await lore.save();

                await interaction.update({ content: `✅ O capítulo **"${chapterName}"** foi excluído com sucesso. Você pode fechar esta mensagem.`, components: []});
            } else if (interaction.customId === 'delete_chapter_cancel') {
                await interaction.update({ content: 'Operação de exclusão cancelada.', components: [] });
            }
        }
    }

    // Lógica de Modais da Lore
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('add_chapter_modal_')) {
            const messageId = interaction.customId.split('_')[3];
            const newChapterName = interaction.fields.getTextInputValue('chapter_name_input');

            await interaction.reply({ content: `Certo! Agora, para adicionar o capítulo **"${newChapterName}"**, reaja com ➕ na **primeira** mensagem do novo capítulo.`, ephemeral: true });

            const reactionFilter = (reaction, user) => user.id === interaction.user.id;

            const startCollectorFn = async (startReaction, user) => {
                if (!reactionFilter(startReaction, user) || startReaction.emoji.name !== '➕') return;
                client.removeListener('messageReactionAdd', startCollectorFn);
                const newStartMessage = startReaction.message;

                await interaction.editReply({ content: 'Ótimo! Agora reaja com ➖ na **última** mensagem do novo capítulo.' });

                const endCollectorFn = async (endReaction, endUser) => {
                    if (!reactionFilter(endReaction, endUser) || endReaction.emoji.name !== '➖') return;
                    client.removeListener('messageReactionAdd', endCollectorFn);
                    const newEndMessage = endReaction.message;

                    if (newStartMessage.createdTimestamp > newEndMessage.createdTimestamp) {
                        return interaction.editReply({ content: '❌ A mensagem de início do capítulo deve ser anterior à de fim. Operação cancelada.' });
                    }

                    await interaction.editReply({ content: 'Processando e adicionando o novo capítulo... Isso pode levar um momento.' });

                    const backupChannelId = '1437124928737509559';
                    const backupChannel = await client.channels.fetch(backupChannelId).catch(() => null);
                    if (!backupChannel) return interaction.followUp({ content: '⚠️ Ocorreu um erro crítico: o canal de backup não foi encontrado. A operação foi cancelada para evitar perda de dados.', ephemeral: true });

                    try {
                        const loreCommand = client.commands.get('lore');
                        if (!loreCommand) return interaction.followUp({ content: '❌ Erro interno: O comando base da lore não foi encontrado.', ephemeral: true });

                        const newMessages = await loreCommand.fetchMessagesBetween(newStartMessage.channel, newStartMessage.id, newEndMessage.id);
                        const { paginateText } = require('../commands/rpg/lore.js');

                        let newPagesAsObjects = [];
                        let textBlock = [];

                        const processTextBlock = (imageUrl = null) => {
                            if (textBlock.length > 0) {
                                const fullText = textBlock.join('\n\n');
                                const textPages = paginateText(fullText);
                                textPages.forEach((pageContent, index) => {
                                    const imgUrl = (index === 0) ? imageUrl : null;
                                    newPagesAsObjects.push({ content: pageContent, imageUrl: imgUrl });
                                });
                                textBlock = [];
                            }
                        };

                        for (const msg of newMessages) {
                            const hasText = msg.content && msg.content.trim() !== '';
                            const imageAttachment = msg.attachments.find(att => att.contentType?.startsWith('image/'));

                            if (imageAttachment) {
                                processTextBlock();
                                const backupMsg = await backupChannel.send({ files: [imageAttachment] });
                                const persistentImageUrl = backupMsg.attachments.first()?.url;

                                if (hasText) textBlock.push(msg.content);
                                processTextBlock(persistentImageUrl);
                            } else if (hasText) {
                                textBlock.push(msg.content);
                            }
                        }
                        processTextBlock();

                        const loreDB = await client.database.Lore.findOne({ messageId: messageId });                        if (!loreDB) return interaction.editReply({ content: '❌ Lore original não encontrada. Operação cancelada.' });

                        loreDB.chapters.push({ name: newChapterName, pages: newPagesAsObjects });
                        await loreDB.save();

                        await interaction.editReply({ content: '✅ Novo capítulo adicionado com sucesso! Iniciando backup e limpeza...' });

                        // Lógica de Backup e Limpeza

                        const { txtBuffer, zipBuffer } = await messagesToTxt(newMessages, `lore-${loreDB.title}-${newChapterName}.txt`, `Backup para ${loreDB.title}`);
                        
                        const criarAnexos = () => {
                            const anc = [new AttachmentBuilder(txtBuffer, { name: `capitulo_${newChapterName}.txt` })];
                            if (zipBuffer) anc.push(new AttachmentBuilder(zipBuffer, { name: `capitulo_${newChapterName}_imagens.zip` }));
                            return anc;
                        };
                        const anexos = criarAnexos();

                        const backupEnviado = await backupChannel.send({ content: `Backup do novo capítulo **${newChapterName}** para a lore **${loreDB.title}**.`, files: anexos }).catch(() => null);
                        if (!backupEnviado) return interaction.followUp({ content: '⚠️ O capítulo foi salvo, mas ocorreu um erro crítico ao enviar o backup para o servidor. As mensagens originais não foram excluídas para evitar perda de dados.', ephemeral: true });

                        const linhaConfirmacao = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('lore_dm_confirm_yes').setLabel('Sim, por favor').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('lore_dm_confirm_no').setLabel('Não, obrigado').setStyle(ButtonStyle.Secondary)
                        );
                        const msgConfirmacao = await interaction.followUp({ content: 'O backup principal foi salvo. Você deseja receber uma cópia do backup em suas mensagens diretas (DM)?', components: [linhaConfirmacao], ephemeral: true, fetchReply: true });

                        const filtroColetor = i => i.user.id === interaction.user.id && i.customId.startsWith('lore_dm_confirm_');
                        const coletor = msgConfirmacao.createMessageComponentCollector({ filter: filtroColetor, componentType: ComponentType.Button, time: 60000, max: 1 });

                        coletor.on('collect', async i => {
                            if (i.customId === 'lore_dm_confirm_yes') {
                                await i.user.send({ content: `Backup do novo capítulo **${newChapterName}** da sua lore **${loreDB.title}**.`, files: anexos }).catch(() => {
                                    i.update({ content: '⚠️ Não foi possível enviar a DM. Verifique suas configurações de privacidade.', components: [] });
                                    return;
                                });
                                await i.update({ content: '✅ Backup enviado para sua DM! Iniciando limpeza das mensagens originais...', components: [] });
                            } else {
                                await i.update({ content: 'Ok! O backup não será enviado por DM. Iniciando limpeza das mensagens originais...', components: [] });
                            }
                            const duasSemanasAtras = Date.now() - 1209600000;
                            const msgsRecentes = newMessages.filter(m => m.createdTimestamp > duasSemanasAtras && m.deletable);
                            const msgsAntigas = newMessages.filter(m => m.createdTimestamp <= duasSemanasAtras && m.deletable);
                            if (msgsRecentes.length > 0) await interaction.channel.bulkDelete(msgsRecentes, true).catch(() => {});
                            for (const msg of msgsAntigas) await msg.delete().catch(() => {});
                            await interaction.followUp({ content: '✅ Mensagens originais do novo capítulo foram limpas.', ephemeral: true });
                        });

                        coletor.on('end', async (collected, reason) => {
                            if (reason === 'time') {
                                await msgConfirmacao.edit({ content: '⏰ Tempo esgotado. A limpeza das mensagens originais foi cancelada. Você pode excluí-las manualmente.', components: [] }).catch(() => {});
                            }
                        });
                        
                        return;
                        
                        const twoWeeksAgo = Date.now() - 1209600000;
                        const recentMessages = newMessages.filter(m => m.createdTimestamp > twoWeeksAgo && m.deletable);
                        const oldMessages = newMessages.filter(m => m.createdTimestamp <= twoWeeksAgo && m.deletable);

                        if (recentMessages.length > 0) await interaction.channel.bulkDelete(recentMessages, true).catch(() => {});
                        for (const msg of oldMessages) await msg.delete().catch(() => {});

                        await interaction.followUp({ content: '✅ Backup concluído e mensagens originais do novo capítulo foram limpas.', ephemeral: true });

                    } catch (error) {
                        console.error("Erro ao adicionar novo capítulo:", error);
                        await interaction.editReply({ content: '❌ Ocorreu um erro ao adicionar o novo capítulo.' });
                    }
                };
                client.on('messageReactionAdd', endCollectorFn);
            };
            client.on('messageReactionAdd', startCollectorFn);
        }

        if (interaction.customId.startsWith('lore_add_backup_modal_')) {
            const messageId = interaction.customId.split('_')[4];
            const newChapterName = interaction.fields.getTextInputValue('chapter_name_input');
            const lore = await client.database.Lore.findOne({ messageId: messageId });
            if (!lore || interaction.user.id !== lore.createdBy) return interaction.reply({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', ephemeral: true });

            await interaction.reply({ content: `✅ Capítulo nomeado como **"${newChapterName}"**. Agora, por favor, envie o arquivo de backup \`.txt\` correspondente. Você tem 5 minutos.`, ephemeral: true });

            const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0 && m.attachments.first().name.endsWith('.txt');
            const collector = interaction.channel.createMessageCollector({ filter, time: 300000, max: 1 });

            collector.on('collect', async msg => {
                const attachment = msg.attachments.first();
                try {
                    await interaction.editReply({ content: '📥 Arquivo recebido. Processando o backup...' });
                    const response = await fetch(attachment.url);
                    if (!response.ok) throw new Error('Falha ao baixar o arquivo de backup.');
                    const backupText = await response.text();
                    const regMen = /\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\] .*?:\s*\n([\s\S]*?)(?=\n?\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\]|$)/g;
                    const correspondencias = [...backupText.matchAll(regMen)];
                    const conteudos = correspondencias
                        .map(corr => corr[1].trim())
                        .filter(cont => cont && !cont.startsWith('[Mensagem sem texto]') && !cont.startsWith('[Anexo:'));
                    const contApe = conteudos.join('\n\n');
                    if (!contApe.trim()) return interaction.followUp({ content: '❌ O arquivo de backup parece estar vazio ou em um formato incorreto.', ephemeral: true });

                    const { paginateText } = require('../commands/rpg/lore.js');
                    const paginasTex = paginateText(contApe);
                    const novasPagObj = paginasTex.map(contPag => ({ content: contPag, imageUrl: null }));
                    lore.chapters.push({ name: newChapterName, pages: novasPagObj });
                    await lore.save();
                    await interaction.followUp({ content: `✅ O capítulo **"${newChapterName}"** foi adicionado com sucesso a partir do backup!`, ephemeral: true });
                    await msg.delete().catch(() => {});
                } catch (error) {
                    console.error("Erro ao processar backup de lore:", error);
                    await interaction.followUp({ content: '❌ Ocorreu um erro ao processar o arquivo de backup.', ephemeral: true });
                }
            });
            collector.on('end', (collected, reason) => { if (reason === 'time') interaction.followUp({ content: '⏰ Tempo esgotado. A operação foi cancelada.', flags: 64 }).catch(() => {}); });
        }

        if (interaction.customId.startsWith('edit_page_modal_')) {
            const parts = interaction.customId.split('_');
            const messageId = parts[3];
            const chapterIndex = parseInt(parts[4], 10);
            const pageIndex = parseInt(parts[5], 10);
            const newPageContent = interaction.fields.getTextInputValue('page_content_input');
            const newChapterTitle = interaction.fields.getTextInputValue('chapter_title_input');

            try {
                await interaction.deferUpdate();
                const lore = await client.database.Lore.findOne({ messageId: messageId });
                if (!lore || interaction.user.id !== lore.createdBy) return interaction.followUp({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', ephemeral: true });
    
                const loreCmd = require('../commands/rpg/lore.js');
                const paginateText = loreCmd.paginateText;
    
                const originalPage = lore.chapters[chapterIndex].pages[pageIndex];
                const newTextPages = paginateText(newPageContent).map(content => ({
                    content: content,
                    imageUrl: null 
                }));
    
                if (newTextPages.length > 0 && originalPage.imageUrl) {
                    newTextPages[0].imageUrl = originalPage.imageUrl;
                }
    
                lore.chapters[chapterIndex].pages.splice(pageIndex, 1, ...newTextPages);
                lore.chapters[chapterIndex].name = newChapterTitle;
                await client.database.Lore.updateOne({ messageId: messageId }, { $set: { chapters: lore.chapters } });
    
                await interaction.followUp({ content: '✅ Página atualizada com sucesso! A lore foi repaginada para acomodar o novo texto. Por favor, navegue novamente para ver as alterações.', ephemeral: true });
            } catch (error) {
                console.error("Erro ao editar a página da lore:", error);
                await interaction.followUp({ content: '❌ Ocorreu um erro ao salvar as alterações.', ephemeral: true });
            }
        }

        if (interaction.customId.startsWith('add_image_modal_')) {
            const parts = interaction.customId.split('_');
            const messageId = parts[3];
            const chapterIndex = parseInt(parts[4], 10);
            const pageIndex = parseInt(parts[5], 10);
            const imageUrl = interaction.fields.getTextInputValue('image_url_input');

            if (!imageUrl.startsWith('http')) return interaction.reply({ content: '❌ URL inválida. A URL deve começar com http:// ou https://', ephemeral: true });

            const lore = await client.database.Lore.findOne({ messageId: messageId });
            if (!lore || interaction.user.id !== lore.createdBy) return interaction.reply({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', ephemeral: true });
            if (!lore.chapters[chapterIndex]?.pages[pageIndex]) return interaction.reply({ content: '❌ Página não encontrada na lore.', ephemeral: true });

            lore.chapters[chapterIndex].pages[pageIndex].imageUrl = imageUrl;
            await lore.save();

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setImage(imageUrl);
            await interaction.update({ embeds: [updatedEmbed], content: '✅ Imagem adicionada com sucesso!' });
        }

        if (interaction.customId.startsWith('lore_edit_title_modal_')) {
            const messageId = interaction.customId.split('_')[4];
            const newTitle = interaction.fields.getTextInputValue('lore_title_input');
            await client.database.Lore.updateOne({ messageId: messageId }, { $set: { title: newTitle } });
            const loreMessage = await interaction.channel.messages.fetch(messageId);
            const updatedEmbed = EmbedBuilder.from(loreMessage.embeds[0]).setTitle(newTitle);
            await loreMessage.edit({ embeds: [updatedEmbed] });
            await interaction.reply({ content: `✅ O título da lore foi atualizado com sucesso!`, ephemeral: true });
        }

        if (interaction.customId === 'lore_modal_config') {
            try {
                await interaction.deferReply({ ephemeral: true });
                await interaction.editReply({ content: 'Salvando sua lore e preparando os backups... Isso pode levar um momento.' });

                const title = interaction.fields.getTextInputValue('lore_title');
                const chapter = interaction.fields.getTextInputValue('lore_chapter');
                const loreState = client.fichaStates.get(interaction.user.id);
                if (!loreState || !loreState.pages) return interaction.editReply({ content: '❌ Não foi possível encontrar a lore para salvar. Por favor, tente novamente.' });

                const { pages } = loreState;
                const loreMessage = await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle(title).setColor('#0099ff').setAuthor({ name: `Lore por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() }).setDescription(pages[0].content).setFooter({ text: `${chapter} - Parte 1 de ${pages.length}` }).setTimestamp()] });

                const publicButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`lore_read_${loreMessage.id}`).setLabel('📖 Ler Lore').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`lore_manage_edit-title_${loreMessage.id}`).setLabel('Editar Título').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
                    new ButtonBuilder().setCustomId(`lore_manage_delete-lore_${loreMessage.id}`).setLabel('Excluir Lore').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
                );
                await loreMessage.edit({ components: [publicButtons] });

                await client.database.Lore.create({ messageId: loreMessage.id, channelId: loreMessage.channel.id, guildId: loreMessage.guild.id, createdBy: interaction.user.id, title: title, chapters: [{ name: chapter, pages: pages }] });
                client.fichaStates.delete(interaction.user.id);
                await interaction.followUp({ content: `✅ Sua lore **"${title}"** foi salva com sucesso!`, ephemeral: true });

                // Lógica de Backup
                const backupChannelId = '1437124928737509559';
                const backupChannel = await client.channels.fetch(backupChannelId).catch(() => null); //
                if (!backupChannel) return interaction.followUp({ content: '⚠️ A lore foi salva, mas o canal de backup não foi encontrado. As mensagens originais não foram excluídas.', flags: 64 });

                const { txtBuffer, zipBuffer } = await messagesToTxt(loreState.rawMessages, `lore-${title}-${chapter}.txt`, `Backup para ${title}`);
                const anexos = [new AttachmentBuilder(txtBuffer, { name: `lore_${loreMessage.id}.txt` })];
                if (zipBuffer) anexos.push(new AttachmentBuilder(zipBuffer, { name: `lore_imagens_${loreMessage.id}.zip` }));

                const backupEnviado = await backupChannel.send({ content: `Backup da lore **${title}** criada por ${interaction.user.tag}.`, files: anexos }).catch(() => null);
                if (!backupEnviado) return interaction.followUp({ content: '⚠️ A lore foi salva, mas ocorreu um erro crítico ao enviar o backup para o servidor. As mensagens originais não foram excluídas para evitar perda de dados.', ephemeral: true });

                const linhaConfirmacao = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('lore_dm_confirm_yes').setLabel('Sim, por favor').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('lore_dm_confirm_no').setLabel('Não, obrigado').setStyle(ButtonStyle.Secondary)
                );
                const msgConfirmacao = await interaction.followUp({ content: 'O backup principal foi salvo. Você deseja receber uma cópia do backup em suas mensagens diretas (DM)?', components: [linhaConfirmacao], ephemeral: true, fetchReply: true });

                const filtroColetor = i => i.user.id === interaction.user.id && i.customId.startsWith('lore_dm_confirm_');
                const coletor = msgConfirmacao.createMessageComponentCollector({ filter: filtroColetor, componentType: ComponentType.Button, time: 60000, max: 1 });

                coletor.on('collect', async i => {
                    if (i.customId === 'lore_dm_confirm_yes') {
                        await i.user.send({ content: `Backup da sua lore **${title}**.`, files: anexos }).catch(() => {
                            i.update({ content: '⚠️ Não foi possível enviar a DM. Verifique suas configurações de privacidade.', components: [] });
                            return;
                        });
                        await i.update({ content: '✅ Backup enviado para sua DM! Iniciando limpeza das mensagens originais...', components: [] });
                    } else {
                        await i.update({ content: 'Ok! O backup não será enviado por DM. Iniciando limpeza das mensagens originais...', components: [] });
                    }
                    const duasSemanasAtras = Date.now() - 1209600000;
                    const msgsRecentes = loreState.rawMessages.filter(m => m.createdTimestamp > duasSemanasAtras && m.deletable);
                    const msgsAntigas = loreState.rawMessages.filter(m => m.createdTimestamp <= duasSemanasAtras && m.deletable);
                    if (msgsRecentes.length > 0) await interaction.channel.bulkDelete(msgsRecentes, true).catch(() => {});
                    for (const msg of msgsAntigas) await msg.delete().catch(() => {});
                    await interaction.followUp({ content: '✅ Mensagens originais da lore foram limpas.', ephemeral: true });
                });

                coletor.on('end', async (collected, reason) => {
                    if (reason === 'time') {
                        await msgConfirmacao.edit({ content: '⏰ Tempo esgotado. A limpeza das mensagens originais foi cancelada. Você pode excluí-las manualmente.', components: [] }).catch(() => {});
                    }
                });

            } catch (error) {
                console.error("Erro ao processar o modal da lore:", error);
            }
        }
    }

    // Lógica de Menus da Lore
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('lore_select_chapter_')) {
            const messageId = interaction.customId.split('_')[3];
            const selectedChapterIndex = parseInt(interaction.values[0], 10);
            const lore = await client.database.Lore.findOne({ messageId: messageId });
            if (!lore) return interaction.update({ content: '❌ Lore não encontrada.', components: [], embeds: [] });

            const isCreator = interaction.user.id === lore.createdBy;
            if (isCreator) {
                const chapterDescription = lore.chapters.map((chap, idx) => `${idx === selectedChapterIndex ? '➡️' : `**${idx + 1}.**`} ${chap.name}`).join('\n');
                const embed = new EmbedBuilder().setTitle(`📚 Gerenciando Capítulos - ${lore.title}`).setDescription(chapterDescription).setColor('#2b2d31');
                const moveButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`lore_move-chapter_up_${messageId}_${selectedChapterIndex}`).setEmoji('⬆️').setLabel('Mover para Cima').setStyle(ButtonStyle.Secondary).setDisabled(selectedChapterIndex === 0),
                    new ButtonBuilder().setCustomId(`lore_move-chapter_down_${messageId}_${selectedChapterIndex}`).setEmoji('⬇️').setLabel('Mover para Baixo').setStyle(ButtonStyle.Secondary).setDisabled(selectedChapterIndex === lore.chapters.length - 1),
                    new ButtonBuilder().setCustomId(`lore_chapters-list_${messageId}`).setLabel('Voltar').setStyle(ButtonStyle.Danger)
                );
                await interaction.update({ embeds: [embed], components: [moveButtons] });
            } else {
                // Simula uma nova interação de leitura para o capítulo selecionado
                interaction.customId = `lore_read_${messageId}_${selectedChapterIndex}_0_0`;
                return handleLoreInteraction(interaction, client);
            }
        }
    }
}

module.exports = { handleLoreInteraction };