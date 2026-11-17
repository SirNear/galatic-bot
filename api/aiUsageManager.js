const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder } = require('discord.js');
const { AiUsage } = require('../mongoose');
const moment = require('moment');
moment.locale('pt-br');



function generateProgressBar(current, max, length = 15) {
    const percentage = Math.min(Math.max((current / max) * 100, 0), 100);
    const filledChars = Math.round((percentage / 100) * length);
    const emptyChars = length - filledChars;

    const filled = '█'.repeat(filledChars);
    const empty = '░'.repeat(emptyChars);

    return {
        bar: `[${filled}${empty}]`,
        percentage: percentage.toFixed(2)
    };
}

async function registerUsage(usageMetadata, modelName = "desconhecido", actionName = "Desconhecida") {
    if (!usageMetadata) return;

    try {
        let usageDoc = await AiUsage.findById("global");
        if (!usageDoc) {
            usageDoc = new AiUsage({ _id: "global" });
        }

        const promptTokens = usageMetadata.promptTokenCount || 0;
        const completionTokens = usageMetadata.candidatesTokenCount || 0;
        const totalTokens = usageMetadata.totalTokenCount || (promptTokens + completionTokens);

        usageDoc.totalPromptTokens += promptTokens;
        usageDoc.totalCompletionTokens += completionTokens;
        usageDoc.totalTokens += totalTokens;
        usageDoc.requestsCount += 1;

        const todayDate = moment().format('YYYY-MM-DD');
        let daily = usageDoc.dailyUsage.get(todayDate) || {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            requests: 0
        };

        daily.promptTokens += promptTokens;
        daily.completionTokens += completionTokens;
        daily.totalTokens += totalTokens;
        daily.requests += 1;

        if (!daily.models) daily.models = new Map();
        
        const safeModelName = modelName.replace(/\./g, '_');
        let modelStats = daily.models.get(safeModelName) || { requests: 0, tokens: 0 };
        modelStats.requests += 1;
        modelStats.tokens += totalTokens;
        daily.models.set(safeModelName, modelStats);

        usageDoc.dailyUsage.set(todayDate, daily);

        const safeActionName = actionName.replace(/\./g, '_');
        if (!usageDoc.actions) usageDoc.actions = new Map();
        let actionStats = usageDoc.actions.get(safeActionName) || { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        
        actionStats.requests += 1;
        actionStats.promptTokens += promptTokens;
        actionStats.completionTokens += completionTokens;
        actionStats.totalTokens += totalTokens;
        usageDoc.actions.set(safeActionName, actionStats);

        usageDoc.lastUpdated = new Date();

        await usageDoc.save();
    } catch (err) {
        console.error("Erro ao registrar uso de IA:", err);
    }
}

async function ensurePanelExists(client) {
    try {
        console.log("[IA Monitor] Iniciando verificação do painel...");
        const channelId = "1510784621904793740";
        const channel = await client.channels.fetch(channelId).catch(err => {
            console.error("[IA Monitor] Erro ao buscar canal:", err);
            return null;
        });

        if (!channel) {
            console.log(`[IA Monitor] Canal ${channelId} não encontrado ou bot sem permissão.`);
            return;
        }

        let usageDoc = await AiUsage.findById("global");
        if (!usageDoc) usageDoc = new AiUsage({ _id: "global" });

        let message = null;
        if (usageDoc.panelMessageId) {
            message = await channel.messages.fetch(usageDoc.panelMessageId).catch(() => null);
        }

        if (!message) {
            console.log("[IA Monitor] Mensagem do painel de modelos não encontrada. Criando novo...");
            const embed = new EmbedBuilder().setTitle('⏳ Inicializando Monitor de IA (Modelos)...').setColor('#2b2d31');
            message = await channel.send({ embeds: [embed] });
            usageDoc.panelChannelId = channel.id;
            usageDoc.panelMessageId = message.id;
            await usageDoc.save();
        }

        let actionMessage = null;
        if (usageDoc.actionPanelMessageId) {
            actionMessage = await channel.messages.fetch(usageDoc.actionPanelMessageId).catch(() => null);
        }

        if (!actionMessage) {
            console.log("[IA Monitor] Mensagem do painel de comandos não encontrada. Criando novo...");
            const embedAction = new EmbedBuilder().setTitle('⏳ Inicializando Monitor de IA (Comandos)...').setColor('#2b2d31');
            actionMessage = await channel.send({ embeds: [embedAction] });
            usageDoc.actionPanelMessageId = actionMessage.id;
            await usageDoc.save();
        }

        await updatePanel(client);
    } catch (error) {
        console.error("[IA Monitor] Erro fatal no ensurePanelExists:", error);
    }
}

async function updatePanel(client) {
    try {
        const usageDoc = await AiUsage.findById("global");
        if (!usageDoc || !usageDoc.panelChannelId || !usageDoc.panelMessageId) return;

        const channel = await client.channels.fetch(usageDoc.panelChannelId).catch(() => null);
        if (!channel) return;

        const message = await channel.messages.fetch(usageDoc.panelMessageId).catch(() => null);
        if (!message) return;

        const todayDate = moment().format('YYYY-MM-DD');
        const daily = usageDoc.dailyUsage.get(todayDate) || { totalTokens: 0, requests: 0, promptTokens: 0, completionTokens: 0 };

        const modelLimits = {
            'gemini-3.5-flash-lite': 500,
            'gemini-3.1-flash-lite': 500,
            'gemini-flash-lite-latest': 500,
            'gemini-2.5-flash-lite': 500,
            'gemini-2.5-flash': 50,
            'gemini-3.5-flash': 50,
            'gemini-3.8-flash': 50,
            'gemini-flash-latest': 50,
            'gemini-2.5-pro': 20,
            'gemini-pro-latest': 20,
            'gemini-2.0-flash': 20,
            'gemini-pro': 20
        };

        let modelsDescription = "";
        let highestUsagePercentage = 0;

        if (daily.models && daily.models.size > 0) {
            for (let [modelKey, stats] of daily.models.entries()) {
                const displayModel = modelKey.replace(/_/g, '.');
                const limit = modelLimits[displayModel] || 20; // Padrão 20 RPD se desconhecido
                const prog = generateProgressBar(stats.requests, limit, 15);
                
                modelsDescription += `**${displayModel.toUpperCase()}**\n\`\`\`${prog.bar} ${stats.requests}/${limit} RPD\`\`\`\n`;
                
                if (parseFloat(prog.percentage) > highestUsagePercentage) {
                    highestUsagePercentage = parseFloat(prog.percentage);
                }
            }
        } else {
            modelsDescription = "*Nenhum uso registrado hoje.*";
        }

        let color = '#2b2d31'; // Default dark
        if (highestUsagePercentage > 90) color = '#ED4245'; // Red
        else if (highestUsagePercentage > 70) color = '#FEE75C'; // Yellow
        else color = '#57F287'; // Green

        const embed = new EmbedBuilder()
            .setTitle('🤖 Monitoramento de Inteligência Artificial')
            .setDescription(`Painel atualizado de consumo de cota Diária (RPD) por modelo.\n\n${modelsDescription}`)
            .setColor(color)
            .addFields(
                { name: '📊 Tokens Totais', value: `\`${usageDoc.totalTokens.toLocaleString('pt-BR')}\``, inline: true },
                { name: '💬 Total Requests', value: `\`${usageDoc.requestsCount.toLocaleString('pt-BR')}\``, inline: true },
                { name: '📈 Detalhamento Geral', value: `**Prompts:** \`${usageDoc.totalPromptTokens.toLocaleString('pt-BR')}\`\n**Respostas:** \`${usageDoc.totalCompletionTokens.toLocaleString('pt-BR')}\``, inline: false },
                { name: '📅 Uso de Hoje', value: `**Tokens:** \`${daily.totalTokens.toLocaleString('pt-BR')}\`\n**Requests:** \`${daily.requests.toLocaleString('pt-BR')}\``, inline: true },
                { name: '🔍 Tokens Hoje', value: `**Prompts:** \`${daily.promptTokens.toLocaleString('pt-BR')}\`\n**Respostas:** \`${daily.completionTokens.toLocaleString('pt-BR')}\``, inline: true }
            )
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: `Última atualização: ${moment().format('DD/MM/YYYY HH:mm:ss')}` })
            .setTimestamp();

        await message.edit({ embeds: [embed] });

        // Update Action Panel
        if (usageDoc.actionPanelMessageId) {
            const actionMessage = await channel.messages.fetch(usageDoc.actionPanelMessageId).catch(() => null);
            if (actionMessage) {
                let actionsDescription = "";
                if (usageDoc.actions && usageDoc.actions.size > 0) {
                    const sortedActions = Array.from(usageDoc.actions.entries()).sort((a, b) => b[1].totalTokens - a[1].totalTokens);
                    for (let [action, stats] of sortedActions) {
                        const displayAction = action.replace(/_/g, '.');
                        actionsDescription += `**${displayAction}**\n\`Requisições:\` ${stats.requests.toLocaleString('pt-BR')} | \`Tokens:\` ${stats.totalTokens.toLocaleString('pt-BR')}\n`;
                    }
                } else {
                    actionsDescription = "*Nenhum comando registrado ainda.*";
                }

                const actionEmbed = new EmbedBuilder()
                    .setTitle('🛠️ Monitoramento de IA por Comando')
                    .setDescription(`Consumo vitalício de Tokens e Requisições separado por Comando/Ação no bot.\n\n${actionsDescription}`)
                    .setColor('#5865F2')
                    .setFooter({ text: `Última atualização: ${moment().format('DD/MM/YYYY HH:mm:ss')} (Tempo Real)` })
                    .setTimestamp();
                
                await actionMessage.edit({ embeds: [actionEmbed] });
            }
        }
    } catch (err) {
        console.error("Erro ao atualizar o painel de IA:", err);
    }
}

