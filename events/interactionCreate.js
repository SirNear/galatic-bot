module.exports = class {
    constructor(client) {
        this.client = client;
    }

    async run(interaction) {
        if (!interaction.isModalSubmit()) return;

        if (interaction.customId === 'fichaCreate') {
            await this.handleFichaCreate(interaction);
        }
        else if (interaction.customId.startsWith('habilidade_')) {
            await this.handleHabilidadeSubmit(interaction);
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
};