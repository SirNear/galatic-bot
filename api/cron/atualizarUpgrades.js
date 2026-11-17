const { EmbedBuilder } = require('discord.js');
const cronManager = require('./cronManager.js');

const FILA_CHANNEL_ID = '1502919510787887104';
const ADM_CHANNEL_ID = '1502919601107763252';

async function executarAtualizacaoUpgrades(client) {
    const pendentes = await client.database.UpgradeModel.find({ status: 'pendente' });
    if (pendentes.length === 0) return "Nenhum treino pendente para atualizar.";

    const filaChannel = await client.channels.fetch(FILA_CHANNEL_ID).catch(() => null);
    const pendentAdmChannel = await client.channels.fetch(ADM_CHANNEL_ID).catch(() => null);
    const timestampAtu = Math.floor(Date.now() / 1000);
    let atualizados = 0;

    for (const upg of pendentes) {
        const createdAtDate = upg.createdAt ? new Date(upg.createdAt) : (upg._id?.getTimestamp ? upg._id.getTimestamp() : new Date());
        const tempoPendenciaTimestamp = Math.floor(createdAtDate.getTime() / 1000);

        if (filaChannel && upg.filaMessageId) {
            const msgFila = await filaChannel.messages.fetch(upg.filaMessageId).catch(() => null);
            if (msgFila && msgFila.embeds.length > 0) {
                const olderUpgrades = await client.database.UpgradeModel.countDocuments({
                    status: 'pendente',
                    createdAt: { $lte: upg.createdAt || createdAtDate }
                });
                const newEmbedFila = EmbedBuilder.from(msgFila.embeds[0])
                    .setDescription(`Jogador: <@${upg.userId}>\nPersonagem: **${upg.personagem || 'Não informado'}**\n\n STATUS: #pendente \n TEMPO DE PENDÊNCIA: <t:${tempoPendenciaTimestamp}:R> \n \n Posição na Fila: ${olderUpgrades}\n\n*Última atualização: <t:${timestampAtu}:f>*`);
                await msgFila.edit({ embeds: [newEmbedFila], components: msgFila.components }).catch(() => null);
            }
        }

        if (pendentAdmChannel && upg.pendenteMessageId) {
            const msgAdm = await pendentAdmChannel.messages.fetch(upg.pendenteMessageId).catch(() => null);
            if (msgAdm && msgAdm.embeds.length > 0) {
                const newEmbedAdm = EmbedBuilder.from(msgAdm.embeds[0])
                    .setDescription(`Autor: <@${upg.userId}>\nPersonagem: **${upg.personagem || 'Não informado'}**\nUpgrades: ${upg.upgrades?.length || 0}\n TEMPO DE PENDÊNCIA: <t:${tempoPendenciaTimestamp}:R> \n \n CLIQUE NO BOTÃO PARA AVALIAR!\n\n*Última atualização: <t:${timestampAtu}:f>*`);
                await msgAdm.edit({ embeds: [newEmbedAdm], components: msgAdm.components }).catch(() => null);
            }
        }
        atualizados++;
    }

    return `${atualizados} treino(s) pendente(s) sincronizado(s).`;
}

module.exports = (client) => {
    cronManager.registerJob({
        id: 'atualizar_upgrades',
        name: '⚔️ Atualização de Fila de Treinos',
        schedule: '0 */4 * * *',
        description: 'Atualiza o tempo de espera e posição dos jogadores na fila de treinos e upgrades pendentes.',
        taskFn: () => executarAtualizacaoUpgrades(client)
    });
};
module.exports.executarAtualizacaoUpgrades = executarAtualizacaoUpgrades;
