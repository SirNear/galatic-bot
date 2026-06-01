const {
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const Command = require('../../structures/Command');
const { extrairFicha } = require('../../structures/fichaParser');
const { Ficha } = require('../../mongoose');

module.exports = class contextExtrairFicha extends Command {
    constructor(client) {
        super(client, {
            name: "Anexar à Ficha",
            description: "Anexa informações desta mensagem a uma ficha existente",
            category: "rpg",
            aliases: [],
            UserPermission: [],
            clientPermission: [],
            OnlyDevs: false,
            slash: true, 
        });

        if (this.config.slash) {
            this.data = new ContextMenuCommandBuilder()
                .setName('Anexar à Ficha')
                .setType(ApplicationCommandType.Message);
        }
    }

    async execute(interaction) {
        if (!interaction.isMessageContextMenuCommand()) return;

        const textoDaMensagem = interaction.targetMessage.content;
        const targetUser = interaction.targetMessage.author;

        if (!textoDaMensagem || textoDaMensagem.length < 10) {
            return interaction.reply({ content: '❌ A mensagem não possui texto suficiente.', ephemeral: true });
        }

        // Busca as fichas do usuário dono da mensagem
        const userFichas = await Ficha.find({ userId: targetUser.id, guildId: interaction.guild.id });

        if (!userFichas || userFichas.length === 0) {
            return interaction.reply({ 
                content: `❌ <@${targetUser.id}> não possui nenhuma ficha criada neste servidor. Use o comando \`/ficha importar\` para criar uma nova ficha primeiro.`, 
                ephemeral: true 
            });
        }

        // 1. Extração
        const fichaExtraida = extrairFicha(textoDaMensagem);

        // 2. Montar Preview
        const embedPreview = new EmbedBuilder()
            .setTitle(`Preview do que será anexado`)
            .setColor('#2b2d31')
            .setDescription(`Estes são os dados extraídos da mensagem.\nSelecione abaixo a qual ficha de <@${targetUser.id}> deseja anexar (fazer merge).`);

        let basicosStr = '';
        for (const [key, value] of Object.entries(fichaExtraida.dados_basicos)) {
            basicosStr += `**${key}:** ${value}\n`;
        }
        if (basicosStr) embedPreview.addFields({ name: 'Dados Básicos', value: basicosStr.substring(0, 1024) });

        let statusStr = '';
        for (const [key, value] of Object.entries(fichaExtraida.status)) {
            statusStr += `**${key}:** ${value}\n`;
        }
        if (statusStr) embedPreview.addFields({ name: 'Status', value: statusStr.substring(0, 1024) });

        if (fichaExtraida.anotacoes) {
            embedPreview.addFields({ name: 'Anotações Extras / Lore', value: fichaExtraida.anotacoes.substring(0, 1024) });
        }

        // 3. Montar Dropdown
        const menuOpcoes = userFichas.map(f => {
            return new StringSelectMenuOptionBuilder()
                .setLabel(f.nome)
                .setDescription(`Anexar dados à ficha de ${f.nome}`)
                .setValue(f.nome);
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_ficha_merge')
            .setPlaceholder('Selecione uma ficha para atualizar...')
            .addOptions(menuOpcoes);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const msgResposta = await interaction.reply({
            embeds: [embedPreview],
            components: [row],
            ephemeral: true, 
            fetchReply: true
        });

        // 4. Coletor
        const filtro = i => i.user.id === interaction.user.id;
        const coletor = msgResposta.createMessageComponentCollector({ filter: filtro, time: 120000 });

        coletor.on('collect', async i => {
            if (i.customId === 'select_ficha_merge') {
                const fichaEscolhida = i.values[0];
                try {
                    const fichaAlvo = await Ficha.findOne({ userId: targetUser.id, guildId: interaction.guild.id, nome: fichaEscolhida });
                    
                    if (!fichaAlvo) {
                        return i.update({ content: `❌ Ficha não encontrada.`, embeds: [], components: [] });
                    }

                    // Mesclar dados
                    for (const [key, value] of Object.entries(fichaExtraida.dados_basicos)) {
                        fichaAlvo.dados_basicos.set(key, value);
                    }
                    for (const [key, value] of Object.entries(fichaExtraida.status)) {
                        fichaAlvo.status.set(key, value);
                    }
                    // A anotação extra pode ser mesclada também
                    if (fichaExtraida.anotacoes) {
                        const anotaAtual = fichaAlvo.dados_basicos.get('Anotações') || '';
                        fichaAlvo.dados_basicos.set('Anotações', anotaAtual + '\n' + fichaExtraida.anotacoes);
                    }
                    
                    await fichaAlvo.save();
                    await i.update({ content: `🔄 Os dados foram anexados com sucesso à ficha **${fichaAlvo.nome}**!`, embeds: [], components: [] });
                } catch(err) {
                    console.error(err);
                    await i.update({ content: `❌ Erro ao atualizar a ficha.`, embeds: [], components: [] });
                }
            }
        });

        coletor.on('end', collected => {
            if(collected.size === 0) {
                interaction.editReply({ components: [] }).catch(()=>{});
            }
        });
    }
};
