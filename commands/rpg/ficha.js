const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  StringSelectMenuComponent,
  StringSelectMenuBuilder,
} = require("discord.js");
const fetch = require("node-fetch");
const Command = require("../../structures/Command");
const color = require("../../api/colors.json");

function splitDescription(text, maxLength = 2000) {
  const parts = [];
  if (!text) return parts;

  let currentChunk = text;
  while (currentChunk.length > 0) {
    if (currentChunk.length <= maxLength) {
      parts.push(currentChunk);
      break;
    }

    let splitIndex = currentChunk.lastIndexOf("\n\n", maxLength);
    if (splitIndex === -1) splitIndex = currentChunk.lastIndexOf("\n", maxLength);
    if (splitIndex === -1) splitIndex = currentChunk.lastIndexOf(" ", maxLength);
    if (splitIndex === -1) splitIndex = maxLength;

    parts.push(currentChunk.substring(0, splitIndex));
    currentChunk = currentChunk.substring(splitIndex).trim();
  }
  return parts;
}

module.exports = class ficha extends Command {
  constructor(client) {
    super(client, {
      name: "ficha",
      category: "rpg",
      aliases: ["f", "criarficha", "registrar", "novopersonagem"],
      UserPermission: [""],
      clientPermission: null,
      OnlyDevs: false, // Mudei para false para permitir uso geral
      slash: true,
      description: "Gerencia fichas de personagem",
    });

    /* #region  CONFIG SLASH */
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
        .addSubcommand(
          (sub) =>
            sub
              .setName("habilidade")
              .setDescription("Adiciona uma habilidade à ficha")
          // A categoria será solicitada no formulário
        );
    }
    /* #endregion */
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
      await interaction.reply({
        content:
          "Iniciando criação de ficha... Responda às perguntas a seguir no chat.",
        flags: 64,
      });

      const channel = interaction.channel;
      const author = interaction.user;

      const questions = [
        "Qual o nome do personagem?",
        "Qual a raça do personagem? (Verifique as raças disponíveis no sistema do RPG)",
        "Qual o reino de origem do personagem? (Elysium, Ozark, Minerva, etc.)",
        "Qual a aparência do personagem? (Você pode enviar um texto ou um arquivo .txt com 'Nome da Aparência, Universo de Origem')",
      ];

      const answers = [];

      for (const question of questions) {
        const questionMsg = await interaction.followUp({
          content: question,
          flags: 64,
        });

        const collector = channel.createMessageCollector({
          filter: (m) => m.author.id === author.id,
          time: 300000, // 5 minutos
          max: 1,
        });

        const collected = await new Promise((resolve) => {
          collector.on("collect", (m) => resolve(m));
          collector.on("end", (collected) => {
            if (collected.size === 0) resolve(null);
          });
        });

        if (!collected) {
          await interaction.followUp({
            content: "Tempo esgotado. Processo de criação de ficha cancelado.",
            flags: 64,
          });
          return;
        }

        let answer = collected.content;
        const attachment = collected.attachments.first();

        if (question.includes("aparência") && !answer && attachment) {
          if (attachment.contentType?.startsWith("text/plain")) {
            try {
              const response = await fetch(attachment.url);
              if (!response.ok) throw new Error("Falha ao buscar anexo.");
              answer = await response.text();
            } catch (error) {
              console.error("Erro ao processar anexo na criação de ficha:", error);
              await interaction.followUp({
                content: "Ocorreu um erro ao ler o arquivo. Tente novamente.",
                flags: 64,
              });
              return;
            }
          }
        }

        answers.push(answer);
        await collected.delete().catch(() => {});
        await questionMsg.delete().catch(() => {});
      }

      const [nome, raca, reino, aparencia] = answers;

      const existingFicha = await this.client.database.Ficha.findOne({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        nome: nome,
      });

      if (existingFicha) {
        return interaction.followUp({
          content: "❌ Você já possui um personagem com este nome!",
          flags: 64,
        });
      }

      await this.client.database.Ficha.create({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        nome,
        raca,
        reino,
        aparencia,
        habilidades: [],
      });

      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("✅ Ficha Criada!")
        .setDescription(`A ficha para **${nome}** foi criada com sucesso!`);

      await interaction.followUp({ embeds: [embed], flags: 64 });
    } catch (err) {
      console.error("Erro ao criar ficha:", err);
      await interaction.followUp({
        content: `Ocorreu um erro ao abrir o formulário! Erro: \`${err.message}\`.`,
        flags: 64,
      });
    }
  }

  async handleHabilidadeAdd(interaction) {
    const fichasDoUsuario = await this.client.database.Ficha.find({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });

    if (!fichasDoUsuario.length) { //se não tem fichas
      return interaction.reply({
        content: "❌ Você não tem fichas registradas, precisa criar uma ficha primeiro com `/ficha criar`.",
        flags: 64,
      });
    }

    if (fichasDoUsuario.length > 1) {
      const options = fichasDoUsuario.map((ficha) => ({
        label: ficha.nome,
        description: `Raça: ${ficha.raca} | Reino: ${ficha.reino}`,
        value: ficha._id.toString(),
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_ficha_habilidade_add")
        .setPlaceholder("Selecione o personagem para adicionar a habilidade")
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const response = await interaction.reply({
        content: "Para qual personagem você quer adicionar esta habilidade?",
        components: [row],
        flags: 64,
      });
      const msg = await response.fetch();

      const collector = msg.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          i.customId === "select_ficha_habilidade_add",
        time: 6000000,
      });

      collector.on("collect", async (i) => {
        const fichaId = i.values[0];
        await this.collectHabilidadeInfo(i, fichaId);
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          interaction
            .editReply({ content: "Tempo esgotado.", components: [] })
            .catch(() => {});
        }
      });
    } else {
      // Se tem apenas uma ficha, usa ela diretamente
      const fichaId = fichasDoUsuario[0]._id.toString();
      await this.collectHabilidadeInfo(interaction, fichaId);
    }
  }

  async collectHabilidadeInfo(interaction, fichaId) {
    if (interaction.isStringSelectMenu()) {
      await interaction.deferUpdate();
    } else {
      await interaction.reply({ content: "Iniciando adição de habilidade...", flags: 64 });
    }

    const channel = interaction.channel;
    const author = interaction.user;

    const questions = [
      "Qual o nome da habilidade?",
      "Qual a categoria da habilidade? (Física, Mágica, Passiva, Haki, Aura de Combate, Sagrada, Demoníaca, Outros (diga qual))",
      "Qual a descrição da habilidade?",
    ];

    const answers = [];

    for (const question of questions) {
      const questionMsg = await interaction.followUp({ content: question, flags: 64 });

      const collector = channel.createMessageCollector({
        filter: (m) => m.author.id === author.id,
        time: 300000, // 5 minutes
        max: 1,
      });

      const collected = await new Promise((resolve) => {
        collector.on("collect", (m) => resolve(m));
        collector.on("end", (collected) => {
          if (collected.size === 0) resolve(null);
        });
      });

      if (!collected) {
        await interaction.followUp({ content: "Tempo esgotado. Processo cancelado.", flags: 64 });
        return;
      }

      let answer = collected.content;
      const attachment = collected.attachments.first();

      if (question.includes("descrição") && !answer && attachment) {
        if (attachment.contentType?.startsWith("text/plain")) {
          try {
            const response = await fetch(attachment.url);
            if (!response.ok) throw new Error("Falha ao buscar anexo.");
            answer = await response.text();
          } catch (error) {
            console.error("Erro ao processar anexo na adição de habilidade:", error);
            await interaction.followUp({ content: "Ocorreu um erro ao ler o arquivo. Tente novamente.", flags: 64 });
            return;
          }
        }
      }

      answers.push(answer);
      await collected.delete().catch(() => {});
      await questionMsg.delete().catch(() => {});
    }

    const [nome, categoria, descricao] = answers;

    const ficha = await this.client.database.Ficha.findById(fichaId);
    if (!ficha) {
      return interaction.followUp({ content: "Erro: A ficha selecionada não foi encontrada.", flags: 64 });
    }

    ficha.habilidades.push({ nome, descricao, categoria, subHabilidades: [] });
    await ficha.save();

    const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("✅ Habilidade Adicionada!")
        .setDescription(`Habilidade **${nome}** adicionada à ficha de **${ficha.nome}**.`);

    const components = []; // Renomeado para evitar conflito
    let summarizeButton;
    if (descricao.length > 4000) {
        // O ID da habilidade é gerado pelo Mongoose no array
        const habilidadeId = ficha.habilidades[ficha.habilidades.length - 1]._id;
        summarizeButton = new ButtonBuilder()
            .setCustomId(`summarize_${ficha._id}_${habilidadeId}`)
            .setLabel("Resumir Descrição (Excede 4000 caracteres)")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(summarizeButton);
        components.push(row);
    }

    const followUpMessage = await interaction.followUp({ embeds: [embed], components: components, flags: 64, fetchReply: true });

    // Adiciona um coletor para o botão de resumo, se ele existir
    if (summarizeButton) {
      const buttonCollector = followUpMessage.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId.startsWith('summarize_'),
        time: 300000 // 5 minutos para clicar
      });

      buttonCollector.on('collect', async i => {
        buttonCollector.stop(); // Para o coletor inicial, pois a interação continuará em um novo coletor
        await i.deferReply({ flags: 64 }); // Responde de forma efêmera para o menu de opções
        const [_, fichaId, habilidadeId] = i.customId.split('_');

        try {
          const ficha = await this.client.database.Ficha.findById(fichaId);
          const habilidade = ficha.habilidades.id(habilidadeId);
          if (!habilidade) {
            return i.editReply({ content: "Habilidade não encontrada." });
          }
          const originalDescription = habilidade.descricao;

          await i.editReply({ content: "Resumindo a habilidade com a IA... 🤖" });
          const { summarizeText } = require("../../api/resumir.js");
          let summarizedDesc = await summarizeText(originalDescription);

          const createComponents = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`confirm_summary_${fichaId}_${habilidadeId}`).setLabel("Confirmar").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`resummarize_again_${fichaId}_${habilidadeId}`).setLabel("Resumir Novamente").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('cancel_summary').setLabel("Cancelar").setStyle(ButtonStyle.Danger)
          );

          const createEmbed = (text) => new EmbedBuilder()
            .setTitle("📝 Proposta de Resumo")
            .setDescription(text.substring(0, 4096))
            .setColor("Blue")
            .setFooter({ text: "Escolha uma opção abaixo." });

          const summaryMessage = await i.editReply({
            content: "Aqui está o resumo gerado:",
            embeds: [createEmbed(summarizedDesc)],
            components: [createComponents()]
          });

          const optionsCollector = summaryMessage.createMessageComponentCollector({
            filter: (btn) => btn.user.id === i.user.id,
            time: 300000 // 5 minutos
          });

          optionsCollector.on('collect', async (btnInteraction) => {
            const btnFichaId = btnInteraction.customId.split('_')[2];
            const btnHabilidadeId = btnInteraction.customId.split('_')[3];

            if (btnInteraction.customId.startsWith('confirm_summary_')) {
              await btnInteraction.deferUpdate();
              const fichaToUpdate = await this.client.database.Ficha.findById(btnFichaId);
              const habilidadeToUpdate = fichaToUpdate.habilidades.id(btnHabilidadeId);
              habilidadeToUpdate.descricao = summarizedDesc;
              await fichaToUpdate.save();
              await i.editReply({ content: "✅ Resumo aplicado com sucesso! Você pode vê-la usando `/ficha ver`.", embeds: [], components: [] });
              summarizeButton.setDisabled(true);
              try {
                await followUpMessage.edit({ components: [new ActionRowBuilder().addComponents(summarizeButton)] });
              } catch (editError) {
                if (editError.code === 10008) { // Unknown Message
                  console.log('A mensagem original de confirmação de habilidade foi deletada, não foi possível desabilitar o botão.');
                } else {
                  console.error('Erro ao tentar editar a mensagem de confirmação:', editError);
                }
              }
              optionsCollector.stop();
            } else if (btnInteraction.customId.startsWith('resummarize_again_')) {
              await btnInteraction.deferUpdate();
              await i.editReply({ content: "Resumindo novamente... 🤖", embeds: [], components: [] });
              summarizedDesc = await summarizeText(originalDescription);
              await i.editReply({
                content: "Aqui está o novo resumo:",
                embeds: [createEmbed(summarizedDesc)],
                components: [createComponents()]
              });
            } else if (btnInteraction.customId === 'cancel_summary') {
              await btnInteraction.deferUpdate();
              await i.editReply({ content: "Operação cancelada.", embeds: [], components: [] });
              optionsCollector.stop();
            }
          });

          optionsCollector.on('end', async (collected, reason) => {
            if (reason === 'time') {
              await i.editReply({ content: "Tempo esgotado.", embeds: [], components: [] }).catch(() => {});
            }
          });
        } catch (error) {
          console.error("Erro ao resumir habilidade (criação):", error);
          await i.editReply({ content: "Ocorreu um erro ao tentar resumir a habilidade." }).catch(() => {});
        }
      });
    }
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

    const response = await interaction.reply({
      content: "Qual ficha você gostaria de ver?",
      components: [row],
      flags: 64,
    });
    const msg = await response.fetch();

    const collector = msg.createMessageComponentCollector({
      filter: (i) =>
        i.user.id === interaction.user.id && i.customId === "select_ficha_view",
      time: 6000000, // 1 minuto
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

  // visualizador de fichas
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
      let currentFichaIndex = fichas.findIndex(
        (f) => f._id.toString() === fichaId.toString()
      );
      const pages = fichas.length;

      let viewMode = "ficha"; // 'ficha' ou 'habilidades'
      let currentHabilidadeIndex = 0;
      let currentDescPageIndex = 0;

      const categoryIcons = {
        fisica: "⚔️",
        magica: "✨",
        passiva: "🛡️",
        haki: "👑",
        sagrada: "🕊️",
        demoniaca: "😈",
        "aura de combate": "🔥",
        outros: "📁",
      };

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

      const getHabilidadeEmbed = (habilidade, ficha, descPageIndex = 0) => {
        if (!habilidade) {
          return {
            embed: new EmbedBuilder()
              .setColor("Red")
              .setTitle("Erro de Visualização")
              .setDescription(
                "Não foi possível carregar os detalhes da habilidade. Tente novamente."
              ),
            components: [],
          };
        }

        const categorySkills = ficha.habilidades.filter(s => (s.categoria.toLowerCase() || "outros") === (habilidade.categoria.toLowerCase() || "outros"));
        const totalHabilidadesNaCategoria = categorySkills.length;

        const embed = new EmbedBuilder()
          .setColor("Purple")
          .setTitle(`🔮 Habilidade: ${habilidade.nome}`)
          .addFields(
            { name: "Categoria", value: habilidade.categoria, inline: true }
          )

        const MAX_DESC_LENGTH = 2000; // Reduzido para uma paginação mais agradável
        const MAX_FIELD_LENGTH = 1024;
        let extraComponents = [];
        let descriptionPages = [];

        // Truncate long description to prevent crash
        if (habilidade.descricao) {
          if (habilidade.descricao.length > 4000) {
            const summarizeButton = new ButtonBuilder()
              .setCustomId(`summarize_${ficha._id}_${habilidade._id}`)
              .setLabel("Resumir Descrição")
              .setStyle(ButtonStyle.Success);

            const actionRow = new ActionRowBuilder().addComponents(summarizeButton);
            extraComponents.push(actionRow);
          }

          if (habilidade.descricao.length <= MAX_DESC_LENGTH) {
            embed.setDescription(habilidade.descricao);
          } else {
            descriptionPages = splitDescription(habilidade.descricao, MAX_DESC_LENGTH);
            embed.setDescription(descriptionPages[descPageIndex]);

            const descNavButtons = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('prev_desc_page')
                .setLabel('◀ Descrição')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(descPageIndex === 0),
              new ButtonBuilder()
                .setCustomId('next_desc_page')
                .setLabel('Descrição ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(descPageIndex >= descriptionPages.length - 1)
            );
            extraComponents.push(descNavButtons);
          }
        }

        const footerParts = [
          `Habilidade ${habilidade.categoria} ${currentHabilidadeIndex + 1}/${totalHabilidadesNaCategoria}`
        ];
        if (descriptionPages.length > 0) {
          embed.setTitle(`🔮 Habilidade: ${habilidade.nome} - DESCRIÇÃO DIVIDIDA`);
          footerParts.push(`Descrição - parte ${descPageIndex + 1}/${descriptionPages.length}`);
        }
        embed.setFooter({ text: footerParts.join(' | ') });

        if (habilidade.subHabilidades && habilidade.subHabilidades.length > 0) {
          const subFields = habilidade.subHabilidades.map((sub) => ({
            name: `Sub-habilidade: ${sub.nome}`,
            value: sub.descricao.length > MAX_FIELD_LENGTH ? `${sub.descricao.substring(0, MAX_FIELD_LENGTH - 4)}...` : sub.descricao,
            inline: false,
          }));

          if ((embed.data.fields?.length ?? 0) + subFields.length <= 25) {
            embed.addFields(subFields);
          }
        }

        return { embed, components: extraComponents };
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
            .setDisabled(!fichas[currentFichaIndex].habilidades.length),
          new ButtonBuilder()
            .setCustomId("addHabilidadeFicha")
            .setLabel("Adicionar Habilidade")
            .setStyle(ButtonStyle.Success)
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
        components: [
          getButtons(currentFichaIndex === 0, currentFichaIndex === pages - 1),
        ],
        flags: 64,
      });

      // Cria coletor de botões
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 6000000,
        idle: 60000,
      });

      collector.on("collect", async (i) => {
        if (i.customId.startsWith("summarize_")) {
          await i.deferReply({ flags: 64 });
          const [_, fichaId, habilidadeId] = i.customId.split("_");

          try {
            const ficha = await this.client.database.Ficha.findById(fichaId);
            const habilidade = ficha.habilidades.id(habilidadeId);
            if (!habilidade) {
              return i.editReply({ content: "Habilidade não encontrada." });
            }
            const originalDescription = habilidade.descricao;

            await i.editReply({ content: "Resumindo a habilidade com a IA... 🤖" });
            const { summarizeText } = require("../../api/resumir.js");
            let summarizedDesc = await summarizeText(originalDescription);

            const createComponents = () => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`confirm_summary_${fichaId}_${habilidadeId}`).setLabel("Confirmar").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`resummarize_again_${fichaId}_${habilidadeId}`).setLabel("Resumir Novamente").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('cancel_summary').setLabel("Cancelar").setStyle(ButtonStyle.Danger)
            );

            const createEmbed = (text) => new EmbedBuilder()
                .setTitle("📝 Proposta de Resumo")
                .setDescription(text.substring(0, 4096))
                .setColor("Blue")
                .setFooter({ text: "Escolha uma opção abaixo." });

            const summaryMessage = await i.editReply({
                content: "Aqui está o resumo gerado:",
                embeds: [createEmbed(summarizedDesc)],
                components: [createComponents()]
            });

            const optionsCollector = summaryMessage.createMessageComponentCollector({
                filter: (btn) => btn.user.id === i.user.id,
                time: 300000 // 5 minutes
            });

            optionsCollector.on('collect', async (btnInteraction) => {
              const btnFichaId = btnInteraction.customId.split('_')[2];
              const btnHabilidadeId = btnInteraction.customId.split('_')[3];

              if (btnInteraction.customId.startsWith('confirm_summary_')) {
                  await btnInteraction.deferUpdate();
                  const fichaToUpdate = await this.client.database.Ficha.findById(btnFichaId);
                  const habilidadeToUpdate = fichaToUpdate.habilidades.id(btnHabilidadeId);
                  habilidadeToUpdate.descricao = summarizedDesc;
                  await fichaToUpdate.save();

                  viewMode = `habilidade_categoria_${habilidadeToUpdate.categoria.toLowerCase()}`;
                  currentDescPageIndex = 0;
                  const { embed: newHabilidadeEmbed, components: newComponents } = getHabilidadeEmbed(habilidadeToUpdate, fichaToUpdate, 0);
                  
                  // Atualiza a mensagem pública original
                  await message.edit({
                    embeds: [newHabilidadeEmbed],
                    components: [getNavButtons(currentHabilidadeIndex === 0, currentHabilidadeIndex >= fichaToUpdate.habilidades.filter(s => s.categoria.toLowerCase() === habilidadeToUpdate.categoria.toLowerCase()).length - 1), ...newComponents],
                  });

                  await i.editReply({ content: "✅ Resumo aplicado com sucesso!", embeds: [], components: [] });
                  optionsCollector.stop();
              } else if (btnInteraction.customId.startsWith('resummarize_again_')) {
                  await btnInteraction.deferUpdate();
                  await i.editReply({ content: "Resumindo novamente... 🤖", embeds: [], components: [] });
                  summarizedDesc = await summarizeText(originalDescription);
                  await i.editReply({ content: "Aqui está o novo resumo:", embeds: [createEmbed(summarizedDesc)], components: [createComponents()] });
              } else if (btnInteraction.customId === 'cancel_summary') {
                  await btnInteraction.deferUpdate();
                  await i.editReply({ content: "Operação cancelada.", embeds: [], components: [] });
                  optionsCollector.stop();
              }
            });

            optionsCollector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await i.editReply({ content: "Tempo esgotado.", embeds: [], components: [] }).catch(() => {});
                }
            });
          } catch (error) {
            console.error("Erro ao resumir:", error);
            await i.followUp({ content: "Ocorreu um erro ao tentar resumir a habilidade.", ephemeral: true });
          }
          return;
        }

        if (viewMode === "ficha") {
          if (i.customId === "prevPage") {
            currentFichaIndex--;
          } else if (i.customId === "nextPage") {
            currentFichaIndex++;
          } else if (i.customId === "viewHabilidades") {
            viewMode = "habilidades";
            currentHabilidadeIndex = 0;
            currentDescPageIndex = 0;
          } else if (i.customId === "addHabilidadeFicha") {
            const fichaAtual = fichas[currentFichaIndex];
            await this.collectHabilidadeInfo(i, fichaAtual._id.toString());
            return; // Impede a atualização da mensagem, pois um modal foi aberto
          }
        } else if (viewMode === "habilidades") {
          if (i.customId.startsWith("view_category_")) {
            const category = i.customId.substring("view_category_".length);
            viewMode = `habilidade_categoria_${category}`;
            currentHabilidadeIndex = 0;
            currentDescPageIndex = 0;
          } else if (i.customId === "voltarFicha") {
            viewMode = "ficha";
          }
        } else if (viewMode.startsWith("habilidade_categoria_")) {
          if (i.customId === "prevHab") {
            currentHabilidadeIndex--;
            currentDescPageIndex = 0;
          } else if (i.customId === "nextHab") {
            currentHabilidadeIndex++;
            currentDescPageIndex = 0;
          } else if (i.customId === "voltarHabilidades") {
            viewMode = "habilidades";
            currentHabilidadeIndex = 0;
            currentDescPageIndex = 0;
          } else if (i.customId === 'prev_desc_page') {
            if (currentDescPageIndex > 0) currentDescPageIndex--;
          } else if (i.customId === 'next_desc_page') {
            currentDescPageIndex++;
          }
        }

        // Atualiza a mensagem com base no modo de visualização
        try {
          if (viewMode === "ficha") {
            await i.update({
              embeds: [getFichaEmbed(fichas[currentFichaIndex])],
              components: [
                getButtons(
                  currentFichaIndex === 0,
                  currentFichaIndex === pages - 1
                ),
              ],
            });
          } else if (viewMode === "habilidades") {
            const fichaAtual = fichas[currentFichaIndex];
            const skillsByCategory = fichaAtual.habilidades.reduce(
              (acc, skill) => {
                const category = skill.categoria.toLowerCase() || "outros";
                if (!acc[category]) acc[category] = [];
                acc[category].push(skill);
                return acc;
              },
              {}
            );

            const categoryButtons = Object.keys(skillsByCategory).map(
              (category) =>
                new ButtonBuilder()
                  .setCustomId(`view_category_${category}`)
                  .setLabel(
                    category.charAt(0).toUpperCase() + category.slice(1)
                  )
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji(categoryIcons[category] || "📁")
            );

            const legendDescription = Object.keys(skillsByCategory)
              .map(
                (cat) =>
                  `${categoryIcons[cat] || "📁"} **${
                    cat.charAt(0).toUpperCase() + cat.slice(1)
                  }**`
              )
              .join("\n");

            const legendEmbed = new EmbedBuilder()
              .setColor("Greyple")
              .setTitle("Categorias de Habilidades")
              .setDescription(
                legendDescription || "Nenhuma habilidade para mostrar."
              );

            const rows = [];
            for (let i = 0; i < categoryButtons.length; i += 5) {
              rows.push(
                new ActionRowBuilder().addComponents(
                  categoryButtons.slice(i, i + 5)
                )
              );
            }
            rows.push(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("voltarFicha")
                  .setLabel("Voltar para a Ficha")
                  .setStyle(ButtonStyle.Danger)
              )
            );

            await i.update({
              embeds: [legendEmbed],
              components: rows,
            });
          } else if (viewMode.startsWith("habilidade_categoria_")) {
            const fichaAtual = fichas[currentFichaIndex];
            const currentCategory = viewMode.substring("habilidade_categoria_".length);
            const categorySkills = fichaAtual.habilidades.filter(
              (s) => (s.categoria.toLowerCase() || "outros") === currentCategory
            );
            const totalHabilidades = categorySkills.length;

            const navButtons = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("prevHab")
                .setLabel("◀️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentHabilidadeIndex === 0),
              new ButtonBuilder()
                .setCustomId("voltarHabilidades")
                .setLabel("Voltar às Categorias")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId("nextHab")
                .setLabel("▶️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentHabilidadeIndex >= totalHabilidades - 1)
            );

            const { embed: habilidadeEmbed, components: extraComponents } = getHabilidadeEmbed(categorySkills[currentHabilidadeIndex], fichaAtual, currentDescPageIndex);

            await i.update({
              embeds: [habilidadeEmbed],
              components: [navButtons, ...extraComponents],
            });
          }
        } catch (error) {
          // Ignora erros de interação já respondida que podem ocorrer se um modal foi aberto
          if (error.code !== "InteractionAlreadyReplied") {
            console.error("Erro ao atualizar interação no coletor:", error);
          }
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
