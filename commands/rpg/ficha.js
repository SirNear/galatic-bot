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
          sub.setName("ver").setDescription("Visualiza fichas de personagem")
        )
        .addSubcommand((sub) =>
          sub
            .setName("habilidade")
            .setDescription("Adiciona uma habilidade à ficha")
            .addStringOption((opt) =>
                opt.setName("categoria")
                    .setDescription("Mágica, Física, Passiva, Sagrada, Amaldiçoada, Haki, Outra (digite)")
                    .setRequired(true)
            )
        );
    }
  }

  /* #region  SLASH COMMAND */
  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case "criar":
          return this.handleFichaCreate(interaction);
        case "ver":
          return this.handleFichaView(interaction);
        case "habilidade":
          return this.handleHabilidadeAdd(interaction);
      }
    } catch (err) {
      console.error("Erro no comando ficha:", err);
      return interaction.reply({
        content: "Ocorreu um erro ao executar este comando!",
        flags: 64,
      });
    }
  }
  /* #endregion */

  /* #region  BACK-END */
  async handleFichaCreate(interaction) {
    try {
      // Primeiro, criar e mostrar o modal
      const modal = new ModalBuilder()
        .setCustomId("fichaCreate")
        .setTitle("Criar Ficha de Personagem");

      const nomeInput = new TextInputBuilder()
        .setCustomId("campoNome")
        .setLabel("Nome do Personagem")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const racaInput = new TextInputBuilder()
        .setCustomId("campoRaca")
        .setLabel("Raça")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const reinoInput = new TextInputBuilder()
        .setCustomId("campoReino")
        .setLabel("Reino")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const aparenciaInput = new TextInputBuilder()
        .setCustomId("campoAparencia")
        .setLabel("Aparência")
        .setPlaceholder("Nome da Aparência 1, Universo de Origem 1\nNome da Aparência 2, Universo de Origem 2")
        .setStyle(TextInputStyle.Paragraph) 
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nomeInput),
        new ActionRowBuilder().addComponents(racaInput),
        new ActionRowBuilder().addComponents(reinoInput),
        new ActionRowBuilder().addComponents(aparenciaInput)
      );

      await interaction.showModal(modal);
    } catch (err) {
      console.error("Erro ao criar modal:", err);
      await interaction.reply({
        content: "Ocorreu um erro ao abrir o formulário!",
        flags: 64,
      });
    }
  }

  async handleHabilidadeAdd(interaction) {
    const fichasDoUsuario = await this.client.database.Ficha.find({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });

    if (!fichasDoUsuario.length) {
      return interaction.reply({
        content: '❌ Você precisa criar uma ficha primeiro com `/ficha criar`.',
        ephemeral: true,
      });
    }

    if (fichasDoUsuario.length > 1) {
      // Se o usuário tem mais de uma ficha, mostra um menu de seleção
      const options = fichasDoUsuario.map((ficha) => ({
        label: ficha.nome,
        description: `Raça: ${ficha.raca} | Reino: ${ficha.reino}`,
        value: ficha._id.toString(),
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_ficha_para_habilidade')
        .setPlaceholder('Selecione o personagem para adicionar a habilidade')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const msg = await interaction.reply({
        content: 'Para qual personagem você quer adicionar esta habilidade?',
        components: [row],
        ephemeral: true,
        fetchReply: true,
      });

      const collector = msg.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id && i.customId === 'select_ficha_para_habilidade',
        time: 60000,
      });

      collector.on('collect', async (i) => {
        const fichaId = i.values[0];
        await this.showHabilidadeModal(i, fichaId);
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          interaction.editReply({ content: 'Tempo esgotado.', components: [] }).catch(() => {});
        }
      });
    } else {
      // Se tem apenas uma ficha, usa ela diretamente
      const fichaId = fichasDoUsuario[0]._id.toString();
      await this.showHabilidadeModal(interaction, fichaId);
    }
  }

  async showHabilidadeModal(interaction, fichaId) {
    const categoria = interaction.isChatInputCommand() 
      ? interaction.options.getString("categoria")
      : interaction.message.interaction.options.getString("categoria");

    const modal = new ModalBuilder()
      .setCustomId(`habilidade_${categoria}_${fichaId}`)
      .setTitle(`Nova Habilidade`);

    const nomeInput = new TextInputBuilder()
      .setCustomId("nomeHabilidade")
      .setLabel("Nome da Habilidade")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descricaoInput = new TextInputBuilder()
      .setCustomId("descricaoHabilidade")
      .setLabel("Descrição da Habilidade")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const subNomeInput = new TextInputBuilder()
      .setCustomId('subHabilidadeNome1')
      .setLabel('Nome da Sub-habilidade (Opcional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const subDescInput = new TextInputBuilder()
      .setCustomId('subHabilidadeDesc1')
      .setLabel('Descrição da Sub-habilidade (Opcional)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nomeInput),
      new ActionRowBuilder().addComponents(descricaoInput),
      new ActionRowBuilder().addComponents(subNomeInput),
      new ActionRowBuilder().addComponents(subDescInput)
    );

    await interaction.showModal(modal);
  }

  //seletor de fichas
  async handleFichaView(interaction) {
    // Busca as fichas do usuário para o menu de seleção
    const fichasDoUsuario = await this.client.database.Ficha.find({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });

    if (!fichasDoUsuario.length) {
      return interaction.reply({
        content:
          "❌ Você não possui nenhuma ficha para visualizar. Use `/ficha criar` para começar.",
        flags: 64,
      });
    }

    // Cria as opções para o menu de seleção
    const options = fichasDoUsuario.map((ficha) => ({
      label: ficha.nome,
      description: `Raça: ${ficha.raca} | Reino: ${ficha.reino}`,
      value: ficha._id.toString(), // O ID único da ficha
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_ficha_view")
      .setPlaceholder("Selecione uma ficha para visualizar")
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const msg = await interaction.reply({
      content: "Qual ficha você gostaria de ver?",
      components: [row],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      filter: (i) =>
        i.user.id === interaction.user.id && i.customId === "select_ficha_view",
      time: 60000, // 1 minuto
    });

    collector.on("collect", async (i) => {
      const fichaId = i.values[0];
      await this.showFicha(i, fichaId); // Passa a nova interação e o ID da ficha
    });

    collector.on("end", (collected, reason) => {
      if (collected.size === 0) {
        interaction
          .editReply({ content: "Tempo esgotado.", components: [] })
          .catch(() => {});
      }
    });
  }

  //visualizador de fichas
  async showFicha(interaction, fichaId) {
    try {
      // Adia a primeira interação (do menu de seleção)
      if (interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      }

      // Busca todas as fichas do usuário
      const fichas = await this.client.database.Ficha.find({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      }).sort({ createdAt: -1 }); // Ordena por data de criação

      if (!fichas.length) {
        // Esta verificação já é feita em handleFichaView, mas é bom ter como segurança.
        return interaction.followUp({
          content: "Nenhuma ficha encontrada.",
          flags: 64,
        });
      }

      this.client.fichaStates.set(interaction.user.id, {
        currentPage: 0,
        fichas,
      });

      // Configuração da paginação
      let currentFichaIndex = fichas.findIndex((f) => f._id.toString() === fichaId.toString());
      const pages = fichas.length;

      let viewMode = 'ficha'; // 'ficha' ou 'habilidades'
      let currentHabilidadeIndex = 0;

      // Função para gerar embed da ficha
      const getFichaEmbed = (ficha) => {
        const embed = new EmbedBuilder()
          .setColor("Blue")
          .setTitle(`📝 Ficha: ${ficha.nome}`)
          .addFields(
            { name: "Reino", value: ficha.reino, inline: true },
            { name: "Raça", value: ficha.raca, inline: true },
            { name: "Aparência", value: ficha.aparencia },
            {
              name: "Habilidades",
              value: ficha.habilidades.length
                ? "Use os botões abaixo para ver as habilidades"
                : "Nenhuma habilidade registrada",
            }
          )
          .setFooter({ text: `Página ${currentFichaIndex + 1} de ${pages}` });

        return embed;
      };

      const getHabilidadeEmbed = (habilidade, ficha) => {
        const totalHabilidades = ficha.habilidades.length;
        return new EmbedBuilder()
          .setColor("Purple")
          .setTitle(`🔮 Habilidade: ${habilidade.nome}`)
          .setDescription(habilidade.descricao)
          .addFields({ name: "Categoria", value: habilidade.categoria, inline: true },
            ...habilidade.subHabilidades.map((sub, index) => ({
              name: `Sub-habilidade ${index + 1}`,
              value: sub.descricao,
              inline: false,
            }))
          )
          .setFooter({ text: `Habilidade ${currentHabilidadeIndex + 1} de ${totalHabilidades}` });
      };


      // Botões de navegação da Ficha
      const getButtons = (disablePrev, disableNext) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prevPage")
            .setLabel("◀️ Anterior")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disablePrev),
          new ButtonBuilder()
            .setCustomId("nextPage")
            .setLabel("Próximo ▶️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disableNext),
          new ButtonBuilder()
            .setCustomId("viewHabilidades")
            .setLabel("Ver Habilidades")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!fichas[currentFichaIndex].habilidades.length)
        );
      };

      // Botões de navegação das Habilidades
      const getNavButtons = (disablePrev, disableNext) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prevHab")
            .setLabel("◀️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disablePrev),
          new ButtonBuilder()
            .setCustomId("voltarFicha")
            .setLabel("Voltar para Ficha")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("nextHab")
            .setLabel("▶️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disableNext)
        );
      };

      // Envia mensagem inicial
      const message = await interaction.editReply({
        embeds: [getFichaEmbed(fichas[currentFichaIndex])],
        components: [getButtons(currentFichaIndex === 0, currentFichaIndex === pages - 1)],
        flags: 64,
      });

      // Cria coletor de botões
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 300000,
        idle: 60000,
      });

      collector.on("collect", async (i) => {
        if (viewMode === 'ficha') {
            if (i.customId === "prevPage") {
                currentFichaIndex--;
            } else if (i.customId === "nextPage") {
                currentFichaIndex++;
            } else if (i.customId === "viewHabilidades") {
                viewMode = 'habilidades';
                currentHabilidadeIndex = 0;
            }
        } else if (viewMode === 'habilidades') {
            if (i.customId === "prevHab") {
                currentHabilidadeIndex--;
            } else if (i.customId === "nextHab") {
                currentHabilidadeIndex++;
            } else if (i.customId === "voltarFicha") {
                viewMode = 'ficha';
            }
        }

        // Atualiza a mensagem com base no modo de visualização
        if (viewMode === 'ficha') {
            await i.update({
                embeds: [getFichaEmbed(fichas[currentFichaIndex])],
                components: [getButtons(currentFichaIndex === 0, currentFichaIndex === pages - 1)],
            });
        } else { // viewMode === 'habilidades'
            const fichaAtual = fichas[currentFichaIndex];
            const totalHabilidades = fichaAtual.habilidades.length;
            await i.update({
                embeds: [getHabilidadeEmbed(fichaAtual.habilidades[currentHabilidadeIndex], fichaAtual)],
                components: [getNavButtons(currentHabilidadeIndex === 0, currentHabilidadeIndex === totalHabilidades - 1)],
            });
        }
      });

      collector.on("end", () => {
        message
          .edit({
            components: [],
          })
          .catch(() => {});
      });
    } catch (err) {
      console.error("Erro ao visualizar fichas:", err);
      return interaction.editReply({
        content: "Ocorreu um erro ao exibir a ficha!",
        flags: 64,
      });
    }
  }
  /* #endregion */
};
