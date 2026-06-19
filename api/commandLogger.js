const { EmbedBuilder } = require('discord.js');

async function logInteraction(interaction, client) {
    // Incrementa contadores de comandos no banco se for Slash Command
    if (interaction.isChatInputCommand()) {
        const cmdName = interaction.commandName;
        try {
            const userDb = await client.database.userData.findOne({ uid: interaction.user.id });
            if (userDb) {
                const stats = userDb.commandStats || new Map();
                stats.set(cmdName, (stats.get(cmdName) || 0) + 1);
                userDb.commandStats = stats;
                await userDb.save().catch(()=>{});
            }
        } catch (e) {
            console.error("Erro ao incrementar contador de comando:", e);
        }
    }

    // Tentar enviar o log para o canal privado
    try {
        const logChannelId = "1423848686391394454";
        const channel = client.channels.cache.get(logChannelId) || await client.channels.fetch(logChannelId).catch(()=>null);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp()
            .setFooter({ text: `ID: ${interaction.user.id}` });

        if (interaction.isChatInputCommand()) {
            embed.setColor("#3498db");
            embed.setTitle(`Ação: Slash Command (/${interaction.commandName})`);
            
            let argsStr = [];
            for (const opt of interaction.options.data) {
                argsStr.push(`**${opt.name}**: ${opt.value || opt.options?.map(o=>`${o.name}:${o.value}`).join(', ') || 'N/A'}`);
            }
            if (argsStr.length > 0) {
                embed.addFields({ name: "Argumentos", value: argsStr.join('\n') });
            } else {
                embed.setDescription("Nenhum argumento fornecido.");
            }
        } else if (interaction.isButton()) {
            embed.setColor("#2ecc71");
            embed.setTitle(`Ação: Clique de Botão`);
            embed.setDescription(`**CustomID:** \`${interaction.customId}\``);
        } else if (interaction.isAnySelectMenu()) {
            embed.setColor("#9b59b6");
            embed.setTitle(`Ação: Menu Suspenso`);
            embed.setDescription(`**CustomID:** \`${interaction.customId}\`\n**Valores Escolhidos:** \n${interaction.values.map(v => `- \`${v}\``).join('\n')}`);
        } else if (interaction.isModalSubmit()) {
            embed.setColor("#e67e22");
            embed.setTitle(`Ação: Envio de Modal`);
            embed.setDescription(`**CustomID:** \`${interaction.customId}\``);
            
            let fieldsStr = [];
            interaction.components.forEach(row => {
                row.components.forEach(comp => {
                    fieldsStr.push(`**${comp.customId}**: ${comp.value}`);
                });
            });
            if (fieldsStr.length > 0) {
                embed.addFields({ name: "Campos Preenchidos", value: fieldsStr.join('\n').substring(0, 1024) });
            }
        } else {
            return; // Ignora auto-complete e afins
        }

        await channel.send({ embeds: [embed] }).catch(()=>{});
    } catch (err) {
        console.error("Erro ao enviar log de comando:", err);
    }
}

module.exports = { logInteraction };
