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
        try {
            if (!interaction.isCommand() && !interaction.isModalSubmit() && !interaction.isButton()) {
                return;
            }

            // Handle Modal Submits
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'fichaCreate') {
                    await this.handleFichaCreate(interaction);
                    return;
                }
                else if (interaction.customId.startsWith('habilidade_')) {
                    await this.handleHabilidadeSubmit(interaction);
                    return;
                }
            }

            // Handle Button Interactions
            if (interaction.isButton()) {
                if (interaction.customId === 'abrirModal' || interaction.customId === 'addHabilidade') {
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
                    return;
                }
            }

            // Handle Command Interactions
            if (interaction.isChatInputCommand()) {
                const command = this.client.slashCommands.get(interaction.commandName);
                if (!command) return;

                await command.execute(interaction);
            }
        } catch (err) {
            console.error('Erro ao processar interação:', err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: 'Ocorreu um erro ao executar este comando!',
                    flags: 64 // Substitui ephemeral: true
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

            // ID único usando nome do personagem
            const fichaId = `${interaction.user.id}_${nome.toLowerCase().replace(/\s+/g, '_')}`;

            // Verifica se já existe ficha com este nome
            const existingFicha = await this.client.database.Ficha.findOne({
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                nome: nome
            });

            if (existingFicha) {
                return interaction.reply({
                    content: '❌ Você já possui um personagem com este nome!',
                    flags: 64
                });
            }

            // Cria a ficha
            const ficha = await this.client.database.Ficha.create({
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
            console.error('Erro ao criar ficha:', err);
            if (!interaction.replied) {
                await interaction.reply({
                    content: 'Ocorreu um erro ao criar a ficha!',
                    flags: 64
                });
            }
        }
    }

    async handleHabilidadeSubmit(interaction) {
        try {
            await interaction.deferReply({ flags: 64 }); // ephemeral: true

            // Extrai a categoria do customId do modal
            const categoria = interaction.customId.split('_')[1];

            // Obtém os valores usando os IDs corretos
            const nome = interaction.fields.getTextInputValue('nomeHabilidade');
            const descricao = interaction.fields.getTextInputValue('descricaoHabilidade');
            const subHabilidadesInput = interaction.fields.getTextInputValue('subHabilidades');

            const subHabilidades = subHabilidadesInput
                ? subHabilidadesInput.split('\n').filter(sub => sub.trim() !== '').map((sub, index) => ({
                    nome: `Sub ${index + 1}`,
                    descricao: sub.trim()
                  }))
                : [];

            // Busca todas as fichas do usuário para ele escolher a qual adicionar
            const fichasDoUsuario = await this.client.database.Ficha.find({ 
                userId: interaction.user.id,
                guildId: interaction.guild.id
            });

            if (!fichasDoUsuario.length) {
                return interaction.editReply({
                    content: 'Erro: Nenhuma ficha encontrada! Use `/ficha criar` primeiro.',
                    flags: 64
                });
            }

            // Se houver apenas uma ficha, usa ela. Se não, pede para o usuário escolher.
            let ficha;
            if (fichasDoUsuario.length === 1) {
                ficha = fichasDoUsuario[0];
            } else {
                // Lógica para o usuário escolher a ficha (será implementada no futuro ou via outro comando)
                // Por agora, vamos pegar a mais recente como padrão
                ficha = fichasDoUsuario.sort((a, b) => b.createdAt - a.createdAt)[0];
            }

            if (!ficha) {
                return interaction.editReply({
                    content: 'Erro: Ficha não encontrada! Use `/ficha criar` primeiro.',
                    flags: 64
                });
            }

            // Adiciona a habilidade
            ficha.habilidades.push({
                nome,
                descricao,
                categoria: categoria, // Já está em minúsculo
                subHabilidades: subHabilidades
            });

            await ficha.save();

            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Habilidade Adicionada!')
                .setDescription(`Habilidade **${nome}** adicionada à ficha de **${ficha.nome}**.`)
                .addFields(
                    { name: 'Categoria', value: categoria, inline: true },
                    { name: 'Descrição', value: descricao }
                );

            if (subHabilidades.length > 0) {
                embed.addFields({
                    name: 'Sub-habilidades',
                    value: subHabilidades.map((sub, index) => `${index + 1}. ${sub.descricao}`).join('\n')
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('Erro ao salvar habilidade:', err);
            const response = {
                content: 'Ocorreu um erro ao salvar a habilidade. Tente novamente.',
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