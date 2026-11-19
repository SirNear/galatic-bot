const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { generatePdf, splitLinesForNotebookLM } = require('../pdfGenerator.js');
const { uploadToDrive, ensureBackupFolder } = require('../driveUploader.js');
const cronManager = require('./cronManager.js');

// ─── Configurações Gerais ──────────────────────────────────────────────────────

const LOG_CHANNEL_ID = '1423848686391394454';
const ITEMS_PER_PAGE = 6;
const DEFAULT_CONCURRENCY = process.env.CRON_CONCURRENCY ? parseInt(process.env.CRON_CONCURRENCY, 10) : 2;

// ─── Monitoramento e Limite Seguro de Memória ──────────────────────────────────

/**
 * Obtém os limites dinâmicos de RAM de acordo com o ambiente (Discloud vs Local Dev).
 */
function getMemoryThresholds() {
    let configuredRam = 100;
    try {
        const configPath = path.join(process.cwd(), 'discloud.config');
        if (fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const match = configContent.match(/^RAM\s*=\s*(\d+)/m);
            if (match) configuredRam = parseInt(match[1], 10);
        }
    } catch (_) {}

    if (process.env.RAM_LIMIT_MB) {
        configuredRam = parseInt(process.env.RAM_LIMIT_MB, 10);
    }

    if (process.env.CRON_RAM_MAX_MB) {
        const customCeiling = parseFloat(process.env.CRON_RAM_MAX_MB);
        return {
            configuredRam,
            ceilingMb: customCeiling,
            recoveryMb: Math.floor(customCeiling * 0.72),
        };
    }

    const isWindows = process.platform === 'win32';
    // No Windows (ambiente dev/teste local do usuário), permitimos um teto de 320 MB para não pausar falsamente.
    // No Linux (Discloud), o teto seguro é 80% da RAM máxima contratada (ex: 80 MB em container de 100 MB).
    const ceilingMb = isWindows ? Math.max(configuredRam, 320) : Math.floor(configuredRam * 0.80);
    const recoveryMb = Math.floor(ceilingMb * 0.72);

    return { configuredRam, ceilingMb, recoveryMb };
}

// ─── Estado Global em Tempo Real ──────────────────────────────────────────────

const activeRunState = {
    isRunning: false,
    workers: new Map(), // categoryId -> workerState
    resultados: [],
    puladas: [],
    chatsPulados: [],
    erros: [],
    currentPage: 0,
    autoFollowLastPage: true,
    lastActionFeedback: null,
    refreshPanelFn: null,
};

// ─── Helpers de Interface e Layout ─────────────────────────────────────────────

