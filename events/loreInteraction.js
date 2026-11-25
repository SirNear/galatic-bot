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
const mongoose = require('mongoose');
const { messagesToTxt } = require('../api/messagesToTxt.js');
const { extractTextFromAttachment } = require('../api/documentParser.js');
const { generatePdf, splitLinesForNotebookLM } = require('../api/pdfGenerator.js');

/**
 * Constrói a fileira de botões públicos da Main Page (mensagem eterna da Lore no canal).
 */
function buildPublicLoreMainPageButtons(messageId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`lore_read_${messageId}`).setLabel('📖 Ler Lore').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`lore_download_pdf_${messageId}`).setEmoji('💾').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`lore_manage_edit-title_${messageId}`).setLabel('Editar Informações').setStyle(ButtonStyle.Secondary).setEmoji('✏️'),
        new ButtonBuilder().setCustomId(`lore_manage_delete-lore_${messageId}`).setLabel('Excluir Lore').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );
}

/**
 * Gera os arquivos PDF de uma Lore completa seguindo o padrão do Resumo Semanal
 * (com word-wrap inteligente sem cortar texto, WinAnsiEncoding e divisão para NotebookLM).
 */
async function generateLorePdfAttachments(loreDoc, client, fallbackChannel = null) {
    let channelObj = fallbackChannel;
    if (loreDoc.channelId) {
        channelObj = await client.channels.fetch(loreDoc.channelId).catch(() => fallbackChannel);
    }

    const catName = channelObj?.parent?.parent?.name || channelObj?.parent?.name || 'Lores do Servidor';
    const forumChanName = channelObj?.isThread?.() ? (channelObj?.parent?.name || channelObj?.name || 'Canal de RP') : (channelObj?.name || 'Canal de RP');
    const postTitle = channelObj?.isThread?.() ? channelObj.name : (loreDoc.title || 'Lore');

    const creatorUser = await client.users.fetch(loreDoc.createdBy).catch(() => null);
    const authorUsername = creatorUser?.username || loreDoc.createdBy || 'Desconhecido';
    const createdDateStr = loreDoc.createdAt ? new Date(loreDoc.createdAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
    const dataGeracao = new Date().toLocaleString('pt-BR');

    const totalChapters = Array.isArray(loreDoc.chapters) ? loreDoc.chapters.length : 0;
    const totalPages = (loreDoc.chapters || []).reduce((acc, c) => acc + (Array.isArray(c?.pages) ? c.pages.length : 0), 0);

    const fileText = [];
    fileText.push(`======================================================================`);
    fileText.push(`                        ARQUIVO DE REGISTRO DE RP`);
    fileText.push(`======================================================================\n`);
    fileText.push(`- Categoria: ${catName}`);
    fileText.push(`- Fórum/Canal: ${forumChanName}`);
    fileText.push(`- Título da Postagem: ${postTitle}`);
    fileText.push(`- Total de Mensagens Coletadas: ${totalPages}`);
    fileText.push(`- Intervalo de Mensagens: ${totalChapters} capítulo(s) • ${totalPages} página(s)`);
    fileText.push(`- Data de Geração: ${dataGeracao}\n`);
    fileText.push(`======================================================================`);
    fileText.push(`                        CONTEÚDO`);
    fileText.push(`======================================================================\n`);

    fileText.push(`\n${'='.repeat(20)} [LORE: ${(loreDoc.title || 'Sem Título').toUpperCase()}] ${'='.repeat(20)}`);
    fileText.push(`Canal: ${channelObj?.name || 'Canal de RP'} | Autor: ${authorUsername} | Data: ${createdDateStr}\n`);

    if (loreDoc.synopsis && loreDoc.synopsis.trim().length > 0) {
        fileText.push(`>> CAPÍTULO: Sinopse / Apresentação`);
        fileText.push('-'.repeat(40));
        fileText.push(loreDoc.synopsis.trim());
    }

    for (const chapter of (loreDoc.chapters || [])) {
        if (!chapter) continue;
        fileText.push(`\n>> CAPÍTULO: ${chapter.name || 'Capítulo'}`);
        fileText.push('-'.repeat(40));
        for (const page of (chapter.pages || [])) {
            if (page && page.content && page.content.trim().length > 0) {
                fileText.push(page.content);
            }
        }
    }

    fileText.push(`\n${'='.repeat(20)} [FIM DA LORE] ${'='.repeat(20)}\n`);

    const notebookParts = splitLinesForNotebookLM(fileText, `Lore: ${loreDoc.title || 'Sem Título'}`);
    const totalParts = notebookParts.length;
    const datStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const cleanLoreName = (loreDoc.title || 'Lore')
        .replace(/[^a-zA-Z0-9-_\u00C0-\u017E ]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .substring(0, 45) || 'Lore';

    const attachments = [];
    for (let pIdx = 0; pIdx < totalParts; pIdx++) {
        const partLines = notebookParts[pIdx];
        const partSuffix = totalParts > 1 ? `_Parte-${pIdx + 1}-de-${totalParts}` : '';
        const partTitleSuffix = totalParts > 1 ? ` (Parte ${pIdx + 1} de ${totalParts})` : '';
        const pdfFileName = `Lore-${cleanLoreName}-${datStr}${partSuffix}.pdf`;

        const pdfBuffer = await generatePdf({
            titulo: `LORE — ${loreDoc.title || 'Sem Título'}${partTitleSuffix}`,
            categoria: catName,
            canal: forumChanName,
            postTitle: `${authorUsername} (${totalChapters} cap. / ${totalPages} pág.)`,
            mensagensRange: 'Início a Fim (Completo)',
            modo: 'Exportação de Lore Completa (Padrão Resumo Semanal)',
            fileTextLines: partLines,
            resumo: null,
        });

        attachments.push(new AttachmentBuilder(pdfBuffer, { name: pdfFileName }));
    }

    return { attachments, totalChapters, totalPages, authorUsername };
}

// Cache em memória de URLs de imagens do Discord já renovadas (TTL de 12 horas)
const refreshedImageCache = new Map();
// Cache de capítulos cujos backups já foram verificados para evitar buscas repetidas
const checkedBackupChapters = new Set();

/**
 * Obtém a data real em que o capítulo foi lançado.
 * Prioriza `chapter.createdAt`, depois o timestamp nativo do ObjectId `chapter._id`,
 * e por fim `loreDoc.createdAt`.
 */
function getChapterReleaseDate(chapter, loreDoc) {
    if (chapter?.createdAt) {
        const dt = new Date(chapter.createdAt);
        if (!isNaN(dt.getTime())) return dt;
    }
    if (chapter?._id) {
        try {
            return new mongoose.Types.ObjectId(String(chapter._id)).getTimestamp();
        } catch (_) { }
    }
    if (loreDoc?.createdAt) {
        const dt = new Date(loreDoc.createdAt);
        if (!isNaN(dt.getTime())) return dt;
    }
    return new Date();
}

/**
 * Renova URLs de anexos da CDN do Discord expiradas usando o endpoint oficial de bots.
 */
async function refreshDiscordAttachmentUrl(url, client) {
    if (!url || typeof url !== 'string') return null;

    const cached = refreshedImageCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.url;
    }

    const isDiscordCdn = url.includes('cdn.discordapp.com/attachments/') || url.includes('media.discordapp.net/attachments/');
    if (!isDiscordCdn) {
        return url;
    }

    try {
        const token = client?.token || process.env.DISCORD_TOKEN || process.env.TOKEN;
        if (!token) return url;

        const res = await fetch('https://discord.com/api/v10/attachments/refresh-urls', {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ attachment_urls: [url] })
        });

        if (res.ok) {
            const data = await res.json();
            const refreshed = data?.refreshed_urls?.[0]?.refreshed;
            if (refreshed) {
                // Verifica rapidamente se o arquivo ainda existe (ex: canal de backup = 200 OK; mensagem deletada = 404)
                const check = await fetch(refreshed, { method: 'HEAD' }).catch(() => null);
                if (check && check.ok) {
                    refreshedImageCache.set(url, { url: refreshed, expiresAt: Date.now() + 12 * 3600 * 1000 });
                    return refreshed;
                }
                return null; // 404 - mensagem original foi deletada, precisa recuperar do ZIP de backup
            }
        }
    } catch (err) {
        console.warn('[LORE IMAGE] Erro ao renovar URL de imagem:', err.message);
    }
    return null;
}

