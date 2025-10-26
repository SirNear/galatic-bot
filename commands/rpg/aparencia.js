const {
  Discord,
  ModalBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  SlashCommandBuilder,
  TextInputStyle,
  TextInputBuilder,
  fetchRecommendedShardCount,
} = require("discord.js");
const Command = require("../../structures/Command.js");
const error = require("../../api/error.js");
const logs = require("../../api/logs.js");
const { google } = require("googleapis");
const ms = require("ms");
const API_KEY = "AIzaSyCulP8QuMiKOq5l1FvAbvHX7vjX1rWJUOQ";
const sheets = google.sheets({ version: "v4", auth: API_KEY });
const colors = require("../../api/colors.json");
const { iniciarContador, pararContador } = require("../../api/contador.js");
let intervalo, contador;
let target;
let { handleRegistro } = require("../../api/APARENCIA/registro.js");

module.exports = class aparencia extends Command {
  constructor(client) {
    super(client, {
      name: "aparencia",
      category: "rpg",
      aliases: [
        "ap",
        "aparencias",
        "aparência",
        "aparências",
        "pesquisaraparencia",
        "pesquisaraparência",
        "pesquisarap",
        "pesquisaraparecia",
        "pesquisaraparencias",
        "pesquisaraparências",
        "pesquisaraparecias",
      ],
      UserPermission: [""],
      clientPermission: null,
      OnlyDevs: false,
      slash: true, // Habilita o comando de barra
      description: "Pesquisa a disponibilidade de uma aparência ou verso.", // Descrição para o /help
    });

    // Configuração do Comando de Barra (Slash Command)
    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description);
    }
  }

  async coletarResposta(interaction, pergunta) {
    const channel = interaction.channel;
    const author = interaction.user;

    // Responde à interação inicial se ainda não foi respondida
    if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: pergunta, fetchReply: true });
    } else {
        await interaction.followUp({ content: pergunta, fetchReply: true });
    }

    const coletorResposta = channel.createMessageCollector({
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

    if (!collected) {
      await interaction.followUp({
        content: "<:berror:1406837900556898304> | **Tempo esgotado.** Operação cancelada."
      });
      return null;
    }

    const resposta = collected.content;
    await collected.delete().catch(() => {});

    return resposta;
  }

  async run({ message, args, client, server }) {
    const sChannel = await message.guild.channels.cache.find(
      (i) => i.id === "1409063037905670154"
    );
    const userDb = await this.client.database.userData.findById(
      `${message.author.globalName} ${message.guild.name}`
    );

    async function normalizeText(s) {
      return String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    /* #region FRONT-END INICIAL  */
    //? MENSAGEM DE NAVEGAÇÃO INICIAL - SELECIONAR BASE DE DADOS
    const embedNavegacao = new EmbedBuilder()
      .setColor("#02607a")
      .setTitle(
        "<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109>"
      )
      .setDescription("Escolha o que você deseja conferir a disponibilidade")
      .setFooter({ text: "Use os botões abaixo para navegar." });

    const botaoSelecao = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("botaoNavAparencia")
        .setLabel("APARÊNCIA")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("verso")
        .setLabel("VERSO")
        .setStyle(ButtonStyle.Success)
    );
    /* #endregion */

    // !MSG UNIVERSAL ABAIXO - APENAS EDITAR
    const msgNavegacao = await message.reply({
      embeds: [embedNavegacao],
      components: [botaoSelecao],
    });

    //? COLETOR DOS BOTÕES
    const coletorBotoesNavegacao = msgNavegacao.createMessageComponentCollector(
      { filter: (i) => i.user.id === message.author.id, time: 60000 }
    ); //60s de espera

    coletorBotoesNavegacao.on("collect", async (i) => {
      const tempoRestante = 15;
      const sujeito = "enviar a aparência";
      const msgAlvo = msgNavegacao;

      switch (i.customId) {
        case "botaoNavAparencia":
          /* #region  embedAparencia */
          const embedAparencia = new EmbedBuilder()
            .setColor("#212416")
            .setTitle(
              `<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **`
            )
            .setDescription("Envie no chat a aparência que deseja verificar.")
            .setFooter({
              text: "envie apenas o nome da aparência, sem emojis, acentuações ou outros caracteres.",
            });
          /* #endregion */ // * ------------------------- EMBED APARENCIA -------------------------

          await i
            .update({ embeds: [embedAparencia], components: [] })
            .catch(() => {});

          /* #region  CONTADOR */

          ({ intervalo, contador } = await iniciarContador(
            tempoRestante,
            sujeito,
            msgAlvo,
            message
          ));
          /* #endregion */

          const coletorAparencia = msgNavegacao.channel.createMessageCollector({
            filter: (m) => m.author.id === message.author.id,
            time: 15000,
            max: 1,
          });

          /* #region  BACK BUSCA E REGISTRO DE APARÊNCIA */
          coletorAparencia.on("collect", async (m) => {
            const nomeAparencia = await pararContador(
              m.content,
              intervalo,
              contador
            );

            let resultados = [];

            target = await normalizeText(nomeAparencia);

            /* #region  BUSCA RESULTADOS NA PLANILHA */
            try {
              const res = await sheets.spreadsheets.values.get({
                spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                range: "A:D",
              });
              const rows = res.data.values || [];

              for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
                const row = rows[rowIndex];
                if (!row) continue;
                const [aparencia, universo, personagem, jogador] = row;
                if (!aparencia) continue;
                const aparNorm = await normalizeText(aparencia);
                if (aparNorm.length < 2) continue;

                if (
                  aparNorm === target ||
                  (aparNorm.length >= 3 && aparNorm.includes(target)) ||
                  (target.length >= 3 && target.includes(aparNorm))
                ) {
                  resultados.push({
                    aparencia,
                    universo,
                    personagem,
                    jogador,
                  });
                }
              }
            } catch (err) {
              console.error(err);
              return await message.channel.send("Erro ao acessar a planilha.");
            }
            /* #endregion */

            // verifica se tem o termo exato daquela aparencia
            let ExactMatch = resultados.find(
              (r) => normalizeText(r.aparencia) === target
            );

            // Uma aparência com o termo exato FOI encontrada.
            if (ExactMatch) {
              const embedExato = new EmbedBuilder()
                .setTitle(
                  `<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **`
                )
                .setDescription(
                  `<:PepeHands:1407563136197984357> | Aparência em uso!`
                )
                .setColor("#8f0808")
                .addFields(
                  {
                    name: "**APARÊNCIA**",
                    value: ExactMatch.aparencia ?? "—",
                  },
                  {
                    name: "**UNIVERSO**",
                    value: ExactMatch.universo ?? "—",
                  },
                  {
                    name: "**PERSONAGEM**",
                    value: ExactMatch.personagem ?? "—",
                  },
                  {
                    name: "**JOGADOR**",
                    value: ExactMatch.jogador ?? "—",
                  }
                );
              await msgNavegacao
                .edit({ embeds: [embedExato], components: [] })
                .catch(() => {});

              // CENÁRIO 2: Nenhuma correspondência exata, MAS HÁ resultados similares.
            } else { // sem aparência com termo exato, mas similares -> oferece registro
                await handleRegistro(
                    'aparência',
                    target,
                    msgNavegacao,
                    message,
                    sChannel,
                    this.client,
                    sheets,
                    false,
                    resultados 
                );
            } 
          });

          coletorAparencia.on("end", (collected, reason) => {
            clearInterval(intervalo);

            if (reason === "time" && collected.size === 0) {
              contador.edit({ content: "Tempo esgotado." }).catch(() => {});
              msgNavegacao.delete().catch(() => {});
            } //!IF TEMPO ESGOTADO

            msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
          }); //!COLETORAPARENCIA.END
          /* #endregion */

          break;
        case "verso":
          await i.update({ components: [] }).catch(() => {});

          const embedVerso = new EmbedBuilder()
            .setColor("#212416")
            .setTitle(
              "<:DNAstrand:1406986203278082109> | ** SISTEMA DE VERSOS **"
            )
            .setDescription(
              "Envie no chat o nome do verso que deseja pesquisar."
            )
            .setFooter({ text: "envie apenas o nome do verso." });

          await msgNavegacao
            .edit({ embeds: [embedVerso], components: [] })
            .catch(() => {});

          /* #region contador */
          ({ intervalo, contador } = await iniciarContador(
            tempoRestante,
            sujeito,
            msgAlvo,
            message
          ));
          /* #endregion */

          const coletorVerso = msgNavegacao.channel.createMessageCollector({
            filter: (m) => m.author.id === message.author.id,
            time: 15000,
            max: 1,
          });

          coletorVerso.on("collect", async (m) => {
            const verseName = await pararContador(
              m.content,
              intervalo,
              contador
            );

            target = await normalizeText(verseName);

            let resultados = [];
            let exactMatch = resultados.find(
              (r) => normalizeText(r.verseName) = target
            );

            /* #region BUSCA VERSO NA PLANILHA */
            try {
              const res = await sheets.spreadsheets.values.get({
                spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                range: "UNIVERSO!A:C",
              });
              const rows = res.data.values || [];

              for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                if (!row) continue;
                const [universo, uso, jogador] = row;
                if (!universo) continue;

                const uniNorm = await normalizeText(universo);

                if (uniNorm.length < 2) continue;

                const data = { universo, uso, jogador };

                if (uniNorm === target) {
                  exactMatch = data;
                  break;
                }

                // aceitar igualdade e correspondência parcial com limites (evita "N" casando)
                if (
                  (uniNorm.length >= 3 && uniNorm.includes(target)) ||
                  (target.length >= 3 && target.includes(uniNorm))
                ) {
                  resultados.push(data);
                }
              } //for
            } catch (err) {
              console.error(err);
              return await message.channel.send(
                "Erro ao acessar a planilha de versos."
              );
            }
            /* #endregion */

            if (exactMatch) {
              const embedExato = new EmbedBuilder()
                .setTitle(
                  `<:DNAstrand:1406986203278082109> | ** SISTEMA DE VERSOS **`
                )
                .setDescription(
                  `<:PepeHands:1407563136197984357> | Verso em uso!`
                )
                .setColor("#8f0808")
                .addFields(
                  { name: "**VERSO**", value: exactMatch.universo ?? "—" },
                  {
                    name: "**USO (%)**",
                    value: String(exactMatch.uso ?? "—"),
                  },
                  { name: "**JOGADOR**", value: exactMatch.jogador ?? "—" }
                );
              await msgNavegacao
                .edit({ embeds: [embedExato], components: [] })
                .catch(() => {});
            } else {
                await handleRegistro(
                    'verso',
                    target,
                    msgNavegacao,
                    message,
                    sChannel,
                    this.client,
                    sheets,
                    false,
                    resultados 
                ); 
            } 
          });

          coletorVerso.on("end", (collected, reason) => {
            clearInterval(intervalo);
            if (reason === "time" && collected.size === 0) {
              contador.edit({ content: "Tempo esgotado." }).catch(() => {});
            }
            // limpa o embed de resultado do fluxo de versos ao terminar
            msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
          });
          break;
        default:
          return;
      }
    });
  }

  async execute(interaction) {
    const sChannel = await interaction.guild.channels.cache.find(
      (i) => i.id === "1409063037905670154"
    );

    async function normalizeText(s) {
      return String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    const embedNavegacao = new EmbedBuilder()
      .setColor("#02607a")
      .setTitle(
        "<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109>"
      )
      .setDescription("Escolha o que você deseja conferir a disponibilidade")
      .setFooter({ text: "Use os botões abaixo para navegar." });

    const botaoSelecao = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("botaoNavAparencia")
        .setLabel("APARÊNCIA")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("verso")
        .setLabel("VERSO")
        .setStyle(ButtonStyle.Success)
    );

    const msgNavegacao = await interaction.reply({
      embeds: [embedNavegacao],
      components: [botaoSelecao],
      fetchReply: true,
    });

    const coletorBotoesNavegacao = msgNavegacao.createMessageComponentCollector(
      { filter: (i) => i.user.id === interaction.user.id, time: 60000 }
    );

    coletorBotoesNavegacao.on("collect", async (i) => {
      const tempoRestante = 15;
      const sujeito = "enviar a aparência";
      const msgAlvo = msgNavegacao;

      switch (i.customId) {
        case "botaoNavAparencia":
          await i.update({
            embeds: [new EmbedBuilder().setColor("#212416").setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **`).setDescription("Envie no chat a aparência que deseja verificar.").setFooter({ text: "envie apenas o nome da aparência, sem emojis, acentuações ou outros caracteres." })],
            components: []
          }).catch(() => {});

          ({ intervalo, contador } = await iniciarContador(
            tempoRestante,
            sujeito,
            msgAlvo,
            i // Passa a interação para o contador
          ));

          const coletorAparencia = i.channel.createMessageCollector({
            filter: (m) => m.author.id === i.user.id,
            time: 15000,
            max: 1,
          });

          coletorAparencia.on("collect", async (m) => {
            const nomeAparencia = await pararContador(
              m.content,
              intervalo,
              contador
            );

            let resultados = [];
            target = await normalizeText(nomeAparencia);

            try {
              const res = await sheets.spreadsheets.values.get({
                spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                range: "A:D",
              });
              const rows = res.data.values || [];

              for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
                const row = rows[rowIndex];
                if (!row) continue;
                const [aparencia, universo, personagem, jogador] = row;
                if (!aparencia) continue;
                const aparNorm = await normalizeText(aparencia);
                if (aparNorm.length < 2) continue;

                if (
                  aparNorm === target ||
                  (aparNorm.length >= 3 && aparNorm.includes(target)) ||
                  (target.length >= 3 && target.includes(aparNorm))
                ) {
                  resultados.push({
                    aparencia,
                    universo,
                    personagem,
                    jogador,
                  });
                }
              }
            } catch (err) {
              console.error(err);
              return await i.channel.send("Erro ao acessar a planilha.");
            }

            let ExactMatch = resultados.find(
              (r) => normalizeText(r.aparencia) === target
            );

            if (ExactMatch) {
              const embedExato = new EmbedBuilder()
                .setTitle(
                  `<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **`
                )
                .setDescription(
                  `<:PepeHands:1407563136197984357> | Aparência em uso!`
                )
                .setColor("#8f0808")
                .addFields(
                  { name: "**APARÊNCIA**", value: ExactMatch.aparencia ?? "—" },
                  { name: "**UNIVERSO**", value: ExactMatch.universo ?? "—" },
                  { name: "**PERSONAGEM**", value: ExactMatch.personagem ?? "—" },
                  { name: "**JOGADOR**", value: ExactMatch.jogador ?? "—" }
                );
              await msgNavegacao
                .edit({ embeds: [embedExato], components: [] })
                .catch(() => {});
            } else {
                await handleRegistro(
                    'aparência',
                    target,
                    msgNavegacao,
                    i, // Passa a interação para o handleRegistro
                    sChannel,
                    this.client,
                    sheets,
                    false,
                    resultados 
                );
            } 
          });

          coletorAparencia.on("end", (collected, reason) => {
            clearInterval(intervalo);
            if (reason === "time" && collected.size === 0) {
              contador.edit({ content: "Tempo esgotado." }).catch(() => {});
              msgNavegacao.delete().catch(() => {});
            }
            msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
          });

          break;
        case "verso":
          await i.update({
            embeds: [new EmbedBuilder().setColor("#212416").setTitle("<:DNAstrand:1406986203278082109> | ** SISTEMA DE VERSOS **").setDescription("Envie no chat o nome do verso que deseja pesquisar.").setFooter({ text: "envie apenas o nome do verso." })],
            components: []
          }).catch(() => {});

          ({ intervalo, contador } = await iniciarContador(
            tempoRestante,
            "enviar o verso",
            msgAlvo,
            i
          ));

          const coletorVerso = i.channel.createMessageCollector({
            filter: (m) => m.author.id === i.user.id,
            time: 15000,
            max: 1,
          });

          coletorVerso.on("collect", async (m) => {
            const verseName = await pararContador(
              m.content,
              intervalo,
              contador
            );

            target = await normalizeText(verseName);

            let resultados = [];
            let exactMatch = null;

            try {
              const res = await sheets.spreadsheets.values.get({
                spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                range: "UNIVERSO!A:C",
              });
              const rows = res.data.values || [];

              for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                if (!row) continue;
                const [universo, uso, jogador] = row;
                if (!universo) continue;

                const uniNorm = await normalizeText(universo);

                if (uniNorm.length < 2) continue;

                const data = { universo, uso, jogador };

                if (uniNorm === target) {
                  exactMatch = data;
                  break;
                }

                if (
                  (uniNorm.length >= 3 && uniNorm.includes(target)) ||
                  (target.length >= 3 && target.includes(uniNorm))
                ) {
                  resultados.push(data);
                }
              }
            } catch (err) {
              console.error(err);
              return await i.channel.send(
                "Erro ao acessar a planilha de versos."
              );
            }

            if (exactMatch) {
              const embedExato = new EmbedBuilder()
                .setTitle(
                  `<:DNAstrand:1406986203278082109> | ** SISTEMA DE VERSOS **`
                )
                .setDescription(
                  `<:PepeHands:1407563136197984357> | Verso em uso!`
                )
                .setColor("#8f0808")
                .addFields(
                  { name: "**VERSO**", value: exactMatch.universo ?? "—" },
                  { name: "**USO (%)**", value: String(exactMatch.uso ?? "—") },
                  { name: "**JOGADOR**", value: exactMatch.jogador ?? "—" }
                );
              await msgNavegacao
                .edit({ embeds: [embedExato], components: [] })
                .catch(() => {});
            } else {
                await handleRegistro(
                    'verso',
                    target,
                    msgNavegacao,
                    i,
                    sChannel,
                    this.client,
                    sheets,
                    false,
                    resultados 
                ); 
            } 
          });

          coletorVerso.on("end", (collected, reason) => {
            clearInterval(intervalo);
            if (reason === "time" && collected.size === 0) {
              contador.edit({ content: "Tempo esgotado." }).catch(() => {});
            }
            msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
          });
          break;
        default:
          return;
      }
    });
  }
};