/**
 * Gera o conteúdo estruturado do arquivo .txt do log de IA.
 */
function generateStructuredLogTxt({ userId, action, prompt, context, response, usage, attachments, modelName, createdAt, logId }) {
    const dataHora = moment(createdAt || new Date()).format('DD/MM/YYYY HH:mm:ss');
    const totalTokens = usage?.totalTokenCount || usage?.totalTokens || 0;
    const promptTokens = usage?.promptTokenCount || usage?.promptTokens || 0;
    const candidatesTokens = usage?.candidatesTokenCount || usage?.completionTokens || 0;

    let txt = `================================================================================\n`;
    txt += `       GALATIC BOT - RELATÓRIO DE INTERAÇÃO COM INTELIGÊNCIA ARTIFICIAL         \n`;
    txt += `================================================================================\n`;
    txt += `ID do Registro: ${logId || 'N/A'}\n`;
    txt += `Data / Hora:    ${dataHora}\n`;
    txt += `Ação Executada: ${action || 'Desconhecida'}\n`;
    txt += `Usuário Alvo:   ID ${userId || 'N/A'}\n`;
    txt += `Modelo Utilizado: ${modelName || 'Não especificado'}\n`;
    txt += `Consumo de Tokens:\n`;
    txt += `  • Total de Tokens:   ${totalTokens.toLocaleString()}\n`;
    txt += `  • Tokens de Prompt:  ${promptTokens.toLocaleString()}\n`;
    txt += `  • Tokens de Resposta: ${candidatesTokens.toLocaleString()}\n`;
    if (attachments && attachments.length > 0) {
        txt += `Anexos Informados: ${attachments.join(', ')}\n`;
    }
    txt += `\n`;

    txt += `================================================================================\n`;
    txt += `[1] CONTEXTO / LORE FORNECIDO À IA\n`;
    txt += `================================================================================\n`;
    txt += `${context ? context.trim() : 'Nenhum contexto ou lore adicional fornecido.'}\n\n`;

    txt += `================================================================================\n`;
    txt += `[2] PROMPT DE ENTRADA\n`;
    txt += `================================================================================\n`;
    txt += `${prompt ? prompt.trim() : 'Sem prompt textual fornecido.'}\n\n`;

    txt += `================================================================================\n`;
    txt += `[3] RESPOSTA GERADA PELA IA\n`;
    txt += `================================================================================\n`;
    txt += `${response ? response.trim() : 'Nenhuma resposta gerada.'}\n\n`;

    txt += `================================================================================\n`;
    txt += `                      FIM DO REGISTRO DE INTERAÇÃO                              \n`;
    txt += `================================================================================\n`;

    return txt;
}

