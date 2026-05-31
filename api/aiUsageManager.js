const { EmbedBuilder } = require('discord.js');
const { AiUsage } = require('../mongoose');
const moment = require('moment');
moment.locale('pt-br');

const MAX_MONTHLY_TOKENS = 1000000; // 1 Milhão de tokens como alvo visual
const MAX_DAILY_REQUESTS = 500; // Ajustado com base no print (ex: Gemini 3.1 Flash Lite)

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

async function registerUsage(usageMetadata) {
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

        usageDoc.dailyUsage.set(todayDate, daily);
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
            console.log("[IA Monitor] Mensagem não encontrada. Criando novo painel...");
            const embed = new EmbedBuilder().setTitle('⏳ Inicializando Monitor de IA...').setColor('#2b2d31');
            message = await channel.send({ embeds: [embed] });
            usageDoc.panelChannelId = channel.id;
            usageDoc.panelMessageId = message.id;
            await usageDoc.save();
            console.log("[IA Monitor] Novo painel criado e salvo no banco de dados.");
        } else {
            console.log("[IA Monitor] Painel já existe. Atualizando...");
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

        const tokenProgress = generateProgressBar(usageDoc.totalTokens, MAX_MONTHLY_TOKENS, 20);
        const reqProgress = generateProgressBar(daily.requests, MAX_DAILY_REQUESTS, 20);

        let color = '#2b2d31'; // Default dark
        if (tokenProgress.percentage > 90 || reqProgress.percentage > 90) color = '#ED4245'; // Red
        else if (tokenProgress.percentage > 70 || reqProgress.percentage > 70) color = '#FEE75C'; // Yellow
        else color = '#57F287'; // Green

        const embed = new EmbedBuilder()
            .setTitle('🤖 Monitoramento de Inteligência Artificial')
            .setDescription(`Painel atualizado de consumo do Gemini (Google Cloud Dev Platform).\n\n**Uso de Tokens (Mensal Base)**\n\`\`\`${tokenProgress.bar} ${tokenProgress.percentage}%\`\`\`\n**Requisições Diárias**\n\`\`\`${reqProgress.bar} ${reqProgress.percentage}%\`\`\``)
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
    } catch (err) {
        console.error("Erro ao atualizar o painel de IA:", err);
    }
}

module.exports = { registerUsage, updatePanel, ensurePanelExists };
