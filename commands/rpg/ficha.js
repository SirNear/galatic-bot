const { Discord, ModalBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, TextInputStyle, TextInputBuilder, fetchRecommendedShardCount } = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')
const color = require('../../api/colors.json')

module.exports = class ficha extends Command {
    constructor(client) {
        super(client, {
            name: "ficha",
            category: "rpg",
            aliases: ['f'],
            UserPermission: [""],
            clientPermission: null,
            OnlyDevs: true
        })
    }
  
async run({ message, args, client, server }) {
    let formularioRegisto = new ModalBuilder()
        .setCustomId('esqueletoFormularioRegistro')
        .setTitle('Registro de Ficha');

    let campoNome = new TextInputBuilder()
        .setCustomId('campoNome')
        .setLabel('Nome do Personagem')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    let campoReino = new TextInputBuilder()
        .setCustomId('campoReino')
        .setLabel('Reino')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    let campoRaca = new TextInputBuilder()
        .setCustomId('campoRaca')
        .setLabel('Raça')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    let campoAparencia = new TextInputBuilder()
        .setCustomId('campoAparencia')
        .setLabel('Aparência')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue('Insira o nome do personagem e o universo pertencente');

    const actionRowNome = new ActionRowBuilder().addComponents(campoNome);
    const actionRowReino = new ActionRowBuilder().addComponents(campoReino);
    const actionRowRaca = new ActionRowBuilder().addComponents(campoRaca);
    const actionRowAparencia = new ActionRowBuilder().addComponents(campoAparencia);

    formularioRegisto.addComponents(actionRowNome, actionRowReino, actionRowRaca, actionRowAparencia);

    const botoesConfirmacao = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('confirma')
                .setLabel('SIM')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancela')
                .setLabel('CANCELAR')
                .setStyle(ButtonStyle.Danger),
        );

    let mensagemConfirmacao = await message.reply({ content: 'Deseja iniciar a inscrição da ficha de um novo personagem?', ephemeral: true, components: [botoesConfirmacao] });

    const coletorBotao = mensagemConfirmacao.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 });

    coletorBotao.on('collect', async (interaction) => {
        if (interaction.customId === 'confirma') {
            console.log('Botão SIM clicado, exibindo o modal...');
            await interaction.showModal(formularioRegisto);

            // Agora, esperando pela interação no modal
            const filter = (interaction) => interaction.customId === 'esqueletoFormularioRegistro';
            interaction.awaitModalSubmit({ filter, time: 150000 }).then(async (modalInteraction) => {
                console.log('Modal enviado e recebido com sucesso!');
                await modalInteraction.deferUpdate();

                // Coletando valores do modal
                let pName = await modalInteraction.fields.getTextInputValue('campoNome');
                let pRaca = await modalInteraction.fields.getTextInputValue('campoRaca');
                let pReino = await modalInteraction.fields.getTextInputValue('campoReino');
                let pAparencia = await modalInteraction.fields.getTextInputValue('campoAparencia');

                let embedSucess = new EmbedBuilder()
                    .setColor(color.green)
                    .setTitle('<:YaroCheck:1408857786221330443> | **Ficha Registrada!**')
                    .setDescription('Confira os valores:')
                    .addFields(
                        {name: '<:membroCDS:1408857982363500556> | **Nome**', value: pName, inline: true},
                        {name: '<:7992_AmongUs_Investigate:1408858074734919861> | **Aparência**', value: pAparencia, inline: true},
                        {name: '<a:NeekoGroove:1408860306029150349> | **Raça**', value: pRaca, inline: true},
                        {name: '<:iglu:1408859733632483388>| **Reino**', value: pReino, inline: true},
                    );

                await mensagemConfirmacao.edit({ embeds: [embedSucess], components: [] });
                message.channel.send('**Ficha registrada com sucesso!** Deseja registrar _habilidades_ agora?');

            }).catch(err => {
                console.error('Erro ao capturar o modal:', err);
                message.channel.send('Houve um erro ao processar o formulário.');
            });

        } else {
            console.log('Botão CANCELAR clicado, cancelando a ação...');
            return error.cancelMsg(mensagemConfirmacao);
        }
    });
}


}