function buildProgressBar(current, total, size = 15) {
    const pct = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
    const filled = Math.round(pct * size);
    const empty = size - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${Math.round(pct * 100)}% (${current}/${total})`;
}

function buildPanelComponents(isFinished, activeWorkers, currentPage, totalPages) {
    const rows = [];

    if (!isFinished && activeWorkers && activeWorkers.length > 0) {
        const row1 = new ActionRowBuilder();

        // Botão para pular o chat do worker ativo
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId('cron_resumo_action_skip_channel')
                .setLabel('Pular Chat Atual')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('cron_resumo_action_partial_channel')
                .setLabel('Cortar & Salvar Chat')
                .setEmoji('💾')
                .setStyle(ButtonStyle.Primary)
        );

        // Botões dedicados para pular cada categoria em execução simultânea (até 3 botões)
        const visibleWorkers = activeWorkers.slice(0, 3);
        for (const w of visibleWorkers) {
            const cleanName = (w.name || 'Cat')
                .replace(/[^a-zA-Z0-9-_\u00C0-\u017E ]/g, '')
                .trim()
                .substring(0, 16) || 'Categoria';
            row1.addComponents(
                new ButtonBuilder()
                    .setCustomId(`cron_resumo_action_skipcat_${w.id}`)
                    .setLabel(`Pular ${cleanName}`)
                    .setEmoji('⏩')
                    .setStyle(ButtonStyle.Danger)
            );
        }

        rows.push(row1);
    }

    // Linha de navegação e paginação
    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('cron_resumo_action_page_prev')
            .setLabel('Anterior')
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage <= 0),
        new ButtonBuilder()
            .setCustomId('cron_resumo_action_page_info')
            .setLabel(`Pág. ${currentPage + 1}/${Math.max(1, totalPages)}`)
            .setEmoji('📄')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('cron_resumo_action_page_next')
            .setLabel('Próxima')
            .setEmoji('➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId('cron_resumo_action_refresh')
            .setLabel('Atualizar')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Success)
    );

    rows.push(navRow);
    return rows;
}

// ─── Interações de Controle (Botões) ──────────────────────────────────────────

async function handleResumoControlInteraction(interaction) {
    const customId = interaction.customId;
    const action = customId.replace('cron_resumo_action_', '');

    // Paginação e refresh funcionam tanto durante quanto após a execução
    if (action === 'page_prev' || action === 'page_next' || action === 'refresh') {
        const totalPages = Math.max(1, Math.ceil(activeRunState.resultados.length / ITEMS_PER_PAGE));

        if (action === 'page_prev') {
            activeRunState.currentPage = Math.max(0, activeRunState.currentPage - 1);
            activeRunState.autoFollowLastPage = false;
        } else if (action === 'page_next') {
            activeRunState.currentPage = Math.min(totalPages - 1, activeRunState.currentPage + 1);
            activeRunState.autoFollowLastPage = (activeRunState.currentPage === totalPages - 1);
        }

        await interaction.deferUpdate().catch(() => {});
        if (typeof activeRunState.refreshPanelFn === 'function') {
            await activeRunState.refreshPanelFn(true);
        }
        return;
    }

    if (!activeRunState.isRunning) {
        return interaction.reply({
            content: 'ℹ️ Nenhum resumo semanal está em execução neste momento.',
            flags: 64,
        });
    }

    // Pular categoria específica por ID
    if (action.startsWith('skipcat_')) {
        const catId = action.replace('skipcat_', '');
        const targetWorker = activeRunState.workers.get(catId);
        if (targetWorker) {
            targetWorker.skipCategory = true;
            targetWorker.status = 'skipped';
            activeRunState.lastActionFeedback = `⏩ Categoria **${targetWorker.name}** pulada por ${interaction.user.username}.`;
            if (typeof activeRunState.refreshPanelFn === 'function') {
                activeRunState.refreshPanelFn(true).catch(() => {});
            }
            return interaction.reply({
                content: `⏩ Pulando imediatamente a categoria **${targetWorker.name}**...`,
                flags: 64,
            });
        }
        return interaction.reply({ content: '⚠️ Categoria já concluída ou não encontrada.', flags: 64 });
    }

    // Pular chat atual (do worker com maior volume ou mais ativo)
    if (action === 'skip_channel') {
        const running = Array.from(activeRunState.workers.values())
            .filter(w => w.status === 'running' || w.status === 'paused_ram');

        running.sort((a, b) => (b.currentChannelMsgs || 0) - (a.currentChannelMsgs || 0));
        const targetWorker = running[0];

        if (targetWorker) {
            targetWorker.skipCurrentChannel = true;
            activeRunState.lastActionFeedback = `⏭️ Chat **#${targetWorker.currentChannelName}** (${targetWorker.name}) pulado por ${interaction.user.username}.`;
            if (typeof activeRunState.refreshPanelFn === 'function') {
                activeRunState.refreshPanelFn(true).catch(() => {});
            }
            return interaction.reply({
                content: `⏭️ Pulando chat **#${targetWorker.currentChannelName}** na categoria **${targetWorker.name}**...`,
                flags: 64,
            });
        }
        return interaction.reply({ content: '⚠️ Nenhum chat ativo para pular neste instante.', flags: 64 });
    }

    // Cortar e salvar chat atual parcialmente
    if (action === 'partial_channel') {
        const running = Array.from(activeRunState.workers.values())
            .filter(w => w.status === 'running' || w.status === 'paused_ram');

        running.sort((a, b) => (b.currentChannelMsgs || 0) - (a.currentChannelMsgs || 0));
        const targetWorker = running[0];

        if (targetWorker) {
            targetWorker.savePartialChannel = true;
            activeRunState.lastActionFeedback = `💾 Chat **#${targetWorker.currentChannelName}** cortado e salvo (${targetWorker.currentChannelMsgs} msgs).`;
            if (typeof activeRunState.refreshPanelFn === 'function') {
                activeRunState.refreshPanelFn(true).catch(() => {});
            }
            return interaction.reply({
                content: `💾 Finalizando leitura de **#${targetWorker.currentChannelName}** e preservando as **${targetWorker.currentChannelMsgs}** mensagens coletadas...`,
                flags: 64,
            });
        }
        return interaction.reply({ content: '⚠️ Nenhum chat ativo para cortar neste instante.', flags: 64 });
    }
}

