const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
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
            'gemini-3.1-flash-lite': 500,
            'gemini-2.5-flash': 20,
            'gemini-3.5-flash': 20,
            'gemini-flash-latest': 20,
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

async function sendLogIA(client, logData) {
    if (!client) return;
    try {
        const logChannelId = "1510784425275822120";
        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel) return;

        const { userId, action, prompt, context, response, usage, attachments, modelName } = logData;
        
        let promptContent = `**Ação:** ${action}\n**Usuário:** <@${userId}> (${userId})\n`;
        if (modelName) {
            promptContent += `**Modelo Utilizado:** \`${modelName}\`\n`;
        }
        if (usage) {
            promptContent += `**Uso de Tokens:** ${usage.totalTokenCount || usage.totalTokens} (Prompt: ${usage.promptTokenCount || usage.promptTokens} | Resposta: ${usage.candidatesTokenCount || usage.completionTokens})\n`;
        }
        promptContent += `\n`;
        if (attachments && attachments.length > 0) {
            promptContent += `**Anexos:** ${attachments.join(', ')}\n\n`;
        }
        if (context) {
            promptContent += `**Contexto / Lore:**\n\`\`\`text\n${context}\n\`\`\`\n`;
        }
        promptContent += `**Prompt:**\n\`\`\`text\n${prompt || 'Sem prompt de texto'}\n\`\`\`\n`;

        let responseContent = `**Resposta para:** ${action} - <@${userId}>\n\`\`\`text\n${response || 'Sem resposta'}\n\`\`\`\n`;

        const sendPaginated = async (fullText, title) => {
            const splitText = (text, maxLength = 4000) => {
                const parts = [];
                let currentChunk = text;
                while (currentChunk.length > 0) {
                    if (currentChunk.length <= maxLength) {
                        parts.push(currentChunk);
                        break;
                    }
                    let splitIndex = currentChunk.lastIndexOf('\n\n', maxLength);
                    if (splitIndex === -1) splitIndex = currentChunk.lastIndexOf('\n', maxLength);
                    if (splitIndex === -1) splitIndex = maxLength;
                    parts.push(currentChunk.substring(0, splitIndex));
                    currentChunk = currentChunk.substring(splitIndex).trim();
                }
                return parts;
            };

            const pages = splitText(fullText);
            let currentPage = 0;
            const uniqueId = Math.random().toString(36).substring(7);

            const generateEmbed = (pageIndex) => {
                return new EmbedBuilder()
                    .setTitle(title)
                    .setColor('#2b2d31')
                    .setDescription(pages[pageIndex])
                    .setFooter({ text: `Página ${pageIndex + 1} de ${pages.length} | Botões expiram em 24h` })
                    .setTimestamp();
            };

            const generateButtons = (pageIndex) => {
                if (pages.length <= 1) return [];
                return [new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`log_prev_${uniqueId}`)
                        .setLabel('◀️ Anterior')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(pageIndex === 0),
                    new ButtonBuilder()
                        .setCustomId(`log_next_${uniqueId}`)
                        .setLabel('Próximo ▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(pageIndex >= pages.length - 1)
                )];
            };

            const msg = await channel.send({
                embeds: [generateEmbed(0)],
                components: generateButtons(0)
            });

            if (pages.length > 1) {
                const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 86400000 });
                collector.on('collect', async i => {
                    if (i.customId.startsWith('log_prev') && currentPage > 0) currentPage--;
                    else if (i.customId.startsWith('log_next') && currentPage < pages.length - 1) currentPage++;
                    
                    await i.update({
                        embeds: [generateEmbed(currentPage)],
                        components: generateButtons(currentPage)
                    });
                });
                collector.on('end', () => {
                    msg.edit({ components: [] }).catch(() => {});
                });
            }
        };

        await sendPaginated(promptContent, `📋 Log de Uso de IA - ${action} (Prompt)`);
        await sendPaginated(responseContent, `📋 Log de Uso de IA - ${action} (Resposta)`);

        // Atualização em tempo real do Painel após registrar logs
        updatePanel(client).catch(err => console.error("Erro ao atualizar painel via sendLogIA:", err));
    } catch (err) {
        console.error("[IA Log] Erro ao enviar log:", err);
    }
}

module.exports = { registerUsage, updatePanel, ensurePanelExists, sendLogIA };
