const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const Command = require('../../structures/Command');

module.exports = class upgrade extends Command {
    constructor(client) {
        super(client, {
            name: 'upgrade',
            description: 'Inicia o processo de registro de upgrade do seu treino atual.',
            category: 'rpg',
            slash: true
        });

        this.data = new SlashCommandBuilder()
            .setName(this.config.name)
            .setDescription(this.config.description);
    }

    async execute(interaction) {
        const embedUpg = new EmbedBuilder()
            .setTitle('<a:rahhh:1502049620640006257> | CENTRAL DE UPGRADES | <a:rahhh:1502049620640006257>')
            .setAuthor({name: 'Sistema de Treinos', iconURL: this.client.guilds.cache.get(interaction.guildId).iconURL()})
            .setDescription('Você fez um novo treino? Que legal! \n \n Para facilitar a aprovação de seus upgrades, use esse sistema! Certifique-se que seu treino está no **mesmo canal** que está digitando o comando. \n \n Primeiro, vou pedir para você marcar com uma reação a primeira e a última mensagem do seu treino, desconsiderando imagens. \n \n CLIQUE NO BOTÃO PARA CONTINUAR')
            .addFields({ name: 'Dúvidas?', value: 'Clique no botão "❌" para cancelar o processo e [CLIQUE AQUI PARA VER O TUTORIAL](google.com)'})
            .setColor('#0647c8');

        const rowAct = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('upgrade_start')
                .setLabel('CONTINUAR')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('upgrade_cancel')
                .setLabel('CANCELAR')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌')
        );

        await interaction.reply({ embeds: [embedUpg], components: [rowAct] });
    }
};