/**
 * Recupera imagens de um capítulo a partir do arquivo .zip enviado ao canal de backup (BACKUP_CHANNEL_ID)
 * e atualiza as páginas no MongoDB com links persistentes do canal de backup.
 */
async function recoverChapterImagesFromBackupZip(client, loreDoc, chapIdx) {
    const cacheKey = `${loreDoc.messageId}_${chapIdx}`;
    if (checkedBackupChapters.has(cacheKey)) return null;
    checkedBackupChapters.add(cacheKey);

    try {
        const bacChannelId = process.env.BACKUP_CHANNEL_ID;
        if (!bacChannelId) return null;

        const bacCha = await client.channels.fetch(bacChannelId).catch(() => null);
        if (!bacCha) return null;

        const chapter = loreDoc.chapters?.[chapIdx];
        if (!chapter || !Array.isArray(chapter.pages)) return null;

        // Busca mensagens no canal de backup para encontrar o .zip desta lore/capítulo
        let targetZipAttachment = null;
        let lastMsgId = undefined;

        for (let batch = 0; batch < 4; batch++) {
            const fetchOpts = { limit: 100 };
            if (lastMsgId) fetchOpts.before = lastMsgId;
            const messages = await bacCha.messages.fetch(fetchOpts).catch(() => null);
            if (!messages || messages.size === 0) break;

            for (const msg of messages.values()) {
                const zipAtt = msg.attachments.find(a => a.name && a.name.endsWith('.zip'));
                if (!zipAtt) continue;

                // Verifica se é o zip da lore (Capítulo 1) ou do capítulo específico
                const matchesLoreId = zipAtt.name.includes(loreDoc.messageId);
                const matchesTitleAndChap = msg.content && msg.content.includes(loreDoc.title) && msg.content.includes(chapter.name);
                const matchesTitleCap0 = chapIdx === 0 && msg.content && msg.content.includes(`Backup da lore **${loreDoc.title}**`);

                if (matchesLoreId || matchesTitleAndChap || matchesTitleCap0) {
                    targetZipAttachment = zipAtt;
                    break;
                }
            }

            if (targetZipAttachment) break;
            lastMsgId = messages.last()?.id;
        }

        if (!targetZipAttachment) return null;

        const zipRes = await fetch(targetZipAttachment.url);
        if (!zipRes.ok) return null;

        const zipBuffer = await zipRes.buffer();
        const zip = new AdmZip(zipBuffer);
        const imageEntries = zip.getEntries().filter(e => !e.isDirectory && /\.(png|jpe?g|gif|webp)$/i.test(e.name));
        if (imageEntries.length === 0) return null;

        // Faz upload de cada imagem do ZIP para o canal de backup para gerar links eternos
        const uploadedUrls = [];
        for (const entry of imageEntries) {
            try {
                const imgBuf = entry.getData();
                const cleanName = entry.name.replace(/^\d{3}-/, '');
                const sent = await bacCha.send({
                    content: `🖼️ Backup de imagem restaurado • Lore: **${loreDoc.title}** (${chapter.name})`,
                    files: [new AttachmentBuilder(imgBuf, { name: entry.name })]
                });
                const newUrl = sent.attachments.first()?.url;
                if (newUrl) {
                    uploadedUrls.push({ entryName: entry.name, cleanName, url: newUrl });
                    refreshedImageCache.set(newUrl, { url: newUrl, expiresAt: Date.now() + 12 * 3600 * 1000 });
                }
            } catch (upErr) {
                console.warn('[LORE IMAGE] Falha ao re-enviar imagem do ZIP:', upErr.message);
            }
        }

        if (uploadedUrls.length === 0) return null;

        // Associa as imagens restauradas às páginas do capítulo
        let uploadIdx = 0;
        for (let p = 0; p < chapter.pages.length; p++) {
            const page = chapter.pages[p];
            if (page.imageUrl) {
                const matchByName = uploadedUrls.find(u => page.imageUrl.includes(u.cleanName));
                if (matchByName) {
                    page.imageUrl = matchByName.url;
                } else if (uploadedUrls[uploadIdx]) {
                    page.imageUrl = uploadedUrls[uploadIdx].url;
                    uploadIdx++;
                }
            }
        }

        // Atualiza no MongoDB
        await client.database.Lore.updateOne(
            { messageId: loreDoc.messageId },
            { $set: { [`chapters.${chapIdx}.pages`]: chapter.pages } }
        ).catch(() => { });

        return chapter.pages;
    } catch (err) {
        console.warn('[LORE IMAGE] Erro ao recuperar imagens do ZIP de backup:', err.message);
        return null;
    }
}

/**
 * Resolve e garante que a URL da imagem de uma página da Lore esteja válida e pronta para exibição no Embed.
 */
async function resolveValidLoreImageUrl(imageUrl, client, loreDoc = null, chapIdx = 0, pIdx = 0) {
    if (!imageUrl) return null;

    // 1. Tenta renovar/validar a URL diretamente
    const refreshed = await refreshDiscordAttachmentUrl(imageUrl, client);
    if (refreshed) return refreshed;

    // 2. Se retornou null (link do Discord expirado e mensagem original apagada), tenta restaurar do ZIP de backup
    if (loreDoc) {
        const updatedPages = await recoverChapterImagesFromBackupZip(client, loreDoc, chapIdx);
        if (updatedPages && updatedPages[pIdx]?.imageUrl) {
            return updatedPages[pIdx].imageUrl;
        }
    }

    // 3. Fallback: retorna a URL original caso seja um link externo
    return imageUrl.startsWith('http') ? imageUrl : null;
}

/**
 * Constrói o modal de configuração/edição da Main Page da Lore.
 */
function buildMainPageConfigModal(loreState) {
    const modal = new ModalBuilder()
        .setCustomId('lore_modal_mainpage')
        .setTitle('Configurar Página Inicial da Lore');

    const titleInput = new TextInputBuilder()
        .setCustomId('lore_title')
        .setLabel("Título da Lore")
        .setStyle(TextInputStyle.Short)
        .setValue((loreState?.title || 'Minha Lore').substring(0, 100))
        .setRequired(true);

    const chapterInput = new TextInputBuilder()
        .setCustomId('lore_chapter')
        .setLabel("Nome/Número do Capítulo")
        .setStyle(TextInputStyle.Short)
        .setValue((loreState?.chapter || 'Capítulo 1').substring(0, 100))
        .setPlaceholder('Ex: "Capítulo 1", "Prólogo", etc.')
        .setRequired(true);

    const synopsisInput = new TextInputBuilder()
        .setCustomId('lore_synopsis')
        .setLabel("Descritor / Sinopse (Página Inicial)")
        .setStyle(TextInputStyle.Paragraph)
        .setValue((loreState?.synopsis || '').substring(0, 4000))
        .setPlaceholder('Resumo ou apresentação para a mensagem eterna da lore no canal (Opcional)...')
        .setRequired(false);

    const coverInput = new TextInputBuilder()
        .setCustomId('lore_cover_image')
        .setLabel("URL da Imagem de Capa (Opcional)")
        .setStyle(TextInputStyle.Short)
        .setValue((loreState?.coverImageUrl || '').substring(0, 500))
        .setPlaceholder('https://exemplo.com/capa.png')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(chapterInput),
        new ActionRowBuilder().addComponents(synopsisInput),
        new ActionRowBuilder().addComponents(coverInput)
    );

    return modal;
}

