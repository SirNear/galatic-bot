/*

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

module.exports = class ficha extends Command {
    constructor(client) {
        super(client, {
            name: "ficha",
            description: "administração de fichas de personagem",
            category: "rpg",
            aliases: [],
            UserPermission: [],
            clientPermission: [],
            OnlyDevs: true,
            slash: true,
        });

        if (this.config.slash) {
            this.data = new SlashCommandBuilder()
                .setName(this.config.name)
                .setDescription(this.config.description)
                .addSubcommand(sub =>
                    sub.setName('criar')
                        .setDescription('Criar uma nova ficha de personagem') 
                )
                .addSubcommand(sub =>
                    sub.setName('editar')
                        .setDescription('Editar uma ficha de personagem existente')
                )
                .addSubcommand(sub =>
                    sub.setName('deletar')
                        .setDescription('Deletar uma ficha de personagem')
                )
                .addSubcommand(sub =>
                    sub.setName('lista')
                        .setDescription('Listar todas as fichas de personagem')
                )
                .addSubcommand(sub =>
                    sub.setName('ver')
                        .setDescription('Visualizar os detalhes de uma ficha de personagem')
                )
        }
    }

    async execute(interaction) {
        switch(interaction.options.getSubcommand()) {
            case 'criar':
                const modal = new ModalBuilder()
                        .setCustomId('modal_criar_ficha')
                        .setTitle('Criação de Ficha');
    
                const inputNome = new TextInputBuilder()
                    .setCustomId('input_nome_ficha')
                    .setLabel('Nome do Personagem')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const inputRaca = new TextInputBuilder()
                    .setCustomId('input_raca_ficha')
                    .setLabel('Raça do Personagem')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const inputIdade = new TextInputBuilder()
                    .setCustomId('input_idade_ficha')
                    .setLabel('Idade do Personagem')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(inputNome),
                    new ActionRowBuilder().addComponents(inputRaca),
                    new ActionRowBuilder().addComponents(inputIdade),
                    new ActionRowBuilder().addComponents(
                );

                await interaction.showModal(modal);


                break;
            case 'editar':
                await interaction.reply({ content: 'Comando de edição de ficha ainda não implementado.', ephemeral: true });
                break;
            case 'deletar':
                await interaction.reply({ content: 'Comando de exclusão de ficha ainda não implementado.', ephemeral: true });
                break;
            case 'lista':
                await interaction.reply({ content: 'Comando de listagem de fichas ainda não implementado.', ephemeral: true });
                break;
            case 'ver':
                await interaction.reply({ content: 'Comando de visualização de ficha ainda não implementado.', ephemeral: true });
                break;
        }
        const embExemplo = new EmbedBuilder()
            .setTitle('🎨 Título do Embed')
            .setDescription('Este é um esqueleto demonstrando os principais componentes de UI do Discord.js v14.')
            .setColor('#5865F2')
            .addFields(
                { name: 'Botões', value: 'Clique abaixo para testar', inline: true },
                { name: 'Menus', value: 'Selecione uma opção', inline: true }
            )
            .setFooter({ text: 'Rodapé do Embed', iconURL: interaction.user.displayAvatarURL() });

        // 2. CRIAÇÃO DE BOTÕES
        const botModal = new ButtonBuilder()
            .setCustomId('btn_abrir_modal')
            .setLabel('Abrir Modal')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝');

        const botAcaoSim = new ButtonBuilder()
            .setCustomId('btn_acao_simples')
            .setLabel('Ação Simples')
            .setStyle(ButtonStyle.Secondary);

        const botDeletar = new ButtonBuilder()
            .setCustomId('btn_deletar')
            .setLabel('Deletar')
            .setStyle(ButtonStyle.Danger);

        const linBotoes = new ActionRowBuilder().addComponents(botModal, botAcaoSim, botDeletar);

        // 3. CRIAÇÃO DE MENU DE SELEÇÃO (DROPDOWN)
        const menSelecao = new StringSelectMenuBuilder()
            .setCustomId('menu_selecao_exemplo')
            .setPlaceholder('Selecione uma categoria...')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('Opção A')
                    .setDescription('Descrição detalhada da opção A')
                    .setValue('val_a')
                    .setEmoji('🅰️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Opção B')
                    .setDescription('Descrição detalhada da opção B')
                    .setValue('val_b')
                    .setEmoji('🅱️'),
            );

        const linMenu = new ActionRowBuilder().addComponents(menSelecao);

        // ENVIAR A RESPOSTA INICIAL
        const msgResposta = await interaction.reply({
            content: 'Aqui está o esqueleto de componentes:',
            embeds: [embExemplo],
            components: [linBotoes, linMenu],
            fetchReply: true // Necessário para criar o coletor depois
        });

        // 4. COLETOR DE INTERAÇÕES (Event Listener temporário)
        // O filtro garante que apenas o usuário que executou o comando possa interagir.
        const filtro = i => i.user.id === interaction.user.id;
        const coletor = msgResposta.createMessageComponentCollector({
            filter: filtro,
            time: 60000 // Tempo em ms (60s)
        });

        coletor.on('collect', async i => {
            if (i.isButton()) {
                if (i.customId === 'btn_abrir_modal') {
                    // 5. CRIAÇÃO E EXIBIÇÃO DE MODAL
                    const modal = new ModalBuilder()
                        .setCustomId('modal_exemplo_submissao')
                        .setTitle('Formulário de Exemplo');

                    const inputNome = new TextInputBuilder()
                        .setCustomId('input_nome')
                        .setLabel('Qual seu nome?')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const inputBio = new TextInputBuilder()
                        .setCustomId('input_bio')
                        .setLabel('Conte sobre você')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(1000)
                        .setRequired(false);

                    // Inputs de modal precisam estar em ActionRows separadas
                    modal.addComponents(new ActionRowBuilder().addComponents(inputNome), new ActionRowBuilder().addComponents(inputBio));

                    await i.showModal(modal);

                    // 6. COLETOR PARA A RESPOSTA DO MODAL (usando awaitModalSubmit)
                    const submissao = await i.awaitModalSubmit({
                        time: 120000, // 2 minutos para o usuário preencher
                        filter: intModal => intModal.user.id === interaction.user.id,
                    }).catch(() => null); // Retorna null se o tempo esgotar

                    if (!submissao) {
                        // O usuário não enviou o modal a tempo.
                        // A interação do botão já terá falhado, então não podemos responder a 'i'.
                        // Poderíamos enviar uma nova mensagem no canal se necessário.
                        return;
                    }

                    // Pega os valores dos inputs
                    const nome = submissao.fields.getTextInputValue('input_nome');
                    const bio = submissao.fields.getTextInputValue('input_bio');

                    // Responde à submissão do modal
                    await submissao.reply({
                        content: `✅ Formulário recebido!\n**Nome:** ${nome}\n**Bio:** ${bio || 'Não informada.'}`,
                        ephemeral: true
                    });

                } else if (i.customId === 'btn_deletar') {
                    await i.update({ content: '🗑️ Mensagem deletada.', components: [], embeds: [] });
                    coletor.stop(); // Para o coletor, já que a mensagem foi "deletada"
                } else {
                    await i.reply({ content: `Você clicou no botão: \`${i.customId}\``, ephemeral: true });
                }
            } else if (i.isStringSelectMenu()) {
                // Tratamento específico para Menus Dropdown
                // i.values é um array com as opções escolhidas (ex: ['val_a'])
                const valSelecionado = i.values[0];
                
                if (valSelecionado === 'val_a') {
                    await i.update({ content: `✅ Você escolheu a **Opção A**! Uma ação específica aconteceu.` });
                } else if (valSelecionado === 'val_b') {
                    await i.update({ content: `✅ Você escolheu a **Opção B**! Outra coisa aconteceu.` });
                }
            }
        });

        // 7. EVENTO DE FIM DO COLETOR (QUANDO O TEMPO ACABA)
        coletor.on('end', collected => {
            // Edita a mensagem original para desabilitar os componentes
            msgResposta.edit({
                content: 'O tempo para interagir expirou.',
                components: [] // Remove todos os botões e menus
            }).catch(() => {}); // Ignora erro se a mensagem já foi deletada
        });
    }
};
*/