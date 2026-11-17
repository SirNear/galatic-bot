const { EmbedBuilder } = require('discord.js');
const cronManager = require('./cronManager.js');

const ADM_CHANNEL_ID = '1502919601107763252';

/**
 * Remove mensagens de lembrete anteriores enviadas pelo bot no canal,
 * garantindo que apenas o lembrete mais recente fique visível.
 */
async function limparLembretesAntigos(channel, client) {
    if (!channel) return;
    try {
        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => new Map());
        for (const msg of messages.values()) {
            if (msg.author.id === client.user.id) {
                const isLembrete = (msg.embeds.length > 0 && msg.embeds[0].title && msg.embeds[0].title.includes('Lembrete de Upgrades Pendentes')) ||
                                   (msg.content && msg.content.includes('731974690125643869') && msg.embeds.length > 0 && msg.embeds[0].title && msg.embeds[0].title.includes('Lembrete'));
                if (isLembrete) {
                    await msg.delete().catch(() => {});
                }
            }
        }

        if (client.database && client.database.PanelConfig) {
            const config = await client.database.PanelConfig.findById('lembrete_upgrades_msg').catch(() => null);
            if (config && config.messageId) {
                const oldMsg = await channel.messages.fetch(config.messageId).catch(() => null);
                if (oldMsg) await oldMsg.delete().catch(() => {});
                await client.database.PanelConfig.deleteOne({ _id: 'lembrete_upgrades_msg' }).catch(() => {});
            }
        }
    } catch (err) {
        console.error('[LEMBRETE UPGRADES] Erro ao limpar lembretes antigos:', err);
    }
}

async function executarLembreteUpgrades(client) {
    const channel = await client.channels.fetch(ADM_CHANNEL_ID).catch(() => null);
    if (!channel) return "Canal de administradores não encontrado.";

    // Remove qualquer mensagem de lembrete anterior presente no canal
    await limparLembretesAntigos(channel, client);

    const pendentesCount = await client.database.UpgradeModel.countDocuments({ status: 'pendente' });

    if (pendentesCount > 0) {
        const embed = new EmbedBuilder()
            .setTitle('🔔 Lembrete de Upgrades Pendentes')
            .setDescription(`Existem atualmente **${pendentesCount}** treino(s) aguardando avaliação na fila!\n\nPor favor, verifiquem a fila de upgrades quando possível para não deixar os jogadores esperando.\n\n*Esta mensagem substitui automaticamente avisos anteriores.*`)
            .setColor('Orange')
            .setTimestamp();

        const newMsg = await channel.send({ content: '<@&731974690125643869>', embeds: [embed] }).catch(() => null);

        if (newMsg && client.database && client.database.PanelConfig) {
            await client.database.PanelConfig.findOneAndUpdate(
                { _id: 'lembrete_upgrades_msg' },
                { channelId: channel.id, messageId: newMsg.id, updatedAt: new Date() },
                { upsert: true }
            ).catch(() => {});
        }

        return `Lembrete enviado aos avaliadores: ${pendentesCount} treino(s) pendente(s).`;
    }

    return "Nenhum treino pendente aguardando avaliação (lembretes anteriores limpos).";
}

module.exports = (client) => {
    // Executa a limpeza imediata de lembretes residuais acumulados no chat
    client.channels.fetch(ADM_CHANNEL_ID).then(ch => {
        if (ch) limparLembretesAntigos(ch, client).catch(() => {});
    }).catch(() => {});

    cronManager.registerJob({
        id: 'lembrete_upgrades',
        name: '🔔 Lembrete de Treinos Pendentes',
        schedule: '0 10 */3 * *',
        description: 'Notifica os administradores caso existam treinos acumulados na fila de avaliação, mantendo apenas o último aviso ativo.',
        taskFn: () => executarLembreteUpgrades(client)
    });
};
module.exports.executarLembreteUpgrades = executarLembreteUpgrades;
module.exports.limparLembretesAntigos = limparLembretesAntigos;