// ─── Proteção Ativa de Memória (Anti-Crash) ────────────────────────────────────

/**
 * Verifica o uso de RSS do processo. Se estiver se aproximando do teto de RAM,
 * pausa a categoria mais custosa (com maior quantidade de linhas e mensagens em buffer)
 * até que as outras categorias terminem e liberem memória.
 */
async function checkMemoryAndThrottle(worker) {
    if (!activeRunState.isRunning) return;

    const { ceilingMb, recoveryMb } = getMemoryThresholds();
    const currentRssMb = process.memoryUsage().rss / 1024 / 1024;

    if (currentRssMb >= ceilingMb) {
        const activeWorkers = Array.from(activeRunState.workers.values())
            .filter(w => w.status === 'running' || w.status === 'paused_ram');

        if (activeWorkers.length > 0) {
            // Ordena os workers pelo custo em memória acumulado
            activeWorkers.sort((a, b) => {
                const costA = (a.collectedLinesCount || 0) + (a.currentChannelMsgs || 0);
                const costB = (b.collectedLinesCount || 0) + (b.currentChannelMsgs || 0);
                return costB - costA;
            });

            const mostCostly = activeWorkers[0];

            // Se este worker for o mais custoso, pausa para proteger o container
            if (mostCostly.id === worker.id) {
                worker.status = 'paused_ram';
                worker.pauseReason = `RAM alta (${currentRssMb.toFixed(1)} MB / Teto ${ceilingMb} MB)`;
                console.warn(`[CRON-RESUMO] ⚠️ Proteção de RAM: pausando categoria mais custosa "${worker.name}" (${currentRssMb.toFixed(1)} MB / ${ceilingMb} MB).`);

                if (global.gc) {
                    try { global.gc(); } catch (_) {}
                }

                if (typeof activeRunState.refreshPanelFn === 'function') {
                    activeRunState.refreshPanelFn(false).catch(() => {});
                }

                while (activeRunState.isRunning && worker.status === 'paused_ram' && !worker.skipCategory) {
                    await new Promise(r => setTimeout(r, 2000));

                    if (global.gc) {
                        try { global.gc(); } catch (_) {}
                    }

                    const checkRssMb = process.memoryUsage().rss / 1024 / 1024;
                    const runningOthers = Array.from(activeRunState.workers.values())
                        .filter(w => w.id !== worker.id && (w.status === 'running' || w.status === 'generating' || w.status === 'uploading'));

                    // Retoma quando a memória cair para a faixa segura OU se não houver outros workers ativos
                    if (checkRssMb <= recoveryMb || runningOthers.length === 0) {
                        worker.status = 'running';
                        worker.pauseReason = null;
                        console.log(`[CRON-RESUMO] 🟢 Retomando categoria "${worker.name}" (RAM recuperada: ${checkRssMb.toFixed(1)} MB).`);
                        if (typeof activeRunState.refreshPanelFn === 'function') {
                            activeRunState.refreshPanelFn(false).catch(() => {});
                        }
                        break;
                    }
                }
            }
        }
    }
}

// ─── Coleta e Processamento de Mensagens ───────────────────────────────────────

/**
 * Coleta todas as mensagens de um canal, com limpeza contínua de cache do Discord.js
 * para garantir que o consumo de memória permaneça estável.
 */
