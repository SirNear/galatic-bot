const { EmbedBuilder } = require('discord.js');
const LOG_CHANNEL_ID = "1409063037905670154";

const CORES = {
    'Registrar': '#57F287', // Verde
    'Editar': '#FEE75C',    // Amarelo
    'Deletar': '#ED4245',   // Vermelho
    'Liberar': '#ED4245'    // Vermelho
};

const EMOJIS = {
    'Registrar': '✅',
    'Editar': '✏️',
    'Deletar': '🗑️',
    'Liberar': '🔓'
};

async function logOperacao(client, user, acao, tipoItem, dados) {
    try {
        if (!client || !client.channels) {
            console.error('[LOG APARENCIA] Client inválido ou sem channels.');
            return;
        }

        const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(err => {
            console.error(`[LOG APARENCIA] Erro ao buscar canal ${LOG_CHANNEL_ID}:`, err);
            return null;
        });
        if (!channel) return console.error(`[LOG APARENCIA] Canal ${LOG_CHANNEL_ID} não encontrado (fetch retornou null).`);

        const cor = CORES[acao] || '#FFFFFF';
        const emoji = EMOJIS[acao] || 'ℹ️';

        const embed = new EmbedBuilder()
            .setColor(cor)
            .setTitle(`${emoji} Log de ${tipoItem}: ${acao}`)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: '👤 Executor', value: `${user.tag} (${user.id})`, inline: false }
            )
            .setTimestamp();

        // Formatação específica para Edição (Antes vs Depois)
        if (acao === 'Editar' && dados.antigo) {
            let alteracoes = '';
            if (tipoItem === 'Verso') {
                alteracoes += `**Nome:** ${dados.antigo.nome} ➔ ${dados.nome}\n`;
                alteracoes += `**Uso:** ${dados.antigo.uso} ➔ ${dados.uso}`;
            } else {
                alteracoes += `**Aparência:** ${dados.antigo.nome} ➔ ${dados.nome}\n`;
                alteracoes += `**Universo:** ${dados.antigo.universo} ➔ ${dados.universo}\n`;
                alteracoes += `**Personagem:** ${dados.antigo.personagem} ➔ ${dados.personagem}`;
            }
            embed.addFields({ name: '🔄 Alterações', value: alteracoes, inline: false });
        } else {
            // Formatação para Registro/Deleção
            if (tipoItem === 'Verso') {
                embed.addFields(
                    { name: '🌌 Verso', value: dados.nome, inline: true },
                    { name: '📊 Uso', value: dados.uso || 'N/A', inline: true }
                );
            } else {
                embed.addFields(
                    { name: '👤 Aparência', value: dados.nome, inline: true },
                    { name: '🌌 Universo', value: dados.universo || 'N/A', inline: true },
                    { name: '🎭 Personagem', value: dados.personagem || 'N/A', inline: true }
                );
            }
        }

        await channel.send({ embeds: [embed] });
        console.log(`[LOG APARENCIA] Log de ${acao} enviado com sucesso para ${channel.name}`);
    } catch (error) {
        console.error(`[LOG APARENCIA] Erro ao enviar log:`, error);
    }
}

module.exports = { logOperacao };
