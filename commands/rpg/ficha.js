const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  StringSelectMenuComponent,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const fetch = require("node-fetch"); 
const Command = require("../../structures/Command");
const color = require("../../api/colors.json");
const { summarizeText } = require("../../api/resumir.js");
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
        .setName("ficha")
        .setDescription(this.config.description)
        /* #region  OPÇÕES DE COMANDOS /ficha {ver, habilidade ou criar} */
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
        );
      /* #endregion */
    }
    /* #endregion */
  }
  // #region FUNÇÕES ARMAZENAR APARÊNCIA, COLETAR RESPOSTA, CONFIRMAR BOTÃO, MOSTRAR FORMULARIO

  async coletarResposta(interaction, pergunta) {
    const channel = interaction.channel;
    const author = interaction.user;

    const perguntaMsg = await interaction.followUp({ //envia msgBotao para cada pergunta
      content: pergunta,
      fetchReply: true, // fetchReply está obsoleto, mas mantido por enquanto.
      flags: 64,
    });

    const coletorResposta = channel.createMessageCollector({ //coletor da perguntaMsg
      filter: (m) => m.author.id === author.id,
      time: 300000, // 5 minutos
      max: 1,
    });

    const collected = await new Promise((resolve) => {
      coletorResposta.on("collect", (m) => resolve(m));
      coletorResposta.on("end", (c) => {
        if (c.size === 0) resolve(null);
      });
    });

    await perguntaMsg.delete().catch(() => {});

    if (!collected) {
      await interaction.followUp({
        content: "<:berror:1406837900556898304> | **Tempo esgotado.** Operação cancelada.",
        flags: 64,
      });
      return null;
    }

    const resposta = collected.content;
    const attachment = collected.attachments.first();

    await collected.delete().catch(() => {});

    return { resposta, attachment };
  }

  async armazemAparencia(interaction, fichaNome) {
    const resposta = await this.coletarResposta(interaction, "Envie a imagem agora.");
    const attachment = resposta.attachment;
    const canalArmazenamento = await this.client.channels.fetch('1094070734151766026').catch(() => null);

/* #region  DEBUG */
    if (!resposta || !resposta.attachment || !resposta.attachment.contentType?.startsWith("image/")) { //se não tem imagem ou se for arquvio, segue sem img
      await interaction.followUp({ content: "Nenhuma imagem válida foi enviada. Continuando sem imagem.", flags: 64 });
      return null;
    }

    if (!canalArmazenamento || !canalArmazenamento.isTextBased()) {
      console.error(`Canal de armazenamento (ID: ${canalArmazenamentoId}) inválido ou não encontrado.`);
      await interaction.followUp({ content: "❌ Erro de configuração: O canal de armazenamento de imagens não foi encontrado.", flags: 64 });
      return null;
    }
/* #endregion */
    
  //backend
    try {
      const embedAparencia = new EmbedBuilder()
        .setColor(color.dblue)
        .setTitle("<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109>")
        .setFooter({ text: `Aparência para a ficha de ${fichaNome || "Nome não definido"}` })
        .setImage(attachment.url);

      const sentMessage = await canalArmazenamento.send({ embeds: [embedAparencia]});

      if (!attachment.url) throw new Error("A URL do anexo não foi encontrada após o envio.");

      await sentMessage.edit({ embeds: [embedAparencia] });
      return attachment.url;
    } catch (e) {
      console.error(`Erro ao enviar imagem para o canal de armazenamento (ID: ${canalArmazenamentoId}):`, e);
      await interaction.followUp({ content: "❌ Ocorreu um erro ao salvar a imagem. Contate um administrador.", flags: 64 });
      return null;
    }
  }

  async formulario(interaction, modal, timeout = 1800000) {
    await interaction.showModal(modal); //exibir formulário

    try {
      const formEnviado = await interaction.awaitModalSubmit({
        filter: i => i.user.id === interaction.user.id && i.customId === modal.data.custom_id,
        time: timeout,
      });
      return formEnviado; //retorna respostas do form

    } catch (err) {
      if (err.code === 'InteractionCollectorError') {
        // O tempo esgotou, não precisa notificar o usuário pois o modal some.
      } else {
        console.error("Erro ao aguardar modal:", err);
      }
      return null;
    }
  }

  async botaoConfirma(interaction, mensagemPergunta, customLabelButtomY, customLabelButtomN, msgPersonalizadaUpdt) {
    const botoesRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('botaoConfirmaId').setLabel(customLabelButtomY).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('botaoNegaId').setLabel(customLabelButtomN).setStyle(ButtonStyle.Danger)
    );

    const msgBotao = await interaction.followUp({
      content: mensagemPergunta,
      components: [botoesRow],
      ephemeral: true,
      fetchReply: true,
    });

    try {
      const btnInteraction = await msgBotao.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 60000 });
      await btnInteraction.update({ content: msgPersonalizadaUpdt, components: [] });
      return btnInteraction.customId === 'botaoConfirmaId';
    } catch (e) {
      await msgBotao.edit({ content: "Tempo esgotado. Continuando...", components: [] }).catch(() => {});
      return false;
    }
  }

  async splitDescription(text, maxLength = 2000) {
  const parts = [];
  if (!text) return parts;

  let currentChunk = text;
  while (currentChunk.length > 0) {
    if (currentChunk.length <= maxLength) {
      parts.push(currentChunk);
      break;
    }

    let splitIndex = currentChunk.lastIndexOf("\n\n", maxLength);
    if (splitIndex === -1)
      splitIndex = currentChunk.lastIndexOf("\n", maxLength);
    if (splitIndex === -1)
      splitIndex = currentChunk.lastIndexOf(" ", maxLength);
    if (splitIndex === -1) splitIndex = maxLength;

    parts.push(currentChunk.substring(0, splitIndex));
    currentChunk = currentChunk.substring(splitIndex).trim();
  }
  return parts;
  }

  // #endregion


  /* #region  BACK-END */

  /* #region  CRIAÇÃO DE FICHA */
  
  async backFichaCriar(interaction) {
    try { 
      await interaction.deferReply({ ephemeral: true });
      await interaction.editReply({
        content:
          "<:cpnews:1411060646019338406> | **Iniciando criação de ficha...** Responda as perguntas a seguir:",
      });

      /* #region  CONFIGURAÇÕES */
      const channel = interaction.channel;
      const author = interaction.user;

      const perguntas = [
        "Qual o nome do personagem?",
        "Qual a raça do personagem? (Verifique as raças disponíveis no [sistema do RPG](https://discord.com/channels/731974689798488185/1142949580779032636))",
        "Qual o reino de origem do personagem? (Elysium, Ozark, Minerva, etc.)",
        "Qual a aparência do personagem? (Você pode enviar um texto ou um arquivo .txt com 'Nome da Aparência, Universo de Origem')",
      ];
      
      const camposFicha = [
        "nome",
        "raca",
        "reino",
        "aparencia" 
      ];

      const fichaData = {};

      /* #endregion */

      /* #region  BACK LOGICA DE SALVAMENTO */
      if (fichaData.aparencia && !fichaData.imagemURL) {
        const querImagem = await this.botaoConfirma(interaction, "Deseja enviar uma imagem para a aparência?", "Sim", "Não", "Iniciando coleta de imagem...");
        if (querImagem) {
          const url = await this.armazemAparencia(interaction, fichaData.nome); 
        }

        for (let i = 0; i < perguntas.length; i++) {
          const pergunta = perguntas[i];
          const respostaColetada = await this.coletarResposta(interaction, pergunta);

          if (!respostaColetada) return

          let { resposta, attachment } = respostaColetada;

          // Lógica para a pergunta da aparência
          if (pergunta.includes("aparência") && !resposta && attachment) {
            if (attachment.contentType?.startsWith("text/plain")) {
              try {
                const response = await fetch(attachment.url);
                if (!response.ok) throw new Error("Falha ao buscar anexo.");
                resposta = await response.text();
              } catch (error) {
                console.error("Erro ao processar anexo na criação de ficha:", error);
                await interaction.followUp({ content: "Ocorreu um erro ao ler o arquivo. Tente novamente.", flags: 64 });
                return;
              }
            }
          }

          if (i === 3) return i = url
          fichaData[camposFicha[i]] = resposta;
          
        }
      }
      /* #endregion */

      /* #region  SE JÁ HOUVER UMA FICHA DAQUELE PERSONAGEM */
      const fichaExistente = await this.client.database.Ficha.findOne({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        nome: fichaData.nome,
      });

      if (fichaExistente) {
        return interaction.followUp({
          content: "❌ Você já possui um personagem com este nome!",
          ephemeral: true,
        });
      }
      /* #endregion */

      // CRIAÇÃO DA FICHA EM DATABASE
      await this.client.database.Ficha.create({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        nome: fichaData.nome,
        raca: fichaData.raca,
        reino: fichaData.reino,
        aparencia: fichaData.aparencia,
        imagemURL: fichaData.imagemURL,
        habilidades: [],
      });

      //EMBED CONFIRMAÇÃO DE CRIAÇÃO DE FICHA
      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("✅ Ficha Criada!")
        .setDescription(
          `A ficha para **${fichaData.nome}** foi criada com sucesso!`
        );

      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error("Erro ao criar ficha:", err);
      if (interaction.deferred || interaction.replied) {
        // evitar erros de resposta do discord
        await interaction
          .editReply({
            content: `Ocorreu um erro ao criar a ficha! Erro: \`${err.message}\`.`,
            embeds: [],
            components: [],
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: `Ocorreu um erro ao criar a ficha! Erro: \`${err.message}\`.`,
            ephemeral: true,
          })
          .catch(() => {});
      }
    }
  }

  /* #region  ADICIONAR HABILIDADE NOVA */
  async backFichaHabAdd(interaction) {
    const fichasDoUsuario = await this.client.database.Ficha.find({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });

    if (!fichasDoUsuario.length) {  // se não tem fichas

      return interaction.reply({
        content:
          "❌ Você não tem fichas registradas, precisa criar uma ficha primeiro com `/ficha criar`.",
        ephemeral: true,
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

      const botoesRow = new ActionRowBuilder().addComponents(selectMenu);

      const response = await interaction.reply({
        content: "Para qual personagem você quer adicionar esta habilidade?",
        components: [botoesRow],
        ephemeral: true,
      });
      const msgBotao = await response.fetch();

      const coletorResposta = msgBotao.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          i.customId === "select_ficha_habilidade_add",
        time: 6000000,
      });

      coletorResposta.on("collect", async (i) => {
        const fichaId = i.values[0];
        await this.backFichaUnicaHabAdd(i, fichaId);
      });

      coletorResposta.on("end", (collected) => {
        if (collected.size === 0) {
          interaction
            .editReply({ content: "Tempo esgotado.", components: [] })
            .catch(() => {});
        }
      });
    } else {
      // Se tem apenas uma ficha, usa ela diretamente
      const fichaId = fichasDoUsuario[0]._id.toString();
      await this.backFichaUnicaHabAdd(interaction, fichaId);
    }
  }

  /* #endregion */

  /* #region  ADICIONAR HABILIDADE NOVA */
  async backFichaUnicaHabAdd(interaction, fichaId) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    if (interaction.isStringSelectMenu()) await interaction.deferUpdate();

    await interaction.editReply({
      content: "Iniciando adição de habilidade...",
      embeds: [],
      components: [],
    });

    /* #region  CONFIGURAÇÃO DE COLETORES, PERGUNTAS E RESPOSTAS */
    const perguntas = [
      "Qual o nome da habilidade?",
      "Qual a categoria da habilidade? (Física, Mágica, Passiva, Haki, Aura de Combate, Sagrada, Demoníaca, Outros (diga qual))",
      "Qual o custo da habilidade? (Ex: 10 Mana, 1 de CARDIO (<:patrickconcern:1407564230256758855>), 100 de mana sagrada, etc. Deixe em branco ou digite 'nenhum' se não houver custo.)",
      "Qual a descrição da habilidade?",
    ];

    const dadosHabilidade = {};

    for (const pergunta of perguntas) {
      const respostaColetada = await this.coletarResposta(interaction, pergunta);
      if (!respostaColetada) {
        return;
      }

      let { resposta, attachment } = respostaColetada;

      if (pergunta.includes("descrição") && !resposta && attachment) {
        if (attachment.contentType?.startsWith("text/plain")) {
          try {
            const response = await fetch(attachment.url);
            if (!response.ok) throw new Error("Falha ao buscar anexo.");
            resposta = await response.text();
          } catch (error) {
            console.error("Erro ao processar anexo na adição de habilidade:", error);
            await interaction.followUp({ content: "Ocorreu um erro ao ler o arquivo. Tente novamente.", ephemeral: true });
            return;
          }
        }
      }

      if (pergunta.includes("nome")) dadosHabilidade.nome = resposta; // TODO: Corrigir, está pegando a resposta inteira
      if (pergunta.includes("categoria")) dadosHabilidade.categoria = resposta;
      if (pergunta.includes("custo")) dadosHabilidade.custo = resposta || " ";
      if (pergunta.includes("descrição")) dadosHabilidade.descricao = resposta;
    }

    const ficha = await this.client.database.Ficha.findById(fichaId);
    if (!ficha) {
      return interaction.followUp({ content: "Erro: A ficha selecionada não foi encontrada.", ephemeral: true });
    }

    // Pergunta se quer adicionar imagem para a habilidade principal
    if (await this.botaoConfirma(interaction, "Deseja adicionar uma imagem para esta habilidade?")) {
      const imageUrl = await this.armazemAparencia(interaction, ficha.nome);
      if (imageUrl) dadosHabilidade.imagemURL = imageUrl;
    }

    dadosHabilidade.subHabilidades = [];

    // Loop para adicionar sub-habilidades
    while (await this.botaoConfirma(interaction, "Deseja adicionar uma sub-habilidade?")) {
      await interaction.followUp({ content: "Iniciando adição de sub-habilidade...", ephemeral: true });
      const nomeSub = await this.coletarResposta(interaction, "Qual o nome da sub-habilidade?");
      if (!nomeSub) break;

      const descSub = await this.coletarResposta(interaction, "Qual a descrição da sub-habilidade?");
      if (!descSub) break;

      const custoSub = await this.coletarResposta(interaction, "Qual o custo da sub-habilidade? (Opcional)");

      const dadosSubHabilidade = {
        nome: nomeSub.resposta,
        descricao: descSub.resposta,
        custo: custoSub ? custoSub.resposta : "Nenhum",
      };

      if (await this.botaoConfirma(interaction, "Deseja adicionar uma imagem para esta sub-habilidade?")) {
        const imageUrl = await this.armazemAparencia(interaction, ficha.nome);
        if (imageUrl) dadosSubHabilidade.imagemURL = imageUrl;
      }

      dadosHabilidade.subHabilidades.push(dadosSubHabilidade);
      await interaction.followUp({ content: `✅ Sub-habilidade **${dadosSubHabilidade.nome}** adicionada.`, ephemeral: true });
    }

    ficha.habilidades.push(dadosHabilidade);
    await ficha.save();

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("✅ Habilidade Adicionada!")
      .setDescription(
        `Habilidade **${dadosHabilidade.nome}** adicionada à ficha de **${ficha.nome}**.`
      );

    /* #region RESUMIR DESCRIÇÃO COM MAIS DE 4000 CARACTERES */
    const components = [];
    let botaoResumo;
    if (dadosHabilidade.descricao.length > 4000) {
      // O ID da habilidade é gerado pelo Mongoose no array
      const habilidadeId = ficha.habilidades[ficha.habilidades.length - 1]._id;
      botaoResumo = new ButtonBuilder()
        .setCustomId(`summarize_${ficha._id}_${habilidadeId}`)
        .setLabel("Resumir Descrição (Excede 4000 caracteres)")
        .setStyle(ButtonStyle.Primary);

      const botoesRow = new ActionRowBuilder().addComponents(botaoResumo);
      components.push(botoesRow);
    }

    const followUpMessage = await interaction.followUp({
      embeds: [embed],
      components: components,
      ephemeral: true,
      fetchReply: true,
    });

    if (botaoResumo) {
      const botaoResumoColetor =
        followUpMessage.createMessageComponentCollector({
          filter: (i) =>
            i.user.id === interaction.user.id &&
            i.customId.startsWith("summarize_"),
          time: 300000, // 5 minutos para clicar
        });

      botaoResumoColetor.on("collect", async (i) => {
        botaoResumoColetor.stop(); // Para o coletor inicial, pois a interação continuará em um novo coletor
        await i.deferReply({ ephemeral: true });
        const [_, fichaId, habilidadeId] = i.customId.split("_");

        try {
          const ficha = await this.client.database.Ficha.findById(fichaId);
          const habilidade = ficha.habilidades.id(habilidadeId);
          if (!habilidade) {
            return i.editReply({ content: "Habilidade não encontrada." });
          }
          const descCompleta = habilidade.descricao;

          await i.editReply({
            content: "Resumindo a habilidade com a IA... 🤖",
          });

          let descResumida = await summarizeText(descCompleta);

          const botoesResumo = () =>
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`confirm_summary_${fichaId}_${habilidadeId}`)
                .setLabel("Confirmar")
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`resummarize_again_${fichaId}_${habilidadeId}`)
                .setLabel("Resumir Novamente")
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId("cancel_summary")
                .setLabel("Cancelar")
                .setStyle(ButtonStyle.Danger)
            );

          const embedResumo = (text) =>
            new EmbedBuilder()
              .setTitle("📝 DESCRIÇÃO RESUMIDA")
              .setDescription(text.substring(0, 4096))
              .setColor("Blue")
              .setFooter({ text: "Escolha uma opção abaixo." });

          const msgBotaoResumo = await i.editReply({
            content: "Aqui está o resumo gerado:",
            embeds: [embedResumo(descResumida)],
            components: [botoesResumo()],
          });

          const opcoesColetoresBotoesSum =
            msgBotaoResumo.createMessageComponentCollector({
              filter: (btn) => btn.user.id === i.user.id,
              time: 300000, // 5 minutos
            });

          opcoesColetoresBotoesSum.on("collect", async (btnInteraction) => {
            const btnFichaId = btnInteraction.customId.split("_")[2];
            const btnHabilidadeId = btnInteraction.customId.split("_")[3];

            if (btnInteraction.customId.startsWith("confirm_summary_")) {
              await btnInteraction.deferUpdate();
              const fichaToUpdate = await this.client.database.Ficha.findById(
                btnFichaId
              );
              const habilidadeToUpdate =
                fichaToUpdate.habilidades.id(btnHabilidadeId);
              habilidadeToUpdate.descricao = descResumida;
              await fichaToUpdate.save();
              await i.editReply({
                content:
                  "✅ Resumo aplicado com sucesso! Você pode ver a habilidade usando `/ficha ver`.",
                embeds: [],
                components: [],
              });

              botaoResumo.setDisabled(true);

              try {
                await followUpMessage.edit({
                  components: [
                    new ActionRowBuilder().addComponents(botaoResumo),
                  ],
                });
              } catch (editError) {
                if (editError.code === 10008) {
                  console.log(
                    "A mensagem original de confirmação de habilidade foi deletada, não foi possível desabilitar o botão."
                  );
                } else {
                  console.error(
                    "Erro ao tentar editar a mensagem de confirmação:",
                    editError
                  );
                }
              }
              opcoesColetoresBotoesSum.stop();
            } else if (
              btnInteraction.customId.startsWith("resummarize_again_")
            ) {
              await btnInteraction.deferUpdate();
              await i.editReply({
                content: "Resumindo novamente... 🤖",
                embeds: [],
                components: [],
              });

              descResumida = await summarizeText(descCompleta);
              await i.editReply({
                content: "Aqui está o novo resumo:",
                embeds: [embedResumo(descResumida)],
                components: [botoesResumo()],
              });
            } else if (btnInteraction.customId === "cancel_summary") {
              await btnInteraction.deferUpdate();
              await i.editReply({
                content:
                  "Resumo cancelado. A descrição permanece a mesma dividida na ficha.",
                embeds: [],
                components: [],
              });
              opcoesColetoresBotoesSum.stop();
            }
          });

          opcoesColetoresBotoesSum.on("end", async (collected, reason) => {
            if (reason === "time") {
              await i
                .editReply({
                  content: "Tempo esgotado.",
                  embeds: [],
                  components: [],
                })
                .catch(() => {});
            }
          });
        } catch (error) {
          console.error("Erro ao resumir habilidade (criação):", error);
          await i
            .editReply({
              content: "Ocorreu um erro ao tentar resumir a habilidade.",
            })
            .catch(() => {});
        }
      });
    }

    /* #endregion */
  }
  /* #endregion */

  /* #region VISUALIZAÇÃO DE FICHA UNICA */
  async backFichaVer(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const fichasDoUsuario = await this.client.database.Ficha.find({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });

    if (!fichasDoUsuario.length) {
      return interaction.editReply({
        content:
          "❌ Você não possui nenhuma ficha para visualizar. Use `/ficha criar` para começar.", ephemeral: true
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

    const botoesRow = new ActionRowBuilder().addComponents(selectMenu);

    const response = await interaction.editReply({
      content: "Qual ficha você gostaria de ver?",
      components: [botoesRow], ephemeral: true
    });

    // O 'response' de editReply já é o objeto da mensagem.
    // Tentar .fetch() em uma mensagem efêmera (flags: 64) causa o erro "Unknown Message".
    const coletorResposta = response.createMessageComponentCollector({
      filter: (i) =>
        i.user.id === interaction.user.id && i.customId === "select_ficha_view",
      time: 600000, // 10 minutos
    });

    coletorResposta.on("collect", async (i) => {
      const fichaId = i.values[0];
      await this.backFichaVerMultipla(i, fichaId); // Passa a nova interação e o ID da ficha
    });

    coletorResposta.on("end", (collected, reason) => {
      if (collected.size === 0) {
        interaction
          .editReply({ content: "Tempo esgotado.", components: [] })
          .catch(() => {});
      }
    });
  }

  /* #endregion */

  /* #region  VISUALIZAÇÃO DE FICHA MULTIPLA */
  async backFichaVerMultipla(interaction, fichaId) {
    try {
      if (interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      }

      // Busca todas as fichas do usuário
      const fichas = await this.client.database.Ficha.find({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      }).sort({ createdAt: -1 }); // Ordena por data de criação

      if (!fichas.length) {
        // Esta verificação já é feita em backFichaVer, mas é bom ter como segurança.
        return interaction.editReply({ content: "Nenhuma ficha encontrada." });
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

        if (ficha.imagemURL) {
          embed.setImage(ficha.imagemURL);
        }

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

        const skillCategoriasPresentes = ficha.habilidades.filter(
          (s) =>
            (s.categoria.toLowerCase() || "outros") ===
            (habilidade.categoria.toLowerCase() || "outros")
        );

        const totalHabilidadesNaCategoria = skillCategoriasPresentes.length;

        const embed = new EmbedBuilder()
          .setColor("Purple")
          .setTitle(`🔮 Habilidade: ${habilidade.nome}`);

        if (habilidade.custo && habilidade.custo.toLowerCase() !== "nenhum") {
          embed.addFields({ name: "Custo", value: habilidade.custo, inline: true });
        } //se o custo estiver disponivel e não for "nenhum"

        if (habilidade.imagemURL) {
            embed.setImage(habilidade.imagemURL);
        }

        /* #region  PARAMTROS DE CONFIG */
        const MAX_DESC_LENGTH = 2000;
        const MAX_FIELD_LENGTH = 1024;
        let extraComponents = [];
        let pageDescs = [];
        /* #endregion */

        // Botões de Ação da Habilidade
        const actionRow = new ActionRowBuilder();
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`edit_habilidade_${ficha._id}_${habilidade._id}`)
                .setLabel("Editar")
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✏️')
        );
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`add_subhabilidade_${ficha._id}_${habilidade._id}`)
                .setLabel("Adicionar Sub-habilidade")
                .setStyle(ButtonStyle.Success)
                .setEmoji('➕')
        );


        if (habilidade.subHabilidades && habilidade.subHabilidades.length > 0) {
            actionRow.addComponents(new ButtonBuilder()
                .setCustomId(`view_sub_habilidades_${habilidade._id}`)
                .setLabel("Ver Sub-habilidades")
                .setStyle(ButtonStyle.Secondary)
            );
        }

        if (habilidade.descricao) {
          if (habilidade.descricao.length > 4000) {
            //APARECE BOTÃO DE RESUMIR DESCRIÇÃO CASO SEJA MAIOR QUE 4000 CARACTERES, VAI TER PAGINAÇÃO
            const botaoResumo = new ButtonBuilder()
              .setCustomId(`summarize_${ficha._id}_${habilidade._id}`)
              .setLabel("Resumir")
              .setStyle(ButtonStyle.Success);
            actionRow.addComponents(botaoResumo);
          }

          if (habilidade.descricao.length <= MAX_DESC_LENGTH) {
            //SE FOR MENOR QUE 2000 CARACTERES, MOSTRA NORMAL
            embed.setDescription(habilidade.descricao);
          } else {
            //SE FOR MAIOR QUE 2000 CARACTERES, DIVIDE EM PÁGINAS

            pageDescs = splitDescription(habilidade.descricao, MAX_DESC_LENGTH);
            embed.setDescription(pageDescs[descPageIndex]);

            /* #region  BOTÕES DE PAGINAÇÃO PARTES DESCRIÇÕES */
            const descNavButtons = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("prev_desc_page")
                .setLabel("◀ Descrição")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(descPageIndex === 0),
              new ButtonBuilder()
                .setCustomId("next_desc_page")
                .setLabel("Descrição ▶")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(descPageIndex >= pageDescs.length - 1)
            );
            extraComponents.push(descNavButtons);
            /* #endregion */
          }
        }

        if (actionRow.components.length > 0) {
            extraComponents.unshift(actionRow);
        }

        const footerParts = [
          `Habilidade ${habilidade.categoria} ${
            currentHabilidadeIndex + 1
          }/${totalHabilidadesNaCategoria}`,
        ]; //posição da habilidade na categoria

        if (pageDescs.length > 0) {
          // FRONT-END PAGINAÇÃO DA DESCRIÇÃO > 2000 CARACTERES
          embed.setTitle(
            `🔮 Habilidade: ${habilidade.nome} - DESCRIÇÃO DIVIDIDA`
          );
          footerParts.push(
            `Descrição - parte ${descPageIndex + 1}/${pageDescs.length}`
          );
        }

        embed.setFooter({ text: footerParts.join(" | ") });

        /* #region  FRONT-END SUB-HABILIDADES */
        if (habilidade.subHabilidades && habilidade.subHabilidades.length > 0) {
          const subFields = habilidade.subHabilidades.map((sub) => ({
            name: `Sub-habilidade: ${sub.nome}`,
            value:
              sub.descricao.length > MAX_FIELD_LENGTH
                ? `${sub.descricao.substring(0, MAX_FIELD_LENGTH - 4)}...`
                : sub.descricao,
            inline: false,
          }));

          if ((embed.data.fields?.length ?? 0) + subFields.length <= 25) {
            embed.addFields(subFields);
          }
        }

        /* #endregion */

        return { embed, components: extraComponents };
      };

      /* #region  FRONT-END BOTÕES DE NAVEGAÇÃO DA FICHA */
      // Botões padrão da visualização da Ficha
      const botNavFicha = (disablePrev, disableNext) => {
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
            .setCustomId(`edit_ficha_${fichas[currentFichaIndex]._id}`)
            .setLabel("Editar Ficha")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✏️'));
      };

      // Botões de navegação das Habilidades
      const botNavHabs = (disablePrev, disableNext) => {
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
      /* #endregion */

      const message = await interaction.followUp({
        embeds: [getFichaEmbed(fichas[currentFichaIndex])],
        components: [
          botNavFicha(currentFichaIndex === 0, currentFichaIndex === pages - 1),
        ],
      });

      const coletorResposta = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 6000000,
        idle: 60000,
      });

      coletorResposta.on("collect", async (i) => {
        // Lógica para abrir modal de edição de ficha
        if (i.customId.startsWith("edit_ficha_")) {
            const fichaIdParaEditar = i.customId.split('_')[2];
            const fichaParaEditar = await this.client.database.Ficha.findById(fichaIdParaEditar);
            if (!fichaParaEditar) return i.reply({ content: "Ficha não encontrada.", ephemeral: true });

            const modal = new ModalBuilder().setCustomId(`modal_edit_ficha_${fichaIdParaEditar}`).setTitle(`Editando: ${fichaParaEditar.nome}`);
            
            const nomeInput = new TextInputBuilder().setCustomId('edit_nome').setLabel("Nome do Personagem").setStyle(TextInputStyle.Short).setValue(fichaParaEditar.nome).setRequired(true);
            const racaInput = new TextInputBuilder().setCustomId('edit_raca').setLabel("Raça").setStyle(TextInputStyle.Short).setValue(fichaParaEditar.raca).setRequired(true);
            const reinoInput = new TextInputBuilder().setCustomId('edit_reino').setLabel("Reino").setStyle(TextInputStyle.Short).setValue(fichaParaEditar.reino).setRequired(true);
            const aparenciaInput = new TextInputBuilder().setCustomId('edit_aparencia').setLabel("Aparência (Nome, Universo)").setStyle(TextInputStyle.Short).setValue(fichaParaEditar.aparencia).setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nomeInput),
                new ActionRowBuilder().addComponents(racaInput),
                new ActionRowBuilder().addComponents(reinoInput),
                new ActionRowBuilder().addComponents(aparenciaInput)
            );
            await i.showModal(modal);
            return; // Impede a atualização da mensagem principal
        }

        if (i.customId.startsWith("edit_habilidade_")) {
            const [,, fichaId, habilidadeId] = i.customId.split('_');
            const fichaSearch = await this.client.database.Ficha.findById(fichaId);
            const habilidadeParaEditar = fichaSearch.habilidades.id(habilidadeId);

            if (!habilidadeParaEditar) return i.reply({ content: "Habilidade não encontrada.", ephemeral: true });

            const modal = new ModalBuilder().setCustomId(`modal_edit_habilidade_${habilidadeId}`).setTitle(`Editando Habilidade: ${habilidadeParaEditar.nome}`);

            const nomeInput = new TextInputBuilder().setCustomId('edit_nome').setLabel("Nome da Habilidade").setStyle(TextInputStyle.Short).setValue(habilidadeParaEditar.nome).setRequired(true);
            const descricaoInput = new TextInputBuilder().setCustomId('edit_descricao').setLabel("Descrição da Habilidade").setStyle(TextInputStyle.Paragraph).setValue(habilidadeParaEditar.descricao).setRequired(true);
            const categoriaInput = new TextInputBuilder().setCustomId('edit_categoria').setLabel("Categoria").setStyle(TextInputStyle.Short).setValue(habilidadeParaEditar.categoria).setRequired(true);
            const custoInput = new TextInputBuilder().setCustomId('edit_custo').setLabel("Custo (Opcional)").setStyle(TextInputStyle.Short).setValue(habilidadeParaEditar.custo || "Nenhum").setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nomeInput),
                new ActionRowBuilder().addComponents(descricaoInput),
                new ActionRowBuilder().addComponents(categoriaInput),
                new ActionRowBuilder().addComponents(custoInput)
            );
            await i.showModal(modal);
            return;
        }

        if (i.customId.startsWith("add_subhabilidade_")) {
            const perguntasSub = [
              'Qual o nome da sub-habilidade?',
              'Qual a descrição da sub-habilidade?',
              'Qual o custo da sub-habilidade? (Opcional)'
            ];
            const respostasSub = {};

            for (const pergunta of perguntasSub) {
              const respostaColetada = await this.coletarResposta(i, pergunta);
              if (!respostaColetada) {
                return;
              }
              respostasSub[pergunta] = respostaColetada.resposta;
            }

            const fichaParaEditar = await this.client.database.Ficha.findById(fichaId);
            const habilidadeParaEditar = fichaParaEditar.habilidades.id(habilidadeId);
            
        }

        if (i.customId.startsWith("summarize_")) {
          await i.deferReply({ ephemeral: true });
          const [_, fichaId, habilidadeId] = i.customId.split("_");

          try {
            const ficha = await this.client.database.Ficha.findById(fichaId);
            const habilidade = ficha.habilidades.id(habilidadeId);
            if (!habilidade) {
              return i.editReply({ content: "Habilidade não encontrada." });
            }
            const descCompleta = habilidade.descricao;

            await i.editReply({
              content: "Resumindo a habilidade com a IA... 🤖",
            });
            const { summarizeText } = require("../../api/resumir.js");
            let descResumida = await summarizeText(descCompleta);

            const botoesResumo = () =>
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`confirm_summary_${fichaId}_${habilidadeId}`)
                  .setLabel("Confirmar")
                  .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                  .setCustomId(`resummarize_again_${fichaId}_${habilidadeId}`)
                  .setLabel("Resumir Novamente")
                  .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                  .setCustomId("cancel_summary")
                  .setLabel("Cancelar")
                  .setStyle(ButtonStyle.Danger)
              );

            const embedResumo = (text) =>
              new EmbedBuilder()
                .setTitle("📝 Proposta de Resumo")
                .setDescription(text.substring(0, 4096))
                .setColor("Blue")
                .setFooter({ text: "Escolha uma opção abaixo." });

            const msgBotaoResumo = await i.editReply({
              content: "Aqui está o resumo gerado:",
              embeds: [embedResumo(descResumida)],
              components: [botoesResumo()],
            });

            const opcoesColetoresBotoesSum =
              msgBotaoResumo.createMessageComponentCollector({
                filter: (btn) => btn.user.id === i.user.id,
                time: 300000, // 5 minutes
              });

            opcoesColetoresBotoesSum.on("collect", async (btnInteraction) => {
              const btnFichaId = btnInteraction.customId.split("_")[2];
              const btnHabilidadeId = btnInteraction.customId.split("_")[3];

              if (btnInteraction.customId.startsWith("confirm_summary_")) {
                await btnInteraction.deferUpdate();
                const fichaToUpdate = await this.client.database.Ficha.findById(
                  btnFichaId
                );
                const habilidadeToUpdate =
                  fichaToUpdate.habilidades.id(btnHabilidadeId);
                habilidadeToUpdate.descricao = descResumida;
                await fichaToUpdate.save();

                viewMode = `habilidade_categoria_${habilidadeToUpdate.categoria.toLowerCase()}`;
                currentDescPageIndex = 0;
                const { embed: newHabilidadeEmbed, components: newComponents } =
                  getHabilidadeEmbed(habilidadeToUpdate, fichaToUpdate, 0);

                // Atualiza a mensagem pública original
                await message.edit({
                  embeds: [newHabilidadeEmbed],
                  components: [
                    botNavHabs(
                      currentHabilidadeIndex === 0,
                      currentHabilidadeIndex >=
                        fichaToUpdate.habilidades.filter(
                          (s) =>
                            s.categoria.toLowerCase() ===
                            habilidadeToUpdate.categoria.toLowerCase()
                        ).length -
                          1
                    ),
                    ...newComponents,
                  ],
                });

                await i.editReply({
                  content: "✅ Resumo aplicado com sucesso!",
                  embeds: [],
                  components: [],
                });
                opcoesColetoresBotoesSum.stop();
              } else if (
                btnInteraction.customId.startsWith("resummarize_again_")
              ) {
                await btnInteraction.deferUpdate();
                await i.editReply({
                  content: "Resumindo novamente... 🤖",
                  embeds: [],
                  components: [],
                });
                descResumida = await summarizeText(descCompleta);
                await i.editReply({
                  content: "Aqui está o novo resumo:",
                  embeds: [embedResumo(descResumida)],
                  components: [botoesResumo()],
                });
              } else if (btnInteraction.customId === "cancel_summary") {
                await btnInteraction.deferUpdate();
                await i.editReply({
                  content: "Operação cancelada.",
                  embeds: [],
                  components: [],
                });
                opcoesColetoresBotoesSum.stop();
              }
            });

            opcoesColetoresBotoesSum.on("end", async (collected, reason) => {
              if (reason === "time") {
                await i
                  .editReply({
                    content: "Tempo esgotado.",
                    embeds: [],
                    components: [],
                  })
                  .catch(() => {});
              }
            });
          } catch (error) {
            console.error("Erro ao resumir:", error);
            await i.followUp({
              content: "Ocorreu um erro ao tentar resumir a habilidade.",
              ephemeral: true,
            });
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
          } else if (i.customId === "prev_desc_page") {
            if (currentDescPageIndex > 0) currentDescPageIndex--;
          } else if (i.customId === "next_desc_page") {
            currentDescPageIndex++;
          }
        }

        // Atualiza a mensagem com base no modo de visualização
        try {
          if (viewMode === "ficha") {
            await i.update({
              embeds: [getFichaEmbed(fichas[currentFichaIndex])],
              components: [
                botNavFicha(
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

            const botoesRows = [];
            for (let i = 0; i < categoryButtons.length; i += 5) {
              botoesRows.push(
                new ActionRowBuilder().addComponents(
                  categoryButtons.slice(i, i + 5)
                )
              );
            }
            botoesRows.push(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("voltarFicha")
                  .setLabel("Voltar para a Ficha")
                  .setStyle(ButtonStyle.Danger)
              )
            );

            await i.update({
              embeds: [legendEmbed],
              components: botoesRows,
            });
          } else if (viewMode.startsWith("habilidade_categoria_")) {
            const fichaAtual = fichas[currentFichaIndex];
            const currentCategory = viewMode.substring(
              "habilidade_categoria_".length
            );
            const skillCategoriasPresentes = fichaAtual.habilidades.filter(
              (s) => (s.categoria.toLowerCase() || "outros") === currentCategory
            );
            const totalHabilidades = skillCategoriasPresentes.length;

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

            const { embed: habilidadeEmbed, components: extraComponents } =
              getHabilidadeEmbed(
                skillCategoriasPresentes[currentHabilidadeIndex],
                fichaAtual,
                currentDescPageIndex
              );

            await i.update({
              embeds: [habilidadeEmbed],
              components: [navButtons, ...extraComponents],
            });
          }
        } catch (error) {
          if (error.code !== "InteractionAlreadyReplied") {
            console.error("Erro ao atualizar interação no coletor:", error);
          }
        }
      });

      coletorResposta.on("end", () => {
        message
          .edit({
            components: [],
          })
          .catch(() => {});
      });
    } catch (err) {
      console.error("Erro ao visualizar fichas:", err);
      return interaction.editReply({
        content: "Ocorreu um erro ao exibir a ficha!", ephemeral: true
      });
    }
  }
  /* #endregion */

  /* #endregion */
};