/**
 * Exibe a pré-visualização da Página Inicial (Main Page) para revisão do autor antes de sacramentar.
 */
async function showMainPagePreview(interaction, client, loreState) {
    const title = loreState.title || 'Sem Título';
    const chapter = loreState.chapter || 'Capítulo 1';
    const synopsis = loreState.synopsis || '';
    const coverUrl = loreState.coverImageUrl || loreState.pages?.[0]?.imageUrl || null;
    const eternalDescription = synopsis || loreState.pages?.[0]?.content || 'Clique em Ler Lore para iniciar a leitura.';

    const previewEmbed = new EmbedBuilder()
        .setTitle(title)
        .setColor('#0099ff')
        .setAuthor({ name: `Lore por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
        .setDescription(eternalDescription.substring(0, 4096))
        .setFooter({ text: synopsis ? `📚 1 capítulo • Clique em "📖 Ler Lore" para iniciar a leitura` : `${chapter} - Parte 1 de ${loreState.pages.length}` })
        .setTimestamp(new Date());

    if (coverUrl && coverUrl.startsWith('http')) {
        previewEmbed.setImage(coverUrl);
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('lore_btn_sacramentar')
            .setLabel('Salvar Lore')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('lore_btn_edit_mainpage')
            .setLabel('Editar Main Page')
            .setEmoji('✏️')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('lore_btn_preview_pages_0')
            .setLabel('Ver Páginas do Texto')
            .setEmoji('📖')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('lore_btn_cancel')
            .setLabel('Cancelar')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
    );

    const payload = {
        content:
            '✨ **Pré-visualização da Página Inicial (Main Page):**\n' +
            'Esta é a mensagem eterna de apresentação da sua lore como ela aparecerá no canal.\n' +
            'Se quiser ajustar título, sinopse ou imagem de capa, clique em **Editar Main Page**.\n' +
            'Quando estiver tudo pronto, clique em **Sacramentar Lore** para salvar e publicar!',
        embeds: [previewEmbed],
        components: [row],
    };

    if (interaction.replied || interaction.deferred) {
        return interaction.editReply(payload);
    } else if (interaction.isButton()) {
        return interaction.update(payload).catch(() => interaction.editReply(payload));
    } else {
        return interaction.reply({ ...payload, flags: 64 });
    }
}

/**
 * Exibe a pré-visualização das páginas de conteúdo da Lore durante a criação.
 */
async function showPagesPreview(interaction, pageIndex, loreState) {
    const pages = loreState.pages || [];
    const idx = Math.max(0, Math.min(pageIndex, pages.length - 1));
    const page = pages[idx] || { content: 'Sem conteúdo.', imageUrl: null };

    const pageEmbed = new EmbedBuilder()
        .setTitle(`<a:spinnyman:1433853169884205106> | Lore: ${loreState.title || 'Sem Título'}`)
        .setDescription(page.content.substring(0, 4096))
        .setColor('#0099ff')
        .setFooter({ text: `Página ${idx + 1} de ${pages.length} (${loreState.chapter || 'Capítulo 1'})` });

    if (page.imageUrl && page.imageUrl.startsWith('http')) {
        pageEmbed.setImage(page.imageUrl);
    }

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`lore_btn_preview_pages_${idx - 1}`)
            .setLabel('◀️ Anterior')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(idx <= 0),
        new ButtonBuilder()
            .setCustomId(`lore_btn_preview_pages_${idx + 1}`)
            .setLabel('Próximo ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(idx >= pages.length - 1),
        new ButtonBuilder()
            .setCustomId('lore_back_to_mainpage')
            .setLabel('Voltar à Main Page')
            .setEmoji('↩️')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('lore_btn_sacramentar')
            .setLabel('Sacramentar Lore')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
    );

    const payload = {
        content: `📖 **Visualizando Páginas do Texto** (Página ${idx + 1} de ${pages.length}):`,
        embeds: [pageEmbed],
        components: [navRow],
    };

    if (interaction.replied || interaction.deferred) {
        return interaction.editReply(payload);
    } else if (interaction.isButton()) {
        return interaction.update(payload).catch(() => interaction.editReply(payload));
    } else {
        return interaction.reply({ ...payload, flags: 64 });
    }
}

/**
 * Executa a sacramentação oficial da Lore: salva no MongoDB, posta no canal e cria backups.
 */
async function sacramentarLore(interaction, client, loreState) {
    if (!loreState || !loreState.pages || loreState.pages.length === 0) {
        const errPayload = { content: '❌ Sessão de lore não encontrada ou expirada. Por favor, inicie novamente com `/lore`.', components: [], embeds: [] };
        if (interaction.replied || interaction.deferred) return interaction.editReply(errPayload);
        return interaction.reply({ ...errPayload, flags: 64 });
    }

    if (interaction.isButton()) {
        await interaction.update({ content: '⏳ Sacramentando sua lore e preparando backups no servidor... Isso pode levar alguns segundos.', components: [], embeds: [] }).catch(() => { });
    } else if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
    }

    const title = loreState.title || 'Minha Lore';
    const chapter = loreState.chapter || 'Capítulo 1';
    const synopsis = loreState.synopsis || '';
    const coverImageInput = loreState.coverImageUrl || '';
    const { pages } = loreState;

    const bacCha = await client.channels.fetch(process.env.BACKUP_CHANNEL_ID).catch(() => null);
    if (!bacCha) {
        return interaction.followUp({ content: '⚠️ O canal de backup não foi encontrado. A operação foi cancelada para evitar perda de dados.', flags: 64 });
    }

    // Faz backup individual de imagens de páginas
    for (let i = 0; i < pages.length; i++) {
        if (pages[i].imageUrl && !pages[i].imageUrl.includes(process.env.BACKUP_CHANNEL_ID)) {
            try {
                const backupImgMsg = await bacCha.send({ files: [pages[i].imageUrl] });
                const persistentUrl = backupImgMsg.attachments.first()?.url;
                if (persistentUrl) pages[i].imageUrl = persistentUrl;
            } catch (imgErr) {
                console.warn(`[LORE] Falha ao fazer backup individual de imagem da página ${i + 1}:`, imgErr.message);
            }
        }
    }

    let finalCoverUrl = null;
    if (coverImageInput && coverImageInput.startsWith('http')) {
        finalCoverUrl = coverImageInput;
        try {
            const backupCoverMsg = await bacCha.send({ files: [coverImageInput] });
            if (backupCoverMsg.attachments.first()?.url) {
                finalCoverUrl = backupCoverMsg.attachments.first().url;
            }
        } catch (_) { }
    } else if (pages[0]?.imageUrl) {
        finalCoverUrl = pages[0].imageUrl;
    }

    const firstMsgDate = loreState.rawMessages?.[0]?.createdAt ? new Date(loreState.rawMessages[0].createdAt) : new Date();
    const eternalDescription = synopsis || pages[0].content;

    const eternalEmbed = new EmbedBuilder()
        .setTitle(title)
        .setColor('#0099ff')
        .setAuthor({ name: `Lore por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
        .setDescription(eternalDescription.substring(0, 4096))
        .setFooter({ text: synopsis ? `📚 1 capítulo • Clique em "📖 Ler Lore" para iniciar a leitura` : `${chapter} - Parte 1 de ${pages.length}` })
        .setTimestamp(firstMsgDate);

    if (finalCoverUrl) {
        eternalEmbed.setImage(finalCoverUrl);
    }

    const targetChannel = interaction.channel;
    const loreMessage = await targetChannel.send({ embeds: [eternalEmbed] });

    const publicButtons = buildPublicLoreMainPageButtons(loreMessage.id);
    await loreMessage.edit({ components: [publicButtons] });

    await client.database.Lore.create({
        messageId: loreMessage.id,
        channelId: loreMessage.channel.id,
        guildId: loreMessage.guild.id,
        createdBy: interaction.user.id,
        title: title,
        synopsis: synopsis || null,
        coverImageUrl: finalCoverUrl || null,
        chapters: [{ name: chapter, pages: pages, createdAt: firstMsgDate }]
    });

    client.fichaStates.delete(interaction.user.id);

    await interaction.followUp({ content: `✅ Sua lore **"${title}"** foi sacramentada e publicada com sucesso!`, flags: 64 });

    const { txtBuffer, zipBuffer } = await messagesToTxt(loreState.rawMessages, `lore-${title}-${chapter}.txt`, `Backup para ${title}`);
    const anexos = [new AttachmentBuilder(txtBuffer, { name: `lore_${loreMessage.id}.txt` })];
    if (zipBuffer) anexos.push(new AttachmentBuilder(zipBuffer, { name: `lore_imagens_${loreMessage.id}.zip` }));

    const backupEnviado = await bacCha.send({ content: `Backup da lore **${title}** criada por ${interaction.user.tag}.`, files: anexos }).catch(() => null);
    if (!backupEnviado) return interaction.followUp({ content: '⚠️ A lore foi salva, mas ocorreu um erro ao enviar o backup para o servidor.', flags: 64 });

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
            if (dmEnviada) await i.update({ content: '✅ Backup enviado para sua DM!', components: [] });
            else await i.update({ content: '⚠️ Não foi possível enviar a DM. Verifique suas configurações de privacidade.', components: [] });
        } else {
            await i.update({ content: 'Ok! O backup não será enviado por DM.', components: [] });
        }

        // Limpeza de mensagens originais apenas se forem mensagens reais do canal e deletáveis
        if (Array.isArray(loreState.rawMessages)) {
            const duasSemanasAtras = Date.now() - 1209600000;
            const msgsRecentes = loreState.rawMessages.filter(m => m.createdTimestamp > duasSemanasAtras && m.deletable);
            const msgsAntigas = loreState.rawMessages.filter(m => m.createdTimestamp <= duasSemanasAtras && m.deletable);
            if (msgsRecentes.length > 0) await interaction.channel.bulkDelete(msgsRecentes, true).catch(() => { });
            for (const msg of msgsAntigas) await msg.delete().catch(() => { });
        }
    });

    coletor.on('end', async (collected, reason) => {
        if (reason === 'time') {
            await msgConfirmacao.edit({ content: '⏰ Tempo esgotado para confirmação de DM.', components: [] }).catch(() => { });
        }
    });
}

