const { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder 
} = require('discord.js');

module.exports = class {
    constructor(client) {
        this.client = client;
    }

    async run(interaction) {
        // Handle Modal Submits
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'fichaCreate') {
                await this.handleFichaCreate(interaction);
            }
            else if (interaction.customId.startsWith('habilidade_')) {
                await this.handleHabilidadeSubmit(interaction);
            }
            return;
        }

        // Handle Button Interactions
        if (interaction.isButton()) {
            if (interaction.customId === 'abrirModal') {
                const modal = new ModalBuilder()
                    .setCustomId('habilidade_inicial')
                    .setTitle('Nova Habilidade');

                // Campos do modal com IDs consistentes
                const categoriaInput = new TextInputBuilder()
                    .setCustomId('categoria')
                    .setLabel('Categoria da Habilidade')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const nomeInput = new TextInputBuilder()
                    .setCustomId('nomeHabilidade') // ID único
                    .setLabel('Nome da Habilidade')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const descricaoInput = new TextInputBuilder()
                    .setCustomId('descricaoHabilidade') // ID único
                    .setLabel('Descrição da Habilidade')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const subHabilidade1 = new TextInputBuilder()
                    .setCustomId('subHabilidade1') // ID único
                    .setLabel('Sub-habilidade 1 (opcional)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false);

                const subHabilidade2 = new TextInputBuilder()
                    .setCustomId('subHabilidade2') // ID único
                    .setLabel('Sub-habilidade 2 (opcional)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false);

                // Adiciona todos os campos
                modal.addComponents(
                    new ActionRowBuilder().addComponents(categoriaInput),
                    new ActionRowBuilder().addComponents(nomeInput),
                    new ActionRowBuilder().addComponents(descricaoInput),
                    new ActionRowBuilder().addComponents(subHabilidade1),
                    new ActionRowBuilder().addComponents(subHabilidade2)
                );

                await interaction.showModal(modal);
            }
            return;
        }

        // Handle Command Interactions
        if (interaction.isChatInputCommand()) {
            const command = this.client.slashCommands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: 'Ocorreu um erro ao executar este comando!',
                    ephemeral: true
                });
            }
        }
    }

    async handleFichaCreate(interaction) {
        try {
            const nome = interaction.fields.getTextInputValue('campoNome');
            const raca = interaction.fields.getTextInputValue('campoRaca');
            const reino = interaction.fields.getTextInputValue('campoReino');
            const aparencia = interaction.fields.getTextInputValue('campoAparencia');

            // Cria ID único com nome do personagem
            const fichaId = `${interaction.user.id}_${nome.toLowerCase().replace(/\s+/g, '_')}`;

            // Verifica se já existe personagem com mesmo nome
            const existingFicha = await this.client.database.Ficha.findById(fichaId);

            if (existingFicha) {
                return interaction.reply({
                    content: '❌ Você já possui um personagem com este nome!',
                    flags: 64
                });
            }

            try {
                await this.client.database.Ficha.create({
                    _id: fichaId,
                    userId: interaction.user.id,
                    guildId: interaction.guild.id,
                    nome,
                    raca,
                    reino,
                    aparencia,
                    habilidades: []
                });

                const embed = new EmbedBuilder()
                    .setColor('Green')
                    .setTitle('✅ Ficha Criada!')
                    .addFields(
                        { name: 'Nome', value: nome, inline: true },
                        { name: 'Raça', value: raca, inline: true },
                        { name: 'Reino', value: reino },
                        { name: 'Aparência', value: aparencia }
                    );

                await interaction.reply({
                    embeds: [embed],
                    flags: 64
                });

                // Pergunta sobre habilidades
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('addHabilidade')
                            .setLabel('Adicionar Habilidades')
                            .setStyle(ButtonStyle.Primary)
                    );

                await interaction.followUp({
                    content: 'Deseja adicionar habilidades agora?',
                    components: [row],
                    flags: 64
                });

            } catch (err) {
                if (err.code === 11000) {
                    return interaction.reply({
                        content: '❌ Erro ao criar ficha: Nome de personagem já existe!',
                        flags: 64
                    });
                }
                throw err;
            }
        } catch (err) {
            console.error('Erro ao criar ficha:', err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Ocorreu um erro ao criar a ficha!',
                    flags: 64
                });
            }
        }
    }

    async handleHabilidadeSubmit(interaction) {
        try {
            await interaction.deferReply({ flags: 64 });

            // Obtém os valores usando os IDs corretos
            const categoria = interaction.fields.getTextInputValue('categoria');
            const nome = interaction.fields.getTextInputValue('nomeHabilidade');
            const descricao = interaction.fields.getTextInputValue('descricaoHabilidade');
            const sub1 = interaction.fields.getTextInputValue('subHabilidade1');
            const sub2 = interaction.fields.getTextInputValue('subHabilidade2');

            const ficha = await this.client.database.Ficha.findById(
                `${interaction.user.id}_${interaction.guildId}`
            );

            if (!ficha) {
                return interaction.editReply({
                    content: 'Erro: Ficha não encontrada! Use `/ficha criar` primeiro.',
                    ephemeral: true
                });
            }

            // Adiciona a habilidade
            ficha.habilidades.push({
                nome,
                descricao,
                categoria: categoria.toLowerCase(),
                subHabilidades: [
                    ...(sub1 ? [{ nome: 'Sub 1', descricao: sub1 }] : []),
                    ...(sub2 ? [{ nome: 'Sub 2', descricao: sub2 }] : [])
                ]
            });

            await ficha.save();

            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Habilidade Adicionada!')
                .addFields(
                    { name: 'Nome', value: nome, inline: true },
                    { name: 'Categoria', value: categoria, inline: true },
                    { name: 'Descrição', value: descricao }
                );

            if (sub1 || sub2) {
                embed.addFields({
                    name: 'Sub-habilidades',
                    value: [
                        sub1 ? `1. ${sub1}` : '',
                        sub2 ? `2. ${sub2}` : ''
                    ].filter(Boolean).join('\n')
                });
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (err) {
            console.error('Erro ao salvar habilidade:', err);
            const response = {
                content: 'Erro ao salvar a habilidade. Tente novamente.',
                flags: 64
            };
            
            if (interaction.deferred) {
                await interaction.editReply(response);
            } else {
                await interaction.reply(response);
            }
        }
    }
};