async function sendLogIA(client, logData) {
    if (!client) return;
    try {
        const logChannelId = "1510784425275822120";
        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel) return;

        const { userId, action, prompt, context, response, usage, attachments, modelName } = logData;
        const now = new Date();

        // 1. Persiste o registro no MongoDB para permanência dos botões
        let logDoc = null;
        try {
            const { AiLog } = require('../mongoose.js');
            if (AiLog) {
                logDoc = await AiLog.create({
                    userId,
                    action: action || "Central de Upgrades",
                    modelName: modelName || "gemini",
                    prompt: prompt || "",
                    context: context || "",
                    response: response || "",
                    usage: usage || {},
                    attachments: attachments || [],
                    channelId: channel.id,
                    createdAt: now
                });
            }
        } catch (dbErr) {
            console.error("[IA Log] Erro ao salvar registro no MongoDB:", dbErr);
        }

        const logId = logDoc ? logDoc._id.toString() : Date.now().toString();

        // 2. Gera o arquivo .txt estruturado e limpo
        const fullTxt = generateStructuredLogTxt({
            userId,
            action,
            prompt,
            context,
            response,
            usage,
            attachments,
            modelName,
            createdAt: now,
            logId
        });

        const safeActionName = (action || 'log').toLowerCase().replace(/[^a-z0-9]/gi, '_');
        const attachment = new AttachmentBuilder(Buffer.from(fullTxt, 'utf-8'), {
            name: `log_ia_${safeActionName}_${logId}.txt`
        });

        // 3. Monta o Embed compacto de resumo
        const totalTokens = usage?.totalTokenCount || usage?.totalTokens || 0;
        const promptTokens = usage?.promptTokenCount || usage?.promptTokens || 0;
        const respTokens = usage?.candidatesTokenCount || usage?.completionTokens || 0;

        let sampleResponse = response ? response.replace(/```[a-z]*\n?/gi, '').trim() : 'Sem resposta';
        if (sampleResponse.length > 400) {
            sampleResponse = sampleResponse.substring(0, 397) + '...';
        }

        const summaryEmbed = new EmbedBuilder()
            .setTitle(`🤖 Log de IA: ${action}`)
            .setColor('#16a085')
            .setDescription(
                `**Usuário:** <@${userId}> (\`${userId}\`)\n` +
                `**Modelo:** \`${modelName || 'Gemini'}\`  •  **Data:** <t:${Math.floor(now.getTime() / 1000)}:f>\n` +
                `**Tokens:** \`${totalTokens.toLocaleString()}\` (Prompt: \`${promptTokens}\` | Resposta: \`${respTokens}\`)\n\n` +
                `📄 *O relatório completo foi gerado e anexado abaixo em formato **.TXT** pesquisável.*\n` +
                `Clique no botão abaixo para ler o conteúdo na íntegra diretamente no chat.`
            )
            .addFields({
                name: '📑 Resumo da Resposta',
                value: `\`\`\`text\n${sampleResponse}\n\`\`\``,
                inline: false
            })
            .setFooter({ text: `Galatic Bot • ID: ${logId}` })
            .setTimestamp(now);

        // 4. Botão Permanente "Ver Mais (Texto Completo)"
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`ai_log_view_${logId}_0`)
                .setLabel('Ver Mais (Texto Completo)')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📖')
        );

        const sentMsg = await channel.send({
            embeds: [summaryEmbed],
            files: [attachment],
            components: [row]
        });

        if (logDoc && sentMsg) {
            logDoc.messageId = sentMsg.id;
            await logDoc.save().catch(() => {});
        }

        // Atualização em tempo real do Painel após registrar logs
        updatePanel(client).catch(err => console.error("Erro ao atualizar painel via sendLogIA:", err));
    } catch (err) {
        console.error("[IA Log] Erro ao enviar log:", err);
    }
}