async function handleLoreInteraction(interaction, client) {
    // ─── Botões do Fluxo de Criação da Lore (Main Page, Prévia e Sacramentação) ───
    if (interaction.isButton()) {
        if (interaction.customId === 'lore_btn_setup_mainpage' || interaction.customId === 'lore_btn_edit_mainpage') {
            const loreState = client.fichaStates.get(interaction.user.id);
            if (!loreState) {
                return interaction.reply({ content: '❌ Sessão de criação de lore não encontrada ou expirada.', flags: 64 });
            }
            return interaction.showModal(buildMainPageConfigModal(loreState));
        }

        if (interaction.customId === 'lore_btn_cancel') {
            client.fichaStates.delete(interaction.user.id);
            return interaction.update({ content: '❌ Criação de lore cancelada.', embeds: [], components: [] });
        }

        if (interaction.customId === 'lore_back_to_mainpage') {
            const loreState = client.fichaStates.get(interaction.user.id);
            if (!loreState) {
                return interaction.reply({ content: '❌ Sessão de criação de lore não encontrada.', flags: 64 });
            }
            return showMainPagePreview(interaction, client, loreState);
        }

        if (interaction.customId.startsWith('lore_btn_preview_pages_')) {
            const pageIdx = parseInt(interaction.customId.replace('lore_btn_preview_pages_', ''), 10) || 0;
            const loreState = client.fichaStates.get(interaction.user.id);
            if (!loreState) {
                return interaction.reply({ content: '❌ Sessão de criação de lore não encontrada.', flags: 64 });
            }
            return showPagesPreview(interaction, pageIdx, loreState);
        }

        if (interaction.customId === 'lore_btn_sacramentar') {
            const loreState = client.fichaStates.get(interaction.user.id);
            return sacramentarLore(interaction, client, loreState);
        }
    }
    // Lógica de botões da Lore
    if (interaction.isButton() || (interaction.isStringSelectMenu() && interaction.customId.startsWith('lore_read_'))) {
        if (interaction.customId.startsWith('lore_download_pdf_')) {
            const messageId = interaction.customId.replace('lore_download_pdf_', '');
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: 64 });
            }

            try {
                const lore = await client.database.Lore.findOne({ messageId: messageId }).lean();
                if (!lore) {
                    return interaction.editReply({ content: '❌ Esta lore não foi encontrada no banco de dados.' });
                }

                const { attachments, totalChapters, totalPages } = await generateLorePdfAttachments(lore, client, interaction.channel);

                return interaction.editReply({
                    content:
                        `💾 **PDF da Lore gerado com sucesso!**\n` +
                        `📖 **Título:** ${lore.title}\n` +
                        `📚 **Conteúdo:** \`${totalChapters}\` capítulo(s) • \`${totalPages}\` página(s) *(formatação completa sem cortes)*`,
                    files: attachments.slice(0, 10)
                });
            } catch (pdfErr) {
                console.error('[LORE PDF] Erro ao gerar PDF da lore:', pdfErr);
                return interaction.editReply({ content: `❌ Ocorreu um erro ao gerar o PDF desta lore: ${pdfErr.message}` });
            }
        }

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
                    .setTitle('Editar Página Inicial da Lore');

                const titleInput = new TextInputBuilder()
                    .setCustomId('lore_title_input')
                    .setLabel("Título da Lore")
                    .setStyle(TextInputStyle.Short)
                    .setValue(lore.title || '')
                    .setRequired(true);

                const currentDesc = lore.synopsis || '';
                const synopsisInput = new TextInputBuilder()
                    .setCustomId('lore_synopsis_input')
                    .setLabel("Descritor / Sinopse (Mensagem Eterna)")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Escreva uma sinopse ou descrição de apresentação para a mensagem principal da lore...')
                    .setValue(currentDesc.substring(0, 4000))
                    .setRequired(false);

                const coverImageInput = new TextInputBuilder()
                    .setCustomId('lore_cover_image_input')
                    .setLabel("Imagem de Capa (URL ou digite 'anexar')")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Cole uma URL https://... ou digite "anexar" para enviar uma foto no chat')
                    .setValue(lore.coverImageUrl || '')
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(synopsisInput),
                    new ActionRowBuilder().addComponents(coverImageInput)
                );
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
            } else if (['add', 'move-chapter', 'delete', 'edit', 'add-image', 'upg'].includes(action)) {
                messageId = parts[2]; // ID da mensagem é sempre o 3º elemento
                if (action === 'add' && type === 'chapter') messageId = parts[3];
                if (action === 'add' && type === 'backup') messageId = parts[3];
                if (action === 'move-chapter' || (action === 'delete' && type === 'chapter')) messageId = parts[3];
                if (['edit', 'delete', 'add-image'].includes(action) && type === 'page') messageId = parts[3];
                if (action === 'upg') messageId = parts[3];

                if (action === 'edit' && type === 'page') {
                    chapterIndex = parseInt(parts[4] || '0', 10);
                    pageIndex = parseInt(parts[5] || '0', 10);
                } else if (action === 'upg') {
                    chapterIndex = parseInt(parts[4] || '0', 10);
                    pageIndex = parseInt(parts[5] || '0', 10);
                    descPageIndex = parseInt(parts[6] || '0', 10);
                } else {
                    let idxPos = 3;
                    if (action === 'move-chapter') idxPos = 4;
                    if (action === 'delete' && type === 'chapter') idxPos = 4;

                    chapterIndex = parseInt(parts[idxPos] || '0', 10);
                    pageIndex = parseInt(parts[4] || '0', 10);
                }
                if (action !== 'upg') descPageIndex = 0;
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
                case 'upg': {
                    if (interaction.user.id !== lore.createdBy) return interaction.reply({ content: '❌ Você não tem permissão para usar isso.', flags: 64 });

                    // Upgrade abrange o capítulo inteiro (contexto geral)
                    const chapterObj = lore.chapters[chapterIndex];
                    const loreText = chapterObj.pages.map(p => p.content).join('\n\n');

                    let personagem = 'Não informado';
                    try {
                        const ficha = await client.database.Ficha.findOne({ userId: interaction.user.id, guildId: interaction.guildId }).sort({ updatedAt: -1 });
                        if (ficha && ficha.nome) personagem = ficha.nome;
                    } catch (_) { }

                    const { cacheUpgradeSystem } = require('./upgradeInteractions.js');
                    cacheUpgradeSystem.set(interaction.user.id, {
                        personagem: personagem,
                        loreText: loreText,
                        upgAmount: 1,
                        currentStep: 1,
                        upgrades: [],
                        aiMode: false,
                        fromLore: true,
                        loreTitle: lore.title,
                        chapterName: chapterObj.name
                    });

                    const embAi = new EmbedBuilder()
                        .setTitle('<a:MEE6_LEVLEUP:1503159176690405426> | CENTRAL DE UPGRADES | <a:MEE6_LEVLEUP:1503159176690405426>')
                        .setDescription(`🏆 **Central de Upgrades da Lore**\n**Lore:** ${lore.title}\n**Capítulo:** ${chapterObj.name}${personagem !== 'Não informado' ? `\n**Personagem:** ${personagem}` : ''}\n\nO texto deste capítulo foi capturado como base do seu treino!\n**Como você deseja definir os seus upgrades?**`)
                        .setColor('#2b2d31');
                    const rowAi = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('upgrade_mode_lore_ai').setLabel('Extrair da Lore (IA)').setStyle(ButtonStyle.Success).setEmoji('🤖'),
                        new ButtonBuilder().setCustomId('upgrade_mode_hybrid').setLabel('Modo Híbrido (IA)').setStyle(ButtonStyle.Primary).setEmoji('⚡'),
                        new ButtonBuilder().setCustomId('upgrade_mode_manual').setLabel('Preencher Manualmente').setStyle(ButtonStyle.Secondary).setEmoji('✍️'),
                        new ButtonBuilder().setCustomId('upgrade_mode_partes').setLabel('Fazer em Partes (10m)').setStyle(ButtonStyle.Success).setEmoji('⏱️'),
                        new ButtonBuilder().setCustomId('upgrade_mode_chat').setLabel('Coletar do Chat (IA)').setStyle(ButtonStyle.Secondary).setEmoji('💬')
                    );

                    // Pré-envia no chat (canal público) para que toda a navegação e confirmação ocorram no chat, como no comando
                    await interaction.channel.send({ content: `<@${interaction.user.id}>`, embeds: [embAi], components: [rowAi] });

                    return interaction.reply({ content: `✅ Central de upgrades enviada no chat para o capítulo **${chapterObj.name}**! Veja a mensagem enviada no canal.`, flags: 64 });
                }
                case 'chapters-list': {
                    const isCreator = interaction.user.id === lore.createdBy;
                    const validChapters = lore.chapters.filter(c => c && c.name);

                    const chapterOptions = validChapters.slice(0, 25).map((chap, idx) => ({
                        label: chap.name.substring(0, 100),
                        description: `Capítulo ${idx + 1} com ${chap.pages.length} página(s).`,
                        value: idx.toString(),
                    }));
                    const selectMenu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`lore_select_chapter_${messageId}`).setPlaceholder(isCreator ? 'Selecione um capítulo para gerenciar' : 'Selecione um capítulo para ler').addOptions(chapterOptions));
                    const componentsList = [selectMenu];
                    if (isCreator) {
                        componentsList.push(new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`lore_add_chapter_${messageId}`).setLabel('Adicionar Capítulo').setStyle(ButtonStyle.Success).setEmoji('➕'),
                            new ButtonBuilder().setCustomId(`lore_add_backup_${messageId}`).setLabel('Importar .TXT / .PDF').setStyle(ButtonStyle.Secondary).setEmoji('📥')
                        ));
                    }
                    const embListCap = new EmbedBuilder().setTitle(`📚 Lista de Capítulos - ${lore.title}`).setDescription(validChapters.map((chap, idx) => `**${idx + 1}.** ${chap.name}`).join('\n')).setFooter({ text: 'Selecione um capítulo no menu abaixo.' }).setColor('#2b2d31');
                    return interaction.reply({ embeds: [embListCap], components: componentsList, flags: 64 });
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
                        modal.setCustomId(`lore_add_backup_modal_${messageId}`).setTitle('Importar Capítulo (.txt / .pdf)');
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

                    const creatorUser = await client.users.fetch(loreDoc.createdBy).catch(() => interaction.user);
                    const chapterReleaseDate = getChapterReleaseDate(chapter, loreDoc);

                    const embed = new EmbedBuilder()
                        .setTitle(loreDoc.title || 'Lore')
                        .setColor('#0099ff')
                        .setAuthor({ name: `Lore por ${creatorUser.username}`, iconURL: creatorUser.displayAvatarURL() })
                        .setDescription(currentDescription)
                        .setFooter({ text: footerParts.join(' | ') })
                        .setTimestamp(chapterReleaseDate);

                    // Resolve e exibe a imagem da página (incluindo renovação automática de links do canal de backup)
                    if (page.imageUrl) {
                        const validImageUrl = await resolveValidLoreImageUrl(page.imageUrl, client, loreDoc, chapIdx, pIdx);
                        if (validImageUrl) {
                            embed.setImage(validImageUrl);
                        }
                    }

                    return { embed, files: [] };
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
                        new ButtonBuilder().setCustomId(`lore_add_backup_${messageId}`).setLabel('Importar .TXT / .PDF').setStyle(ButtonStyle.Secondary).setEmoji('📥'),
                        new ButtonBuilder().setCustomId(`lore_delete_chapter_${messageId}_${chapIdx}`).setLabel('Excluir Capítulo').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(totalChapters <= 1)
                    ));
                }

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`lore_prev_chapter_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('<< Cap. Anterior').setStyle(ButtonStyle.Secondary).setDisabled(chapIdx === 0),
                    new ButtonBuilder().setCustomId(`lore_next_chapter_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setLabel('Cap. Próximo >>').setStyle(ButtonStyle.Secondary).setDisabled(chapIdx >= totalChapters - 1)
                );

                if (interaction.user.id === loreDoc.createdBy) {
                    row2.addComponents(
                        new ButtonBuilder().setCustomId(`lore_upg_chap_${messageId}_${chapIdx}_${pIdx}_${descPIdx}`).setEmoji('1503159176690405426').setStyle(ButtonStyle.Success)
                    );
                }
                components.push(row2);

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
            } else if (action !== 'upg') {
                if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
            }

            if (action !== 'upg') {
                const { embed, files } = await generateEphemeralEmbed(lore, chapterIndex, pageIndex, descPageIndex);
                const responseOptions = { embeds: [embed], files: files, components: getEphemeralButtons(lore, chapterIndex, pageIndex, descPageIndex) };

                await interaction.editReply(responseOptions);
            }
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

                await interaction.update({ content: `✅ O capítulo **"${chapterName}"** foi excluído com sucesso. Você pode fechar esta mensagem.`, components: [] });
            } else if (interaction.customId === 'delete_chapter_cancel') {
                await interaction.update({ content: 'Operação de exclusão cancelada.', components: [] });
            }
        }
    }

    // Lógica de Modais da Lore
    if (interaction.isModalSubmit()) {
        // Função compartilhada para importar capítulo a partir de mensagem contendo anexo (.txt / .pdf + .zip opcional)
        const processChapterFileMessage = async (msg, messageId, newChapterName, isFormattedBackupMode = false) => {
            try {
                const docAttachment = msg.attachments.find(att => {
                    const n = (att.name || '').toLowerCase();
                    const ct = (att.contentType || '').toLowerCase();
                    return n.endsWith('.txt') || n.endsWith('.pdf') || n.endsWith('.md') || n.endsWith('.log') || ct.includes('pdf') || ct.startsWith('text/');
                });
                const zipAttachment = msg.attachments.find(att => (att.name || '').toLowerCase().endsWith('.zip'));

                if (!docAttachment) {
                    return interaction.followUp({ content: '❌ Nenhum arquivo `.txt` ou `.pdf` válido foi encontrado na mensagem.', flags: 64 });
                }

                await interaction.editReply({ content: `📥 Arquivo **${docAttachment.name}** recebido! Extraindo texto e processando o capítulo **"${newChapterName}"**...` }).catch(() => {});

                const parsed = await extractTextFromAttachment(docAttachment);
                const rawText = parsed.text;

                // Verifica se o arquivo segue o padrão de log de backup ([DD/MM/YYYY HH:mm:ss] Autor:\nConteúdo)
                const regMen = /\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\] .*?:\s*\n([\s\S]*?)(?=\n?\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\]|$)/g;
                const correspondencias = [...rawText.matchAll(regMen)];
                let contApe = '';

                if (correspondencias.length > 0) {
                    const conteudos = correspondencias
                        .map(corr => corr[1].trim())
                        .filter(cont => cont && !cont.startsWith('[Mensagem sem texto]') && !cont.startsWith('[Anexo:'));
                    contApe = conteudos.join('\n\n');
                }

                if (!contApe.trim() && rawText.trim().length > 0) {
                    contApe = rawText;
                }

                if (!contApe.trim()) {
                    return interaction.followUp({ content: '❌ O arquivo enviado parece estar vazio ou sem texto legível.', flags: 64 });
                }

                // Se era um arquivo de backup com timestamps (ou se foi enviado no modo backup e não tem markdown prévio), aplica formatação automática de diálogos/pensamentos se for backup log
                if (correspondencias.length > 0) {
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
                }

                const { paginateText } = require('../commands/rpg/lore.js');
                const paginasTex = paginateText(contApe);

                if (paginasTex.length === 0) {
                    return interaction.followUp({ content: '❌ Não foi possível paginar o texto do arquivo enviado.', flags: 64 });
                }

                const bacCha = await client.channels.fetch(process.env.BACKUP_CHANNEL_ID).catch(() => null);

                // Processar imagens do ZIP se existir
                let imagensMap = {};
                if (zipAttachment && bacCha) {
                    try {
                        const zipResponse = await fetch(zipAttachment.url);
                        const zipBuffer = await zipResponse.buffer();
                        const zip = new AdmZip(zipBuffer);
                        const zipEntries = zip.getEntries();

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
                    } catch (zipErr) {
                        console.warn(`Erro ao processar ZIP de imagens:`, zipErr.message);
                    }
                }

                const novasPagObj = paginasTex.map((contPag, idx) => ({
                    content: contPag,
                    imageUrl: imagensMap[idx] || null
                }));

                const loreDB = await client.database.Lore.findOne({ messageId: messageId });
                if (!loreDB) return interaction.editReply({ content: '❌ Lore original não encontrada.' });

                loreDB.chapters.push({ name: newChapterName, pages: novasPagObj, createdAt: new Date() });
                await loreDB.save();

                // Atualiza o contador de capítulos no footer da mensagem principal da lore (se tiver sinopse)
                try {
                    const targetChannel = await client.channels.fetch(loreDB.channelId).catch(() => interaction.channel);
                    const loreMessage = await targetChannel.messages.fetch(messageId).catch(() => null);
                    if (loreMessage && loreMessage.embeds[0] && loreDB.synopsis) {
                        const updatedEmbed = EmbedBuilder.from(loreMessage.embeds[0])
                            .setFooter({ text: `📚 ${loreDB.chapters.length} capítulo(s) • Clique em "📖 Ler Lore" para iniciar a leitura` });
                        await loreMessage.edit({ embeds: [updatedEmbed] }).catch(() => {});
                    }
                } catch (_) {}

                // Salva backup do capítulo no canal de backup
                if (bacCha) {
                    const mockMsg = {
                        createdAt: new Date(),
                        createdTimestamp: Date.now(),
                        author: interaction.user,
                        channel: interaction.channel,
                        content: contApe,
                        attachments: { size: 0, forEach: () => {}, find: () => null }
                    };
                    const { txtBuffer } = await messagesToTxt([mockMsg], `lore-${loreDB.title}-${newChapterName}.txt`, `Backup para ${loreDB.title}`).catch(() => ({ txtBuffer: Buffer.from(contApe, 'utf-8') }));
                    const anexos = [new AttachmentBuilder(txtBuffer, { name: `capitulo_${newChapterName}.txt` })];
                    await bacCha.send({
                        content: `Backup do novo capítulo **${newChapterName}** (${parsed.fileType.toUpperCase()}) para a lore **${loreDB.title}**.`,
                        files: anexos
                    }).catch(() => null);
                }

                await msg.delete().catch(() => {});
                await interaction.editReply({
                    content: `✅ O capítulo **"${newChapterName}"** (${novasPagObj.length} página(s)) foi importado com sucesso a partir do arquivo \`${parsed.fileName}\` (${parsed.fileType.toUpperCase()})!`
                }).catch(() => {});
            } catch (error) {
                console.error("Erro ao processar arquivo de capítulo de lore:", error);
                await interaction.followUp({ content: `❌ Ocorreu um erro ao processar o arquivo: ${error.message}`, flags: 64 }).catch(() => {});
            }
        };

        if (interaction.customId.startsWith('add_chapter_modal_')) {
            const messageId = interaction.customId.split('_')[3];
            const newChapterName = interaction.fields.getTextInputValue('chapter_name_input');

            await interaction.deferReply({ flags: 64 });
            await interaction.editReply({
                content:
                    `Certo! Para adicionar o capítulo **"${newChapterName}"**, escolha uma das opções abaixo:\n\n` +
                    `1️⃣ **Pelos Mensagens do Chat:** Reaja com ➕ na **primeira** mensagem do novo capítulo (e depois com ➖ na última).\n` +
                    `📄 **Por Arquivo (.txt ou .pdf):** Simplesmente **envie o arquivo \`.txt\` ou \`.pdf\` neste canal agora** (junto com um \`.zip\` de imagens opcional)!`
            });

            const reactionFilter = (reaction, user) => user.id === interaction.user.id;

            // Coletor paralelo de arquivo (.txt / .pdf) caso o jogador prefira enviar um arquivo diretamente
            const fileFilter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
            const fileCollector = interaction.channel.createMessageCollector({ filter: fileFilter, time: 300000 });

            fileCollector.on('collect', async (msg) => {
                const hasDoc = msg.attachments.some(att => {
                    const n = (att.name || '').toLowerCase();
                    const ct = (att.contentType || '').toLowerCase();
                    return n.endsWith('.txt') || n.endsWith('.pdf') || n.endsWith('.md') || n.endsWith('.log') || ct.includes('pdf') || ct.startsWith('text/');
                });
                if (!hasDoc) return;

                client.removeListener('messageReactionAdd', startCollectorFn);
                fileCollector.stop('file_uploaded');
                await processChapterFileMessage(msg, messageId, newChapterName, false);
            });

            const startCollectorFn = async (startReaction, user) => {
                if (!reactionFilter(startReaction, user) || startReaction.emoji.name !== '➕') return;
                client.removeListener('messageReactionAdd', startCollectorFn);
                fileCollector.stop('reaction_started');
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
                            const imageAttachment = msg.attachments.find(att =>
                                att.contentType?.startsWith('image/') ||
                                /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(att.url || att.name || '')
                            );

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

                        const chapDate = newMessages[0]?.createdAt ? new Date(newMessages[0].createdAt) : new Date();
                        loreDB.chapters.push({ name: newChapterName, pages: newPagesAsObjects, createdAt: chapDate });
                        await loreDB.save();

                        // Atualiza o contador de capítulos no footer da mensagem principal da lore
                        try {
                            const targetChannel = await client.channels.fetch(loreDB.channelId).catch(() => interaction.channel);
                            const loreMessage = await targetChannel.messages.fetch(messageId).catch(() => null);
                            if (loreMessage && loreMessage.embeds[0] && loreDB.synopsis) {
                                const updatedEmbed = EmbedBuilder.from(loreMessage.embeds[0])
                                    .setFooter({ text: `📚 ${loreDB.chapters.length} capítulo(s) • Clique em "📖 Ler Lore" para iniciar a leitura` });
                                await loreMessage.edit({ embeds: [updatedEmbed] }).catch(() => {});
                            }
                        } catch (_) {}

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
                                if (msgsRecentes.length > 0) await interaction.channel.bulkDelete(msgsRecentes, true).catch(() => { });
                                for (const msg of msgsAntigas) await msg.delete().catch(() => { });
                                await interaction.followUp({ content: '✅ Mensagens originais do novo capítulo foram limpas.', flags: 64 });
                            } catch (cleanupErr) {
                                console.error("Erro ao limpar mensagens:", cleanupErr);
                                await interaction.followUp({ content: '⚠️ Ocorreu um erro ao limpar as mensagens originais.', flags: 64 });
                            }
                        });

                        coletor.on('end', async (collected, reason) => {
                            if (reason === 'time') {
                                await msgConfirmacao.edit({ content: '⏰ Tempo esgotado. A limpeza das mensagens originais foi cancelada. Você pode excluí-las manualmente.', components: [] }).catch(() => { });
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
            await interaction.editReply({ content: `✅ Capítulo nomeado como **"${newChapterName}"**. Agora, envie o arquivo **.txt** ou **.pdf** neste canal (junto com um arquivo **.zip** de imagens opcional). Você tem 5 minutos.` });

            const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
            const collector = interaction.channel.createMessageCollector({ filter, time: 300000, max: 1 });

            collector.on('collect', async msg => {
                await processChapterFileMessage(msg, messageId, newChapterName, true);
            });
            collector.on('end', (collected, reason) => { if (reason === 'time') interaction.followUp({ content: '⏰ Tempo esgotado. A operação foi cancelada.', flags: 64 }).catch(() => { }); });
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
            const imageUrl = interaction.fields.getTextInputValue('image_url_input').trim();

            await interaction.deferReply({ flags: 64 });

            if (!imageUrl.startsWith('http')) return interaction.editReply({ content: '❌ URL inválida. A URL deve começar com http:// ou https://' });

            const lore = await client.database.Lore.findOne({ messageId: messageId });
            if (!lore || interaction.user.id !== lore.createdBy) return interaction.editReply({ content: '❌ Você não tem permissão ou a lore não foi encontrada.' });
            if (!lore.chapters[chapterIndex]?.pages[pageIndex]) return interaction.editReply({ content: '❌ Página não encontrada na lore.' });

            let finalPageImageUrl = imageUrl;
            const bacCha = await client.channels.fetch(process.env.BACKUP_CHANNEL_ID).catch(() => null);
            if (bacCha) {
                try {
                    const imgRes = await fetch(imageUrl);
                    if (imgRes.ok) {
                        const buf = await imgRes.buffer();
                        const extMatch = imageUrl.match(/\.(png|jpe?g|gif|webp)/i);
                        const ext = extMatch ? extMatch[1] : 'png';
                        const sent = await bacCha.send({
                            content: `🖼️ Imagem de página adicionada • Lore: **${lore.title}**`,
                            files: [new AttachmentBuilder(buf, { name: `page_${chapterIndex}_${pageIndex}.${ext}` })]
                        });
                        if (sent.attachments.first()?.url) {
                            finalPageImageUrl = sent.attachments.first().url;
                        }
                    }
                } catch (_) { }
            }

            lore.chapters[chapterIndex].pages[pageIndex].imageUrl = finalPageImageUrl;
            lore.markModified('chapters');
            await lore.save();

            await interaction.editReply({ content: '✅ Imagem adicionada e salva em backup com sucesso! Navegue novamente pela página para visualizá-la.' });
        }

        if (interaction.customId.startsWith('lore_edit_title_modal_')) {
            await interaction.deferReply({ flags: 64 });
            const messageId = interaction.customId.split('_')[4];
            const newTitle = interaction.fields.getTextInputValue('lore_title_input').trim();
            let newSynopsis = '';
            let newCoverInput = '';
            try {
                newSynopsis = interaction.fields.getTextInputValue('lore_synopsis_input')?.trim() || '';
            } catch (_) { }
            try {
                newCoverInput = interaction.fields.getTextInputValue('lore_cover_image_input')?.trim() || '';
            } catch (_) { }

            const lore = await client.database.Lore.findOne({ messageId: messageId });
            if (!lore || interaction.user.id !== lore.createdBy) {
                return interaction.editReply({ content: '❌ Você não tem permissão ou a lore não foi encontrada.' });
            }

            const bacCha = await client.channels.fetch(process.env.BACKUP_CHANNEL_ID).catch(() => null);
            let finalCoverUrl = lore.coverImageUrl || null;
            let waitingUpload = false;

            if (['anexar', 'upload', 'arquivo', 'foto'].includes(newCoverInput.toLowerCase())) {
                waitingUpload = true;
            } else if (newCoverInput === '' || newCoverInput.toLowerCase() === 'remover' || newCoverInput.toLowerCase() === 'nenhuma') {
                finalCoverUrl = null;
            } else if (newCoverInput.startsWith('http')) {
                finalCoverUrl = newCoverInput;
                if (bacCha && !newCoverInput.includes(process.env.BACKUP_CHANNEL_ID)) {
                    try {
                        const imgRes = await fetch(newCoverInput);
                        if (imgRes.ok) {
                            const buf = await imgRes.buffer();
                            const extMatch = newCoverInput.match(/\.(png|jpe?g|gif|webp)/i);
                            const ext = extMatch ? extMatch[1] : 'png';
                            const sent = await bacCha.send({
                                content: `🖼️ Capa da Lore **${newTitle}**`,
                                files: [new AttachmentBuilder(buf, { name: `capa_${messageId}.${ext}` })]
                            });
                            if (sent.attachments.first()?.url) {
                                finalCoverUrl = sent.attachments.first().url;
                            }
                        }
                    } catch (_) { }
                }
            }

            lore.title = newTitle;
            if (newSynopsis) lore.synopsis = newSynopsis;
            if (!waitingUpload) lore.coverImageUrl = finalCoverUrl;
            await lore.save();

            // Atualiza a mensagem eterna no canal
            const updateEternalMessage = async (coverUrlToSet) => {
                const targetChannel = await client.channels.fetch(lore.channelId).catch(() => interaction.channel);
                const loreMessage = await targetChannel.messages.fetch(messageId).catch(() => null);
                if (!loreMessage || !loreMessage.embeds[0]) return;

                const oldEmbed = loreMessage.embeds[0];
                const descToSet = lore.synopsis || oldEmbed.description || lore.chapters[0]?.pages[0]?.content || 'Clique abaixo para ler a lore.';
                const validCover = coverUrlToSet ? (await resolveValidLoreImageUrl(coverUrlToSet, client)) : null;

                const updatedEmbed = EmbedBuilder.from(oldEmbed)
                    .setTitle(newTitle)
                    .setDescription(descToSet.substring(0, 4096))
                    .setImage(validCover || null)
                    .setFooter({ text: `📚 ${lore.chapters.length} capítulo(s) • Clique em "📖 Ler Lore" para iniciar a leitura` });

                const publicButtons = buildPublicLoreMainPageButtons(messageId);

                await loreMessage.edit({ embeds: [updatedEmbed], components: [publicButtons] }).catch(() => { });
            };

            await updateEternalMessage(lore.coverImageUrl);

            if (waitingUpload) {
                await interaction.editReply({
                    content: `✅ Título e descritor atualizados! 📸 **Agora envie a imagem de capa neste chat em até 2 minutos** (sua mensagem com a foto será salva em backup e apagada automaticamente).`
                });

                const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
                const collector = interaction.channel.createMessageCollector({ filter, time: 120000, max: 1 });

                collector.on('collect', async (msg) => {
                    const att = msg.attachments.find(a => a.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(a.url || a.name || ''));
                    if (!att) {
                        return interaction.followUp({ content: '❌ O arquivo enviado não é uma imagem válida.', flags: 64 });
                    }
                    let uploadedCoverUrl = att.url;
                    if (bacCha) {
                        try {
                            const backupMsg = await bacCha.send({
                                content: `🖼️ Capa da Lore **${newTitle}**`,
                                files: [att]
                            });
                            uploadedCoverUrl = backupMsg.attachments.first()?.url || att.url;
                        } catch (_) { }
                    }
                    lore.coverImageUrl = uploadedCoverUrl;
                    await lore.save();
                    await updateEternalMessage(uploadedCoverUrl);
                    await msg.delete().catch(() => { });
                    await interaction.editReply({ content: '✅ Página inicial da Lore (Título, Descritor e Imagem de Capa) atualizada com sucesso!' }).catch(() => { });
                });
                return;
            }

            await interaction.editReply({ content: `✅ Página inicial da lore (**Título, Descritor e Imagem de Capa**) atualizada com sucesso!` });
        }

        if (interaction.customId === 'lore_modal_mainpage' || interaction.customId === 'lore_modal_config') {
            try {
                const title = interaction.fields.getTextInputValue('lore_title')?.trim() || 'Minha Lore';
                const chapter = interaction.fields.getTextInputValue('lore_chapter')?.trim() || 'Capítulo 1';
                let synopsis = '';
                let coverImageInput = '';
                try {
                    synopsis = interaction.fields.getTextInputValue('lore_synopsis')?.trim() || '';
                } catch (_) { }
                try {
                    coverImageInput = interaction.fields.getTextInputValue('lore_cover_image')?.trim() || '';
                } catch (_) { }

                const loreState = client.fichaStates.get(interaction.user.id);
                if (!loreState || !loreState.pages) {
                    return interaction.reply({
                        content: '❌ Não foi possível encontrar a sessão da sua lore. Por favor, inicie novamente com `/lore`.',
                        flags: 64,
                    });
                }

                loreState.title = title;
                loreState.chapter = chapter;
                loreState.synopsis = synopsis;
                loreState.coverImageUrl = coverImageInput;

                await showMainPagePreview(interaction, client, loreState);
            } catch (err) {
                console.error('[LORE-MODAL] Erro ao processar modal da Main Page:', err);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ Erro ao processar os dados da Main Page.', flags: 64 }).catch(() => { });
                }
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

/**
 * Atualiza todas as mensagens fixas de lore pré-existentes para garantir que os botões exibam
 * "Editar Informações" com o emoji ✏️ no lugar de "Editar Título" ou "Editar Capa / Lore".
 */
async function syncPreExistingLores(client) {
    try {
        if (!client?.database?.Lore) return;
        const lores = await client.database.Lore.find({});
        if (!lores || lores.length === 0) return;
        console.log(`[LORE SYNC] Verificando ${lores.length} lore(s) pré-existente(s) no Discord...`);
        let updatedCount = 0;

        for (const lore of lores) {
            try {
                if (!lore.channelId || !lore.messageId) continue;
                const channel = await client.channels.fetch(lore.channelId).catch(() => null);
                if (!channel) continue;

                let wasArchived = false;
                if (channel.isThread?.() && channel.archived) {
                    wasArchived = true;
                    await channel.setArchived(false).catch(() => { });
                }

                const message = await channel.messages.fetch(lore.messageId).catch(() => null);
                if (!message) {
                    if (wasArchived) await channel.setArchived(true).catch(() => { });
                    continue;
                }

                const currentEditBtn = message.components?.[0]?.components?.find(c => c.customId === `lore_manage_edit-title_${lore.messageId}`);
                const currentPdfBtn = message.components?.[0]?.components?.find(c => c.customId === `lore_download_pdf_${lore.messageId}`);
                if (!currentEditBtn || currentEditBtn.label !== 'Editar Informações' || !currentPdfBtn) {
                    const newRow = buildPublicLoreMainPageButtons(lore.messageId);
                    await message.edit({ components: [newRow] }).catch(err => {
                        console.warn(`[LORE SYNC] Não foi possível atualizar lore ${lore.messageId}: ${err.message}`);
                    });
                    updatedCount++;
                }

                if (wasArchived) {
                    await channel.setArchived(true).catch(() => { });
                }
            } catch (err) {
                // Silencioso para canais ou mensagens não mais acessíveis
            }
        }
        if (updatedCount > 0) {
            console.log(`[LORE SYNC] ✅ ${updatedCount} mensagem(ns) fixa(s) de lore atualizada(s) para "Editar Informações".`);
        }
    } catch (err) {
        console.error('[LORE SYNC] Erro ao sincronizar mensagens de lore pré-existentes:', err);
    }
}

module.exports = {
    handleLoreInteraction,
    resolveValidLoreImageUrl,
    refreshDiscordAttachmentUrl,
    getChapterReleaseDate,
    syncPreExistingLores,
    buildPublicLoreMainPageButtons,
    generateLorePdfAttachments
};