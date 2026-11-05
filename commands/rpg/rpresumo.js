const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
  ChannelType,
} = require('discord.js');
const Command = require('../../structures/Command');
const { resumirRP, summarizeSummary } = require('../../api/resumir.js');
const { generatePdf } = require('../../api/pdfGenerator.js');
const { uploadToDrive } = require('../../api/driveUploader.js');
const AdmZip = require('adm-zip');

// ─── Log dedicado do comando rpresumo ─────────────────────────────────────────
const LOG_CHANNEL_ID = '1423848686391394454';

async function logRpresumo(client, interaction, dados) {
    try {
        const channel = client.channels.cache.get(LOG_CHANNEL_ID)
            || await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('📜 /rpresumo — Log de Execução')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp()
            .setFooter({ text: `Usuário ID: ${interaction.user.id}` });

        embed.addFields(
            { name: '🗂️ Canal/Categoria Alvo', value: `\`${dados.canalNome}\``, inline: true },
            { name: '📊 Mensagens Coletadas', value: `\`${dados.totalMensagens}\``, inline: true },
            { name: '⚙️ Modo', value: `\`${dados.modo}\``, inline: true },
        );

        if (dados.semResumo !== undefined) {
            embed.addFields({ name: '🤖 IA Usada', value: dados.semResumo ? 'Não' : 'Sim', inline: true });
        }

        if (dados.formatoSaida) {
            embed.addFields({ name: '📁 Formato de Saída', value: `\`${dados.formatoSaida}\``, inline: true });
        }

        if (dados.driveLink) {
            embed.addFields({ name: '📤 Enviado para Drive', value: `[Ver no Drive](${dados.driveLink})`, inline: false });
        }

        if (dados.erro) {
            embed.addFields({ name: '❌ Erro', value: `\`\`\`${String(dados.erro).substring(0, 1000)}\`\`\`` });
            embed.setColor('#e74c3c');
        }

        await channel.send({ embeds: [embed] }).catch(() => {});
    } catch (e) {
        console.error('[RPRESUMO-LOG] Erro ao enviar log:', e);
    }
}

