const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    // Executa a cada 12 horas (12 * 60 * 60 * 1000 milissegundos)
    setInterval(async () => {
        try {
            const pendentes = await client.database.UpgradeModel.find({ status: 'pendente' });
            if (pendentes.length === 0) return;

            const filaChannel = await client.channels.fetch('1502919601107763252').catch(() => null);
            const pendentAdmChannel = await client.channels.fetch('1502919510787887104').catch(() => null);

            const timestampAtu = Math.floor(Date.now() / 1000);

            for (const upg of pendentes) {
                const tempoPendenciaTimestamp = Math.floor(new Date(upg.createdAt).getTime() / 1000);

                if (filaChannel && upg.filaMessageId) {
                    const msgFila = await filaChannel.messages.fetch(upg.filaMessageId).catch(() => null);
                    if (msgFila && msgFila.embeds.length > 0) {
                        const olderUpgrades = await client.database.UpgradeModel.countDocuments({ status: 'pendente', createdAt: { $lte: upg.createdAt } });
                        const newEmbedFila = EmbedBuilder.from(msgFila.embeds[0])
                            .setDescription(`Jogador: <@${upg.userId}>\nPersonagem: **${upg.personagem || 'Não informado'}**\n\n STATUS: #pendente \n TEMPO DE PENDÊNCIA: <t:${tempoPendenciaTimestamp}:R> \n \n Posição na Fila: ${olderUpgrades}\n\n*Última atualização: <t:${timestampAtu}:f>*`);
                        await msgFila.edit({ embeds: [newEmbedFila] }).catch(() => null);
                    }
                }

                if (pendentAdmChannel && upg.pendenteMessageId) {
                    const msgAdm = await pendentAdmChannel.messages.fetch(upg.pendenteMessageId).catch(() => null);
                    if (msgAdm && msgAdm.embeds.length > 0) {
                        const newEmbedAdm = EmbedBuilder.from(msgAdm.embeds[0])
                            .setDescription(`Autor: <@${upg.userId}>\nPersonagem: **${upg.personagem || 'Não informado'}**\nUpgrades: ${upg.upgrades.length}\n TEMPO DE PENDÊNCIA: <t:${tempoPendenciaTimestamp}:R> \n \n CLIQUE NO BOTÃO PARA AVALIAR!\n\n*Última atualização: <t:${timestampAtu}:f>*`);
                        await msgAdm.edit({ embeds: [newEmbedAdm] }).catch(() => null);
                    }
                }
            }
        } catch (error) {
            console.error('[CRON JOB] Erro na atualização automática de upgrades:', error);
        }
    }, 12 * 60 * 60 * 1000);
};