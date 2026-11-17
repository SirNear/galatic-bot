const { EmbedBuilder } = require('discord.js');
const cronManager = require('./cronManager.js');

async function executarLembreteUpgrades(client) {
    const ADM_CHANNEL_ID = '1502919601107763252';
    const pendentesCount = await client.database.UpgradeModel.countDocuments({ status: 'pendente' });

    if (pendentesCount > 0) {
        const channel = await client.channels.fetch(ADM_CHANNEL_ID).catch(() => null);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('🔔 Lembrete de Upgrades Pendentes')
                .setDescription(`Existem atualmente **${pendentesCount}** treino(s) aguardando avaliação na fila!\n\nPor favor, verifiquem a fila de upgrades quando possível para não deixar os jogadores esperando.`)
                .setColor('Orange')
                .setTimestamp();

            await channel.send({ content: '<@&731974690125643869>', embeds: [embed] }).catch(() => {});
            return `Lembrete enviado aos avaliadores: ${pendentesCount} treino(s) pendente(s).`;
        }
    }
    return "Nenhum treino pendente aguardando avaliação.";
}

module.exports = (client) => {
    cronManager.registerJob({
        id: 'lembrete_upgrades',
        name: '🔔 Lembrete de Treinos Pendentes',
        schedule: '0 10 */3 * *',
        description: 'Notifica os administradores a cada 3 dias caso existam treinos acumulados na fila de avaliação.',
        taskFn: () => executarLembreteUpgrades(client)
    });
};
module.exports.executarLembreteUpgrades = executarLembreteUpgrades;