module.exports = class rpresumo extends Command {
  constructor(client) {
    super(client, {
      name: "rpresumo",
      description: "Resume um RP, identificando e incluindo conteúdo de Lores.",
      category: "rpg",
      aliases: ["resumir", "resumorpg"],
      UserPermission: [],
      clientPermission: [],
      OnlyDevs: false,
      slash: true,
    });

    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addStringOption(option => 
            option.setName('inicio')
                .setDescription('ID da mensagem inicial do RP')
                .setRequired(false))
        .addChannelOption(option => 
            option.setName('canal')
                .setDescription('Canal onde o RP ocorreu (opcional)')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('fim')
                .setDescription('ID da mensagem final do RP (opcional)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('com_resumo')
                .setDescription('Se verdadeiro, gera um resumo com IA. Por padrão (false), apenas coleta o conteúdo.')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('formato')
                .setDescription('Formato de download do arquivo gerado.')
                .setRequired(false)
                .addChoices(
                    { name: '📄 TXT (padrão)', value: 'txt' },
                    { name: '📕 PDF (pesquisável)', value: 'pdf' },
                    { name: '📦 ZIP (TXT + PDF)', value: 'zip' },
                ))
        .addBooleanOption(option =>
            option.setName('enviar_drive')
                .setDescription('Se verdadeiro, envia o PDF para a pasta do Google Drive.')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('tudo')
                .setDescription('Se verdadeiro, faz log do servidor INTEIRO (todas as categorias, fóruns, tópicos e chats).')
                .setRequired(false))
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Filtra para pegar apenas as mensagens/RPs de um usuário específico (opcional).')
                .setRequired(false));
    }
  }

  async fetchMessages(channel, startId, endId, targetUserId = null) {
    const messages = [];
    let cursor = endId;
    let stop = false;

    // Tenta incluir a mensagem final se ela pertencer a este canal e for válida
    if (endId) {
        try {
            const endMsg = await channel.messages.fetch(endId);
            if (!targetUserId || endMsg.author?.id === targetUserId) {
                messages.push(endMsg);
            }
        } catch (e) {
            // Mensagem não existe neste canal, apenas usamos o ID como referência de tempo
        }
    }

    while (!stop) {
        const options = { limit: 100 };
        if (cursor) options.before = cursor;

    try {
        const fetched = await channel.messages.fetch(options);
        if (fetched.size === 0) break;

        for (const msg of fetched.values()) {
            if (startId && msg.id === startId) {
                if (!targetUserId || msg.author?.id === targetUserId) {
                    messages.push(msg);
                }
                stop = true;
                break;
            }
            if (startId && BigInt(msg.id) < BigInt(startId)) {
                stop = true;
                break;
            }
            if (msg.id !== endId) {
                if (!targetUserId || msg.author?.id === targetUserId) {
                    messages.push(msg);
                }
            }
        }
        cursor = fetched.last()?.id;
    } catch (e) {
        console.error(`Erro ao buscar mensagens no canal ${channel.name}:`, e);
        break;
    }
    }
    return messages;
  }

  /**
   * Formata as mensagens coletadas em linhas para arquivo de texto e IA.
   */
  formatMessages(messages, loreMap, catName, forumChanName, postTitle, modoStr = null, rangeStr = null, targetUser = null) {
    let aiText = [];
    let fileText = [];

    fileText.push(`======================================================================`);
    fileText.push(`                        ARQUIVO DE REGISTRO DE RP`);
    fileText.push(`======================================================================\n`);
    fileText.push(`LEGENDA:`);
    fileText.push(`- Categoria: A categoria de canais onde o RP ocorreu.`);
    fileText.push(`- Fórum/Canal: O canal ou fórum específico.`);
    fileText.push(`- Título da Postagem: O nome do tópico/thread (se aplicável).`);
    fileText.push(`- Intervalo de Mensagens: Do ID da primeira à última mensagem incluída.`);
    fileText.push(`- Modo: ${modoStr || 'Texto Bruto (Backup de Conteúdo)'}\n`);
    fileText.push(`----------------------------------------------------------------------`);
    fileText.push(`                            INFORMAÇÕES`);
    fileText.push(`----------------------------------------------------------------------\n`);
    fileText.push(`- Categoria: ${catName}`);
    fileText.push(`- Fórum/Canal: ${forumChanName}`);
    fileText.push(`- Título da Postagem: ${postTitle}`);
    fileText.push(`- Intervalo de Mensagens: ${rangeStr || 'Início a Fim'}`);
    fileText.push(`- Filtro de Usuário: ${targetUser ? `${targetUser.tag} (${targetUser.id})` : 'Todos os Usuários'}`);
    fileText.push(`- Total de Mensagens: ${messages.length}`);
    fileText.push(`- Data de Geração: ${new Date().toLocaleString('pt-BR')}\n`);
    fileText.push(`======================================================================`);
    fileText.push(`                        CONTEÚDO`);
    fileText.push(`======================================================================\n`);

    for (const msg of messages) {
        const lore = loreMap.get(msg.id);
        const time = msg.createdAt ? msg.createdAt.toLocaleString('pt-BR') : 'Data desconhecida';
        const channelName = msg.channel ? msg.channel.name : 'Desconhecido';

        if (lore) {
            aiText.push(`\n--- [INÍCIO DA LORE: ${lore.title}] ---\n`);
            fileText.push(`\n${'='.repeat(20)} [LORE: ${lore.title.toUpperCase()}] ${'='.repeat(20)}`);
            fileText.push(`Canal: ${channelName} | Autor: ${msg.author.username} | Data: ${time}\n`);

            for (const chapter of lore.chapters) {
                aiText.push(`Capítulo: ${chapter.name}`);
                fileText.push(`\n>> CAPÍTULO: ${chapter.name}`);
                fileText.push('-'.repeat(40));
                for (const page of chapter.pages) {
                    aiText.push(page.content);
                    fileText.push(page.content);
                }
            }
            aiText.push(`\n--- [FIM DA LORE: ${lore.title}] ---\n`);
            fileText.push(`\n${'='.repeat(20)} [FIM DA LORE] ${'='.repeat(20)}\n`);
        } else {
            if (msg.content && msg.content.trim().length > 0) {
                aiText.push(`${msg.author.username}: ${msg.content}`);
                fileText.push(`[${time}] [${channelName}] ${msg.author.username}:`);
                fileText.push(`${msg.content}`);
                fileText.push('-'.repeat(60));
            }
        }
    }

    return { fileText, aiText };
  }

  /**
   * Identifica canais de texto e threads de fóruns de uma categoria.
   */
  async getCategoryChannels(cat, allChannels) {
    let channelsToProcess = [];
    let children;
    if (cat.isMock) {
        children = allChannels.filter(c => c && !c.parentId && c.type !== ChannelType.GuildCategory && (c.isTextBased() || c.type === ChannelType.GuildForum));
    } else {
        children = allChannels.filter(c => c && c.parentId === cat.id);
    }

    for (const child of children.values()) {
        if (child.isTextBased() && child.type !== ChannelType.GuildForum) {
            channelsToProcess.push({
                channel: child,
                forumName: child.name,
                isThread: child.isThread(),
                postTitle: child.isThread() ? child.name : 'N/A'
            });
            if (child.threads && typeof child.threads.fetchActive === 'function') {
                try {
                    const activeThreads = await child.threads.fetchActive();
                    for (const th of activeThreads.threads.values()) {
                        channelsToProcess.push({
                            channel: th,
                            forumName: child.name,
                            isThread: true,
                            postTitle: th.name
                        });
                    }
                } catch (e) {}
            }
        } else if (child.type === ChannelType.GuildForum) {
            try {
                const active = await child.threads.fetchActive();
                const archived = await child.threads.fetchArchived({ type: 'public', limit: 50 }).catch(() => ({ threads: new Map() }));
                const allThreads = [...active.threads.values(), ...archived.threads.values()];
                for (const thread of allThreads) {
                    channelsToProcess.push({
                        channel: thread,
                        forumName: child.name,
                        isThread: true,
                        postTitle: thread.name
                    });
                }
            } catch (e) {
                console.error(`[RPRESUMO-TUDO] Erro ao buscar fórum ${child.name}:`, e.message);
            }
        }
    }
    return channelsToProcess;
  }

  /**
   * Executa a extração completa de todo o servidor (todas as categorias, fóruns, tópicos e chats).
   */
  async executeTudo(interaction, options) {
    const { startId, endId, formato, enviarDrive, targetUser } = options;
    const targetUserId = targetUser ? targetUser.id : null;

    try {
        if (startId && endId && BigInt(startId) > BigInt(endId)) {
            return interaction.editReply({ content: '❌ O ID da mensagem inicial deve ser menor (mais antigo) que o ID da mensagem final.' });
        }
        if ((startId && !/^\d+$/.test(startId)) || (endId && !/^\d+$/.test(endId))) {
            return interaction.editReply({ content: '❌ Os IDs fornecidos devem ser numéricos (Snowflakes).' });
        }

        const msgMapeando = targetUser 
            ? `🔍 Mapeando servidor para coletar histórico de <@${targetUser.id}>...`
            : '🔍 Mapeando todas as categorias, fóruns, tópicos e canais do servidor...';
        await interaction.editReply({ content: msgMapeando });

        const allChannels = await interaction.guild.channels.fetch().catch(() => null);
        if (!allChannels) {
            return interaction.editReply({ content: '❌ Não foi possível carregar os canais do servidor.' });
        }

        const categories = allChannels.filter(c => c && c.type === ChannelType.GuildCategory);
        const orphanChannels = allChannels.filter(c => c && !c.parentId && c.type !== ChannelType.GuildCategory && (c.isTextBased() || c.type === ChannelType.GuildForum));

        const categoryList = Array.from(categories.values());
        if (orphanChannels.size > 0) {
            categoryList.push({ id: 'sem_categoria', name: 'Geral (Sem Categoria)', isMock: true });
        }

        if (categoryList.length === 0) {
            return interaction.editReply({ content: '❌ Nenhuma categoria ou canal encontrado.' });
        }

        const masterZip = new AdmZip();
        let totalServerMessages = 0;
        let processedCatsCount = 0;

        for (let i = 0; i < categoryList.length; i++) {
            const cat = categoryList[i];
            const safeCatName = cat.name.replace(/[^a-zA-Z0-9-_\u00C0-\u017E ]/g, '_').trim() || `Categoria_${i + 1}`;

            await interaction.editReply({ 
                content: `⏳ [${i + 1}/${categoryList.length}] Processando categoria: **${cat.name}**... (${totalServerMessages} mensagens coletadas${targetUser ? ` de ${targetUser.username}` : ''})` 
            }).catch(() => {});

            const channelsToProcess = await this.getCategoryChannels(cat, allChannels);
            if (channelsToProcess.length === 0) continue;

            const channelIds = channelsToProcess.map(item => item.channel.id);
            const categoryLores = await this.client.database.Lore.find({ channelId: { $in: channelIds } }).catch(() => []);
            const loreMap = new Map(categoryLores.map(l => [l.messageId, l]));

            let catAllMessages = [];

            for (const item of channelsToProcess) {
                try {
                    const msgs = await this.fetchMessages(item.channel, startId, endId, targetUserId);
                    if (!msgs || msgs.length === 0) continue;

                    msgs.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                    catAllMessages.push(...msgs);

                    const { fileText } = this.formatMessages(
                        msgs, 
                        loreMap, 
                        cat.name, 
                        item.forumName !== 'N/A' ? item.forumName : item.channel.name, 
                        item.postTitle !== 'N/A' ? item.postTitle : 'Principal',
                        targetUser ? `Backup Individual (Filtro: @${targetUser.username})` : 'Backup Individual de Canal',
                        `${startId || 'Início'} a ${endId || 'Fim'}`,
                        targetUser
                    );

                    const rawItemName = item.postTitle !== 'N/A' 
                        ? `${item.forumName} - ${item.postTitle}` 
                        : item.channel.name;
                    const cleanItemName = rawItemName.replace(/[^a-zA-Z0-9-_\u00C0-\u017E ]/g, '_').trim() || `Canal_${item.channel.id}`;

                    masterZip.addFile(`${safeCatName}/${cleanItemName}.txt`, Buffer.from(fileText.join('\n'), 'utf-8'));
                } catch (chErr) {
                    console.error(`[RPRESUMO-TUDO] Erro no canal ${item.channel.name}:`, chErr.message);
                }
            }

            if (catAllMessages.length > 0) {
                catAllMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                totalServerMessages += catAllMessages.length;
                processedCatsCount++;

                // Arquivo consolidado da categoria
                const { fileText: catAllLines } = this.formatMessages(
                    catAllMessages, 
                    loreMap, 
                    cat.name, 
                    'Categoria Inteira', 
                    'Todos os Canais e Fóruns',
                    targetUser ? `Backup Consolidado (Filtro: @${targetUser.username})` : 'Backup Consolidado da Categoria',
                    `${startId || 'Início'} a ${endId || 'Fim'}`,
                    targetUser
                );
                masterZip.addFile(`${safeCatName}/00_TODOS_OS_CHATS_${safeCatName}.txt`, Buffer.from(catAllLines.join('\n'), 'utf-8'));

                // Se formato for PDF ou ZIP, gera também o PDF da categoria
                if (formato === 'pdf' || formato === 'zip') {
                    try {
                        const pdfBuffer = await generatePdf({
                            titulo: targetUser ? `RP — ${cat.name} (${targetUser.username})` : `RP — ${cat.name}`,
                            categoria: cat.name,
                            canal: 'Categoria Inteira',
                            postTitle: 'Todos os Tópicos e Chats',
                            mensagensRange: `${startId || 'Início'} a ${endId || 'Fim'}`,
                            modo: targetUser ? `Backup Servidor Completo (Filtro: @${targetUser.username})` : 'Backup Servidor Completo',
                            fileTextLines: catAllLines,
                            resumo: null,
                        });
                        masterZip.addFile(`${safeCatName}/RP-${safeCatName}.pdf`, pdfBuffer);
                    } catch (pdfErr) {
                        console.warn(`[RPRESUMO-TUDO] Erro ao gerar PDF de ${cat.name}:`, pdfErr.message);
                    }
                }
            }
        }

        if (totalServerMessages === 0) {
            return interaction.editReply({ 
                content: targetUser 
                    ? `❌ Nenhuma mensagem encontrada para o usuário <@${targetUser.id}> em todo o servidor.` 
                    : '❌ Nenhuma mensagem encontrada no servidor dentro do critério especificado.' 
            });
        }

        await interaction.editReply({ content: '📦 Compactando todos os arquivos do servidor em ZIP...' });

        const zipBuffer = masterZip.toBuffer();
        const datAtu = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        const userSuffix = targetUser ? `-${targetUser.username.replace(/[^a-zA-Z0-9-_\u00C0-\u017E]/g, '_')}` : '';
        const zipFileName = `backup-rp-servidor-tudo${userSuffix}-${datAtu}.zip`;

        let driveLink = null;
        const isTooBigForDiscord = zipBuffer.length > 24 * 1024 * 1024;

        if (enviarDrive || isTooBigForDiscord) {
            try {
                await interaction.editReply({ content: '📤 Enviando arquivo ZIP com o backup de TUDO para o Google Drive...' }).catch(() => {});
                const uploadResult = await uploadToDrive({
                    buffer: zipBuffer,
                    fileName: zipFileName,
                    mimeType: 'application/zip',
                    skipIfExists: false,
                });
                driveLink = uploadResult.webViewLink;
            } catch (driveErr) {
                console.error('[RPRESUMO-TUDO] Erro ao enviar ZIP para o Drive:', driveErr);
            }
        }

        const filesToSend = [];
        if (!isTooBigForDiscord) {
            filesToSend.push(new AttachmentBuilder(zipBuffer, { name: zipFileName }));
        }

        const replyLines = [
            `✅ **Log de TUDO Concluído com Sucesso!**`,
            targetUser ? `👤 **Usuário filtrado:** <@${targetUser.id}> (\`${targetUser.tag}\`)` : null,
            `📁 **Categorias com conteúdo do usuário:** \`${processedCatsCount}\``,
            `💬 **Total de mensagens coletadas:** \`${totalServerMessages}\``,
            `📦 **Arquivo:** \`${zipFileName}\` (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`,
        ].filter(Boolean);

        if (driveLink) {
            replyLines.push(`☁️ **Google Drive:** [Acessar Backup no Drive](${driveLink})`);
        } else if (isTooBigForDiscord) {
            replyLines.push(`⚠️ O arquivo ZIP tem ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB e excedeu o limite do Discord. Use a opção \`enviar_drive: Verdadeiro\`.`);
        }

        await logRpresumo(this.client, interaction, {
            canalNome: 'SERVIDOR COMPLETO (TUDO)',
            totalMensagens: totalServerMessages,
            modo: targetUser ? `Log de TUDO (Filtro: @${targetUser.tag})` : 'Log de TUDO (Servidor Completo)',
            semResumo: true,
            formatoSaida: `ZIP (${formato.toUpperCase()})`,
            driveLink,
        });

        return interaction.editReply({
            content: replyLines.join('\n'),
            files: filesToSend,
        });

    } catch (err) {
        console.error('[RPRESUMO-TUDO] Erro geral:', err);
        await logRpresumo(this.client, interaction, {
            canalNome: 'SERVIDOR COMPLETO (TUDO)',
            totalMensagens: 0,
            modo: 'Erro no Log de Tudo',
            erro: err.message,
        });
        return interaction.editReply({ content: `❌ Ocorreu um erro ao processar o log completo do servidor: ${err.message}` }).catch(() => {});
    }
  }

  /**
   * Gera os buffers de TXT e PDF e monta os attachments conforme o formato escolhido.
   */
  async buildOutputFiles(textForFile, fileTextLines, summaryPages, targetChannel, formato, pdfMeta, targetUser = null) {
    const datAtu = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const nomCan = targetChannel.name.replace(/[^a-zA-Z0-9-_\u00C0-\u017E]/g, '_');
    const userSuffix = targetUser ? `-${targetUser.username.replace(/[^a-zA-Z0-9-_\u00C0-\u017E]/g, '_')}` : '';
    const resumoTexto = summaryPages ? summaryPages.join('\n\n') : null;

    const transcriptBuffer = Buffer.from(textForFile, 'utf-8');
    const summaryBuffer = summaryPages ? Buffer.from(resumoTexto, 'utf-8') : null;

    const txtTranscricao = new AttachmentBuilder(transcriptBuffer, { name: `mensagens-${nomCan}${userSuffix}-${datAtu}.txt` });
    const txtResumo = summaryBuffer ? new AttachmentBuilder(summaryBuffer, { name: `resumo-${nomCan}${userSuffix}-${datAtu}.txt` }) : null;

    if (formato === 'pdf' || formato === 'zip') {
        const pdfBuffer = await generatePdf({
            ...pdfMeta,
            fileTextLines,
            resumo: resumoTexto,
        });

        if (formato === 'pdf') {
            const pdfAttachment = new AttachmentBuilder(pdfBuffer, { name: `rp-${nomCan}${userSuffix}-${datAtu}.pdf` });
            return { attachments: [pdfAttachment], pdfBuffer, pdfFileName: `rp-${nomCan}${userSuffix}-${datAtu}.pdf` };
        }

        if (formato === 'zip') {
            const zip = new AdmZip();
            zip.addFile(`mensagens-${nomCan}${userSuffix}-${datAtu}.txt`, transcriptBuffer);
            if (summaryBuffer) zip.addFile(`resumo-${nomCan}${userSuffix}-${datAtu}.txt`, summaryBuffer);
            zip.addFile(`rp-${nomCan}${userSuffix}-${datAtu}.pdf`, pdfBuffer);
            const zipBuffer = zip.toBuffer();
            const zipAttachment = new AttachmentBuilder(zipBuffer, { name: `rp-${nomCan}${userSuffix}-${datAtu}.zip` });
            return { attachments: [zipAttachment], pdfBuffer, pdfFileName: `rp-${nomCan}${userSuffix}-${datAtu}.pdf` };
        }
    }

    // TXT (padrão)
    const files = [txtTranscricao];
    if (txtResumo) files.push(txtResumo);
    return { attachments: files, pdfBuffer: null, pdfFileName: null };
  }

  async execute(interaction) {
    const tudo = interaction.options.getBoolean('tudo') === true;
    const targetUser = interaction.options.getUser('usuario');
    const targetUserId = targetUser ? targetUser.id : null;
    const startId = interaction.options.getString('inicio');
    let endId = interaction.options.getString('fim');
    const targetChannel = interaction.options.getChannel('canal') || interaction.channel;
    // Por padrão NÃO gera resumo de IA para economizar tokens.
    // Só gera resumo se com_resumo for explicitamente true.
    const comResumo = interaction.options.getBoolean('com_resumo') === true;
    const semResumo = !comResumo; // alias interno para compatibilidade com a lógica abaixo
    const formato = interaction.options.getString('formato') || 'txt';
    const enviarDrive = interaction.options.getBoolean('enviar_drive') || false;

    await interaction.deferReply({ flags: 64 });

    if (tudo) {
        return this.executeTudo(interaction, { startId, endId, formato, enviarDrive, targetUser });
    }

    const ehCategoria = targetChannel.type === ChannelType.GuildCategory;

    // Identificar canais para processar
    let channelsToProcess = [];
    
    if (ehCategoria) {
        await interaction.guild.channels.fetch();
        const children = interaction.guild.channels.cache.filter(c => c.parentId === targetChannel.id);
        
        for (const child of children.values()) {
            if (child.isTextBased() && child.type !== ChannelType.GuildForum) {
                channelsToProcess.push(child);
            } else if (child.type === ChannelType.GuildForum) {
                try {
                    const active = await child.threads.fetchActive();
                    const archived = await child.threads.fetchArchived({ type: 'public', limit: 50 });
                    channelsToProcess.push(...active.threads.values(), ...archived.threads.values());
                } catch (e) { console.error(e); }
            }
        }
    } else if (targetChannel.type === ChannelType.GuildForum) {
        try {
            const active = await targetChannel.threads.fetchActive();
            const archived = await targetChannel.threads.fetchArchived({ type: 'public', limit: 50 });
            channelsToProcess.push(...active.threads.values(), ...archived.threads.values());
        } catch (e) { console.error(e); }
    } else if (targetChannel.isTextBased()) {
        channelsToProcess.push(targetChannel);
    } else {
        return interaction.editReply({ content: '❌ Tipo de canal inválido ou não suportado.' });
    }

    if (channelsToProcess.length === 0) {
        return interaction.editReply({ content: '❌ Nenhum canal de texto encontrado para processar.' });
    }

    try {
        if (startId && endId && BigInt(startId) > BigInt(endId)) {
            return interaction.editReply({ content: '❌ O ID da mensagem inicial deve ser menor (mais antigo) que o ID da mensagem final.' });
        }
        
        if ((startId && !/^\d+$/.test(startId)) || (endId && !/^\d+$/.test(endId))) {
             return interaction.editReply({ content: '❌ Os IDs fornecidos devem ser numéricos (Snowflakes).' });
        }

        let allMessages = [];
        let processedCount = 0;

        await interaction.editReply({ content: `⏳ Coletando mensagens de ${channelsToProcess.length} canais/tópicos...` });

        for (const ch of channelsToProcess) {
            const msgs = await this.fetchMessages(ch, startId, endId, targetUserId);
            allMessages.push(...msgs);
            processedCount++;
            
            if (processedCount % 5 === 0 || processedCount === channelsToProcess.length) {
                await interaction.editReply({ content: `⏳ Coletando mensagens... (${processedCount}/${channelsToProcess.length} canais processados | ${allMessages.length} mensagens coletadas${targetUser ? ` de ${targetUser.username}` : ''})` });
            }
        }

        allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        
        const channelIds = channelsToProcess.map(c => c.id);
        const channelLores = await this.client.database.Lore.find({ channelId: { $in: channelIds } });
        const loreMap = new Map(channelLores.map(l => [l.messageId, l]));

        let aiText = [];
        let fileText = [];

        // Metadados do cabeçalho
        let catName = 'N/A';
        let forumChanName = 'N/A';
        let postTitle = 'N/A';

        if (targetChannel.type === ChannelType.GuildCategory) {
            catName = targetChannel.name;
            forumChanName = 'Categoria Inteira';
            postTitle = 'Vários Tópicos';
        } else if (targetChannel.isThread()) {
            postTitle = targetChannel.name;
            if (targetChannel.parent) {
                forumChanName = targetChannel.parent.name;
                if (targetChannel.parent.parent) catName = targetChannel.parent.parent.name;
            }
        } else {
            forumChanName = targetChannel.name;
            if (targetChannel.parent) catName = targetChannel.parent.name;
        }

        const formatted = this.formatMessages(
            allMessages,
            loreMap,
            catName,
            forumChanName,
            postTitle,
            semResumo ? 'Texto Bruto (Sem Resumo)' : 'Resumo com IA',
            `${startId || 'Início'} a ${endId || 'Fim'}`,
            targetUser
        );
        fileText = formatted.fileText;
        aiText = formatted.aiText;

        const textToSummarize = aiText.join('\n');
        const textForFile = fileText.join('\n');

        if (allMessages.length === 0 || textToSummarize.length < 10) {
            return interaction.editReply({ 
                content: targetUser 
                    ? `❌ Nenhuma mensagem encontrada para o usuário <@${targetUser.id}> no canal/categoria selecionado.` 
                    : '❌ Texto insuficiente para resumir ou nenhuma mensagem encontrada.' 
            });
        }

        const pdfMeta = {
            titulo: targetUser
                ? `${postTitle !== 'N/A' ? postTitle : forumChanName} (${targetUser.username})`
                : (postTitle !== 'N/A' ? postTitle : forumChanName),
            categoria: catName,
            canal: forumChanName,
            postTitle,
            mensagensRange: `${startId || 'Início'} a ${endId || 'Fim'}`,
            modo: targetUser
                ? `${comResumo ? 'Resumo com IA' : 'Coleta'} (Filtro: @${targetUser.username})`
                : (comResumo ? 'Resumo com IA' : 'Coleta de Conteúdo (Sem IA)'),
        };

        // ── Modo padrão: sem resumo de IA (economiza tokens) ─────────────────
        // Entra aqui sempre que com_resumo não for explicitamente true,
        // ou quando for uma categoria inteira.
        if (ehCategoria || semResumo) {
            const msgContent = ehCategoria 
                ? '📝 Coletando conteúdo da categoria (sem IA). Gerando arquivo...' 
                : '📝 Coletando conteúdo sem resumo de IA. Gerando arquivo...';
            await interaction.editReply({ content: msgContent });

            const { attachments, pdfBuffer, pdfFileName } = await this.buildOutputFiles(
                textForFile, fileText, null, targetChannel, formato, pdfMeta, targetUser
            );

            let driveLink = null;
            if (enviarDrive && pdfBuffer) {
                try {
                    await interaction.editReply({ content: `${msgContent}\n📤 Enviando para o Drive...` });
                    const uploadResult = await uploadToDrive({
                        buffer: pdfBuffer,
                        fileName: pdfFileName,
                        mimeType: 'application/pdf',
                        skipIfExists: true,
                    });
                    driveLink = uploadResult.webViewLink;
                } catch (e) {
                    console.error('[RPRESUMO] Erro ao enviar para Drive:', e);
                }
            }

            const finalContent = [
                `✅ Arquivo gerado com sucesso!`,
                targetUser ? `👤 **Filtro de Usuário:** <@${targetUser.id}> (\`${targetUser.tag}\`)` : null,
                driveLink ? `📤 Drive: [Ver PDF](${driveLink})` : null,
            ].filter(Boolean).join('\n');

            await logRpresumo(this.client, interaction, {
                canalNome: targetChannel.name,
                totalMensagens: allMessages.length,
                modo: targetUser ? `Filtro @${targetUser.tag} (${ehCategoria ? 'Categoria' : 'Canal'})` : (ehCategoria ? 'Categoria (sem IA)' : 'Coleta sem IA'),
                semResumo: !comResumo,
                formatoSaida: formato.toUpperCase(),
                driveLink,
            });

            return interaction.editReply({ content: finalContent, files: attachments });
        }

        // ── Modo com resumo de IA ─────────────────────────────────────────────
        await interaction.editReply({ content: '🤖 Gerando resumo com IA... Isso pode levar alguns segundos.' });
        
        let summaryPages = await resumirRP(textToSummarize, { client: this.client, userId: interaction.user.id });
        
        let currentPage = 0;
        const generateEmbed = (page) => new EmbedBuilder()
            .setTitle(targetUser ? `📄 Resumo do RP — ${targetUser.username}` : '📄 Resumo do RP')
            .setColor('#00ff00')
            .setDescription(summaryPages[page] || "Resumo vazio.")
            .setFooter({ text: `Página ${page + 1}/${summaryPages.length} | Gerado por IA${targetUser ? ` | Filtro: @${targetUser.username}` : ''}` });

        const getButtons = (page) => {
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev_sum').setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId('next_sum').setLabel('▶').setStyle(ButtonStyle.Primary).setDisabled(page === summaryPages.length - 1),
                new ButtonBuilder().setCustomId('resumir_mais').setLabel('Resumir Mais').setStyle(ButtonStyle.Secondary).setEmoji('📉')
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('baixar_txt').setLabel('Baixar TXT').setStyle(ButtonStyle.Secondary).setEmoji('📄'),
                new ButtonBuilder().setCustomId('baixar_pdf').setLabel('Baixar PDF').setStyle(ButtonStyle.Secondary).setEmoji('📕'),
                new ButtonBuilder().setCustomId('baixar_zip').setLabel('Baixar ZIP').setStyle(ButtonStyle.Secondary).setEmoji('📦'),
                new ButtonBuilder().setCustomId('enviar_drive_btn').setLabel('Enviar ao Drive').setStyle(ButtonStyle.Success).setEmoji('☁️'),
            );
            return [row1, row2];
        };

        // Gera os anexos iniciais conforme formato escolhido
        await interaction.editReply({ content: '⚙️ Preparando arquivos...' });
        const { attachments: initialAttachments, pdfBuffer: initPdfBuffer, pdfFileName: initPdfFileName } = await this.buildOutputFiles(
            textForFile, fileText, summaryPages, targetChannel, formato, pdfMeta, targetUser
        );

        // Upload para Drive se solicitado via opção
        let driveLink = null;
        if (enviarDrive) {
            try {
                await interaction.editReply({ content: '📤 Enviando para o Drive...' });
                const pdfBuf = initPdfBuffer || await generatePdf({ ...pdfMeta, fileTextLines: fileText, resumo: summaryPages.join('\n\n') });
                const datAtu = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
                const nomCan = targetChannel.name.replace(/[^a-zA-Z0-9-_\u00C0-\u017E]/g, '_');
                const userSuffix = targetUser ? `-${targetUser.username.replace(/[^a-zA-Z0-9-_\u00C0-\u017E]/g, '_')}` : '';
                const uploadResult = await uploadToDrive({
                    buffer: pdfBuf,
                    fileName: initPdfFileName || `rp-${nomCan}${userSuffix}-${datAtu}.pdf`,
                    mimeType: 'application/pdf',
                    skipIfExists: true,
                });
                driveLink = uploadResult.webViewLink;
            } catch (e) {
                console.error('[RPRESUMO] Erro ao enviar para Drive:', e);
            }
        }

        await logRpresumo(this.client, interaction, {
            canalNome: targetChannel.name,
            totalMensagens: allMessages.length,
            modo: targetUser ? `Resumo com IA (Filtro: @${targetUser.tag})` : 'Resumo com IA',
            semResumo: false,
            formatoSaida: formato.toUpperCase(),
            driveLink,
        });

        const driveContent = driveLink ? `\n📤 Drive: [Ver PDF](${driveLink})` : null;
        const response = await interaction.editReply({ 
            content: driveContent, 
            embeds: [generateEmbed(currentPage)], 
            components: getButtons(currentPage),
            files: initialAttachments
        });

        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 300000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: 'Apenas quem solicitou pode interagir.', ephemeral: true });
            
            if (i.customId === 'prev_sum') { currentPage--; }
            if (i.customId === 'next_sum') { currentPage++; }
            
            if (i.customId === 'resumir_mais') {
                await i.update({ content: '🤖 Condensando o resumo...', components: [] });
                try {
                    const currentSummaryText = summaryPages.join('\n');
                    const newSummary = await summarizeSummary(currentSummaryText, { client: this.client, userId: interaction.user.id });
                    summaryPages = newSummary;
                    currentPage = 0;
                    
                    const { attachments: newFiles } = await this.buildOutputFiles(textForFile, fileText, summaryPages, targetChannel, formato, pdfMeta, targetUser);
                    await interaction.editReply({
                        content: driveContent,
                        embeds: [generateEmbed(currentPage)],
                        components: getButtons(currentPage),
                        files: newFiles
                    });
                    return;
                } catch (err) {
                    console.error(err);
                    await interaction.followUp({ content: '❌ Erro ao tentar resumir mais.', ephemeral: true });
                }
                return;
            }

            // Botões de download dinâmico
            if (['baixar_txt', 'baixar_pdf', 'baixar_zip'].includes(i.customId)) {
                await i.deferReply({ ephemeral: true });
                try {
                    const fmtMap = { baixar_txt: 'txt', baixar_pdf: 'pdf', baixar_zip: 'zip' };
                    const fmtEscolhido = fmtMap[i.customId];
                    const { attachments: dlFiles } = await this.buildOutputFiles(textForFile, fileText, summaryPages, targetChannel, fmtEscolhido, pdfMeta, targetUser);
                    await i.editReply({ content: `✅ Aqui estão seus arquivos em **${fmtEscolhido.toUpperCase()}**:`, files: dlFiles });
                } catch (err) {
                    console.error(err);
                    await i.editReply({ content: '❌ Erro ao gerar o arquivo.' });
                }
                return;
            }

            // Botão de envio ao Drive
            if (i.customId === 'enviar_drive_btn') {
                await i.deferReply({ ephemeral: true });
                try {
                    const pdfBuf = await generatePdf({ ...pdfMeta, fileTextLines: fileText, resumo: summaryPages.join('\n\n') });
                    const datAtu = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
                    const nomCan = targetChannel.name.replace(/[^a-zA-Z0-9-_\u00C0-\u017E]/g, '_');
                    const userSuffix = targetUser ? `-${targetUser.username.replace(/[^a-zA-Z0-9-_\u00C0-\u017E]/g, '_')}` : '';
                    const uploadResult = await uploadToDrive({
                        buffer: pdfBuf,
                        fileName: `rp-${nomCan}${userSuffix}-${datAtu}.pdf`,
                        mimeType: 'application/pdf',
                        skipIfExists: true,
                    });
                    const driveMsg = uploadResult.alreadyExisted
                        ? `⏭️ Arquivo já existia no Drive: [Clique para ver](${uploadResult.webViewLink})`
                        : `✅ PDF enviado ao Drive com sucesso! [Clique para ver](${uploadResult.webViewLink})`;
                    await i.editReply({ content: driveMsg });
                } catch (err) {
                    console.error(err);
                    await i.editReply({ content: '❌ Erro ao enviar para o Drive. Verifique as credenciais da Service Account.' });
                }
                return;
            }

            await i.update({ 
                embeds: [generateEmbed(currentPage)], 
                components: getButtons(currentPage) 
            });
        });

    } catch (err) {
        console.error(err);
        await logRpresumo(this.client, interaction, {
            canalNome: targetChannel.name,
            totalMensagens: 0,
            modo: 'Erro',
            erro: err.message,
        });

        if (err.code === 10062 || err.code === 40060) {
            try {
                await interaction.channel.send({ content: `<@${interaction.user.id}>, a sua solicitação demorou muito e a interação expirou. Ocorreu um erro durante o processamento.` });
            } catch (erroFal) {
                console.error("Falha ao enviar mensagem de fallback de erro no canal:", erroFal);
            }
        } else {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: '❌ Ocorreu um erro ao processar o resumo. Verifique os IDs, permissões e se o bot pode ver o histórico do canal.' }).catch(() => {});
            }
        }
    }
  }
};