async function fetchAllMessages(channel, worker = null, onPageProgress = null) {
    const messages = [];
    let cursor = null;
    let truncatedManually = false;

    if (worker) {
        worker.currentChannelMsgs = 0;
    }

    while (true) {
        if (!activeRunState.isRunning || worker?.skipCategory || worker?.skipCurrentChannel) {
            try { channel.messages.cache.clear(); } catch (_) {}
            return { messages: [], skipped: true, truncatedManually: false };
        }

        if (worker?.savePartialChannel) {
            worker.savePartialChannel = false;
            truncatedManually = true;
            break;
        }

        // Verifica a segurança da memória antes de cada requisição ao Discord
        if (worker) {
            await checkMemoryAndThrottle(worker);
        }

        const options = { limit: 100, cache: false };
        if (cursor) options.before = cursor;

        try {
            const fetched = await channel.messages.fetch(options);
            if (!fetched || fetched.size === 0) break;

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

            // Limpa o cache interno do discord.js imediatamente para evitar que milhares de instâncias fiquem presas em RAM
            try { channel.messages.cache.clear(); } catch (_) {}

            if (worker) {
                worker.currentChannelMsgs = messages.length;
            }
            cursor = fetched.last()?.id;

            if (onPageProgress && messages.length % 350 === 0) {
                await onPageProgress(messages.length);
            }
        } catch (e) {
            console.error(`[CRON-RESUMO] Erro ao buscar mensagens em #${channel.name}:`, e.message);
            break;
        }
    }

    try { channel.messages.cache.clear(); } catch (_) {}

    return {
        messages: messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp),
        skipped: false,
        truncatedManually,
    };
}

/**
 * Processa um canal ou thread específico e monta o conteúdo textual do RP.
 */
async function processChannel(channel, client, worker = null, onPageProgress = null) {
    const { messages: msgs, skipped, truncatedManually } = await fetchAllMessages(channel, worker, onPageProgress);
    if (skipped) return { skipped: true };
    if (!msgs || msgs.length === 0) return null;

    const channelIds = [channel.id];
    const channelLores = await client.database.Lore.find({ channelId: { $in: channelIds } }).lean().catch(() => []);
    const loreMap = new Map(channelLores.map(l => [l.messageId, l]));

    const fileText = [];
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
    fileText.push(`- Total de Mensagens Coletadas: ${msgs.length}`);
    if (truncatedManually) {
        fileText.push(`- Nota de Volume: Leitura cortada manualmente via botão — salvas as ${msgs.length} mensagens lidas.`);
    } else {
        fileText.push(`- Intervalo de Mensagens: Início a Fim (Completo)`);
    }
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
        skipped: false,
    };
}

// ─── Processamento Individual de uma Categoria ─────────────────────────────────

