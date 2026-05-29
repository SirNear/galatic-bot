const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    // Executa a cada 5 minutos a verificação
    setInterval(async () => {
        try {
            const canaisDuvida = await client.database.UpgradeDuvida.find();
            const agora = Date.now();

            for (const db of canaisDuvida) {
                const channel = await client.channels.fetch(db.channelId).catch(() => null);

                if (!channel) {
                    await client.database.UpgradeDuvida.findByIdAndDelete(db._id);
                    continue;
                }

                if (agora > db.expiresAt) {
                    await channel.delete().catch(() => null);
                    await client.database.UpgradeDuvida.findByIdAndDelete(db._id);
                    continue;
                }

                if (agora > db.nextReminderAt) {
                    const horasRestantes = Math.ceil((db.expiresAt - agora) / (60 * 60 * 1000));
                    
                    const embed = new EmbedBuilder()
                        .setTitle('⏳ Lembrete de Inatividade')
                        .setDescription(`Atenção! Este canal será encerrado automaticamente em aproximadamente **${horasRestantes} hora(s)** por inatividade.\n\nQualquer nova mensagem enviada aqui renovará o tempo para 12 horas.`)
                        .setColor('Yellow');

                    await channel.send({ content: `<@${db.admodId}> <@${db.userId}>`, embeds: [embed] }).catch(() => null);

                    db.nextReminderAt = agora + (2 * 60 * 60 * 1000);
                    await db.save();
                }
            }
        } catch (error) {
            console.error('[CRON] Erro ao gerenciar canais de dúvida de upgrades:', error);
        }
    }, 5 * 60 * 1000);
};