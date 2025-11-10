const { 
    ModalBuilder, 
    EmbedBuilder,
    TextInputBuilder, 
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    InteractionType,    
    AttachmentBuilder,
    ComponentType
} = require('discord.js');
const { google } = require("googleapis");
const { messagesToTxt } = require('../api/messagesToTxt.js');
const Lore = require('./Lore.js'); // Importa o modelo da Lore

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
                    const messageId = parts[3]; // Para lore_manage_ACTION_MESSAGE_ID
                    const lore = await this.client.database.Lore.findOne({ messageId: messageId });

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

                        return; 

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


                    // ======================= INÍCIO DA LÓGICA DE PAGINAÇÃO E NAVEGAÇÃO DA LORE =======================
                    if (interaction.customId.startsWith('lore_')) { 
                    const [prefix, action, type, ...rest] = interaction.customId.split('_');
                    const parts = interaction.customId.split('_');

                    let messageId; // Variável para armazenar o ID da mensagem principal da lore
                    let chapterIndex = parseInt(parts[4] || '0', 10);
                    let pageIndex = parseInt(parts[5] || '0', 10);
                    // Índice para a paginação da descrição de uma única página, caso ela seja muito longa.
                    let descPageIndex = parseInt(parts[6] || '0', 10);

                    // Lógica aprimorada para extrair o messageId com base na estrutura do customId
                    if (action === 'read') { // Ex: lore_read_MESSAGE_ID
                        messageId = parts[2];
                    } else if (action === 'add' && type === 'chapter') { // Ex: lore_add_chapter_MESSAGE_ID
                        messageId = parts[3];
                    } else if (action === 'add-image' || action === 'edit_page' || action === 'delete_chapter') { // Ex: lore_add-image_MESSAGE_ID_CHAP_PAGE
                        messageId = parts[2];
                        // Reajusta os índices para estas ações, pois o messageId está em parts[2]
                        chapterIndex = parseInt(parts[3] || '0', 10);
                        pageIndex = parseInt(parts[4] || '0', 10);
                    } else { // Para todas as outras ações de navegação (prev/next chapter/page/desc)
                             // Ex: lore_prev_chapter_MESSAGE_ID_CHAP_PAGE_DESC
                        messageId = parts[3];
                    }
                    const lore = await this.client.database.Lore.findOne({ messageId: messageId }).lean();

                    if (!lore) {
                        return interaction.reply({ content: '❌ Esta lore parece estar desatualizada ou corrompida.', flags: 64 });
                    }

                    switch (action) {
                        case 'prev':
                            if (parts[2] === 'page' && pageIndex > 0) {
                                pageIndex--;
                                descPageIndex = 0; // Reset desc page index when changing pages
                            } else if (parts[2] === 'chapter' && chapterIndex > 0) { // Navega para o capítulo anterior.
                                chapterIndex--;
                                pageIndex = 0;
                                descPageIndex = 0; // Reseta todos os índices.
                            }
                            // Navega para a parte anterior da descrição da página atual.
                            if (parts[2] === 'desc') {
                                if (descPageIndex > 0) descPageIndex--;
                            }
                            break;
                        case 'next':
                            if (parts[2] === 'page' && pageIndex < lore.chapters[chapterIndex].pages.length - 1) { 
                                pageIndex++;
                                descPageIndex = 0; // Reseta a paginação da descrição ao trocar de página.
                            } else if (parts[2] === 'chapter' && chapterIndex < lore.chapters.length - 1) { // Navega para o próximo capítulo.
                                chapterIndex++;
                                pageIndex = 0;
                                descPageIndex = 0; // Reseta todos os índices.
                            }
                            // Navega para a próxima parte da descrição da página atual.
                            if (parts[2] === 'desc') {
                                descPageIndex++;
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
                                return; // Retorna para evitar que a interação seja atualizada antes do modal
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
                                    flags: 64
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
                            return; // Retorna para evitar que a interação seja atualizada antes do modal
                        case 'add': 
                            if (parts[1] === 'add' && parts[2] === 'chapter' && interaction.user.id !== lore.createdBy) {
                                return interaction.reply({ content: '❌ Você não tem permissão para adicionar capítulos a esta lore.', flags: 64 });
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
                            await interaction.showModal(modal); // Retorna para evitar que a interação seja atualizada antes do modal
                            return; 
                        case 'read':
                            break;
                        default:
                            return; 
                    }

                    // ======================= FUNÇÃO HELPER DE PAGINAÇÃO DE TEXTO =======================
                    // Esta função divide um texto longo em partes menores (páginas) que cabem nos limites do Discord (4096 caracteres para embeds).
                    // Ela tenta quebrar o texto em pontos lógicos (parágrafos, linhas, espaços) para não cortar palavras ou frases no meio.
                    const splitText = (text, maxLength = 4096) => {
                        const parts = [];
                        let currentChunk = text;
                        while (currentChunk.length > 0) {
                            if (currentChunk.length <= maxLength) {
                                parts.push(currentChunk);
                                break;
                            }
                            let splitIndex = currentChunk.lastIndexOf('\n\n', maxLength);
                            if (splitIndex === -1) splitIndex = currentChunk.lastIndexOf('\n', maxLength);
                            if (splitIndex === -1) splitIndex = currentChunk.lastIndexOf(' ', maxLength);
                            if (splitIndex === -1) splitIndex = maxLength;
                            parts.push(currentChunk.substring(0, splitIndex));
                            currentChunk = currentChunk.substring(splitIndex).trim();
                        }
                        return parts;
                    };
                    // ======================= FIM DA FUNÇÃO HELPER DE PAGINAÇÃO DE TEXTO =======================

                    const validateImageUrl = async (url) => {
                        try {
                            const response = await fetch(url);
                            return response.ok && response.headers.get('content-type')?.startsWith('image/');
                        } catch {
                            return false;
                        }
                    };

                    // ======================= GERAÇÃO DE EMBED COM SUPORTE À PAGINAÇÃO DE DESCRIÇÃO =======================
                    // Esta função cria o embed que será exibido para o usuário.
                    // Ela utiliza a função `splitText` para dividir o conteúdo da página (`page.content`) se ele for muito longo.
                    // O `descPIdx` (índice da página de descrição) é usado para exibir a parte correta do texto.
                    const generateEphemeralEmbed = async (loreDoc, chapIdx, pIdx, descPIdx) => {
                        try {
                            let files = []; // Array para armazenar os arquivos a serem anexados.
                            const chapter = loreDoc.chapters[chapIdx];
                            const page = chapter.pages[pIdx];

                            // Garante que temos um conteúdo válido
                            if (!page || !page.content) {
                                return new EmbedBuilder()
                                    .setColor('Red')
                                    .setTitle('❌ Erro')
                                    .setDescription('Página não encontrada ou sem conteúdo.')
                                    .setTimestamp();
                            }

                            // A PAGINAÇÃO OCORRE AQUI: O texto da página é dividido em `descriptionParts`.
                            const descriptionParts = splitText(page.content);
                            
                            // Seleciona a parte correta da descrição para exibir.
                            let currentDescription = 'Sem conteúdo disponível.';
                            
                            if (descriptionParts && descriptionParts.length > 0) {
                                if (descPIdx < descriptionParts.length) {
                                    currentDescription = descriptionParts[descPIdx];
                                } else {
                                    currentDescription = descriptionParts[0];
                                }
                            }

                            // Garante que a descrição nunca seja undefined ou vazia
                            if (!currentDescription || currentDescription.trim() === '') {
                                currentDescription = 'Sem conteúdo disponível.';
                            }

                            const footerParts = [`${chapter.name} - Página ${pIdx + 1} de ${chapter.pages.length}`];
                            // Se a descrição foi dividida, adiciona a informação de "Parte X de Y" no rodapé.
                            if (descriptionParts.length > 1) {
                                footerParts.push(`Parte ${descPIdx + 1} de ${descriptionParts.length}`);
                            }

                            const embed = new EmbedBuilder()
                                .setTitle(loreDoc.title || 'Lore')
                                .setColor('#0099ff')
                                .setAuthor({ 
                                    name: `Lore por ${interaction.user.username}`, 
                                    iconURL: interaction.user.displayAvatarURL() 
                                })
                                .setDescription(currentDescription || ' ') // Ensure description is never null/undefined/empty string
                                .setFooter({ text: footerParts.join(' | ') })
                                .setTimestamp();

                            // Verifica e adiciona a imagem se existir e for válida
                            // --- Lógica de processamento de imagem ---
                            if (page?.imageUrl) {
                                const isValidImage = await validateImageUrl(page.imageUrl);
                                if (isValidImage) {
                                    try {
                                        // Faz o download da imagem para um buffer
                                        const response = await fetch(page.imageUrl); // Certifique-se de que `fetch` está disponível (importado)
                                        const imageBuffer = Buffer.from(await response.arrayBuffer());
                                        const attachment = new AttachmentBuilder(imageBuffer, { name: 'lore_image.png' });
                                        files.push(attachment);
                                        // Define a imagem no embed para usar o anexo local
                                        embed.setImage('attachment://lore_image.png');
                                    } catch (fetchError) {
                                        console.error(`Falha ao baixar a imagem da URL: ${page.imageUrl}`, fetchError);
                                    }
                                }
                            }
                            // --- Fim da lógica de processamento de imagem ---

                            return { embed, files }; // Retorna o embed e os arquivos

                        } catch (error) {
                            console.error('Erro ao gerar embed:', error);
                            // Retorna um embed de erro com descrição válida
                            const errorEmbed = new EmbedBuilder()
                                .setColor('Red')
                                .setTitle('❌ Erro ao carregar página')
                                .setDescription('Ocorreu um erro ao carregar esta página da lore.')
                                .setTimestamp();
                            return { embed: errorEmbed, files: [] }; // Retorna o embed de erro e um array vazio de arquivos
                        }
                    };
                    // ======================= FIM DA GERAÇÃO DE EMBED PAGINADA =======================


                    // ======================= GERAÇÃO DE BOTÕES COM SUPORTE À PAGINAÇÃO DE DESCRIÇÃO =======================
                    // Esta função cria os botões de navegação.
                    // Se a descrição de uma página foi dividida em várias partes (`totalDescPages > 1`), ela adiciona botões específicos ("◀ Descrição" e "Descrição ▶") para navegar entre essas partes.
                    const getEphemeralButtons = (loreDoc, chapIdx, pIdx, descPIdx) => {
                        const totalChapters = loreDoc.chapters.length;
                        const totalPagesInChapter = loreDoc.chapters[chapIdx].pages.length;
                        const descriptionParts = splitText(loreDoc.chapters[chapIdx].pages[pIdx].content);
                        const totalDescPages = descriptionParts.length;

                        const chapterNavRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`lore_prev_chapter_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('<< Cap. Anterior').setStyle(ButtonStyle.Secondary).setDisabled(chapIdx === 0),
                            new ButtonBuilder().setCustomId(`lore_next_chapter_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('Cap. Próximo >>').setStyle(ButtonStyle.Secondary).setDisabled(chapIdx >= totalChapters - 1)
                        );
                        const pageNavRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`lore_prev_page_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('◀️ Página').setStyle(ButtonStyle.Primary).setDisabled(pIdx === 0),
                            new ButtonBuilder().setCustomId(`lore_next_page_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('Página ▶️').setStyle(ButtonStyle.Primary).setDisabled(pIdx >= totalPagesInChapter - 1)
                        );

                        const components = [chapterNavRow, pageNavRow];

                        // AQUI SÃO ADICIONADOS OS BOTÕES DE PAGINAÇÃO DA DESCRIÇÃO
                        if (totalDescPages > 1) {
                            const descNavRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId(`lore_prev_desc_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('◀ Descrição').setStyle(ButtonStyle.Secondary).setDisabled(descPIdx === 0),
                                new ButtonBuilder().setCustomId(`lore_next_desc_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('Descrição ▶').setStyle(ButtonStyle.Secondary).setDisabled(descPIdx >= totalDescPages - 1)
                            );
                            components.push(descNavRow);
                        }

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
                    // ======================= FIM DA GERAÇÃO DE BOTÕES DE PAGINAÇÃO =======================

                    const { embed, files } = await generateEphemeralEmbed(lore, chapterIndex, pageIndex, descPageIndex);
                    const responseOptions = {
                        embeds: [embed],
                        files: files, // Adiciona os arquivos à resposta
                        components: getEphemeralButtons(lore, chapterIndex, pageIndex, descPageIndex),
                        flags: 64
                    };

                    // Garante que estamos usando o método correto para responder
                    if (action === 'read') {
                        await interaction.reply(responseOptions);
                    } else {
                        // Se a interação já foi respondida, usa update
                        await interaction.update(responseOptions);
                    }
                    return; 
                }
                // ======================= FIM DA LÓGICA DE PAGINAÇÃO E NAVEGAÇÃO DA LORE =======================

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
                        return interaction.reply({ content: '❌ Ocorreu um erro ao processar esta ação (ID de linha inválido).', flags: 64 });
                    }

                    const res = await sheets.spreadsheets.values.get({
                        spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                        range: `INDIVIDUAIS!A${rowIndex}:D${rowIndex}`,
                    });

                    const rowData = res.data.values ? res.data.values[0] : null;
                    if (!rowData) {
                        return interaction.reply({ content: '❌ Não foi possível encontrar os dados desta aparência. Pode ter sido movida ou excluída.', flags: 64 });
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
                            flags: 64
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

                // ======================= INÍCIO DA CRIAÇÃO DE CAPÍTULO E PAGINAÇÃO DE CONTEÚDO =======================
                // Este bloco é acionado quando o usuário envia o modal para adicionar um novo capítulo.
                // O processo envolve coletar mensagens e paginá-las.
                if (interaction.customId.startsWith('add_chapter_modal_')) {
                    const messageId = interaction.customId.split('_')[3];
                    const newChapterName = interaction.fields.getTextInputValue('chapter_name_input');

                    await interaction.reply({ content: `Certo! Agora, para adicionar o capítulo **"${newChapterName}"**, reaja com ➕ na **primeira** mensagem do novo capítulo.`, flags: 64 });

                    const reactionFilter = (reaction, user) => user.id === interaction.user.id && reaction.message.channel.id === interaction.channelId;

                    // ======================= COLETA DE MENSAGENS PARA O NOVO CAPÍTULO =======================
                    // O bot aguarda o usuário reagir com ➕ na primeira mensagem e ➖ na última.
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
                                if (!loreCommand) {
                                    return interaction.editReply({ content: '❌ Erro interno: O comando base da lore não foi encontrado.' });
                                }

                                const newMessages = await loreCommand.fetchMessagesBetween(interaction.channel, newStartMessage.id, newEndMessage.id);
                                
                                // ======================= PROCESSAMENTO E PAGINAÇÃO DAS MENSAGENS COLETADAS =======================
                                // Esta lógica itera sobre as mensagens coletadas para criar as "páginas" do capítulo.
                                // - `textBlock`: Acumula texto de mensagens consecutivas.
                                // - `persistentImageUrl`: Associa uma imagem a todas as páginas de texto subsequentes.
                                // - `processTextBlock()`: Pega o texto acumulado, usa `paginateText` para dividi-lo se for longo, e cria os objetos de página.
                                let newPagesAsObjects = [];
                                let textBlock = [];
                                let persistentImageUrl = null;

                                const processTextBlock = () => {
                                    if (textBlock.length > 0) {
                                        // AQUI OCORRE A PAGINAÇÃO DO TEXTO: `loreCommand.paginateText` (que usa uma lógica similar a `splitText`)
                                        // divide o texto acumulado em `textPages` se ele exceder o limite.
                                        const fullText = textBlock.join('\n\n');
                                        const textPages = loreCommand.paginateText(fullText);
                                        textPages.forEach(pageContent => {
                                            newPagesAsObjects.push({
                                                content: pageContent,
                                                imageUrl: persistentImageUrl
                                            });
                                        });
                                        textBlock = [];
                                        persistentImageUrl = null;
                                    }
                                };

                                // Itera sobre cada mensagem para construir os blocos de texto e associar imagens.
                                for (const msg of newMessages) {
                                    const hasText = msg.content && msg.content.trim() !== '';
                                    const imageAttachment = msg.attachments.find(att => att.contentType?.startsWith('image/'))?.url;

                                    if (imageAttachment) {
                                        // 1. Processa qualquer texto acumulado ANTES desta imagem.
                                        processTextBlock(); 
                                        
                                        // 2. Se a mensagem atual tem texto, cria uma página para ele COM a imagem.
                                        if (hasText) {
                                            textBlock.push(msg.content);
                                            persistentImageUrl = imageAttachment;
                                            processTextBlock(); // Processa imediatamente este bloco com texto e imagem.
                                        } else {
                                            // 3. Se a mensagem tem SÓ a imagem, define-a como persistente para o próximo texto.
                                            persistentImageUrl = imageAttachment;
                                        }
                                    } else if (hasText) {
                                        // 4. Se a mensagem tem só texto, acumula no bloco atual.
                                        textBlock.push(msg.content);
                                    }
                                    // Se a mensagem não tem texto nem imagem (ex: embed), ela é ignorada.
                                }
                                processTextBlock(); // Processa o bloco final
                                // ======================= FIM DO PROCESSAMENTO E PAGINAÇÃO =======================

                                const loreDB = await this.client.database.Lore.findOne({ messageId: messageId });
                                if (!loreDB) {
                                    return interaction.editReply({ content: '❌ Lore original não encontrada. Operação cancelada.' });
                                }

                                // Adiciona o novo capítulo ao array de capítulos do documento
                                loreDB.chapters.push({ name: newChapterName });
                                const newChapterIndex = loreDB.chapters.length - 1;

                                loreDB.chapters[newChapterIndex].pages = newPagesAsObjects;
                                await loreDB.save();

                                await interaction.editReply({ content: '✅ Novo capítulo adicionado com sucesso! Iniciando backup e limpeza...' });

                                // Início da Lógica de Backup e Exclusão para o novo capítulo
                                const backupChannelId = '1437124928737509559';
                                const backupChannel = await this.client.channels.fetch(backupChannelId).catch(() => null);
                                if (!backupChannel) {
                                    return interaction.followUp({ content: '⚠️ O capítulo foi salvo, mas o canal de backup não foi encontrado. As mensagens originais não foram excluídas.', flags: 64 });
                                }

                                const { txtBuffer, zipBuffer } = await messagesToTxt(newMessages, `lore-${loreDB.title}-${newChapterName}.txt`, `Backup para ${loreDB.title}`);
                                const attachments = [new AttachmentBuilder(txtBuffer, { name: `capitulo_${newChapterName}.txt` })];
                                if (zipBuffer) {
                                    attachments.push(new AttachmentBuilder(zipBuffer, { name: `capitulo_${newChapterName}_imagens.zip` }));
                                }

                                const backupSent = await backupChannel.send({ content: `Backup do novo capítulo **${newChapterName}** para a lore **${loreDB.title}**.`, files: attachments }).catch(() => null);
                                const dmSent = await interaction.user.send({ content: `Backup do novo capítulo **${newChapterName}** da sua lore **${loreDB.title}**.`, files: attachments }).catch(() => null);

                                if (!backupSent || !dmSent) {
                                    return interaction.followUp({ content: '⚠️ O capítulo foi salvo, mas ocorreu um erro ao enviar os backups. As mensagens originais não foram excluídas.', flags: 64 });
                                }

                                const twoWeeksAgo = Date.now() - 1209600000;
                                const recentMessages = newMessages.filter(m => m.createdTimestamp > twoWeeksAgo && m.deletable);
                                const oldMessages = newMessages.filter(m => m.createdTimestamp <= twoWeeksAgo && m.deletable);

                                if (recentMessages.length > 0) {
                                    await interaction.channel.bulkDelete(recentMessages, true).catch(() => {});
                                }
                                for (const msg of oldMessages) {
                                    await msg.delete().catch(() => {});
                                }

                                await interaction.followUp({ content: '✅ Backup concluído e mensagens originais do novo capítulo foram limpas.', flags: 64 });
                                // Fim da lógica de backup
                            } catch (error) {
                                console.error("Erro ao adicionar novo capítulo:", error);
                                await interaction.editReply({ content: '❌ Ocorreu um erro ao adicionar o novo capítulo.' });
                            }
                        };
                        this.client.on('messageReactionAdd', endCollectorFn);
                    };
                    this.client.on('messageReactionAdd', startCollectorFn);
                    return;
                    // ======================= FIM DA CRIAÇÃO DE CAPÍTULO E PAGINAÇÃO DE CONTEÚDO =======================
                }

                if (interaction.customId.startsWith('edit_chapter_modal_')) {

                    return interaction.reply({ content: 'Esta função foi atualizada para "Editar Página". Por favor, tente novamente.', flags: 64 });
                }

                if (interaction.customId.startsWith('edit_page_modal_')) {
                    const parts = interaction.customId.split('_');
                    const messageId = parts[3];
                    const chapterIndex = parseInt(parts[4], 10);
                    const pageIndex = parseInt(parts[5], 10);
                    const newPageContent = interaction.fields.getTextInputValue('page_content_input');

                    const lore = await this.client.database.Lore.findOne({ messageId: messageId });
                    if (!lore || interaction.user.id !== lore.createdBy) {
                        return interaction.reply({ content: '❌ Você não tem permissão ou a lore não foi encontrada.', flags: 64 });
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

                    // Validação da URL
                    if (!imageUrl.startsWith('http')) {
                        return interaction.reply({ 
                            content: '❌ URL inválida. A URL deve começar com http:// ou https://',
                            flags: 64 
                        });
                    }

                    try {
                        const lore = await this.client.database.Lore.findOne({ messageId: messageId });
                        if (!lore || interaction.user.id !== lore.createdBy) {
                            return interaction.reply({ 
                                content: '❌ Você não tem permissão ou a lore não foi encontrada.',
                                flags: 64 
                            });
                        }

                        // Garante que o caminho existe
                        if (!lore.chapters[chapterIndex].pages[pageIndex]) {
                            return interaction.reply({
                                content: '❌ Página não encontrada na lore.',
                                flags: 64
                            });
                        }

                        // Atualiza a imageUrl
                        lore.chapters[chapterIndex].pages[pageIndex].imageUrl = imageUrl;
                        await lore.save();

                        // Atualiza o embed com a nova imagem
                        const currentEmbed = interaction.message.embeds[0];
                        const updatedEmbed = EmbedBuilder.from(currentEmbed)
                            .setImage(imageUrl);

                        await interaction.update({ 
                            embeds: [updatedEmbed],
                            content: '✅ Imagem adicionada com sucesso!' 
                        });

                        console.log('Imagem salva:', {
                            messageId,
                            chapterIndex,
                            pageIndex,
                            imageUrl
                        });

                    } catch (err) {
                        console.error('Erro ao salvar imagem:', err);
                        await interaction.reply({ 
                            content: '❌ Erro ao salvar a imagem. Tente novamente.',
                            flags: 64 
                        });
                    }
                    return;
                }

                if (interaction.customId.startsWith('lore_edit_title_modal_')) {
                    const messageId = interaction.customId.split('_')[4];
                    const newTitle = interaction.fields.getTextInputValue('lore_title_input');

                    await this.client.database.Lore.updateOne({ messageId: messageId }, { $set: { title: newTitle } });

                    const loreMessage = await interaction.channel.messages.fetch(messageId);
                    const updatedEmbed = EmbedBuilder.from(loreMessage.embeds[0]).setTitle(newTitle);
                    await loreMessage.edit({ embeds: [updatedEmbed] });

                    await interaction.reply({ content: `✅ O título da lore foi atualizado com sucesso!`, flags: 64 });
                    return; // Retorna para evitar que a interação seja atualizada antes do modal
                }


                if (interaction.customId === 'lore_modal_config') {
                    try {
                        // Adia a resposta do modal IMEDIATAMENTE.
                        // Isso garante que a interação seja reconhecida antes de qualquer processamento.
                        await interaction.deferReply({ flags: 64 });

                        // Edita a resposta para dar feedback ao usuário enquanto o processamento ocorre.
                        await interaction.editReply({ content: 'Salvando sua lore e preparando os backups... Isso pode levar um momento.' });
                        
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

                        const publicButtons = new ActionRowBuilder();
                        publicButtons.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`lore_read_${loreMessage.id}`)
                                .setLabel('📖 Ler Lore')
                                .setStyle(ButtonStyle.Success)
                        );

                        // Adiciona botões de gerenciamento se o usuário for o criador
                        publicButtons.addComponents(
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
                        await interaction.followUp({ content: `✅ Sua lore **"${title}"** foi salva com sucesso neste canal!`, flags: 64 });
                        
                        // Início da Lógica de Backup e Exclusão
                        try {
                            const backupChannelId = '1437124928737509559';
                            const backupChannel = await this.client.channels.fetch(backupChannelId).catch(() => null);
                            if (!backupChannel) {
                                console.error(`Canal de backup ${backupChannelId} não encontrado.`);
                                await interaction.followUp({ content: '⚠️ A lore foi salva, mas não foi possível encontrar o canal de backup. As mensagens originais não foram excluídas.', flags: 64 });
                                return;
                            }

                            const { txtBuffer, zipBuffer } = await messagesToTxt(loreState.rawMessages, `lore-${title}.txt`, `Backup para ${title}`);
                            
                            const attachments = [new AttachmentBuilder(txtBuffer, { name: `lore_${loreMessage.id}.txt` })];
                            if (zipBuffer) {
                                attachments.push(new AttachmentBuilder(zipBuffer, { name: `lore_imagens_${loreMessage.id}.zip` }));
                            }

                            // Envia para o canal de backup e para a DM
                            const backupSent = await backupChannel.send({ content: `Backup da lore **${title}** criada por ${interaction.user.tag}.`, files: attachments }).catch(() => null);
                            const dmSent = await interaction.user.send({ content: `Backup da sua lore **${title}**.`, files: attachments }).catch(dmError => console.error(`Erro ao enviar DM de backup para ${interaction.user.tag}:`, dmError));

                            // Verifica se os backups foram enviados corretamente
                            if (!backupSent || !dmSent) {
                                await interaction.followUp({ content: '⚠️ A lore foi salva, mas ocorreu um erro ao enviar os backups (Verifique se suas DMs estão abertas). As mensagens originais **não foram excluídas**.', flags: 64 });
                                return;
                            }

                            // Exclusão das mensagens
                            await interaction.followUp({ content: ' backups enviados. Iniciando exclusão das mensagens originais...', flags: 64 });

                            const twoWeeksAgo = Date.now() - 1209600000; // 14 dias em milissegundos
                            const recentMessages = loreState.rawMessages.filter(m => m.createdTimestamp > twoWeeksAgo && m.deletable);
                            const oldMessages = loreState.rawMessages.filter(m => m.createdTimestamp <= twoWeeksAgo && m.deletable);

                            if (recentMessages.length > 0) {
                                await interaction.channel.bulkDelete(recentMessages, true).catch(err => {
                                    console.error("Erro no bulkDelete, tentando individualmente:", err);
                                    for (const msg of recentMessages) {
                                        msg.delete().catch(() => {});
                                    }
                                });
                            }

                            for (const msg of oldMessages) {
                                await msg.delete().catch(() => {});
                            }

                            await interaction.followUp({ content: '✅ Mensagens originais da lore foram limpas do canal.', flags: 64 });

                        } catch (backupError) {
                            console.error("Erro no processo de backup/exclusão da lore:", backupError);
                            await interaction.followUp({ content: '⚠️ A lore foi salva, mas um erro inesperado ocorreu durante o backup. As mensagens originais **não foram excluídas**.', flags: 64 });
                        }
                    } catch (error) {
                        console.error("Erro ao processar o modal da lore:", error);
                    }
                }

                if (interaction.customId.startsWith('modal_edit_appearance_')) {
                    await interaction.deferReply({ flags: 64 });
    
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