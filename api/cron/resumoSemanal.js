const { ChannelType, EmbedBuilder } = require('discord.js');
const { generatePdf } = require('../pdfGenerator.js');
const { uploadToDrive, ensureBackupFolder } = require('../driveUploader.js');
const cronManager = require('./cronManager.js');

// ─── Configuração ─────────────────────────────────────────────────────────────

// Canal de log do cron (mesmo usado em commandLogger.js)
const LOG_CHANNEL_ID = '1423848686391394454';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildProgressBar(current, total, size = 15) {
    const pct = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
    const filled = Math.round(pct * size);
    const empty = size - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${Math.round(pct * 100)}% (${current}/${total})`;
}

/**
 * Coleta todas as mensagens de um canal de texto de forma paginada sem poluir o cache de RAM.
 */
async function fetchAllMessages(channel) {
    const messages = [];
    let cursor = null;

    while (true) {
        const options = { limit: 100, cache: false };
        if (cursor) options.before = cursor;

        try {
            const fetched = await channel.messages.fetch(options);
            if (fetched.size === 0) break;

            for (const msg of fetched.values()) {
                messages.push({
                    id: msg.id,
                    content: msg.content || '',
                    createdAt: msg.createdAt,
                    createdTimestamp: msg.createdTimestamp || 0,
                    authorUsername: msg.author?.username || 'Desconhecido',
                    channelName: channel.name || 'Desconhecido',
                });
            }
            cursor = fetched.last()?.id;
        } catch (e) {
            console.error(`[CRON-RESUMO] Erro ao buscar mensagens em ${channel.name}:`, e.message);
            break;
        }
    }

    return messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

/**
 * Processa um canal (ou thread) e retorna { fileTextLines } prontos para o PDF.
 */
async function processChannel(channel, client) {
    const msgs = await fetchAllMessages(channel);
    if (msgs.length === 0) return null;

    const channelIds = [channel.id];
    const channelLores = await client.database.Lore.find({ channelId: { $in: channelIds } }).lean().catch(() => []);
    const loreMap = new Map(channelLores.map(l => [l.messageId, l]));

    const fileText = [];

    // Cabeçalho do arquivo
    const catName = channel.parent?.parent?.name || channel.parent?.name || 'N/A';
    const forumChanName = channel.parent?.name || channel.name;
    const postTitle = channel.isThread() ? channel.name : 'N/A';
    const dataGeracao = new Date().toLocaleString('pt-BR');

    fileText.push(`======================================================================`);
    fileText.push(`                        ARQUIVO DE REGISTRO DE RP`);
    fileText.push(`======================================================================\n`);
    fileText.push(`- Categoria: ${catName}`);
    fileText.push(`- Fórum/Canal: ${forumChanName}`);
    fileText.push(`- Título da Postagem: ${postTitle}`);
    fileText.push(`- Intervalo de Mensagens: Início a Fim`);
    fileText.push(`- Data de Geração: ${dataGeracao}\n`);
    fileText.push(`======================================================================`);
    fileText.push(`                        CONTEÚDO`);
    fileText.push(`======================================================================\n`);

    for (const msg of msgs) {
        const lore = loreMap.get(msg.id);
        const time = msg.createdAt ? new Date(msg.createdAt).toLocaleString('pt-BR') : 'Data desconhecida';
        const channelName = msg.channelName || 'Desconhecido';

        if (lore) {
            fileText.push(`\n${'='.repeat(20)} [LORE: ${(lore.title || 'Sem Título').toUpperCase()}] ${'='.repeat(20)}`);
            fileText.push(`Canal: ${channelName} | Autor: ${msg.authorUsername} | Data: ${time}\n`);

            for (const chapter of (lore.chapters || [])) {
                fileText.push(`\n>> CAPÍTULO: ${chapter.name}`);
                fileText.push('-'.repeat(40));
                for (const page of (chapter.pages || [])) {
                    fileText.push(page.content);
                }
            }
            fileText.push(`\n${'='.repeat(20)} [FIM DA LORE] ${'='.repeat(20)}\n`);
        } else {
            if (msg.content && msg.content.trim().length > 0) {
                fileText.push(`[${time}] [${channelName}] ${msg.authorUsername}:`);
                fileText.push(`${msg.content}`);
                fileText.push('-'.repeat(60));
            }
        }
    }

    return {
        fileTextLines: fileText,
        catName,
        forumChanName,
        postTitle,
        channelName: channel.name,
    };
}

// ─── Função Principal do Cron ──────────────────────────────────────────────────

async function executarResumoSemanal(client, triggerInteraction = null) {
    console.log('[CRON-RESUMO] Iniciando resumo semanal de todas as categorias...');
    const startTime = Date.now();

    let logChannel = null;
    try {
        logChannel = client.channels.cache.get(LOG_CHANNEL_ID) || await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    } catch (e) {}

    const guild = await client.guilds.fetch('731974689798488185').catch(() => null);
    if (!guild) {
        console.error('[CRON-RESUMO] Guild não encontrada!');
        return 'Erro: Guild não encontrada.';
    }

    const allChannels = await guild.channels.fetch().catch(() => null);
    if (!allChannels) return 'Erro: Não foi possível listar canais da guild.';

    const datStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const subfolderName = `Resumo Semanal - ${datStr}`;

    let driveFolderInfo = {
        id: null,
        webViewLink: 'https://drive.google.com',
    };
    try {
        driveFolderInfo = await ensureBackupFolder(subfolderName);
    } catch (err) {
        console.warn('[CRON-RESUMO] Aviso ao preparar pasta do Drive:', err.message);
    }

    // Coleta todas as categorias do servidor
    const categorias = Array.from(allChannels.filter(c => c && c.type === ChannelType.GuildCategory).values());
    const totalCategorias = categorias.length;
    console.log(`[CRON-RESUMO] ${totalCategorias} categorias encontradas. Pasta: ${subfolderName}`);

    const resultados = [];
    const puladas = [];
    const erros = [];
    let progressMessage = null;
    let lastUpdateTs = 0;

    async function updateProgressPanel(currentCatIndex, statusText, force = false) {
        const now = Date.now();
        if (!force && now - lastUpdateTs < 3500) return;
        lastUpdateTs = now;

        const isFinished = currentCatIndex >= totalCategorias && force && statusText.startsWith('✅');
        const ramMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
        const elapsedSec = Math.floor((now - startTime) / 1000);
        const elapsedFormatted = `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;
        const unixNow = Math.floor(now / 1000);

        const embed = new EmbedBuilder()
            .setTitle(isFinished ? '📅 Resumo Semanal de RP — Concluído!' : '⏳ Resumo Semanal de RP — Em Andamento...')
            .setColor(isFinished ? (erros.length > 0 ? '#e67e22' : '#2ecc71') : '#3498db')
            .setTimestamp()
            .setDescription(
                `**Progresso Geral:** \`${buildProgressBar(currentCatIndex, totalCategorias)}\`\n` +
                `**Status Atual:** ${statusText}\n` +
                `**Último Pulso (Vivo):** <t:${unixNow}:R> • **Tempo:** \`${elapsedFormatted}\` • **RAM:** \`${ramMb} MB\`\n` +
                `**Resumo Parcial:** ✅ **${resultados.length}** salvas | ⏭️ **${puladas.length}** vazias | ❌ **${erros.length}** erro(s)\n\n` +
                `📁 **Pasta no Google Drive:** [Abrir "${subfolderName}"](${driveFolderInfo.webViewLink})`
            );

        if (resultados.length > 0) {
            const ultimosResultados = resultados
                .slice(-12)
                .map(r => `${r.jaExistia ? '⏭️' : '✅'} **${r.categoria}** — [${r.arquivo}](${r.link})`)
                .join('\n');
            embed.addFields({
                name: `📄 Categorias Sincronizadas (${resultados.length})`,
                value: ultimosResultados.substring(0, 1024),
            });
        }

        if (erros.length > 0) {
            const errStr = erros.slice(-5).map(e => `❌ **${e.categoria}**: ${e.erro}`).join('\n');
            embed.addFields({ name: `⚠️ Erros (${erros.length})`, value: errStr.substring(0, 1024) });
        }

        if (logChannel) {
            if (!progressMessage) {
                progressMessage = await logChannel.send({ embeds: [embed] }).catch(() => null);
            } else {
                await progressMessage.edit({ embeds: [embed] }).catch(() => {});
            }
        }

        if (triggerInteraction) {
            await triggerInteraction.editReply({ content: null, embeds: [embed] }).catch(() => {});
        }
    }

    await updateProgressPanel(0, 'Iniciando varredura das categorias...', true);

    for (let idx = 0; idx < totalCategorias; idx++) {
        const categoria = categorias[idx];
        try {
            await updateProgressPanel(idx, `🔄 **[${idx + 1}/${totalCategorias}]** Mapeando canais de **${categoria.name}**...`, true);

            // Coleta filhos: canais de texto e fóruns
            const filhos = allChannels.filter(c => c && c.parentId === categoria.id);
            const channelsToProcess = [];

            for (const [, filho] of filhos) {
                if (filho.isTextBased() && filho.type !== ChannelType.GuildForum) {
                    channelsToProcess.push(filho);
                } else if (filho.type === ChannelType.GuildForum) {
                    try {
                        const active = await filho.threads.fetchActive();
                        const archived = await filho.threads.fetchArchived({ type: 'public', limit: 50 });
                        channelsToProcess.push(...active.threads.values(), ...archived.threads.values());
                    } catch (e) {
                        console.error(`[CRON-RESUMO] Erro ao buscar threads de ${filho.name}:`, e.message);
                    }
                }
            }

            if (channelsToProcess.length === 0) {
                puladas.push(categoria.name);
                continue;
            }

            // Processa todos os canais da categoria
            const allFileLines = [];

            for (let cIdx = 0; cIdx < channelsToProcess.length; cIdx++) {
                const ch = channelsToProcess[cIdx];
                try {
                    await updateProgressPanel(
                        idx,
                        `🔄 **[${idx + 1}/${totalCategorias}] ${categoria.name}** — Lendo canal ${cIdx + 1}/${channelsToProcess.length} (\`#${ch.name}\`)...`,
                        false
                    );
                    const result = await processChannel(ch, client);
                    if (!result) continue;
                    for (const line of result.fileTextLines) {
                        allFileLines.push(line);
                    }
                } catch (e) {
                    console.error(`[CRON-RESUMO] Erro ao processar canal ${ch.name}:`, e.message);
                }
            }

            if (allFileLines.length === 0) {
                puladas.push(categoria.name);
                continue;
            }

            const nomCat = categoria.name.replace(/[^a-zA-Z0-9-_\u00C0-\u017E ]/g, '_').trim();
            const pdfFileName = `RP-${nomCat}-${datStr}.pdf`;

            let uploadResult;
            let finalFileName = pdfFileName;

            await updateProgressPanel(
                idx,
                `📄 **[${idx + 1}/${totalCategorias}] ${categoria.name}** — Gerando PDF e enviando para a pasta do Drive...`,
                true
            );

            try {
                const pdfBuffer = await generatePdf({
                    titulo: `RP — ${categoria.name}`,
                    categoria: categoria.name,
                    canal: 'Categoria Inteira',
                    postTitle: 'Vários Tópicos',
                    mensagensRange: 'Início a Fim',
                    modo: 'Coleta Automática Semanal (Sem IA)',
                    fileTextLines: allFileLines,
                    resumo: null,
                });

                uploadResult = await uploadToDrive({
                    buffer: pdfBuffer,
                    fileName: pdfFileName,
                    mimeType: 'application/pdf',
                    skipIfExists: true,
                    subfolderName,
                });
            } catch (pdfErr) {
                console.warn(`[CRON-RESUMO] Falha ao gerar/enviar PDF para ${categoria.name}. Usando fallback em TXT:`, pdfErr.message);
                finalFileName = `RP-${nomCat}-${datStr}.txt`;
                const txtBuffer = Buffer.from(allFileLines.join('\n'), 'utf-8');
                uploadResult = await uploadToDrive({
                    buffer: txtBuffer,
                    fileName: finalFileName,
                    mimeType: 'text/plain',
                    skipIfExists: true,
                    subfolderName,
                });
            }

            if (uploadResult?.folderLink) {
                driveFolderInfo.webViewLink = uploadResult.folderLink;
            }

            resultados.push({
                categoria: categoria.name,
                arquivo: finalFileName,
                link: uploadResult.webViewLink,
                jaExistia: uploadResult.alreadyExisted,
            });

            console.log(`[CRON-RESUMO] ✅ [${idx + 1}/${totalCategorias}] ${categoria.name} → ${uploadResult.alreadyExisted ? 'Já existia' : 'Enviado'}: ${finalFileName}`);
        } catch (e) {
            console.error(`[CRON-RESUMO] ❌ Erro na categoria ${categoria.name}:`, e.message);
            erros.push({ categoria: categoria.name, erro: e.message });
        }
    }

    await updateProgressPanel(
        totalCategorias,
        `✅ **Concluído!** ${resultados.length} categoria(s) sincronizada(s) na pasta **${subfolderName}**.`,
        true
    );

    console.log(`[CRON-RESUMO] ✅ Concluído! ${resultados.length} categorias processadas, ${puladas.length} vazias, ${erros.length} erros.`);
    return `${resultados.length} categorias salvas na pasta "${subfolderName}" (${erros.length} erros).`;
}

// ─── Registro no CronManager ──────────────────────────────────────────────────

module.exports = (client) => {
    cronManager.registerJob({
        id: 'resumo-semanal-rp',
        name: '📜 Resumo Semanal de RP',
        schedule: '0 3 * * 0',
        description: 'Coleta o roleplay de todas as categorias do servidor, gera PDFs pesquisáveis e faz upload automático em pasta organizada no Google Drive.',
        taskFn: async (interaction = null) => {
            return await executarResumoSemanal(client, interaction);
        }
    });
    console.log('[CRON-RESUMO] Job semanal registrado (todo domingo às 03:00).');
};

module.exports.executarResumoSemanal = executarResumoSemanal;
