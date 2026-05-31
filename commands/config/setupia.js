const Command = require('../../structures/Command');
const { EmbedBuilder } = require('discord.js');
const { AiUsage } = require('../../mongoose');
const { updatePanel } = require('../../api/aiUsageManager');

module.exports = class setupia extends Command {
    constructor(client) {
        super(client, {
            name: "setupia",
            category: "config",
            aliases: ['setup-ia'],
            UserPermission: "Administrator",
            clientPermission: null,
            OnlyDevs: true
        })
    }

    async run({ message, args, client }) {
        try {
            const channelId = args[0] || message.channel.id;
            const channel = await client.channels.fetch(channelId).catch(() => null);

            if (!channel) {
                return message.reply("Canal não encontrado. Forneça um ID válido ou execute o comando no canal desejado.");
            }

            const embed = new EmbedBuilder()
                .setTitle('⏳ Configurando Painel de IA...')
                .setDescription('Aguarde, os dados estão sendo sincronizados.')
                .setColor('#2b2d31');

            const panelMsg = await channel.send({ embeds: [embed] });

            let usageDoc = await AiUsage.findById("global");
            if (!usageDoc) {
                usageDoc = new AiUsage({ _id: "global" });
            }

            usageDoc.panelChannelId = channel.id;
            usageDoc.panelMessageId = panelMsg.id;
            await usageDoc.save();

            await updatePanel(client);

            message.reply(`Painel configurado com sucesso em <#${channel.id}>!`);
        } catch (error) {
            console.error("Erro no setupia:", error);
            message.reply("Ocorreu um erro ao configurar o painel.");
        }
    }
}
