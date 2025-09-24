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
const { summarizeText } = require("../../api/resumir.js");

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

  /* #region  SLASH COMMAND */
  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();

      /* #region  ACIONA BACK-ENDS EM FUNCTIONS */
      switch (subcommand) {
        case "criar":
          return this.backFichaCriar(interaction);
        case "ver":
          return this.backFichaVer(interaction);
        case "habilidade":
          return this.backFichaHabAdd(interaction);
      }
      /* #endregion */
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

  /* #region  CRIAÇÃO DE FICHA */
  async backFichaCriar(interaction) {
    /* #region  ENVIAR IAMGEM DE APARENCIA P/ SALVAR */
    const enviarImagemParaArmazenamento = async (attachment, fichaNome) => {
      const storageChannelId = "1094070734151766026"; // ID do seu canal de armazenamento
      const storageChannel = await this.client.channels
        .fetch(storageChannelId)
        .catch(() => null);

      if (!storageChannel || !storageChannel.isTextBased()) {
        console.error(
          `Canal de armazenamento (ID: ${storageChannelId}) inválido ou não encontrado.`
        );
        await interaction.followUp({
          content:
            "⚠️ Erro de configuração: O canal para salvar imagens é inválido. A imagem não será salva.",
          flags: 64,
        });
        return null;
      }

      try {
        const sentMessage = await storageChannel.send({ files: [attachment] });
        const ImgUrl = sentMessage.attachments.first()?.url;

        if (ImgUrl) {
          const embedRAparencia = new EmbedBuilder()
            .setColor(color.dblue)
            .setTitle(
              "<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109>"
            )
            .setFooter({
              text: `Aparência para a ficha de ${
                fichaNome || "Nome não definido"
              }`,
            })
            .setImage(ImgUrl);
          await sentMessage.edit({ embeds: [embedRAparencia] });
          return ImgUrl;
        }
      } catch (e) {
        console.error(
          `Erro ao enviar imagem para o canal de armazenamento (ID: ${storageChannelId}):`,
          e
        );
        await interaction.followUp({
          content:
            "❌ Não foi possível enviar a imagem para o canal de armazenamento. Verifique as permissões do bot.",
          flags: 64,
        });
      }
      return null;
    };
    /* #endregion */

    try {
      await interaction.deferReply({ flags: 64 });
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

      const fichaData = {};

      for (let i = 0; i < perguntas.length; i++) {
        const pergunta = perguntas[i];
        const perguntaMsg = await interaction.followUp({
          content: pergunta,
          fetchReply: true,
          flags: 64,
        });

        const collector = channel.createMessageCollector({
          filter: (m) => m.author.id === author.id,
          time: 300000, // 5 minutos
          max: 1,
        });

        //passa valores de collected a cada instância concluida
        const collected = await new Promise((resolve) => {
          collector.on("collect", (m) => resolve(m));
          collector.on("end", (collected) => {
            if (collected.size === 0) resolve(null);
          });
        });

        if (!collected) {
          await interaction.followUp({
            content:
              "<:berror:1406837900556898304> | **Tempo esgotado.** Criação de ficha cancelada, faça o comando novamente.",
            flags: 64,
          });
          return;
        }

        let resposta = collected.content;
        const attachment = collected.attachments.first();

        // Lógica para a pergunta da aparência
        if (pergunta.includes("aparência") && !resposta && attachment) {
          if (attachment.contentType?.startsWith("text/plain")) {
            try {
              const response = await fetch(attachment.url);
              // ... (código para ler .txt)
              if (!response.ok) throw new Error("Falha ao buscar anexo.");
              resposta = await response.text();
            } catch (error) {
              console.error(
                "Erro ao processar anexo na criação de ficha:",
                error
              );
              await interaction.followUp({
                content: "Ocorreu um erro ao ler o arquivo. Tente novamente.",
                flags: 64,
              });
              return;
            }
          }
        }

        // Salva a resposta no objeto de dados da ficha
        if (i === 0) fichaData.nome = resposta;
        if (i === 1) fichaData.raca = resposta;
        if (i === 2) fichaData.reino = resposta;
        if (i === 3) {
          // Lógica específica para a pergunta da aparência
          if (attachment && attachment.contentType?.startsWith("image/")) {
            fichaData.imagemURL = await enviarImagemParaArmazenamento(
              attachment,
              fichaData.nome
            );
            if (resposta) {
              // Se enviou imagem E texto, o texto é a aparência.
              fichaData.aparencia = resposta;
            } else {
              // Se enviou só a imagem, pergunta o nome.
              const askNameMsg = await interaction.followUp({
                content:
                  "Você enviou uma imagem. Agora, por favor, digite o nome da aparência e o universo (Ex: Goku, Dragon Ball Z).",
                flags: 64,
                fetchReply: true,
              });

              const nameCollector = channel.createMessageCollector({
                filter: (m) => m.author.id === author.id,
                time: 120000,
                max: 1,
              });
              const nameCollected = await new Promise((resolve) => {
                nameCollector.on("collect", (m) => resolve(m));
                nameCollector.on("end", (c) => {
                  if (c.size === 0) resolve(null);
                });
              });

              if (nameCollected) {
                fichaData.aparencia = nameCollected.content;
                await nameCollected.delete().catch(() => {});
                await askNameMsg.delete().catch(() => {});
              } else {
                await interaction.followUp({
                  content:
                    "Tempo esgotado. A aparência será salva como 'Aparência com imagem, sem nome'.",
                  flags: 64,
                });
                fichaData.aparencia = "Aparência com imagem, sem nome";
              }
            }
          } else {
            // Caso 2: Usuário enviou apenas texto (ou .txt).
            fichaData.aparencia = resposta;
          }
        }

        await collected.delete().catch(() => {});
        await perguntaMsg.delete().catch(() => {});
      }
      /* #endregion */

      /* #region  BACK COLETOR DA IMAGEM */
      if (fichaData.aparencia && !fichaData.imagemURL) {
        const addImagem = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("add_image_yes")
            .setLabel("Sim")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("add_image_no")
            .setLabel("Não")
            .setStyle(ButtonStyle.Danger)
        );
        const askMsg = await interaction.followUp({
          content: "Deseja enviar uma imagem para a aparência?",
          components: [addImagem],
          flags: 64,
          fetchReply: true,
        });

        try {
          const botaoAddImg = await askMsg.awaitMessageComponent({
            filter: (i) => i.user.id === author.id,
            time: 60000,
          });

          /* #region  COLETORES - SIM OU NÃO */
          if (botaoAddImg.customId === "add_image_yes") {
            //SE QUISER
            //se for adicionar
            await botaoAddImg.update({
              content: "Ótimo! Por favor, envie a imagem agora.",
              components: [],
            });

            /* #region  CONFIG COLETORES ADD */

            const coletorImg = channel.createMessageCollector({
              filter: (m) =>
                m.author.id === author.id && m.attachments.size > 0,
              time: 120000,
              max: 1,
            });

            const imgColetada = await new Promise((resolve) => {
              coletorImg.on("collect", (m) => resolve(m));
              coletorImg.on("end", (c) => {
                if (c.size === 0) resolve(null);
              });
            });
            /* #endregion */

            /* #region  AO COLETAR - sim*/
            if (
              imgColetada &&
              imgColetada.attachments.first()?.contentType?.startsWith("image/")
            ) {
              const imgAnexada = imgColetada.attachments.first();
              const ImgUrl = await enviarImagemParaArmazenamento(
                imgAnexada,
                fichaData.nome
              );
              if (ImgUrl) {
                fichaData.imagemURL = ImgUrl;
                await interaction.followUp({
                  content: "✅ Imagem da aparência salva!",
                  flags: 64,
                });
              }

              await imgColetada.delete().catch(() => {});
            } else {
              await interaction.followUp({
                content:
                  "Nenhuma imagem válida foi enviada. Continuando sem imagem.",
                flags: 64,
              });
            }
            /* #endregion */
          } else {
            //SE NÃO QUISER
            await botaoAddImg.update({
              content: "Ok, você pode adicionar depois se quiser.",
              components: [],
            });
          }
          /* #endregion */
        } catch (e) {
          await askMsg
            .edit({
              content: "Tempo esgotado. Continuando sem imagem.",
              components: [],
            })
            .catch(() => {});
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
          flags: 64,
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

      await interaction.followUp({ embeds: [embed], flags: 64 });
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
            flags: 64,
          })
          .catch(() => {});
      }
    }
  }
  /* #endregion */

  /* #region  ADICIONAR HABILIDADE NOVA */
  async backFichaHabAdd(interaction) {
    const fichasDoUsuario = await this.client.database.Ficha.find({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });

    if (!fichasDoUsuario.length) {
      // se não tem fichas
      return interaction.reply({
        content:
          "❌ Você não tem fichas registradas, precisa criar uma ficha primeiro com `/ficha criar`.",
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
        await this.backFichaUnicaHabAdd(i, fichaId);
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
      await this.backFichaUnicaHabAdd(interaction, fichaId);
    }
  }

  /* #endregion */

  /* #region  ADICIONAR HABILIDADE NOVA */
  async backFichaUnicaHabAdd(interaction, fichaId) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }

    await interaction.editReply({
      content: "Iniciando adição de habilidade...",
      components: [],
    });

    /* #region  CONFIGURAÇÃO DE COLETORES, PERGUNTAS E RESPOSTAS */
    const channel = interaction.channel;
    const author = interaction.user;

    const perguntas = [
      "Qual o nome da habilidade?",
      "Qual a categoria da habilidade? (Física, Mágica, Passiva, Haki, Aura de Combate, Sagrada, Demoníaca, Outros (diga qual))",
      "Qual o custo da habilidade? (Ex: 10 Mana, 1 de CARDIO (<:patrickconcern:1407564230256758855>), 100 de mana sagrada, etc. Deixe em branco ou digite 'nenhum' se não houver custo.)",
      "Qual a descrição da habilidade?",
    ];

    const respostas = [];

    for (const pergunta of perguntas) {
      const perguntaMsg = await interaction.followUp({
        content: pergunta,
        flags: 64,
      });

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
        await interaction.followUp({
          content: "Tempo esgotado. Processo cancelado.",
          flags: 64,
        });
        return;
      }

      let resposta = collected.content;
      const attachment = collected.attachments.first();
      /* #endregion */

      if (
        pergunta.includes("custo") &&
        (!resposta || resposta.includes("nenhum"))
      ) {
        // se for custo e não tiver custo
        resposta = " ";
      }

      /* #region  SE A DESCRIÇÃO FOR MAIOR QUE 6000 CARACTERES, O DISCORD TRANSFORMA EM TXT E A LÓGICA MUDA */
      if (pergunta.includes("descrição") && !resposta && attachment) {
        if (attachment.contentType?.startsWith("text/plain")) {
          try {
            const response = await fetch(attachment.url);
            if (!response.ok) throw new Error("Falha ao buscar anexo.");
            resposta = await response.text();
          } catch (error) {
            console.error(
              "Erro ao processar anexo na adição de habilidade:",
              error
            );
            await interaction.followUp({
              content: "Ocorreu um erro ao ler o arquivo. Tente novamente.",
              flags: 64,
            });
            return;
          }
        }
      }
      /* #endregion */

      respostas.push(resposta);
      await collected.delete().catch(() => {});
      await perguntaMsg.delete().catch(() => {});
    }

    const [nome, categoria, custo, descricao] = respostas;

    const ficha = await this.client.database.Ficha.findById(fichaId);

    if (!ficha) {
      return interaction.followUp({
        content:
          "Erro no banco de dados: A ficha selecionada não foi encontrada. Contate um administrador.",
        flags: 64,
      });
    }

    ficha.habilidades.push({
      nome,
      descricao,
      categoria,
      custo,
      subHabilidades: [],
    });
    await ficha.save();

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("✅ Habilidade Adicionada!")
      .setDescription(
        `Habilidade **${nome}** adicionada à ficha de **${ficha.nome}**.`
      );

    /* #region RESUMIR DESCRIÇÃO COM MAIS DE 4000 CARACTERES */
    const components = [];
    let botaoResumo;
    if (descricao.length > 4000) {
      // O ID da habilidade é gerado pelo Mongoose no array
      const habilidadeId = ficha.habilidades[ficha.habilidades.length - 1]._id;
      botaoResumo = new ButtonBuilder()
        .setCustomId(`summarize_${ficha._id}_${habilidadeId}`)
        .setLabel("Resumir Descrição (Excede 4000 caracteres)")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(botaoResumo);
      components.push(row);
    }

    const followUpMessage = await interaction.followUp({
      embeds: [embed],
      components: components,
      flags: 64,
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
        await i.deferReply({ flags: 64 });
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
          /* #region  CONFIG FRONT-END */

          /* #region  BOTÕES RESUMO */
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
          /* #endregion */

          const embedResumo = (text) =>
            new EmbedBuilder()
              .setTitle("📝 DESCRIÇÃO RESUMIDA")
              .setDescription(text.substring(0, 4096))
              .setColor("Blue")
              .setFooter({ text: "Escolha uma opção abaixo." });

          const msgResumo = await i.editReply({
            content: "Aqui está o resumo gerado:",
            embeds: [embedResumo(descResumida)],
            components: [botoesResumo()],
          });

          const opcoesColetoresBotoesSum =
            msgResumo.createMessageComponentCollector({
              filter: (btn) => btn.user.id === i.user.id,
              time: 300000, // 5 minutos
            });

          /* #endregion */

          opcoesColetoresBotoesSum.on("collect", async (btnInteraction) => {
            const btnFichaId = btnInteraction.customId.split("_")[2];
            const btnHabilidadeId = btnInteraction.customId.split("_")[3];

            /* #region  OPÇÕES BOTÕES */
            if (btnInteraction.customId.startsWith("confirm_summary_")) {
              //CONFIRMAR RESUMO
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
              //RESUMIR DNV

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
              // CANCELAR RESUMo
              await btnInteraction.deferUpdate();
              await i.editReply({
                content:
                  "Resumo cancelado. A descrição permanece a mesma dividida na ficha.",
                embeds: [],
                components: [],
              });
              opcoesColetoresBotoesSum.stop();
            }
            /* #endregion */
          });

          opcoesColetoresBotoesSum.on("end", async (collected, reason) => {
            //erro ou timeout
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
    await interaction.deferReply({ flags: 64 });
    const fichasDoUsuario = await this.client.database.Ficha.find({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });

    if (!fichasDoUsuario.length) {
      return interaction.editReply({
        content:
          "❌ Você não possui nenhuma ficha para visualizar. Use `/ficha criar` para começar.",
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

    const response = await interaction.editReply({
      content: "Qual ficha você gostaria de ver?",
      components: [row],
    });

    // O 'response' de editReply já é o objeto da mensagem.
    // Tentar .fetch() em uma mensagem efêmera (flags: 64) causa o erro "Unknown Message".
    const collector = response.createMessageComponentCollector({
      filter: (i) =>
        i.user.id === interaction.user.id && i.customId === "select_ficha_view",
      time: 600000, // 10 minutos
    });

    collector.on("collect", async (i) => {
      const fichaId = i.values[0];
      await this.backFichaVerMultipla(i, fichaId); // Passa a nova interação e o ID da ficha
    });

    collector.on("end", (collected, reason) => {
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
            { name: "Reino", value: ficha.reino },
            { name: "Raça", value: ficha.raca },
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
          .setTitle(`🔮 Habilidade: ${habilidade.nome}`)
          .addFields({ name: "Categoria", value: habilidade.categoria });

        if (habilidade.custo && habilidade.custo.toLowerCase() !== "nenhum") {
          embed.addFields({ name: "Custo", value: habilidade.custo });
        } //se o custo estiver disponivel e não for "nenhum"

        /* #region  PARAMTROS DE CONFIG */
        const MAX_DESC_LENGTH = 2000;
        const MAX_FIELD_LENGTH = 1024;
        let extraComponents = [];
        let pageDescs = [];
        /* #endregion */

        if (habilidade.descricao) {
          if (habilidade.descricao.length > 4000) {
            //APARECE BOTÃO DE RESUMIR DESCRIÇÃO CASO SEJA MAIOR QUE 4000 CARACTERES, VAI TER PAGINAÇÃO
            const botaoResumo = new ButtonBuilder()
              .setCustomId(`summarize_${ficha._id}_${habilidade._id}`)
              .setLabel("Resumir Descrição")
              .setStyle(ButtonStyle.Success);

            const actionRow = new ActionRowBuilder().addComponents(botaoResumo);
            extraComponents.push(actionRow);
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
            .setCustomId("addHabilidadeFicha")
            .setLabel("Adicionar Habilidade")
            .setStyle(ButtonStyle.Success)
        );
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

            const msgResumo = await i.editReply({
              content: "Aqui está o resumo gerado:",
              embeds: [embedResumo(descResumida)],
              components: [botoesResumo()],
            });

            const opcoesColetoresBotoesSum =
              msgResumo.createMessageComponentCollector({
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
          } else if (i.customId === "addHabilidadeFicha") {
            const fichaAtual = fichas[currentFichaIndex];
            await this.backFichaUnicaHabAdd(i, fichaAtual._id.toString());
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

  /* #endregion */
};