async function processCategoryWorker(categoria, client, allChannels, catIndex, totalCategorias, subfolderName, updateProgressPanel) {
    const worker = {
        id: categoria.id,
        name: categoria.name,
        catIndex,
        totalCats: totalCategorias,
        currentChannelName: 'Mapeando canais...',
        currentChannelMsgs: 0,
        totalChannels: 0,
        processedChannels: 0,
        collectedLinesCount: 0,
        status: 'running',
        pauseReason: null,
        skipCategory: false,
        skipCurrentChannel: false,
        savePartialChannel: false,
        startTime: Date.now(),
    };

    activeRunState.workers.set(categoria.id, worker);

    try {
        await updateProgressPanel();

        // Mapeia os canais filhos (canais de texto e tópicos de fóruns)
        const filhos = allChannels.filter(c => c && c.parentId === categoria.id);
        const channelsToProcess = [];

        for (const [, filho] of filhos) {
            if (worker.skipCategory || !activeRunState.isRunning) break;
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

        worker.totalChannels = channelsToProcess.length;

        if (worker.skipCategory || !activeRunState.isRunning) {
            activeRunState.puladas.push(`${categoria.name} (pulada)`);
            return;
        }

        if (channelsToProcess.length === 0) {
            activeRunState.puladas.push(categoria.name);
            return;
        }

        const allFileLines = [];

        for (let cIdx = 0; cIdx < channelsToProcess.length; cIdx++) {
            if (worker.skipCategory || !activeRunState.isRunning) break;

            const ch = channelsToProcess[cIdx];
            worker.currentChannelName = ch.name;
            worker.processedChannels = cIdx + 1;
            worker.currentChannelMsgs = 0;
            worker.skipCurrentChannel = false;
            worker.savePartialChannel = false;

            try {
                await updateProgressPanel();

                const result = await processChannel(ch, client, worker, async () => {
                    await updateProgressPanel();
                });

                if (worker.skipCurrentChannel || result?.skipped) {
                    worker.skipCurrentChannel = false;
                    activeRunState.chatsPulados.push(`#${ch.name}`);
                    continue;
                }

                if (!result) continue; // Pula automaticamente apenas chats vazios

                for (const line of result.fileTextLines) {
                    allFileLines.push(line);
                }
                worker.collectedLinesCount = allFileLines.length;
            } catch (e) {
                console.error(`[CRON-RESUMO] Erro ao processar #${ch.name}:`, e.message);
            }
        }

        if (worker.skipCategory || !activeRunState.isRunning) {
            activeRunState.puladas.push(`${categoria.name} (pulada)`);
            return;
        }

        if (allFileLines.length === 0) {
            activeRunState.puladas.push(categoria.name);
            return;
        }

        const datStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        const nomCat = categoria.name.replace(/[^a-zA-Z0-9-_\u00C0-\u017E ]/g, '_').trim();

        // Divide automaticamente em volumes saudáveis para NotebookLM (~400k caracteres por arquivo)
        const notebookParts = splitLinesForNotebookLM(allFileLines, `Categoria: ${categoria.name}`);
        const totalParts = notebookParts.length;

        // Limpa o array principal de linhas para desocupar memória antes de gerar o PDF
        allFileLines.length = 0;

        for (let pIdx = 0; pIdx < totalParts; pIdx++) {
            if (!activeRunState.isRunning) break;

            const partLines = notebookParts[pIdx];
            const partSuffix = totalParts > 1 ? `_Parte-${pIdx + 1}-de-${totalParts}` : '';
            const partTitleSuffix = totalParts > 1 ? ` (Parte ${pIdx + 1} de ${totalParts})` : '';
            const pdfFileName = `RP-${nomCat}-${datStr}${partSuffix}.pdf`;

            worker.status = 'generating';
            worker.currentChannelName = totalParts > 1 ? `Gerando PDF (Parte ${pIdx + 1}/${totalParts})...` : 'Gerando PDF...';
            await updateProgressPanel();

            let uploadResult;
            let finalFileName = pdfFileName;

            try {
                const pdfBuffer = await generatePdf({
                    titulo: `RP — ${categoria.name}${partTitleSuffix}`,
                    categoria: categoria.name,
                    canal: totalParts > 1 ? `Categoria Inteira (Volume ${pIdx + 1}/${totalParts})` : 'Categoria Inteira',
                    postTitle: 'Vários Tópicos',
                    mensagensRange: 'Início a Fim (Completo)',
                    modo: 'Coleta Automática Semanal (Otimizado para NotebookLM)',
                    fileTextLines: partLines,
                    resumo: null,
                });

                worker.status = 'uploading';
                worker.currentChannelName = `Enviando ao Drive (${finalFileName})...`;
                await updateProgressPanel();

                uploadResult = await uploadToDrive({
                    buffer: pdfBuffer,
                    fileName: pdfFileName,
                    mimeType: 'application/pdf',
                    skipIfExists: true,
                    subfolderName,
                });
            } catch (pdfErr) {
                console.warn(`[CRON-RESUMO] Falha no PDF de ${categoria.name}${partTitleSuffix}. Usando fallback TXT:`, pdfErr.message);
                finalFileName = `RP-${nomCat}-${datStr}${partSuffix}.txt`;
                const txtBuffer = Buffer.from(partLines.join('\n'), 'utf-8');

                worker.status = 'uploading';
                worker.currentChannelName = `Enviando ao Drive (${finalFileName})...`;
                await updateProgressPanel();

                uploadResult = await uploadToDrive({
                    buffer: txtBuffer,
                    fileName: finalFileName,
                    mimeType: 'text/plain',
                    skipIfExists: true,
                    subfolderName,
                });
            }

            activeRunState.resultados.push({
                categoria: totalParts > 1 ? `${categoria.name} [${pIdx + 1}/${totalParts}]` : categoria.name,
                arquivo: finalFileName,
                link: uploadResult?.webViewLink || 'https://drive.google.com',
                jaExistia: uploadResult?.alreadyExisted || false,
            });

            console.log(`[CRON-RESUMO] ✅ [${catIndex}/${totalCategorias}] ${categoria.name}${partTitleSuffix} → ${uploadResult?.alreadyExisted ? 'Já existia' : 'Enviado'}: ${finalFileName}`);
        }
    } catch (catErr) {
        console.error(`[CRON-RESUMO] ❌ Erro na categoria ${categoria.name}:`, catErr.message);
        activeRunState.erros.push({ categoria: categoria.name, erro: catErr.message });
    } finally {
        worker.status = 'done';
        activeRunState.workers.delete(categoria.id);
        if (global.gc) {
            try { global.gc(); } catch (_) {}
        }
    }
}

// ─── Função Principal do Resumo Semanal (Multi-Thread / Worker Pool) ───────────

async function executarResumoSemanal(client, triggerInteraction = null) {
    console.log('[CRON-RESUMO] Iniciando resumo semanal de todas as categorias (Multi-Thread com Proteção de RAM)...');
    const startTime = Date.now();

    activeRunState.isRunning = true;
    activeRunState.workers.clear();
    activeRunState.resultados = [];
    activeRunState.puladas = [];
    activeRunState.chatsPulados = [];
    activeRunState.erros = [];
    activeRunState.currentPage = 0;
    activeRunState.autoFollowLastPage = true;
    activeRunState.lastActionFeedback = null;

    let logChannel = null;
    try {
        logChannel = client.channels.cache.get(LOG_CHANNEL_ID) || await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    } catch (_) {}

    const triggerChannel = (triggerInteraction?.channel && triggerInteraction.channel.id !== LOG_CHANNEL_ID)
        ? triggerInteraction.channel
        : null;

    const guild = await client.guilds.fetch('731974689798488185').catch(() => null);
    if (!guild) {
        activeRunState.isRunning = false;
        console.error('[CRON-RESUMO] Guild 731974689798488185 não encontrada!');
        return 'Erro: Guild não encontrada.';
    }

    const allChannels = await guild.channels.fetch().catch(() => null);
    if (!allChannels) {
        activeRunState.isRunning = false;
        return 'Erro: Não foi possível listar canais da guild.';
    }

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

    const categorias = Array.from(allChannels.filter(c => c && c.type === ChannelType.GuildCategory).values());
    const totalCategorias = categorias.length;
    console.log(`[CRON-RESUMO] ${totalCategorias} categorias encontradas. Concorrência: ${DEFAULT_CONCURRENCY}. Pasta: ${subfolderName}`);

    let progressMessage = null;
    let triggerChannelMessage = null;
    let interactionTokenExpired = false;
    let lastUpdateTs = 0;
    let isUpdatingPanel = false;
    let finishedCatsCount = 0;

    async function updateProgressPanel(force = false) {
        const now = Date.now();
        if (!force && now - lastUpdateTs < 3500) return;
        if (isUpdatingPanel && !force) return;

        isUpdatingPanel = true;
        lastUpdateTs = now;

        try {
            const isFinished = !activeRunState.isRunning || (finishedCatsCount >= totalCategorias);
            const ramMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
            const { ceilingMb } = getMemoryThresholds();
            const isWindows = process.platform === 'win32';
            const ramLabel = `${ramMb} MB / ${ceilingMb} MB${isWindows ? ' (Dev)' : ' (Discloud)'}`;

            const elapsedSec = Math.floor((now - startTime) / 1000);
            const elapsedFormatted = `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;
            const unixNow = Math.floor(now / 1000);

            const activeWorkersList = Array.from(activeRunState.workers.values())
                .filter(w => w.status === 'running' || w.status === 'paused_ram' || w.status === 'generating' || w.status === 'uploading');

            let workersDisplay = '';
            if (isFinished) {
                workersDisplay = `📂 **Categorias:** \`Todas as ${totalCategorias} categorias concluídas com sucesso\``;
            } else if (activeWorkersList.length === 0) {
                workersDisplay = `📂 **Categorias:** \`Aguardando próximo lote...\``;
            } else {
                const lines = activeWorkersList.map(w => {
                    const icon = w.status === 'paused_ram' ? '⏸️' : (w.status === 'generating' || w.status === 'uploading' ? '📤' : '▶️');
                    let detail = '';
                    if (w.status === 'paused_ram') {
                        detail = `*(⏸️ Pausada: ${w.pauseReason || 'Proteção de RAM'})*`;
                    } else if (w.status === 'generating') {
                        detail = `*(📄 Gerando PDF para NotebookLM...)*`;
                    } else if (w.status === 'uploading') {
                        detail = `*(☁️ Enviando ao Drive...)*`;
                    } else {
                        const countStr = w.totalChannels > 0 ? ` (${w.processedChannels}/${w.totalChannels})` : '';
                        const msgStr = w.currentChannelMsgs > 0 ? ` • ${w.currentChannelMsgs} msgs` : '';
                        detail = `\`#${w.currentChannelName}${countStr}\`${msgStr}`;
                    }
                    return `${icon} \`[${w.catIndex}/${w.totalCats}]\` **${w.name}**\n   ↳ ${detail}`;
                });
                workersDisplay = `📁 **Categorias em Paralelo (${activeWorkersList.length} simultâneas):**\n${lines.join('\n')}`;
            }

            const feedbackLine = activeRunState.lastActionFeedback
                ? `\n⚡ **Ação Manual:** ${activeRunState.lastActionFeedback}`
                : '';

            const totalPages = Math.max(1, Math.ceil(activeRunState.resultados.length / ITEMS_PER_PAGE));
            if (activeRunState.autoFollowLastPage) {
                activeRunState.currentPage = totalPages - 1;
            } else if (activeRunState.currentPage >= totalPages) {
                activeRunState.currentPage = totalPages - 1;
            }

            // Aviso caso a interação efêmera do Discord esteja próxima do limite de 15 minutos
            const tokenNotice = (triggerInteraction && elapsedSec >= 840)
                ? '\n⚠️ *Limite de 15m da resposta efêmera do Discord atingido. O progresso continua sendo atualizado na mensagem do canal de logs abaixo!*'
                : '';

            const embed = new EmbedBuilder()
                .setTitle(isFinished ? '📅 Resumo Semanal de RP — Concluído!' : '⏳ Resumo Semanal de RP — Multi-Thread Ativo...')
                .setColor(isFinished ? (activeRunState.erros.length > 0 ? '#e67e22' : '#2ecc71') : '#3498db')
                .setTimestamp()
                .setDescription(
                    `**Progresso Geral:** \`${buildProgressBar(finishedCatsCount, totalCategorias)}\`\n` +
                    `${workersDisplay}\n` +
                    `**Status:** ${isFinished ? '✅ Execução concluída.' : `🔄 Coleta em paralelo (${activeWorkersList.length} ativas, concorrência máx: ${DEFAULT_CONCURRENCY}).`}${feedbackLine}${tokenNotice}\n` +
                    `**Último Pulso (Vivo):** <t:${unixNow}:R> • **Tempo:** \`${elapsedFormatted}\` • **RAM:** \`${ramLabel}\`\n` +
                    `**Resumo Parcial:** ✅ **${activeRunState.resultados.length}** arq. salvos | ⏭️ **${activeRunState.puladas.length}** cat. vazias/puladas | 💬 **${activeRunState.chatsPulados.length}** chats pulados | ❌ **${activeRunState.erros.length}** erro(s)\n\n` +
                    `📁 **Pasta no Google Drive:** [Abrir "${subfolderName}"](${driveFolderInfo.webViewLink})`
                );

            if (activeRunState.resultados.length > 0) {
                const startIdx = activeRunState.currentPage * ITEMS_PER_PAGE;
                const pageItems = activeRunState.resultados.slice(startIdx, startIdx + ITEMS_PER_PAGE);
                const pageLines = pageItems
                    .map((r, i) => `\`${startIdx + i + 1}.\` ${r.jaExistia ? '⏭️' : '✅'} **${r.categoria}** — [${r.arquivo}](${r.link})`)
                    .join('\n');

                embed.addFields({
                    name: `📄 Arquivos Sincronizados para NotebookLM (${activeRunState.resultados.length} total • Pág. ${activeRunState.currentPage + 1}/${totalPages})`,
                    value: pageLines.substring(0, 1024) || 'Nenhum arquivo nesta página.',
                });
            }

            if (activeRunState.erros.length > 0) {
                const errStr = activeRunState.erros.slice(-5).map(e => `❌ **${e.categoria}**: ${e.erro}`).join('\n');
                embed.addFields({ name: `⚠️ Erros (${activeRunState.erros.length})`, value: errStr.substring(0, 1024) });
            }

            const components = buildPanelComponents(isFinished, activeWorkersList, activeRunState.currentPage, totalPages);

            if (logChannel) {
                if (!progressMessage) {
                    progressMessage = await logChannel.send({ embeds: [embed], components }).catch(() => null);
                } else {
                    await progressMessage.edit({ embeds: [embed], components }).catch(() => {});
                }
            }

            if (triggerChannel) {
                if (!triggerChannelMessage) {
                    triggerChannelMessage = await triggerChannel.send({ embeds: [embed], components }).catch(() => null);
                } else {
                    await triggerChannelMessage.edit({ embeds: [embed], components }).catch(() => {});
                }
            }

            if (triggerInteraction && !interactionTokenExpired) {
                await triggerInteraction.editReply({ content: null, embeds: [embed], components }).catch((err) => {
                    if (err?.code === 50027 || err?.status === 401) {
                        interactionTokenExpired = true;
                    }
                });
            }
        } finally {
            isUpdatingPanel = false;
        }
    }

    activeRunState.refreshPanelFn = async (force = true) => {
        await updateProgressPanel(force);
    };

    await updateProgressPanel(true);

    // Heartbeat automático a cada 6s para atualizar o timer e a memória em tempo real
    const heartbeatTimer = setInterval(() => {
        if (activeRunState.isRunning) {
            updateProgressPanel(false).catch(() => {});
        }
    }, 6000);

    try {
        let queueIndex = 0;

        // Worker concorrente da fila de categorias
        async function poolWorker(workerId) {
            while (queueIndex < totalCategorias && activeRunState.isRunning) {
                // Se a RAM estiver acima do teto de segurança e já houver outro worker em andamento, aguarda
                const { ceilingMb } = getMemoryThresholds();
                const currentRssMb = process.memoryUsage().rss / 1024 / 1024;
                if (currentRssMb >= ceilingMb && activeRunState.workers.size >= 1) {
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }

                const catIndex = queueIndex++;
                const categoria = categorias[catIndex];
                if (!categoria) break;

                console.log(`[CRON-RESUMO] [Worker-${workerId}] Iniciando [${catIndex + 1}/${totalCategorias}] "${categoria.name}"...`);
                await processCategoryWorker(
                    categoria,
                    client,
                    allChannels,
                    catIndex + 1,
                    totalCategorias,
                    subfolderName,
                    updateProgressPanel
                );

                finishedCatsCount++;
                await updateProgressPanel(false);
            }
        }

        // Inicia a execução simultânea dos workers
        const concurrency = Math.max(1, DEFAULT_CONCURRENCY);
        const poolPromises = [];
        for (let w = 0; w < concurrency; w++) {
            poolPromises.push(poolWorker(w + 1));
        }

        await Promise.all(poolPromises);
    } finally {
        clearInterval(heartbeatTimer);
        activeRunState.isRunning = false;
        activeRunState.workers.clear();
    }

    await updateProgressPanel(true);

    console.log(`[CRON-RESUMO] ✅ Concluído! ${activeRunState.resultados.length} arquivos salvos, ${activeRunState.puladas.length} vazias/puladas, ${activeRunState.erros.length} erros.`);
    return `${activeRunState.resultados.length} arquivo(s) salvo(s) na pasta "${subfolderName}" (${activeRunState.erros.length} erros).`;
}

// ─── Registro no CronManager ──────────────────────────────────────────────────

module.exports = (client) => {
    cronManager.registerJob({
        id: 'resumo-semanal-rp',
        name: '📜 Resumo Semanal de RP',
        schedule: '0 3 * * 0',
        description: 'Coleta o roleplay de várias categorias simultaneamente (Multi-Thread com proteção dinâmica de RAM), divide em volumes para NotebookLM, gera PDFs e envia ao Google Drive.',
        taskFn: async (interaction = null) => {
            return await executarResumoSemanal(client, interaction);
        }
    });
    console.log('[CRON-RESUMO] Job semanal registrado com Multi-Thread e Proteção de RAM (todo domingo às 03:00).');
};

module.exports.executarResumoSemanal = executarResumoSemanal;
module.exports.handleResumoControlInteraction = handleResumoControlInteraction;
