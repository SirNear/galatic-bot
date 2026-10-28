const { ChannelType } = require('discord.js');
const { resumirRP } = require('../resumir.js');
const { generatePdf } = require('../pdfGenerator.js');
const { uploadToDrive } = require('../driveUploader.js');
const cronManager = require('./cronManager.js');

// ─── Configuração ─────────────────────────────────────────────────────────────

// Canal de log do cron (mesmo usado em commandLogger.js)
const LOG_CHANNEL_ID = '1423848686391394454';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Coleta todas as mensagens de um canal de texto de forma paginada.
 */
async function fetchAllMessages(channel) {
    const messages = [];
    let cursor = null;

    while (true) {
        const options = { limit: 100 };
        if (cursor) options.before = cursor;

        try {
            const fetched = await channel.messages.fetch(options);
            if (fetched.size === 0) break;
            messages.push(...fetched.values());
            cursor = fetched.last()?.id;
        } catch (e) {
            console.error(`[CRON-RESUMO] Erro ao buscar mensagens em ${channel.name}:`, e.message);
            break;
        }
    }

    return messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

/**
 * Processa um canal (ou thread) e retorna { fileTextLines, aiText } prontos para o resumo/PDF.
 */
async function processChannel(channel, client) {
    const msgs = await fetchAllMessages(channel);
    if (msgs.length === 0) return null;

    const channelIds = [channel.id];
    const channelLores = await client.database.Lore.find({ channelId: { $in: channelIds } });
    const loreMap = new Map(channelLores.map(l => [l.messageId, l]));

    const aiText = [];
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
        const time = msg.createdAt ? msg.createdAt.toLocaleString('pt-BR') : 'Data desconhecida';
        const channelName = msg.channel.name || 'Desconhecido';

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

    return {
        fileTextLines: fileText,
        aiText: aiText.join('\n'),
        catName,
        forumChanName,
        postTitle,
        channelName: channel.name,
    };
}

// ─── Função Principal do Cron ──────────────────────────────────────────────────

async function executarResumoSemanal(client) {
    console.log('[CRON-RESUMO] Iniciando resumo semanal de todas as categorias...');

    let logChannel = null;
    try {
        logChannel = client.channels.cache.get(LOG_CHANNEL_ID) || await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    } catch (e) {}

    const guild = await client.guilds.fetch('731974689798488185').catch(() => null);
    if (!guild) {
        console.error('[CRON-RESUMO] Guild não encontrada!');
        return;
    }

    const allChannels = await guild.channels.fetch().catch(() => null);
    if (!allChannels) return;

    // Coleta todas as categorias do servidor
    const categorias = allChannels.filter(c => c && c.type === ChannelType.GuildCategory);
    console.log(`[CRON-RESUMO] ${categorias.size} categorias encontradas.`);

    const resultados = [];
    const erros = [];

    for (const [, categoria] of categorias) {
        try {
            // Coleta filhos: canais de texto e fóruns
            const filhos = allChannels.filter(c => c && c.parentId === categoria.id);
            let channelsToProcess = [];

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

            if (channelsToProcess.length === 0) continue;

            // Processa todos os canais da categoria
            const allFileLines = [];
            const allAiText = [];

            for (const ch of channelsToProcess) {
                try {
                    const result = await processChannel(ch, client);
                    if (!result) continue;
                    allFileLines.push(...result.fileTextLines);
                    if (result.aiText.length > 10) allAiText.push(result.aiText);
                } catch (e) {
                    console.error(`[CRON-RESUMO] Erro ao processar canal ${ch.name}:`, e.message);
                }
            }

            if (allFileLines.length === 0) continue;

            const datStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
            const nomCat = categoria.name.replace(/[^a-zA-Z0-9-_\u00C0-\u017E ]/g, '_');
            const pdfFileName = `RP-${nomCat}-${datStr}.pdf`;

            // Gera o PDF (sem resumo de IA — apenas coleta de conteúdo)
            const pdfBuffer = await generatePdf({
                titulo: `RP — ${categoria.name}`,
                categoria: categoria.name,
                canal: 'Categoria Inteira',
                postTitle: 'Vários Tópicos',
                mensagensRange: 'Início a Fim',
                modo: 'Coleta Automática Semanal (Sem IA)',
                fileTextLines: allFileLines,
                resumo: null, // Nunca gera resumo de IA automaticamente para economizar tokens
            });

            // Faz upload para o Drive (skipIfExists evita duplicatas)
            const uploadResult = await uploadToDrive({
                buffer: pdfBuffer,
                fileName: pdfFileName,
                mimeType: 'application/pdf',
                skipIfExists: true,
            });

            resultados.push({
                categoria: categoria.name,
                arquivo: pdfFileName,
                link: uploadResult.webViewLink,
                jaExistia: uploadResult.alreadyExisted,
            });

            console.log(`[CRON-RESUMO] ✅ ${categoria.name} → ${uploadResult.alreadyExisted ? 'Já existia' : 'Enviado'}: ${pdfFileName}`);

        } catch (e) {
            console.error(`[CRON-RESUMO] ❌ Erro na categoria ${categoria.name}:`, e);
            erros.push({ categoria: categoria.name, erro: e.message });
        }
    }

    // Log no canal do Discord
    if (logChannel && (resultados.length > 0 || erros.length > 0)) {
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle('📅 Resumo Semanal de RP — Concluído')
            .setColor(erros.length > 0 ? '#e67e22' : '#2ecc71')
            .setTimestamp()
            .setDescription(
                `**${resultados.length}** categoria(s) processada(s). **${erros.length}** erro(s).\n\n` +
                `📁 [Ver pasta do Drive](https://drive.google.com/drive/folders/1n5rkbn5TbTEK2X-NTTnWVQXjzq9vUssB)`
            );

        if (resultados.length > 0) {
            const resStr = resultados
                .slice(0, 15)
                .map(r => `${r.jaExistia ? '⏭️' : '✅'} **${r.categoria}** — [${r.arquivo}](${r.link})`)
                .join('\n');
            embed.addFields({ name: '📄 Arquivos no Drive', value: resStr.substring(0, 1024) });
        }

        if (erros.length > 0) {
            const errStr = erros.slice(0, 5).map(e => `❌ **${e.categoria}**: ${e.erro}`).join('\n');
            embed.addFields({ name: '⚠️ Erros', value: errStr.substring(0, 1024) });
        }

        await logChannel.send({ embeds: [embed] }).catch(console.error);
    }

    console.log(`[CRON-RESUMO] ✅ Concluído! ${resultados.length} categorias processadas, ${erros.length} erros.`);
}

// ─── Registro no CronManager ──────────────────────────────────────────────────

module.exports = (client) => {
    cronManager.registerJob(
        'resumo-semanal-rp',
        '📄 Resumo Semanal de RP',
        '0 3 * * 0', // Toda domingo às 03:00
        () => executarResumoSemanal(client)
    );
    console.log('[CRON-RESUMO] Job semanal registrado (toda domingo às 03:00).');
};

module.exports.executarResumoSemanal = executarResumoSemanal;
