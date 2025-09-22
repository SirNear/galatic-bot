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
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_sub_habilidades')
      .setPlaceholder('Quantas sub-habilidades você quer adicionar?')
      .addOptions([
        { label: 'Nenhuma', value: '0' },
        { label: '1 Sub-habilidade', value: '1' },
        { label: '2 Sub-habilidades', value: '2' },
        { label: '3 Sub-habilidades', value: '3' },
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const msg = await interaction.reply({
      content: 'Selecione o número de sub-habilidades para a nova habilidade.',
      components: [row],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id && i.customId === 'select_sub_habilidades',
      time: 60000,
    });

    collector.on('collect', async i => {
      const numSubHabilidades = parseInt(i.values[0], 10);
      const categoria = interaction.options.getString("categoria");

      const modal = new ModalBuilder()
        .setCustomId(`habilidade_${categoria}`)
        .setTitle(`Nova Habilidade: ${categoria.charAt(0).toUpperCase() + categoria.slice(1)}`);

      const nomeInput = new TextInputBuilder()
        .setCustomId("nomeHabilidade")
        .setLabel("Nome da Habilidade")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const descricaoInput = new TextInputBuilder()
        .setCustomId("descricaoHabilidade")
        .setLabel("Descrição (max 1000 caracteres)")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(nomeInput), new ActionRowBuilder().addComponents(descricaoInput));

      for (let j = 1; j <= numSubHabilidades; j++) {
        const subHabilidadeInput = new TextInputBuilder()
          .setCustomId(`subHabilidade${j}`)
          .setLabel(`Sub-habilidade ${j}`)
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(subHabilidadeInput));
      }

      await i.showModal(modal);
      collector.stop();
    });

    collector.on('end', (collected, reason) => {
      if (collected.size === 0) {
        interaction.editReply({ content: 'Tempo esgotado.', components: [] }).catch(() => {});
      } else {
        interaction.editReply({ content: 'Modal aberto!', components: [] }).catch(() => {});
      }
    });
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
    await interaction.deferUpdate();

    try {
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
      let currentPage = fichas.findIndex((f) => f._id.toString() === fichaId.toString());
      const pages = fichas.length;

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
          .setFooter({ text: `Página ${currentPage + 1} de ${pages}` });

        return embed;
      };

      // Botões de navegação
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
            .setDisabled(!fichas[currentPage].habilidades.length)
        );
      };

      // Envia mensagem inicial
      const message = await interaction.editReply({
        // Usa editReply na interação original do select
        embeds: [getFichaEmbed(fichas[currentPage])],
        components: [getButtons(currentPage === 0, currentPage === pages - 1)],
        flags: 64,
      });

      // Cria coletor de botões
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 300000, // 5 minutos
      });

      collector.on("collect", async (i) => {
        await i.deferUpdate();

        if (i.customId === "prevPage") {
          currentPage--;
        } else if (i.customId === "nextPage") {
          currentPage++;
        } else if (i.customId === "viewHabilidades") {
          // Mostra habilidades em um modal ou embed separado
          return this.showHabilidades(i, fichas[currentPage]);
        }

        await message.edit({
          embeds: [getFichaEmbed(fichas[currentPage])],
          components: [
            getButtons(currentPage === 0, currentPage === pages - 1),
          ],
        });
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

  // Método para mostrar habilidades
  async showHabilidades(interaction, ficha) {
    const habilidades = ficha.habilidades;
    if (!habilidades.length) return;
    let currentPage = 0;
    const pages = Math.ceil(habilidades.length / 1);

    const getHabilidadeEmbed = (habilidade) => {
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
        .setFooter({ text: `Habilidade ${currentPage + 1} de ${pages}` });
    };

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

    await interaction.editReply({
      embeds: [getHabilidadeEmbed(habilidades[currentPage])],
      components: [getNavButtons(currentPage === 0, currentPage === pages - 1)],
    });

    const collector = interaction.message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 300000,
      idle: 60000, // 1 minuto de inatividade
    });

    collector.on("collect", async (i) => {
      if (i.customId === "prevHab") {
        currentPage--;
      } else if (i.customId === "nextHab") {
        currentPage++;
      } else if (i.customId === "voltarFicha") {
        collector.stop("back");
        return this.showFicha(i, ficha._id);
      }

      await i.update({
        embeds: [getHabilidadeEmbed(habilidades[currentPage])],
        components: [
          getNavButtons(currentPage === 0, currentPage === pages - 1),
        ],
      });
    });
  }
  /* #endregion */
};
