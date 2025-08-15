const { Discord, ModalBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, TextInputStyle, TextInputBuilder, fetchRecommendedShardCount } = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')

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
  
async run({ message, args, client, server}) {

    let formularioRegisto = new ModalBuilder()
        .setCustomId('esqueletoFormularioRegistro')
        .setTitle('Registro de Ficha')

    let campoNome = new TextInputBuilder()
        .setCustomId('nome')
        .setLabel('Nome do Personagem')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)

    let campoReino = new TextInputBuilder()
        .setCustomId('reino')
        .setLabel('Reino')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)

    let campoRaca = new TextInputBuilder()
        .setCustomId('raca')
        .setLabel('Raça')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)

    let campoAparencia = new TextInputBuilder()
        .setCustomId('aparencia')
        .setLabel('Aparência')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue('Insira o nome do personagem e o universo pertencente')

    const actionRowNome = new ActionRowBuilder().addComponents(campoNome);
    const actionRowReino = new ActionRowBuilder().addComponents(campoReino);
    const actionRowRaca = new ActionRowBuilder().addComponents(campoRaca);
    const actionRowAparencia = new ActionRowBuilder().addComponents(campoAparencia);

    formularioRegisto.addComponents(actionRowNome, actionRowReino, actionRowRaca, actionRowAparencia)

    const botoesConfirmacao = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('confirma')
                .setLabel('SIM')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('cancela')
                .setLabel('CANCELAR')
                .setStyle(ButtonStyle.Primary),
        )

    let mensagemConfirmacaoRegistrado = await message.reply({ content: 'Deseja iniciar a inscrição da ficha de um novo personagem?', ephemeral: true, components: [botoesConfirmacao] })

    const collector = mensagemConfirmacaoRegistrado.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 300000 });


    collector.on('collect', async (interaction) => {
        mensagemConfirmacaoRegistrado.delete()

        const filter = (interaction) => interaction.customId === 'confirma'

        interaction.awaitModalSubmit({ filter, time: 150000 }).then(async (interaction) => {
            if (interaction.customId === 'confirma') { 

                let pName = modalInteraction.fields.getTextInputValue('nome');
                let pRaca = modalInteraction.fields.getTextInputValue('raca');
                let pReino = modalInteraction.fields.getTextInputValue('reino');
                let pAparencia = modalInteraction.fields.getTextInputValue('aparencia');

                let embedSucess = new EmbedBuilder()
                        .setColor(color.green)
                        .setTitle('<:YaroCheck:810266633804709908> | **Ficha Registrada!**')
                        .setDescription('Confira os valores:')
                        .addFields(
                            {name: '<:membroCDS:713866588398288956> | **Nome**', value: pName, inline: true},
                            {name: '<:7992_AmongUs_Investigate:810735122462670869> | **Descrição**', value: pAparencia, inline: true},
                            {name: '<:passe:713845479691124867> | **Tipos**', value: pRaca, inline: true},
                            {name: '<:classes:713835963133985019> | **Espécie**', value: pReino, inline: true},
                        );

                await interaction.reply({embeds: [embedSucess]})
                
                message.channel.send('**Ficha registrada com sucesso!** Deseja registrar _habilidades_ agora?')

                let formularioRegisto = new ModalBuilder()
                    .setCustomId('esqueletoFormularioHabilidade')
                    .setTitle('Registro de Habilidade')

                let campoNome = new TextInputBuilder()
                    .setCustomId('hNome')
                    .setLabel('Nome da Habilidade')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)

                let campoReino = new TextInputBuilder()
                    .setCustomId('hDesc')
                    .setLabel('Descrição')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(2)
                    .setMaxLength(4000)
                    .setRequired(true)

                let campoRaca = new TextInputBuilder()
                    .setCustomId('hTipo')
                    .setLabel('Tipo de Habilidade')
                    .setStyle(TextInputStyle.Short)
                    .setValue('ESCREVA EXATAMENTE: magica, fisica, passiva, amaldiçoada, ')
                    .setRequired(true)

                let campoAparencia = new TextInputBuilder()
                    .setCustomId('aparencia')
                    .setLabel('Aparência')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue('Insira o nome do personagem e o universo pertencente')

                const actionRowNome = new ActionRowBuilder().addComponents(campoNome);
                const actionRowReino = new ActionRowBuilder().addComponents(campoReino);
                const actionRowRaca = new ActionRowBuilder().addComponents(campoRaca);
                const actionRowAparencia = new ActionRowBuilder().addComponents(campoAparencia);

                formularioRegisto.addComponents(actionRowNome, actionRowReino, actionRowRaca, actionRowAparencia)


                const botaoHabilidade = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('confirmado')
                            .setLabel('SIM')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('cancelado')
                            .setLabel('CANCELAR')
                            .setStyle(ButtonStyle.Primary),
                    )

                let mensagemConfirmaHabilidade = await message.reply({ content: 'Deseja iniciar a inscrição da ficha de um novo personagem?', ephemeral: true, components: [botaoHabilidade] })

                collectorHabilidade.on('collect', async (interaction) => {  
                        const filter = (interaction) => interaction.customId === 'confirmado'

                        interaction.awaitModalSubmit({ filter, time: 150000 }).then(async (interaction) => { 
                            if (interaction.customId === 'confirmado') {

                            }
                        })




                })


            }else { message.reply({ content: 'Registro cancelado! Você pode registrar sua ficha depois!', ephemeral: true }) }
        })
    })

    collector.on('end', collected => {
        if (collected.size === 0) {
            message.reply({ content: 'Você não interagiu a tempo!', ephemeral: true });
        }
    });
}
}