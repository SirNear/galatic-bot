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

                // Adiciona os campos
                const categoriaInput = new TextInputBuilder()
                    .setCustomId('categoria')
                    .setLabel('Categoria da Habilidade')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                // ... outros campos ...

                modal.addComponents(
                    new ActionRowBuilder().addComponents(categoriaInput)
                    // ... outros campos ...
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
        const nome = interaction.fields.getTextInputValue('campoNome');
        const reino = interaction.fields.getTextInputValue('campoReino');
        const raca = interaction.fields.getTextInputValue('campoRaca');
        const aparencia = interaction.fields.getTextInputValue('campoAparencia');

        try {
            await this.client.database.Ficha.create({
                _id: `${interaction.user.id}_${interaction.guildId}`,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                nome,
                reino,
                raca,
                aparencia,
                habilidades: []
            });

            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Ficha Criada!')
                .addFields(
                    { name: 'Nome', value: nome, inline: true },
                    { name: 'Reino', value: reino, inline: true },
                    { name: 'Raça', value: raca, inline: true },
                    { name: 'Aparência', value: aparencia }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });

            // Pergunta sobre adicionar habilidades
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
                ephemeral: true
            });
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: 'Erro ao criar ficha!',
                ephemeral: true
            });
        }
    }

    async handleHabilidadeSubmit(interaction) {
        if (interaction.customId === 'habilidade_inicial') {
            const categoria = interaction.fields.getTextInputValue('categoria');
            const nome = interaction.fields.getTextInputValue('nome');
            const descricao = interaction.fields.getTextInputValue('descricao');
            const sub1 = interaction.fields.getTextInputValue('sub1');
            const sub2 = interaction.fields.getTextInputValue('sub2');

            try {
                const ficha = await this.client.database.Ficha.findById(
                    `${interaction.user.id}_${interaction.guildId}`
                );

                if (!ficha) {
                    return interaction.reply({
                        content: 'Erro: Ficha não encontrada!',
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

                // Pergunta se quer adicionar mais
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('addMaisHabilidade')
                            .setLabel('Adicionar Mais')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('finalizarFicha')
                            .setLabel('Finalizar')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await interaction.followUp({
                    content: 'Deseja adicionar mais habilidades?',
                    components: [row],
                    ephemeral: true
                });

            } catch (err) {
                console.error('Erro ao salvar habilidade:', err);
                await interaction.reply({
                    content: 'Erro ao salvar a habilidade!',
                    ephemeral: true
                });
            }
        } else {
            const categoria = interaction.customId.split('_')[1];
            const nome = interaction.fields.getTextInputValue('nome');
            const descricao = interaction.fields.getTextInputValue('descricao');
            const sub1 = interaction.fields.getTextInputValue('sub1');
            const sub2 = interaction.fields.getTextInputValue('sub2');
            const prereq = interaction.fields.getTextInputValue('prereq');

            try {
                const ficha = await this.client.database.Ficha.findById(
                    `${interaction.user.id}_${interaction.guildId}`
                );

                if (!ficha) {
                    return interaction.reply({
                        content: 'Você precisa criar uma ficha primeiro!',
                        ephemeral: true
                    });
                }

                const novaHabilidade = {
                    nome,
                    descricao,
                    categoria,
                    subHabilidades: []
                };

                if (sub1) novaHabilidade.subHabilidades.push({ nome: 'Sub 1', descricao: sub1 });
                if (sub2) novaHabilidade.subHabilidades.push({ nome: 'Sub 2', descricao: sub2 });
                if (prereq) novaHabilidade.prerequisito = prereq;

                ficha.habilidades.push(novaHabilidade);
                await ficha.save();

                await interaction.reply({
                    content: `✅ Habilidade "${nome}" adicionada com sucesso!`,
                    ephemeral: true
                });
            } catch (err) {
                console.error(err);
                await interaction.reply({
                    content: 'Erro ao adicionar habilidade!',
                    ephemeral: true
                });
            }
        }
    }
};