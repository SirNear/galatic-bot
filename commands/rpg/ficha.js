const {
  EmbedBuilder,
  ModalBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextInputStyle,
  TextInputBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const Command = require("../../structures/Command");
const color = require("../../api/colors.json");

module.exports = class ficha extends Command {
  constructor(client) {
    super(client, {
      name: "ficha",
      category: "rpg",
      aliases: ["f"],
      UserPermission: [""],
      clientPermission: null,
      OnlyDevs: false, // Mudei para false para permitir uso geral
      slash: true,
      description: "Gerencia fichas de personagem",
    });

    // Configuração do slash command
    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName("ficha") // Garante que o nome está em minúsculo
        .setDescription(this.config.description)
        .addSubcommand((sub) =>
          sub
            .setName("criar")
            .setDescription("Cria uma nova ficha de personagem")
        )
        .addSubcommand((sub) =>
          sub
            .setName("habilidade")
            .setDescription("Adiciona uma habilidade à ficha")
            .addStringOption((opt) =>
              opt
                .setName("categoria")
                .setDescription("Categoria da habilidade")
                .setRequired(true)
                .addChoices(
                  { name: "Mágica", value: "magica" },
                  { name: "Física", value: "fisica" },
                  { name: "Passiva", value: "passiva" },
                  { name: "Sagrada", value: "sagrada" },
                  { name: "Amaldiçoada", value: "amaldicoada" },
                  { name: "Haki", value: "haki" },
                  { name: "Outra", value: "outra" }
                )
            )
        );
    }
  }

  // Método para slash commands
  async execute(interaction) {
    try {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'criar') {
            // Remove verificação de ficha existente
            const modal = new ModalBuilder()
                .setCustomId('fichaCreate')
                .setTitle('Criar Nova Ficha de Personagem');

            let campoNome = new TextInputBuilder()
              .setCustomId("campoNome")
              .setLabel("Nome do Personagem")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            let campoReino = new TextInputBuilder()
              .setCustomId("campoReino")
              .setLabel("Reino")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            let campoRaca = new TextInputBuilder()
              .setCustomId("campoRaca")
              .setLabel("Raça")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            let campoAparencia = new TextInputBuilder()
              .setCustomId("campoAparencia")
              .setLabel("Aparência")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue("Insira o nome do personagem e o universo pertencente");

            const actionRowNome = new ActionRowBuilder().addComponents(campoNome);
            const actionRowReino = new ActionRowBuilder().addComponents(campoReino);
            const actionRowRaca = new ActionRowBuilder().addComponents(campoRaca);
            const actionRowAparencia = new ActionRowBuilder().addComponents(
              campoAparencia
            );

            modal.addComponents(
              actionRowNome,
              actionRowReino,
              actionRowRaca,
              actionRowAparencia
            );

            return interaction.showModal(modal);
        } else if (subcommand === 'habilidade') {
            // Adiciona opção para selecionar personagem
            const personagens = await this.client.database.Ficha.find({
                userId: interaction.user.id,
                guildId: interaction.guild.id
            });

            if (personagens.length === 0) {
                return interaction.reply({
                    content: '❌ Você não possui nenhuma ficha registrada!',
                    flags: 64
                });
            }

            // Cria select menu com personagens
            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('selecionar_personagem')
                        .setPlaceholder('Selecione um personagem')
                        .addOptions(
                            personagens.map(p => ({
                                label: p.nome,
                                value: p._id
                            }))
                        )
                );

            await interaction.reply({
                content: 'Selecione o personagem para adicionar a habilidade:',
                components: [row],
                flags: 64
            });
        }
    } catch (err) {
        console.error('Erro no comando ficha:', err);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'Ocorreu um erro ao executar este comando!',
                flags: 64
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

        // ID único usando timestamp
        const fichaId = `${interaction.user.id}_${Date.now()}`;

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
            flags: 64 // Substitui ephemeral: true
        });
    } catch (err) {
        console.error('Erro ao criar ficha:', err);
        await interaction.reply({
            content: 'Ocorreu um erro ao criar a ficha!',
            flags: 64
        });
    }
  }

  async handleHabilidadeAdd(interaction) {
    const categoria = interaction.options.getString("categoria");

    const modal = new ModalBuilder()
      .setCustomId(`habilidade_${categoria}`)
      .setTitle(
        `Nova Habilidade ${categoria.charAt(0).toUpperCase() + categoria.slice(1)}`
      );

    const nomeInput = new TextInputBuilder()
      .setCustomId("nomeHabilidade") // Mudar de 'nome' para 'nomeHabilidade'
      .setLabel("Nome da Habilidade")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descricaoInput = new TextInputBuilder()
      .setCustomId("descricaoHabilidade") // Mudar de 'descricao' para 'descricaoHabilidade'
      .setLabel("Descrição (max 1000 caracteres)")
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(1000)
      .setRequired(true);

    const subHabilidade1 = new TextInputBuilder()
      .setCustomId("sub1")
      .setLabel("Sub-habilidade 1 (opcional)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    const subHabilidade2 = new TextInputBuilder()
      .setCustomId("sub2")
      .setLabel("Sub-habilidade 2 (opcional)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    const prerequisito = new TextInputBuilder()
      .setCustomId("prereq")
      .setLabel("Pré-requisitos (opcional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nomeInput),
      new ActionRowBuilder().addComponents(descricaoInput),
      new ActionRowBuilder().addComponents(subHabilidade1),
      new ActionRowBuilder().addComponents(subHabilidade2),
      new ActionRowBuilder().addComponents(prerequisito)
    );

    await interaction.showModal(modal);
  }

  // Mantenha o método run() para compatibilidade com comandos prefixados
  async run({ message, args, client, server }) {
    let userDb = await this.client.database.userData.findById(
        `${message.author.globalName} ${message.guild.name}`
    );

    /* #region  FORMULÁRIO */
    let formularioRegisto = new ModalBuilder()
      .setCustomId("esqueletoFormularioRegistro")
      .setTitle("Registro de Ficha");

    let campoNome = new TextInputBuilder()
      .setCustomId("campoNome")
      .setLabel("Nome do Personagem")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    let campoReino = new TextInputBuilder()
      .setCustomId("campoReino")
      .setLabel("Reino")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    let campoRaca = new TextInputBuilder()
      .setCustomId("campoRaca")
      .setLabel("Raça")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    let campoAparencia = new TextInputBuilder()
      .setCustomId("campoAparencia")
      .setLabel("Aparência")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue("Insira o nome do personagem e o universo pertencente");

    const actionRowNome = new ActionRowBuilder().addComponents(campoNome);
    const actionRowReino = new ActionRowBuilder().addComponents(campoReino);
    const actionRowRaca = new ActionRowBuilder().addComponents(campoRaca);
    const actionRowAparencia = new ActionRowBuilder().addComponents(
      campoAparencia
    );

    formularioRegisto.addComponents(
      actionRowNome,
      actionRowReino,
      actionRowRaca,
      actionRowAparencia
    );
    /* #endregion */

    /* #region  BOTÕES */
    const botoesConfirmacao = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("confirma")
            .setLabel("SIM")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("cancela")
            .setLabel("CANCELAR")
            .setStyle(ButtonStyle.Danger)
    );

    let mensagemConfirmacao = await message.reply({
        content: "Deseja iniciar a inscrição da ficha de um novo personagem?",
        ephemeral: true,
        components: [botoesConfirmacao],
    });

    const coletorBotao = mensagemConfirmacao.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 60000,
    });
    /* #endregion */

    coletorBotao.on("collect", async (interaction) => {
        if (interaction.customId === "confirma") {
            await interaction.showModal(formularioRegisto);

            // Agora, esperando pela interação no modal
            const filter = (interaction) =>
                interaction.customId === "esqueletoFormularioRegistro";
            interaction
                .awaitModalSubmit({ filter, time: 150000 })
                .then(async (modalInteraction) => {
                    await modalInteraction.deferUpdate();

                    /* #region VALORES COLETADOS DO FORMULÁRIO */
                    let pName = await modalInteraction.fields.getTextInputValue("campoNome");
                    let pRaca = await modalInteraction.fields.getTextInputValue("campoRaca");
                    let pReino = await modalInteraction.fields.getTextInputValue("campoReino");
                    let pAparencia = await modalInteraction.fields.getTextInputValue("campoAparencia");
                    /* #endregion */

                    try {
                        // Salva a ficha no banco
                        await this.client.database.Ficha.create({
                            _id: `${message.author.id}_${pName}`,
                            userId: message.author.id,
                            guildId: message.guild.id,
                            nome: pName,
                            reino: pReino,
                            raca: pRaca,
                            aparencia: pAparencia,
                            habilidades: []
                        });

                        let embedSucess = new EmbedBuilder()
                            .setColor(color.green)
                            .setTitle("<:YaroCheck:1408857786221330443> | **Ficha Registrada!**")
                            .setDescription("Confira os valores:")
                            .addFields(
                                {
                                  name: "<:membroCDS:1408857982363500556> | **Nome**",
                                  value: pName,
                                  inline: true,
                                },
                                {
                                  name: "<:7992_AmongUs_Investigate:1408858074734919861> | **Aparência**",
                                  value: pAparencia,
                                  inline: true,
                                },
                                {
                                  name: "<a:NeekoGroove:1408860306029150349> | **Raça**",
                                  value: pRaca,
                                  inline: true,
                                },
                                {
                                  name: "<:iglu:1408859733632483388>| **Reino**",
                                  value: pReino,
                                  inline: true,
                                }
                            );

                        await mensagemConfirmacao.edit({
                            embeds: [embedSucess],
                            components: [],
                        });

                        const msgHabilidades = await message.channel.send(
                            "**Ficha registrada com sucesso!** Deseja registrar _habilidades_ agora? (Responda com 'sim' ou 'não')"
                        );

                        // Declarando o coletor aqui
                        const coletorHabilidades = message.channel.createMessageCollector({
                            filter: (m) => 
                                m.author.id === message.author.id && 
                                ['sim', 'não', 'nao'].includes(m.content.toLowerCase()),
                            time: 60000,
                            max: 1,
                        });

                        coletorHabilidades.on('collect', async (msg) => {
                            if (msg.content.toLowerCase() === 'sim') {
                                try {
                                    // Cria modal de habilidades
                                    const modal = new ModalBuilder()
                                        .setCustomId('habilidade_inicial')
                                        .setTitle('Nova Habilidade');

                                    // Campos do modal
                                    const categoriaInput = new TextInputBuilder()
                                        .setCustomId('categoria')
                                        .setLabel('Categoria da Habilidade')
                                        .setStyle(TextInputStyle.Short)
                                        .setRequired(true);

                                    const nomeInput = new TextInputBuilder()
                                        .setCustomId('nome')
                                        .setLabel('Nome da Habilidade')
                                        .setStyle(TextInputStyle.Short)
                                        .setRequired(true);

                                    const descricaoInput = new TextInputBuilder()
                                        .setCustomId('descricao')
                                        .setLabel('Descrição')
                                        .setStyle(TextInputStyle.Paragraph)
                                        .setRequired(true);

                                    const subHabilidade1 = new TextInputBuilder()
                                        .setCustomId('sub1')
                                        .setLabel('Sub-habilidade 1 (opcional)')
                                        .setStyle(TextInputStyle.Paragraph)
                                        .setRequired(false);

                                    const subHabilidade2 = new TextInputBuilder()
                                        .setCustomId('sub2')
                                        .setLabel('Sub-habilidade 2 (opcional)')
                                        .setStyle(TextInputStyle.Paragraph)
                                        .setRequired(false);

                                    modal.addComponents(
                                        new ActionRowBuilder().addComponents(categoriaInput),
                                        new ActionRowBuilder().addComponents(nomeInput),
                                        new ActionRowBuilder().addComponents(descricaoInput),
                                        new ActionRowBuilder().addComponents(subHabilidade1),
                                        new ActionRowBuilder().addComponents(subHabilidade2)
                                    );

                                    // Em vez de tentar criar um collector, vamos usar buttons
                                    const row = new ActionRowBuilder()
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setCustomId('abrirModal')
                                                .setLabel('Adicionar Habilidade')
                                                .setStyle(ButtonStyle.Primary)
                                        );

                                    await msg.reply({
                                        content: 'Clique no botão abaixo para adicionar uma habilidade:',
                                        components: [row]
                                    });

                                } catch (err) {
                                    console.error('Erro ao configurar modal:', err);
                                    await msg.reply('Houve um erro. Use `/ficha habilidade` para adicionar mais tarde.');
                                }
                            } else {
                                await msg.reply('Ok! Você pode adicionar habilidades depois usando `/ficha habilidade`');
                            }
                        });

                        coletorHabilidades.on('end', (collected, reason) => {
                            if (reason === 'time') {
                                message.channel.send('Tempo esgotado! Você pode adicionar habilidades depois usando `/ficha habilidade`');
                            }
                        });

                        console.log(
                            `Ficha registrada: Nome: ${pName}, Raça: ${pRaca}, Reino: ${pReino}, Aparência: ${pAparencia} por ${message.author.tag}(${userDb.jogador})`
                        );
                    } catch (err) {
                        console.error("Erro ao salvar ficha:", err);
                        return modalInteraction.reply("Erro ao salvar a ficha!");
                    }
                })
                .catch((err) => {
                    console.error("Erro ao capturar o modal:", err);
                    message.channel.send("Houve um erro ao processar o formulário.");
                });
        } else {
            console.log("Botão CANCELAR clicado, cancelando a ação...");
            await mensagemConfirmacao.edit({
                content: 'Operação cancelada!',
                components: [],
                ephemeral: true
            });
        }
    });
  }
};
