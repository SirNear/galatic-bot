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
                        .setLabel('Tipo da Habilidade')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Física, Mágica, Passiva, Haki, Sagrada, Demoniaca, Amaldiçoada, Aura de Combate, outras (digite)')
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
                        .setPlaceholder('Você poderá adicionar mais depois! \n Deixe em branco se não quiser adicionar.')
                        .setRequired(false);

                    const subHabilidade2 = new TextInputBuilder()
                        .setCustomId('subHabilidade2') // ID único
                        .setLabel('Sub-habilidade 2 (opcional)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Você poderá adicionar mais depois! \n Deixe em branco se não quiser adicionar.')
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
            const [, categoria, fichaId] = interaction.customId.split('_');

            // Obtém os valores usando os IDs corretos
            const nome = interaction.fields.getTextInputValue('nomeHabilidade');
            const descricao = interaction.fields.getTextInputValue('descricaoHabilidade');
            
            const subHabilidades = [];
            let subNome1, subDesc1;

            try { subNome1 = interaction.fields.getTextInputValue('subHabilidadeNome1'); } catch { subNome1 = null; }
            try { subDesc1 = interaction.fields.getTextInputValue('subHabilidadeDesc1'); } catch { subDesc1 = null; }

            if (subNome1 && subDesc1) {
                subHabilidades.push({ nome: subNome1, descricao: subDesc1 });
            } else if (subNome1 || subDesc1) {
                // Se apenas um dos campos da sub-habilidade foi preenchido, avisa o usuário.
                return interaction.editReply({
                    content: '❌ Para adicionar uma sub-habilidade, você precisa preencher tanto o nome quanto a descrição dela.',
                    flags: 64
                });
            }

            // Busca a ficha específica pelo ID passado no customId do modal
            const ficha = await this.client.database.Ficha.findById(fichaId);

            if (!ficha) {
                return interaction.editReply({
                    content: 'Erro: A ficha selecionada não foi encontrada.',
                    flags: 64
                });
            }
            if (ficha.userId !== interaction.user.id) {
                return interaction.editReply({
                    content: 'Erro: Você não tem permissão para editar esta ficha.',
                    flags: 64
                });
            }

            // Adiciona a habilidade
            ficha.habilidades.push({
                nome,
                descricao,
                categoria: categoria, 
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