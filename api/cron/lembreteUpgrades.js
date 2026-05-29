const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    const ADM_CHANNEL_ID = '1502919601107763252';
    const TRES_DIAS = 3 * 24 * 60 * 60 * 1000;

    setInterval(async () => {
        try {
            const pendentesCount = await client.database.UpgradeModel.countDocuments({ status: 'pendente' });
            
            if (pendentesCount > 0) {
                const channel = await client.channels.fetch(ADM_CHANNEL_ID).catch(() => null);
                if (!channel) return;

                const embed = new EmbedBuilder()
                    .setTitle('🔔 Lembrete de Upgrades Pendentes')
                    .setDescription(`Existem atualmente **${pendentesCount}** treino(s) aguardando avaliação na fila!\n\nPor favor, verifiquem a fila de upgrades quando possível para não deixar os jogadores esperando.`)
                    .setColor('Orange')
                    .setTimestamp();

                await channel.send({ content: '<@&731974690125643869> <@&1438672389918556310> <@&1409771551099715645>', embeds: [embed] }).catch(() => {});
            }
        } catch (error) {
            console.error('[CRON] Erro ao verificar upgrades pendentes:', error);
        }
    }, TRES_DIAS);
};