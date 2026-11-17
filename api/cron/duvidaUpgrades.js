const { EmbedBuilder } = require('discord.js');
const cronManager = require('./cronManager.js');

async function executarGerenciamentoDuvidas(client) {
    const canaisDuvida = await client.database.UpgradeDuvida.find();
    if (canaisDuvida.length === 0) return "Nenhum canal de dúvida ativo.";

    const agora = Date.now();
    let encerrados = 0;
    let avisados = 0;

    for (const db of canaisDuvida) {
        const channel = await client.channels.fetch(db.channelId).catch(() => null);

        if (!channel) {
            await client.database.UpgradeDuvida.findByIdAndDelete(db._id);
            continue;
        }

        if (agora > db.expiresAt) {
            await channel.delete().catch(() => null);
            await client.database.UpgradeDuvida.findByIdAndDelete(db._id);
            encerrados++;
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
            avisados++;
        }
    }

    return `${canaisDuvida.length} canal(is) verificado(s) (${encerrados} encerrado(s), ${avisados} alertado(s)).`;
}

module.exports = (client) => {
    cronManager.registerJob({
        id: 'duvida_upgrades',
        name: '⏳ Gestão de Canais de Dúvidas',
        schedule: '*/5 * * * *',
        description: 'Verifica inatividade em canais de dúvidas de treinos e encerra canais abandonados após 12h.',
        taskFn: () => executarGerenciamentoDuvidas(client)
    });
};
module.exports.executarGerenciamentoDuvidas = executarGerenciamentoDuvidas;