/**
 * Trata interações dos botões permanentes de visualização de logs de IA.
 */
async function handleAiLogInteraction(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('ai_log_view_')) return;

    if (interaction.isButton() && (interaction.message.flags?.has(64) || interaction.deferred || interaction.replied)) {
        await interaction.deferUpdate().catch(() => {});
    } else {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    try {
        const parts = customId.replace('ai_log_view_', '').split('_');
        const logId = parts[0];
        const page = parseInt(parts[1], 10) || 0;

        const { AiLog } = require('../mongoose.js');
        const logDoc = await AiLog.findById(logId).catch(() => null);

        if (!logDoc) {
            return interaction.editReply({
                content: '❌ Registro de log não encontrado no banco de dados. Os detalhes completos estão disponíveis no arquivo .TXT anexado à mensagem original.',
                embeds: [],
                components: []
            });
        }

        const fullTxt = generateStructuredLogTxt({
            userId: logDoc.userId,
            action: logDoc.action,
            prompt: logDoc.prompt,
            context: logDoc.context,
            response: logDoc.response,
            usage: logDoc.usage,
            attachments: logDoc.attachments,
            modelName: logDoc.modelName,
            createdAt: logDoc.createdAt,
            logId: logDoc._id
        });

        const { paginateText } = require('./dbMonitor.js');
        const pages = paginateText(fullTxt, 1800);
        const totalPages = pages.length;
        const safePage = Math.max(0, Math.min(page, totalPages - 1));

        const safeContent = pages[safePage].replace(/```/g, '`\u200B`\u200B`');

        const embed = new EmbedBuilder()
            .setTitle(`📖 Leitura Completa: ${logDoc.action} (Pág. ${safePage + 1}/${totalPages})`)
            .setColor('#16a085')
            .setDescription(`\`\`\`text\n${safeContent}\n\`\`\``)
            .addFields({
                name: '📑 Informações do Registro',
                value: `👤 **Usuário:** <@${logDoc.userId}>  •  🧠 **Modelo:** \`${logDoc.modelName || 'Gemini'}\`\n` +
                       `📏 **Tamanho:** \`${fullTxt.length.toLocaleString()}\` caracteres (${fullTxt.split('\n').length} linhas)`,
                inline: false
            })
            .setFooter({ text: `Galatic Bot • Página ${safePage + 1} de ${totalPages} • ID: ${logDoc._id}` })
            .setTimestamp(logDoc.createdAt);

        const components = [];
        if (totalPages > 1) {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ai_log_view_${logId}_0`)
                    .setLabel('⏮')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(safePage === 0),
                new ButtonBuilder()
                    .setCustomId(`ai_log_view_${logId}_${safePage - 1}`)
                    .setLabel('◀ Anterior')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(safePage === 0),
                new ButtonBuilder()
                    .setCustomId(`ai_log_view_${logId}_${safePage + 1}`)
                    .setLabel('Próxima ▶')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(safePage >= totalPages - 1),
                new ButtonBuilder()
                    .setCustomId(`ai_log_view_${logId}_${totalPages - 1}`)
                    .setLabel('⏭')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(safePage >= totalPages - 1)
            ));
        }

        return interaction.editReply({ embeds: [embed], components });
    } catch (err) {
        console.error('[AI Log] Erro ao manipular visualização de log:', err);
        return interaction.editReply({ content: '❌ Ocorreu um erro ao carregar o log de IA.', embeds: [], components: [] });
    }
}

/**
 * Migra mensagens de log antigas presentes no canal 1510784425275822120 para o novo formato com .TXT e botão permanente.
 */
async function migrarLogsAntigosNoChat(client) {
    if (!client) return;
    try {
        const logChannelId = "1510784425275822120";
        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => new Map());
        const oldMessages = [];

        for (const msg of messages.values()) {
            if (msg.author.id !== client.user.id) continue;
            // Pula mensagens que já possuem arquivo .txt anexado ou o botão permanente novo
            const jaMigrado = msg.attachments.some(a => a.name && a.name.endsWith('.txt')) ||
                              msg.components.some(r => r.components.some(c => c.customId && c.customId.startsWith('ai_log_view_')));
            if (jaMigrado) continue;

            const isOldAiLog = msg.embeds.some(e => e.title && e.title.includes('Log de Uso de IA'));
            if (isOldAiLog) {
                oldMessages.push(msg);
            }
        }

        if (oldMessages.length === 0) return;
        console.log(`[AI LOG MIGRATION] Encontradas ${oldMessages.length} mensagens antigas de IA para migração.`);

        const { AiLog } = require('../mongoose.js');

        for (const msg of oldMessages) {
            try {
                const embed = msg.embeds[0];
                if (!embed) continue;

                const title = embed.title || '';
                const desc = embed.description || '';

                let userId = 'Desconhecido';
                const userMatch = desc.match(/<@!?(\d+)>/) || desc.match(/\((\d{17,20})\)/);
                if (userMatch) userId = userMatch[1];

                let action = 'Central de Upgrades';
                const actionMatch = title.match(/Log de Uso de IA - (.*?) \((Prompt|Resposta)\)/) || desc.match(/\*\*Ação:\*\* (.*?)\n/);
                if (actionMatch) action = actionMatch[1].trim();

                let modelName = 'gemini-3.5-flash-lite';
                const modelMatch = desc.match(/\*\*Modelo Utilizado:\*\* `(.*?)`/);
                if (modelMatch) modelName = modelMatch[1];

                const isPromptMsg = title.includes('(Prompt)');
                const isRespMsg = title.includes('(Resposta)');

                if (!AiLog) continue;
                const logDoc = await AiLog.create({
                    userId,
                    action,
                    modelName,
                    prompt: isPromptMsg ? desc : '(Prompt registrado em mensagens anteriores)',
                    response: isRespMsg ? desc : '(Resposta registrada em mensagens anteriores)',
                    channelId: channel.id,
                    createdAt: msg.createdAt
                });

                const fullTxt = generateStructuredLogTxt({
                    userId,
                    action,
                    prompt: logDoc.prompt,
                    context: '',
                    response: logDoc.response,
                    usage: {},
                    attachments: [],
                    modelName,
                    createdAt: msg.createdAt,
                    logId: logDoc._id
                });

                const safeActionName = action.toLowerCase().replace(/[^a-z0-9]/gi, '_');
                const attachment = new AttachmentBuilder(Buffer.from(fullTxt, 'utf-8'), {
                    name: `log_ia_${safeActionName}_${logDoc._id}.txt`
                });

                let previewText = desc.replace(/```[a-z]*\n?/gi, '').trim();
                if (previewText.length > 400) previewText = previewText.substring(0, 397) + '...';

                const summaryEmbed = new EmbedBuilder()
                    .setTitle(`🤖 Log de IA: ${action}`)
                    .setColor('#16a085')
                    .setDescription(
                        `**Usuário:** <@${userId}> (\`${userId}\`)\n` +
                        `**Modelo:** \`${modelName}\`  •  **Data:** <t:${Math.floor(msg.createdAt.getTime() / 1000)}:f>\n\n` +
                        `📄 *O relatório foi migrado e anexado abaixo em formato **.TXT** organizado.*\n` +
                        `Clique no botão permanente **Ver Mais** para ler diretamente no Discord.`
                    )
                    .addFields({
                        name: '📑 Conteúdo do Registro (Migrado)',
                        value: `\`\`\`text\n${previewText || 'Sem pré-visualização'}\n\`\`\``,
                        inline: false
                    })
                    .setFooter({ text: `Galatic Bot • ID: ${logDoc._id} (Migrado)` })
                    .setTimestamp(msg.createdAt);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ai_log_view_${logDoc._id}_0`)
                        .setLabel('Ver Mais (Texto Completo)')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📖')
                );

                const newMsg = await channel.send({
                    embeds: [summaryEmbed],
                    files: [attachment],
                    components: [row]
                });

                logDoc.messageId = newMsg.id;
                await logDoc.save().catch(() => {});

                // Remove a mensagem antiga desorganizada
                await msg.delete().catch(() => {});
            } catch (itemErr) {
                console.error('[AI LOG MIGRATION] Falha ao migrar mensagem individual:', itemErr);
            }
        }
        console.log(`[AI LOG MIGRATION] Migração de mensagens concluída com sucesso!`);
    } catch (err) {
        console.error('[AI LOG MIGRATION] Erro geral na migração:', err);
    }
}

module.exports = {
    registerUsage,
    updatePanel,
    ensurePanelExists,
    sendLogIA,
    handleAiLogInteraction,
    generateStructuredLogTxt,
    migrarLogsAntigosNoChat
};
