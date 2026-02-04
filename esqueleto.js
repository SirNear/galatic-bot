const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ComponentType
} = require('discord.js');
const Command = require('../../structures/Command');

module.exports = class esqueleto extends Command {
    constructor(client) {
        super(client, {
            name: "esqueleto",
            description: "Exemplo prático de Embeds, Botões, Menus e Modais.",
            category: "utils",
            aliases: ["exemplo", "template"],
            UserPermission: [],
            clientPermission: [],
            OnlyDevs: true,
            slash: true,
        });

        if (this.config.slash) {
            this.data = new SlashCommandBuilder()
                .setName(this.config.name)
                .setDescription(this.config.description)
                .addStringOption(opt =>
                    opt.setName('opcao_texto')
                        .setDescription('Exemplo de argumento de texto')
                        .setRequired(false)
                );
        }
    }

    async execute(interaction) {
        // 1. CRIAÇÃO DE EMBED
        const embExe = new EmbedBuilder()
            .setTitle('🎨 Título do Embed')
            .setDescription('Este é um esqueleto demonstrando os principais componentes de UI do Discord.js v14.')
            .setColor('#5865F2')
            .addFields(
                { name: 'Botões', value: 'Clique abaixo para testar', inline: true },
                { name: 'Menus', value: 'Selecione uma opção', inline: true }
            )
            .setFooter({ text: 'Rodapé do Embed', iconURL: interaction.user.displayAvatarURL() });

        // 2. CRIAÇÃO DE BOTÕES
        const botMod = new ButtonBuilder()
            .setCustomId('btn_abrir_modal')
            .setLabel('Abrir Modal')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝');

        const botSec = new ButtonBuilder()
            .setCustomId('btn_acao_simples')
            .setLabel('Ação Simples')
            .setStyle(ButtonStyle.Secondary);

        const botDan = new ButtonBuilder()
            .setCustomId('btn_deletar')
            .setLabel('Deletar')
            .setStyle(ButtonStyle.Danger);

        const rowBot = new ActionRowBuilder().addComponents(botMod, botSec, botDan);

        // 3. CRIAÇÃO DE MENU DE SELEÇÃO (DROPDOWN)
        const menSel = new StringSelectMenuBuilder()
            .setCustomId('menu_selecao_exemplo')
            .setPlaceholder('Selecione uma categoria...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Opção A')
                    .setDescription('Descrição detalhada da opção A')
                    .setValue('valor_a')
                    .setEmoji('🅰️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Opção B')
                    .setDescription('Descrição detalhada da opção B')
                    .setValue('valor_b')
                    .setEmoji('🅱️'),
            );

        const rowMen = new ActionRowBuilder().addComponents(menSel);

        // ENVIAR A RESPOSTA INICIAL
        const resInt = await interaction.reply({
            content: 'Aqui está o esqueleto de componentes:',
            embeds: [embExe],
            components: [rowBot, rowMen],
            fetchReply: true // Necessário para criar o coletor depois
        });

        // 4. COLETOR DE INTERAÇÕES (Event Listener temporário)
        const colCom = resInt.createMessageComponentCollector({
            componentType: ComponentType.Button | ComponentType.StringSelect, // Escuta botões e menus
            time: 60000 // Tempo em ms (60s)
        });

        colCom.on('collect', async i => {
            // Verifica se quem clicou é quem usou o comando
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '❌ Apenas quem executou o comando pode interagir.', ephemeral: true });
            }

            if (i.isButton()) {
                if (i.customId === 'btn_abrir_modal') {
                    // 5. CRIAÇÃO E EXIBIÇÃO DE MODAL
                    const modExe = new ModalBuilder()
                        .setCustomId('modal_exemplo_submissao')
                        .setTitle('Formulário de Exemplo');

                    const inpNom = new TextInputBuilder()
                        .setCustomId('input_nome')
                        .setLabel('Qual seu nome?')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const inpBio = new TextInputBuilder()
                        .setCustomId('input_bio')
                        .setLabel('Conte sobre você')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(1000)
                        .setRequired(false);

                    // Inputs de modal precisam estar em ActionRows separadas
                    modExe.addComponents(new ActionRowBuilder().addComponents(inpNom), new ActionRowBuilder().addComponents(inpBio));

                    await i.showModal(modExe);
                    // Nota: A resposta do modal deve ser tratada via interactionCreate ou awaitModalSubmit
                } else if (i.customId === 'btn_deletar') {
                    await i.update({ content: '🗑️ Mensagem deletada (simulação).', components: [], embeds: [] });
                    colCom.stop();
                } else {
                    await i.reply({ content: `Você clicou em: ${i.customId}`, ephemeral: true });
                }
            } else if (i.isStringSelectMenu()) {
                await i.update({ content: `✅ Você selecionou: **${i.values[0]}**` });
            }
        });
    }
};