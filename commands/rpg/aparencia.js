const {
  Discord,
  ModalBuilder,
  PermissionsBitField,
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

    function calcularDistanciaLev(a, b) {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
    
      const matriz = [];
    
      for (let i = 0; i <= b.length; i++) {
        matriz[i] = [i];
      }
    
      for (let j = 0; j <= a.length; j++) {
        matriz[0][j] = j;
      }
    
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matriz[i][j] = matriz[i - 1][j - 1];
          } else {
            matriz[i][j] = Math.min(
              matriz[i - 1][j - 1] + 1,
              matriz[i][j - 1] + 1,
              matriz[i - 1][j] + 1
            );
          }
        }
      }
    
      return matriz[b.length][a.length];
    }

    async function normalizeText(s) {
      return String(s || "")
        .normalize("NFD") // Separa os acentos das letras
        .replace(/[\u0300-\u036f]/g, "") // Remove os acentos
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    const embedNavegacao = new EmbedBuilder() //? MENSAGEM DE NAVEGAÇÃO INICIAL - SELECIONAR BASE DE DADOS
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

    const msgNavegacao = await message.reply({ // !MSG UNIVERSAL ABAIXO - APENAS EDITAR
      embeds: [embedNavegacao],
      components: [botaoSelecao],
    });

    const coletorBotoesNavegacao = msgNavegacao.createMessageComponentCollector( //? COLETOR DOS BOTÕES
      { filter: (i) => i.user.id === message.author.id, time: 60000 }
    ); //60s de espera

    coletorBotoesNavegacao.on("collect", async (i) => {
      const tempoRestante = 15;
      const sujeito = "enviar a aparência";
      const msgAlvo = msgNavegacao;

      switch (i.customId) {
        case "botaoNavAparencia":
          const embedAparencia = new EmbedBuilder() /* #region  embedAparencia */
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
                
                let ehSimilar = false;
                const palavrasApar = aparNorm.split(' ');
                const limiar = Math.max(1, Math.floor(target.length / 4));
                
                for (const palavra of palavrasApar) {
                    const distancia = calcularDistanciaLev(palavra, target);
                    if (distancia <= limiar) {
                        ehSimilar = true;
                        break;
                    }
                }

                if (aparNorm.includes(target) || ehSimilar) {
                    resultados.push({
                        aparencia,
                        universo,
                        personagem,
                        jogador,
                        rowIndex: rowIndex + 1,
                    });
                }
              }
            } catch (err) {
              console.error(err);
              return await message.channel.send("Erro ao acessar a planilha.");
            }

            let pag = 0;
            const EmbedPagesAparencia = resultados.map((r, idx) => 
                    new EmbedBuilder()
                        .setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **`)
                        .setColor("#212416")
                        .setDescription(`<:patrickconcern:1407564230256758855> | Resultado similar ${idx + 1} de ${resultados.length}`)
                        .addFields(
                            { name: "**APARÊNCIA**", value: r.aparencia ?? "—" },
                            { name: "**UNIVERSO**", value: r.universo ?? "—" },
                            { name: "**PERSONAGEM**", value: r.personagem ?? "—" },
                            { name: "**JOGADOR**", value: r.jogador ?? "—" }
                        )
                        .setFooter({ text: `Página ${idx + 1}/${resultados.length}` })
                );
            
                const navRow = async (idx) => {
                    const author = message.author;
                    const member = message.member;
                    const userDb = await this.client.database.userData.findOne({ uid: author.id, uServer: message.guild.id });
                    const components = [
                        new ButtonBuilder().setCustomId("reg_nova_ap").setEmoji("➕").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("prev_ap_similar").setLabel("⏪").setStyle(ButtonStyle.Primary).setDisabled(idx === 0 || EmbedPagesAparencia.length === 0),
                        new ButtonBuilder().setCustomId("next_ap_similar").setLabel("⏩").setStyle(ButtonStyle.Primary).setDisabled(idx === EmbedPagesAparencia.length - 1 || EmbedPagesAparencia.length === 0),
                        new ButtonBuilder().setCustomId("close_ap_similar").setLabel("❌").setStyle(ButtonStyle.Secondary)
                    ];

                    const currentResult = resultados[idx];
                    if (currentResult && userDb) {
                        const jogadorPlanilha = currentResult.jogador;
                        const jogadorDB = userDb.jogador;

                        const isOwner = await normalizeText(jogadorPlanilha) === await normalizeText(jogadorDB);
                        const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

                        if (isOwner || isAdmin) {
                            const rowIndex = currentResult.rowIndex;
                            components.push(
                                new ButtonBuilder().setCustomId(`edit_appearance_${rowIndex}`).setEmoji('✏️').setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder().setCustomId(`delete_appearance_${rowIndex}`).setEmoji('🗑️').setStyle(ButtonStyle.Danger) // Corrigido para Danger
                            );
                        }
                    }

                    const rows = [];
                    for (let i = 0; i < components.length; i += 5) {
                        rows.push(
                            new ActionRowBuilder().addComponents(components.slice(i, i + 5))
                        );
                    }

                    return rows;
                };

                if (resultados.length === 0) {
                    EmbedPagesAparencia.push(new EmbedBuilder().setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **`).setColor("#212416").setDescription(`<:a_check:1406838162276941824> | **Nenhum resultado similar encontrado.**\n\nA aparência **${target}** está livre para registro!\nClique no botão abaixo para registrá-la.`));
                }

                await msgNavegacao.edit({
                    embeds: [EmbedPagesAparencia[pag]],
                    components: await navRow(pag),
                });

                let registroIniciado = false;

                const navCollector = msgNavegacao.createMessageComponentCollector({
                    filter: (ii) => ii.user.id === message.author.id,
                    time: 60000,
                    idle: 30000
                });

                navCollector.on("collect", async (ii) => {
                    if (registroIniciado) return;

                    switch (ii.customId) {
                        case 'prev_ap_similar':
                            pag = Math.max(0, pag - 1);
                            break;
                        case 'next_ap_similar':
                            pag = Math.min(EmbedPagesAparencia.length - 1, pag + 1);
                            break;
                        case 'close_ap_similar':
                            navCollector.stop("closed");
                            return;
                        case 'reg_nova_ap':
                            registroIniciado = true;
                            navCollector.stop("register");
                            await handleRegistro('aparência', target, msgNavegacao, message, sChannel, this.client, sheets, false, []);
                            return;
                        default:
                            if (ii.customId.startsWith('edit_appearance_') || ii.customId.startsWith('delete_appearance_')) {
                                return;
                            }
                            return;
                    }
                    if (!registroIniciado) {
                        await ii.update({
                            embeds: [EmbedPagesAparencia[pag]],
                            components: await navRow(pag),
                        }).catch(() => {});
                    }
                });

                navCollector.on("end", async (collected, reason) => {
                    if (reason === "closed") {
                        await msgNavegacao.delete().catch(() => {});
                        message.channel.send({ content: "<a:cdfpatpat:1407135944456536186> | **NAVEGAÇÃO FINALIZADA!**" }).catch(() => {});
                    } else if (reason !== "register") {
                        await msgNavegacao.edit({ components: [] }).catch(() => {});
                    }
                });
          });

          coletorAparencia.on("end", (collected, reason) => {
            clearInterval(intervalo);
            if (reason === "time" && collected.size === 0) {
              contador.edit({ content: "Tempo esgotado." }).catch(() => {});
              msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
            }
          });

          break;
      }
    });
  }

  async execute(interaction) {
    const sChannel = await interaction.guild.channels.cache.find(
      (i) => i.id === "1409063037905670154"
    );

    function calcularDistanciaLev(a, b) {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
    
      const matriz = [];
    
      for (let i = 0; i <= b.length; i++) {
        matriz[i] = [i];
      }
    
      for (let j = 0; j <= a.length; j++) {
        matriz[0][j] = j;
      }
    
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matriz[i][j] = matriz[i - 1][j - 1];
          } else {
            matriz[i][j] = Math.min(
              matriz[i - 1][j - 1] + 1,
              matriz[i][j - 1] + 1,
              matriz[i - 1][j] + 1
            );
          }
        }
      }
    
      return matriz[b.length][a.length];
    }

    async function normalizeText(s) {
      return String(s || "")
        .normalize("NFD") // Separa os acentos das letras
        .replace(/[\u0300-\u036f]/g, "") // Remove os acentos
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
                
                let ehSimilar = false;
                const palavrasApar = aparNorm.split(' ');
                const limiar = Math.max(1, Math.floor(target.length / 4));
                
                for (const palavra of palavrasApar) {
                    const distancia = calcularDistanciaLev(palavra, target);
                    if (distancia <= limiar) {
                        ehSimilar = true;
                        break;
                    }
                }

                if (aparNorm.includes(target) || ehSimilar) {
                    resultados.push({
                        aparencia,
                        universo,
                        personagem,
                        jogador,
                        rowIndex: rowIndex + 1,
                    });
                }
              }
            } catch (err) {
              console.error(err);
              return await i.channel.send("Erro ao acessar a planilha.");
            }

            let pag = 0;
            const EmbedPagesAparencia = resultados.map((r, idx) => 
                    new EmbedBuilder()
                        .setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **`)
                        .setColor("#212416")
                        .setDescription(`<:patrickconcern:1407564230256758855> | Resultado similar ${idx + 1} de ${resultados.length}`)
                        .addFields(
                            { name: "**APARÊNCIA**", value: r.aparencia ?? "—" },
                            { name: "**UNIVERSO**", value: r.universo ?? "—" },
                            { name: "**PERSONAGEM**", value: r.personagem ?? "—" },
                            { name: "**JOGADOR**", value: r.jogador ?? "—" }
                        )
                        .setFooter({ text: `Página ${idx + 1}/${resultados.length}` })
                );
            
                const navRow = async (idx) => {
                    const author = i.user;
                    const member = i.member;
                    const userDb = await this.client.database.userData.findOne({ uid: author.id, uServer: i.guild.id });
                    const components = [
                        new ButtonBuilder().setCustomId("reg_nova_ap").setEmoji("➕").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("prev_ap_similar").setLabel("⏪").setStyle(ButtonStyle.Primary).setDisabled(idx === 0 || EmbedPagesAparencia.length === 0),
                        new ButtonBuilder().setCustomId("next_ap_similar").setLabel("⏩").setStyle(ButtonStyle.Primary).setDisabled(idx === EmbedPagesAparencia.length - 1 || EmbedPagesAparencia.length === 0),
                        new ButtonBuilder().setCustomId("close_ap_similar").setLabel("❌").setStyle(ButtonStyle.Secondary)
                    ];

                    const currentResult = resultados[idx];
                    if (currentResult && userDb) {
                        const jogadorPlanilha = currentResult.jogador;
                        const jogadorDB = userDb.jogador;

                        // --- DEBUG LOG ---
                        console.log(`[DEBUG] Verificando dono (slash):`);
                        console.log(` - Planilha: '${jogadorPlanilha}' -> Normalizado: '${await normalizeText(jogadorPlanilha)}'`);
                        console.log(` - Banco de Dados: '${jogadorDB}' -> Normalizado: '${await normalizeText(jogadorDB)}'`);
                        // --- FIM DEBUG ---

                        const isOwner = await normalizeText(jogadorPlanilha) === await normalizeText(jogadorDB);
                        const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

                        if (isOwner || isAdmin) {
                            const rowIndex = currentResult.rowIndex;
                            components.push(
                                new ButtonBuilder().setCustomId(`edit_appearance_${rowIndex}`).setEmoji('✏️').setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder().setCustomId(`delete_appearance_${rowIndex}`).setEmoji('🗑️').setStyle(ButtonStyle.Danger)
                            );
                        }
                    }

                    const rows = [];
                    for (let i = 0; i < components.length; i += 5) {
                        rows.push(
                            new ActionRowBuilder().addComponents(components.slice(i, i + 5))
                        );
                    }

                    return rows;
                };

                if (resultados.length === 0) {
                    EmbedPagesAparencia.push(new EmbedBuilder().setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **`).setColor("#212416").setDescription(`<:a_check:1406838162276941824> | **Nenhum resultado similar encontrado.**\n\nA aparência **${target}** está livre para registro!\nClique no botão abaixo para registrá-la.`));
                }

                await msgNavegacao.edit({
                    embeds: [EmbedPagesAparencia[pag]],
                    components: await navRow(pag),
                });

                let registroIniciado = false;

                const navCollector = msgNavegacao.createMessageComponentCollector({
                    filter: (ii) => ii.user.id === i.user.id,
                    time: 60000,
                    idle: 30000
                });

                navCollector.on("collect", async (ii) => {
                    if (registroIniciado) return;

                    switch (ii.customId) {
                        case 'prev_ap_similar':
                            pag = Math.max(0, pag - 1);
                            break;
                        case 'next_ap_similar':
                            pag = Math.min(EmbedPagesAparencia.length - 1, pag + 1);
                            break;
                        case 'close_ap_similar':
                            navCollector.stop("closed");
                            return;
                        case 'reg_nova_ap':
                            registroIniciado = true;
                            navCollector.stop("register");
                            await handleRegistro('aparência', target, msgNavegacao, i, sChannel, this.client, sheets, false, []);
                            return;
                        default:
                            if (ii.customId.startsWith('edit_appearance_') || ii.customId.startsWith('delete_appearance_')) {
                                return;
                            }
                            return;
                    }
                    if (!registroIniciado) {
                        await ii.update({
                            embeds: [EmbedPagesAparencia[pag]],
                            components: await navRow(pag),
                        }).catch(() => {});
                    }
                });

                navCollector.on("end", async (collected, reason) => {
                    if (reason === "closed") {
                        await msgNavegacao.delete().catch(() => {});
                        i.channel.send({ content: "<a:cdfpatpat:1407135944456536186> | **NAVEGAÇÃO FINALIZADA!**" }).catch(() => {});
                    } else if (reason !== "register") {
                        await msgNavegacao.edit({ components: [] }).catch(() => {});
                    }
                });
          });

          coletorAparencia.on("end", (collected, reason) => {
            clearInterval(intervalo);
            if (reason === "time" && collected.size === 0) {
              contador.edit({ content: "Tempo esgotado." }).catch(() => {});
              msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
            }
          });

          break;
        case "verso":
          const embedVerso = new EmbedBuilder().setColor("#212416").setTitle("<:DNAstrand:1406986203278082109> | ** SISTEMA DE VERSOS **").setDescription("Envie no chat o nome do verso que deseja pesquisar.").setFooter({ text: "envie apenas o nome do verso." });
          await i.update({ embeds: [embedVerso], components: [] }).catch(() => {});

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
              msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
            }
          });
          break;
      }
    });
  }
};
