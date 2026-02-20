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
const AdmZip = require('adm-zip');
const { messagesToTxt } = require('../api/messagesToTxt.js');

async function handleLoreInteraction(interaction, client) {
    // Lógica de botões da Lore
    if (interaction.isButton() || (interaction.isStringSelectMenu() && interaction.customId.startsWith('lore_read_'))) {
        if (interaction.customId.startsWith('lore_manage_')) {
            const parts = interaction.customId.split('_');
            const manageAction = parts[2];
            const messageId = parts[3];
            const lore = await client.database.Lore.findOne({ messageId: messageId });

            if (!lore || interaction.user.id !== lore.createdBy) {
                return interaction.reply({ content: '❌ Você não tem permissão para gerenciar esta lore.', flags: 64 });
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
                    flags: 64
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
            if (!lore) return interaction.reply({ content: '❌ Esta lore parece estar desatualizada ou corrompida.', flags: 64 });

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
                    return interaction.reply({ embeds: [embListCap], components: [selectMenu], flags: 64 });
                }
                case 'move-chapter': {
                    if (interaction.user.id !== lore.createdBy) return interaction.reply({ content: '❌ Você não tem permissão para gerenciar esta lore.', flags: 64 });
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
                        return interaction.reply({ content: `Tem certeza que deseja excluir o capítulo **"${lore.chapters[chapterIndex].name}"**? Esta ação não pode ser desfeita.`, components: [confirmRow], flags: 64 });
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
                    if (interaction.user.id !== lore.createdBy) return interaction.reply({ content: '❌ Você não tem permissão para adicionar a esta lore.', flags: 64 });
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
            const validateImageUrl = async (url) => { try { const response = await fetch(url, { headers: { 'User-Agent': 'GalaticBot/1.0' } }); return response.ok && response.headers.get('content-type')?.startsWith('image/'); } catch { return false; } };

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
                    
                    let imgVal = false;
                    if (page.imageUrl) {
                        imgVal = await validateImageUrl(page.imageUrl);
                        if (!imgVal) {
                            try {
                                const canBacId = process.env.BACKUP_CHANNEL_ID;
                                const canBac = await client.channels.fetch(canBacId).catch(() => null);
                                if (canBac) {
                                    const menBac = await canBac.messages.fetch({ limit: 100 });
                                    const nomZipCap = `capitulo_${chapter.name}_imagens.zip`;
                                    const nomZipLor = `lore_imagens_${loreDoc.messageId}.zip`;
                                    const normalizeName = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
                                    
                                    let msgZip = menBac.find(m => m.attachments.some(a => normalizeName(a.name) === normalizeName(nomZipCap)));
                                    let isGlobalZip = false;

                                    if (!msgZip) {
                                        msgZip = menBac.find(m => m.attachments.some(a => normalizeName(a.name) === normalizeName(nomZipLor)));
                                        if (msgZip) isGlobalZip = true;
                                    }

                                    if (msgZip) {
                                        const aneZip = msgZip.attachments.find(a => isGlobalZip ? normalizeName(a.name) === normalizeName(nomZipLor) : normalizeName(a.name) === normalizeName(nomZipCap));
                                        if (!aneZip) throw new Error('Anexo ZIP não encontrado na mensagem de backup.');

                                        const resZip = await fetch(aneZip.url);
                                        const bufZip = Buffer.from(await resZip.arrayBuffer());
                                        const arqZip = new AdmZip(bufZip);
                                        const entZip = arqZip.getEntries().filter(e => !e.isDirectory && /\.(png|jpe?g|gif)$/i.test(e.entryName)).sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));
                                        const pagComImg = chapter.pages.filter(p => p.imageUrl);

                                        let offset = 0;
                                        if (isGlobalZip) {
                                            for (let c = 0; c < chapIdx; c++) {
                                                if (loreDoc.chapters[c] && loreDoc.chapters[c].pages) {
                                                    offset += loreDoc.chapters[c].pages.filter(p => p.imageUrl).length;
                                                }
                                            }
                                        }

                                        if (entZip.length > 0) {
                                            for (let i = 0; i < pagComImg.length; i++) {
                                                const zipIdx = offset + i;
                                                if (zipIdx < entZip.length) {
                                                    const isCurrentPage = pagComImg[i] === page;
                                                    if (isCurrentPage) {
                                                        const bufImg = entZip[zipIdx].getData();
                                                        const msgImg = await canBac.send({ files: [new AttachmentBuilder(bufImg, { name: entZip[zipIdx].entryName })] });
                                                        pagComImg[i].imageUrl = msgImg.attachments.first().url;
                                                    }
                                                }
                                            }
                                            await client.database.Lore.updateOne({ messageId: loreDoc.messageId }, { $set: { chapters: loreDoc.chapters } });
                                            imgVal = true;
                                        }
                                    }
                                }
                            } catch (errRec) { console.error('Erro ao recuperar imagens do backup:', errRec); }
                        }
                    }

                    if (page.imageUrl && imgVal) {
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

            if (action === 'read') {
                if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: 64 });
            } else {
                if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
            }

            const { embed, files } = await generateEphemeralEmbed(lore, chapterIndex, pageIndex, descPageIndex);
            const responseOptions = { embeds: [embed], files: files, components: getEphemeralButtons(lore, chapterIndex, pageIndex, descPageIndex) };

            await interaction.editReply(responseOptions);
        }

        if (interaction.customId.startsWith('lore_delete_chapter_confirm_')) {
            const parts = interaction.customId.split('_');
            const messageId = parts[4];
            const chapterIndex = parseInt(parts[5], 10);

            const lore = await client.database.Lore.findOne({ messageId: messageId });
            if (!lore || interaction.user.id !== lore.createdBy) {
                return interaction.reply({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', flags: 64 });
            }
            
            if (lore.chapters.length <= 1) {
                return interaction.reply({ content: '❌ Você não pode excluir o único capítulo da lore.', flags: 64 });
            }

            const selectedChapter = lore.chapters[chapterIndex];
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`lore_delete_chapter_confirmed_${messageId}_${chapterIndex}`).setLabel('Sim, deletar!').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`lore_delete_chapter_cancel_${messageId}`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
            );
            
            await interaction.reply({
                content: `⚠️ **ATENÇÃO!** Tem certeza que deseja excluir permanentemente o capítulo **"${selectedChapter.name}"** e suas ${selectedChapter.pages.length} página(s)? Esta ação não pode ser desfeita.`,
                components: [confirmRow],
                flags: 64
            });
        }

        if (interaction.customId.startsWith('lore_delete_chapter_confirmed_')) {
            const parts = interaction.customId.split('_');
            const messageId = parts[5];
            const chapterIndex = parseInt(parts[6], 10);

            const lore = await client.database.Lore.findOne({ messageId: messageId });
            if (!lore || interaction.user.id !== lore.createdBy) {
                return interaction.update({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', components: [] });
            }

            const chapterName = lore.chapters[chapterIndex].name;
            lore.chapters.splice(chapterIndex, 1);
            await lore.save();

            await interaction.update({ content: `✅ O capítulo **"${chapterName}"** foi excluído com sucesso!`, components: [] });
        }

        if (interaction.customId.startsWith('lore_delete_chapter_cancel_')) {
            await interaction.update({ content: 'Operação de exclusão cancelada.', components: [] });
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

            await interaction.deferReply({ flags: 64 });
            await interaction.editReply({ content: `Certo! Agora, para adicionar o capítulo **"${newChapterName}"**, reaja com ➕ na **primeira** mensagem do novo capítulo.` });

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

                    const bacCha = await client.channels.fetch(process.env.BACKUP_CHANNEL_ID).catch(() => null);
                    if (!bacCha) return interaction.followUp({ content: '⚠️ Ocorreu um erro crítico: o canal de backup não foi encontrado. A operação foi cancelada para evitar perda de dados.', flags: 64 });

                    try {
                        const loreCommand = client.commands.get('lore');
                        if (!loreCommand) return interaction.followUp({ content: '❌ Erro interno: O comando base da lore não foi encontrado.', flags: 64 });

                        const newMessages = await loreCommand.fetchMessagesBetween(newStartMessage.channel, newStartMessage.id, newEndMessage.id);
                        const { paginateText } = require('../commands/rpg/lore.js');

                        let newPagesAsObjects = [];
                        let textBlock = [];

                        const processTextBlock = (imageUrl = null) => {
                            if (textBlock.length > 0) {
                                const fullText = textBlock.join('\n\n');
                                const textPages = paginateText(fullText);
                                textPages.forEach((pageContent, index) => {
                                    const imgUrl = imageUrl;
                                    newPagesAsObjects.push({ content: pageContent, imageUrl: imgUrl });
                                });
                                textBlock = [];
                            } else if (imageUrl) {
                                if (newPagesAsObjects.length > 0 && !newPagesAsObjects[newPagesAsObjects.length - 1].imageUrl) {
                                    newPagesAsObjects[newPagesAsObjects.length - 1].imageUrl = imageUrl;
                                } else {
                                    newPagesAsObjects.push({
                                        content: ' ',
                                        imageUrl: imageUrl
                                    });
                                }
                            }
                        };

                        for (const msg of newMessages) {
                            const hasText = msg.content && msg.content.trim() !== '';
                            const imageAttachment = msg.attachments.find(att => att.contentType?.startsWith('image/'));

                            if (imageAttachment) {
                                processTextBlock();
                                let persistentImageUrl = imageAttachment.url; // Fallback para a URL original
                                try {
                                    const backupMsg = await bacCha.send({ files: [imageAttachment] });
                                    persistentImageUrl = backupMsg.attachments.first()?.url;
                                } catch (imgErr) {
                                    console.warn(`Falha ao fazer backup da imagem individual (Discord 500/403). Usando URL original. Erro: ${imgErr.message}`);
                                    // O script continua sem travar, usando a URL original
                                }

                                if (hasText) textBlock.push(msg.content);
                                processTextBlock(persistentImageUrl);
                            } else if (hasText) {
                                textBlock.push(msg.content);
                            }
                        }
                        processTextBlock();

                        const loreDB = await client.database.Lore.findOne({ messageId: messageId });
                        if (!loreDB) return interaction.editReply({ content: '❌ Lore original não encontrada. Operação cancelada.' });

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

                        const backupEnviado = await bacCha.send({ content: `Backup do novo capítulo **${newChapterName}** para a lore **${loreDB.title}**.`, files: anexos }).catch(() => null);
                        if (!backupEnviado) return interaction.followUp({ content: '⚠️ O capítulo foi salvo, mas ocorreu um erro crítico ao enviar o backup para o servidor. As mensagens originais não foram excluídas para evitar perda de dados.', flags: 64 });

                        const linhaConfirmacao = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('lore_dm_confirm_yes').setLabel('Sim, por favor').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('lore_dm_confirm_no').setLabel('Não, obrigado').setStyle(ButtonStyle.Secondary)
                        );
                        const msgConfirmacao = await interaction.followUp({ content: 'O backup principal foi salvo. Você deseja receber uma cópia do backup em suas mensagens diretas (DM)?', components: [linhaConfirmacao], flags: 64, fetchReply: true });

                        const filtroColetor = i => i.user.id === interaction.user.id && i.customId.startsWith('lore_dm_confirm_');
                        const coletor = msgConfirmacao.createMessageComponentCollector({ filter: filtroColetor, componentType: ComponentType.Button, time: 60000, max: 1 });

                        coletor.on('collect', async i => {
                            try {
                                if (i.customId === 'lore_dm_confirm_yes') {
                                    let dmEnviada = true;
                                    await i.user.send({ content: `Backup do novo capítulo **${newChapterName}** da sua lore **${loreDB.title}**.`, files: anexos }).catch(() => {
                                        dmEnviada = false;
                                    });
                                    
                                    if (dmEnviada) await i.update({ content: '✅ Backup enviado para sua DM! Iniciando limpeza das mensagens originais...', components: [] });
                                    else await i.update({ content: '⚠️ Não foi possível enviar a DM. Verifique suas configurações de privacidade. Iniciando limpeza...', components: [] });
                                } else {
                                    await i.update({ content: 'Ok! O backup não será enviado por DM. Iniciando limpeza das mensagens originais...', components: [] });
                                }
                                const duasSemanasAtras = Date.now() - 1209600000;
                                const msgsRecentes = newMessages.filter(m => m.createdTimestamp > duasSemanasAtras && m.deletable);
                                const msgsAntigas = newMessages.filter(m => m.createdTimestamp <= duasSemanasAtras && m.deletable);
                                if (msgsRecentes.length > 0) await interaction.channel.bulkDelete(msgsRecentes, true).catch(() => {});
                                for (const msg of msgsAntigas) await msg.delete().catch(() => {});
                                await interaction.followUp({ content: '✅ Mensagens originais do novo capítulo foram limpas.', flags: 64 });
                            } catch (cleanupErr) {
                                console.error("Erro ao limpar mensagens:", cleanupErr);
                                await interaction.followUp({ content: '⚠️ Ocorreu um erro ao limpar as mensagens originais.', flags: 64 });
                            }
                        });

                        coletor.on('end', async (collected, reason) => {
                            if (reason === 'time') {
                                await msgConfirmacao.edit({ content: '⏰ Tempo esgotado. A limpeza das mensagens originais foi cancelada. Você pode excluí-las manualmente.', components: [] }).catch(() => {});
                            }
                        });

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
            if (!lore || interaction.user.id !== lore.createdBy) return interaction.reply({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', flags: 64 });

            await interaction.deferReply({ flags: 64 });
            await interaction.editReply({ content: `✅ Capítulo nomeado como **"${newChapterName}"**. Agora, por favor, envie os arquivos de backup (.txt e .zip opcional). Você tem 5 minutos.` });

            const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
            const collector = interaction.channel.createMessageCollector({ filter, time: 300000, max: 1 });

            collector.on('collect', async msg => {
                try {
                    await interaction.editReply({ content: '📥 Arquivos recebidos. Processando o backup...' });
                    
                    // Buscar arquivo .txt
                    const txtAttachment = msg.attachments.find(att => att.name.endsWith('.txt'));
                    const zipAttachment = msg.attachments.find(att => att.name.endsWith('.zip'));
                    
                    if (!txtAttachment) return interaction.followUp({ content: '❌ Nenhum arquivo .txt encontrado na mensagem.', flags: 64 });

                    const response = await fetch(txtAttachment.url);
                    if (!response.ok) throw new Error('Falha ao baixar o arquivo de backup.');
                    const backupText = await response.text();
                    const regMen = /\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\] .*?:\s*\n([\s\S]*?)(?=\n?\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\]|$)/g;
                    const correspondencias = [...backupText.matchAll(regMen)];
                    const conteudos = correspondencias
                        .map(corr => corr[1].trim())
                        .filter(cont => cont && !cont.startsWith('[Mensagem sem texto]') && !cont.startsWith('[Anexo:'));
                    let contApe = conteudos.join('\n\n');

                    if (!contApe.trim() && backupText.trim().length > 0) {
                        contApe = backupText;
                    }

                    if (!contApe.trim()) return interaction.followUp({ content: '❌ O arquivo de backup parece estar vazio ou em um formato incorreto.', flags: 64 });

                    // Formatação automática (estilo /formatar)
                    const linTex = contApe.split(/\r?\n/);
                    const linFor = [];
                    let emPen = false;

                    for (let lin of linTex) {
                        let linTri = lin.trim();

                        if (linTri.length === 0) {
                            linFor.push(lin);
                            continue;
                        }

                        if (/^[-—•]/.test(linTri)) {
                            let conFal = linTri.replace(/^[-—•]\s*/, '');
                            const parFal = conFal.split('—');
                            let linNov = `— ${parFal[0].trim()}`;

                            for (let i = 1; i < parFal.length; i++) {
                                let parAtu = parFal[i].trim();
                                if (!parAtu) continue;
                                if (i % 2 !== 0) linNov += ` — **${parAtu}**`;
                                else linNov += ` — ${parAtu}`;
                            }
                            linFor.push(linNov);
                            emPen = false;
                        } else if (emPen || (linTri.startsWith('('))) {
                            if (!emPen) {
                                if (linTri.endsWith(')')) linFor.push(`*${linTri}*`);
                                else { emPen = true; linFor.push(`*${linTri}`); }
                            } else {
                                if (linTri.endsWith(')')) { emPen = false; linFor.push(`${linTri}*`); }
                                else linFor.push(linTri);
                            }
                        } else {
                            linFor.push(`**${linTri}**`);
                            emPen = false;
                        }
                    }
                    contApe = linFor.join('\n');

                    const { paginateText } = require('../commands/rpg/lore.js');
                    const paginasTex = paginateText(contApe);
                    
                    // Processar imagens do ZIP se existir
                    let imagensMap = {};
                    if (zipAttachment) {
                        try {
                            const zipResponse = await fetch(zipAttachment.url);
                            const zipBuffer = await zipResponse.buffer();
                            const zip = new AdmZip(zipBuffer);
                            const zipEntries = zip.getEntries();
                            
                            // Extrair e fazer upload das imagens
                            const bacCha = await client.channels.fetch(process.env.BACKUP_CHANNEL_ID).catch(() => null);
                            
                            if (bacCha) {
                                for (let i = 0; i < zipEntries.length; i++) {
                                    const entry = zipEntries[i];
                                    if (!entry.isDirectory && entry.name.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
                                        try {
                                            const imagemBuffer = entry.getData();
                                            const backupMsg = await bacCha.send({ 
                                                files: [new AttachmentBuilder(imagemBuffer, { name: entry.name })] 
                                            });
                                            const imagemUrl = backupMsg.attachments.first()?.url;
                                            if (imagemUrl) imagensMap[i] = imagemUrl;
                                        } catch (imgErr) {
                                            console.warn(`Falha ao fazer upload da imagem ${entry.name}:`, imgErr.message);
                                        }
                                    }
                                }
                            }
                        } catch (zipErr) {
                            console.warn(`Erro ao processar ZIP de imagens:`, zipErr.message);
                        }
                    }
                    
                    const novasPagObj = paginasTex.map((contPag, idx) => ({ 
                        content: contPag, 
                        imageUrl: imagensMap[idx] || null 
                    }));
                    
                    lore.chapters.push({ name: newChapterName, pages: novasPagObj });
                    await lore.save();
                    await interaction.followUp({ content: `✅ O capítulo **"${newChapterName}"** foi adicionado com sucesso a partir do backup!`, flags: 64 });
                    await msg.delete().catch(() => {});
                } catch (error) {
                    console.error("Erro ao processar backup de lore:", error);
                    await interaction.followUp({ content: '❌ Ocorreu um erro ao processar o arquivo de backup.', flags: 64 });
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
                await interaction.deferReply({ flags: 64 });
                const lore = await client.database.Lore.findOne({ messageId: messageId });
                if (!lore || interaction.user.id !== lore.createdBy) return interaction.followUp({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', flags: 64 });
    
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
    
                await interaction.editReply({ content: '✅ Página atualizada com sucesso! A lore foi repaginada para acomodar o novo texto. Por favor, navegue novamente para ver as alterações.' });
            } catch (error) {
                console.error("Erro ao editar a página da lore:", error);
                await interaction.editReply({ content: '❌ Ocorreu um erro ao salvar as alterações.' });
            }
        }

        if (interaction.customId.startsWith('add_image_modal_')) {
            const parts = interaction.customId.split('_');
            const messageId = parts[3];
            const chapterIndex = parseInt(parts[4], 10);
            const pageIndex = parseInt(parts[5], 10);
            const imageUrl = interaction.fields.getTextInputValue('image_url_input');

            await interaction.deferReply({ flags: 64 });

            if (!imageUrl.startsWith('http')) return interaction.editReply({ content: '❌ URL inválida. A URL deve começar com http:// ou https://' });

            const lore = await client.database.Lore.findOne({ messageId: messageId });
            if (!lore || interaction.user.id !== lore.createdBy) return interaction.editReply({ content: '❌ Você não tem permissão ou a lore não foi encontrada.' });
            if (!lore.chapters[chapterIndex]?.pages[pageIndex]) return interaction.editReply({ content: '❌ Página não encontrada na lore.' });

            lore.chapters[chapterIndex].pages[pageIndex].imageUrl = imageUrl;
            lore.markModified('chapters');
            await lore.save();

            await interaction.editReply({ content: '✅ Imagem adicionada com sucesso!' });
        }

        if (interaction.customId.startsWith('lore_edit_title_modal_')) {
            await interaction.deferReply({ flags: 64 });
            const messageId = interaction.customId.split('_')[4];
            const newTitle = interaction.fields.getTextInputValue('lore_title_input');
            await client.database.Lore.updateOne({ messageId: messageId }, { $set: { title: newTitle } });
            const loreMessage = await interaction.channel.messages.fetch(messageId);
            const updatedEmbed = EmbedBuilder.from(loreMessage.embeds[0]).setTitle(newTitle);
            await loreMessage.edit({ embeds: [updatedEmbed] });
            await interaction.editReply({ content: `✅ O título da lore foi atualizado com sucesso!` });
        }

        if (interaction.customId === 'lore_modal_config') {
            try {
                await interaction.deferReply({ flags: 64 });
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
                await interaction.followUp({ content: `✅ Sua lore **"${title}"** foi salva com sucesso!`, flags: 64 });

                // Lógica de Backup
                const bacCha = await client.channels.fetch(process.env.BACKUP_CHANNEL_ID).catch(() => null); //
                if (!bacCha) return interaction.followUp({ content: '⚠️ A lore foi salva, mas o canal de backup não foi encontrado. As mensagens originais não foram excluídas.', flags: 64 });

                const { txtBuffer, zipBuffer } = await messagesToTxt(loreState.rawMessages, `lore-${title}-${chapter}.txt`, `Backup para ${title}`);
                const anexos = [new AttachmentBuilder(txtBuffer, { name: `lore_${loreMessage.id}.txt` })];
                if (zipBuffer) anexos.push(new AttachmentBuilder(zipBuffer, { name: `lore_imagens_${loreMessage.id}.zip` }));

                const backupEnviado = await bacCha.send({ content: `Backup da lore **${title}** criada por ${interaction.user.tag}.`, files: anexos }).catch(() => null);
                if (!backupEnviado) return interaction.followUp({ content: '⚠️ A lore foi salva, mas ocorreu um erro crítico ao enviar o backup para o servidor. As mensagens originais não foram excluídas para evitar perda de dados.', flags: 64 });

                const linhaConfirmacao = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('lore_dm_confirm_yes').setLabel('Sim, por favor').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('lore_dm_confirm_no').setLabel('Não, obrigado').setStyle(ButtonStyle.Secondary)
                );
                const msgConfirmacao = await interaction.followUp({ content: 'O backup principal foi salvo. Você deseja receber uma cópia do backup em suas mensagens diretas (DM)?', components: [linhaConfirmacao], flags: 64, fetchReply: true });

                const filtroColetor = i => i.user.id === interaction.user.id && i.customId.startsWith('lore_dm_confirm_');
                const coletor = msgConfirmacao.createMessageComponentCollector({ filter: filtroColetor, componentType: ComponentType.Button, time: 60000, max: 1 });

                coletor.on('collect', async i => {
                    if (i.customId === 'lore_dm_confirm_yes') {
                        let dmEnviada = true;
                        await i.user.send({ content: `Backup da sua lore **${title}**.`, files: anexos }).catch(() => {
                            dmEnviada = false;
                        });
                        
                        if (dmEnviada) await i.update({ content: '✅ Backup enviado para sua DM! Iniciando limpeza das mensagens originais...', components: [] });
                        else await i.update({ content: '⚠️ Não foi possível enviar a DM. Verifique suas configurações de privacidade. Iniciando limpeza...', components: [] });
                    } else {
                        await i.update({ content: 'Ok! O backup não será enviado por DM. Iniciando limpeza das mensagens originais...', components: [] });
                    }
                    const duasSemanasAtras = Date.now() - 1209600000;
                    const msgsRecentes = loreState.rawMessages.filter(m => m.createdTimestamp > duasSemanasAtras && m.deletable);
                    const msgsAntigas = loreState.rawMessages.filter(m => m.createdTimestamp <= duasSemanasAtras && m.deletable);
                    if (msgsRecentes.length > 0) await interaction.channel.bulkDelete(msgsRecentes, true).catch(() => {});
                    for (const msg of msgsAntigas) await msg.delete().catch(() => {});
                    await interaction.followUp({ content: '✅ Mensagens originais da lore foram limpas.', flags: 64 });
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
                const selectedChapter = lore.chapters[selectedChapterIndex];
                const chapterDescription = lore.chapters.map((chap, idx) => `${idx === selectedChapterIndex ? '➡️' : `**${idx + 1}.**`} ${chap.name}`).join('\n');
                const embed = new EmbedBuilder()
                    .setTitle(`📚 Gerenciando Capítulos - ${lore.title}`)
                    .setDescription(chapterDescription)
                    .addFields(
                        { name: `📖 Capítulo Selecionado`, value: `**${selectedChapter.name}** (${selectedChapter.pages.length} página(s))`, inline: false }
                    )
                    .setColor('#2b2d31');
                
                const actionButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`lore_read_${messageId}_${selectedChapterIndex}_0_0`).setEmoji('📖').setLabel('Navegar Capítulo').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`lore_delete_chapter_confirm_${messageId}_${selectedChapterIndex}`).setEmoji('🗑️').setLabel('Deletar Capítulo').setStyle(ButtonStyle.Danger)
                );
                
                const moveButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`lore_move-chapter_up_${messageId}_${selectedChapterIndex}`).setEmoji('⬆️').setLabel('Mover para Cima').setStyle(ButtonStyle.Secondary).setDisabled(selectedChapterIndex === 0),
                    new ButtonBuilder().setCustomId(`lore_move-chapter_down_${messageId}_${selectedChapterIndex}`).setEmoji('⬇️').setLabel('Mover para Baixo').setStyle(ButtonStyle.Secondary).setDisabled(selectedChapterIndex === lore.chapters.length - 1),
                    new ButtonBuilder().setCustomId(`lore_chapters-list_${messageId}`).setLabel('Voltar à Lista').setStyle(ButtonStyle.Secondary)
                );
                
                await interaction.update({ embeds: [embed], components: [actionButtons, moveButtons] });
            } else {
                // Simula uma nova interação de leitura para o capítulo selecionado
                interaction.customId = `lore_read_${messageId}_${selectedChapterIndex}_0_0`;
                return handleLoreInteraction(interaction, client);
            }
        }
    }
}

module.exports = { handleLoreInteraction };