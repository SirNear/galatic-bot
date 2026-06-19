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
const path = require("path");
const Command = require("../../structures/Command.js");
const error = require("../../api/error.js");
const logs = require("../../api/logs.js");
const { google } = require("googleapis");
const ms = require("ms");

let sheets;
try {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  sheets = google.sheets({ version: "v4", auth: auth });
} catch (err) {
  console.error("[ERRO] Falha ao carregar credenciais do Google (aparencia.js):", err.message);
}

const colors = require("../../api/colors.json");
const { iniciarContador, pararContador } = require("../../api/contador.js");
let intervalo, contador;
let target;
const { logOperacao } = require("../../api/APARENCIA/logAparencia.js");
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
      slash: true,
      description: "pesquisa por registros de aparências, versos e sistemas",
    });


    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addStringOption(option =>
          option
            .setName('termo')
            .setDescription('Termo de busca (ex: nome do personagem ou verso)')
            .setRequired(false)
        );
    }
  }

  async coletarResposta(interaction, pergunta) {
    const channel = interaction.channel;
    const author = interaction.user;

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: pergunta, fetchReply: true });
    } else {
      await interaction.followUp({ content: pergunta, fetchReply: true });
    }

    const coletorResposta = channel.createMessageCollector({
      filter: (m) => m.author.id === author.id,
      time: 300000,
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
    await collected.delete().catch(() => { });

    return resposta;
  }


  async run({ message, args, client, server, interaction }) {
    const botLogChannel = message.guild.channels.cache.find((i) => i.id === "1409063037905670154");

    let termo = args.join(' ').trim();

    if (interaction && interaction.options) {
      const optionTermo = interaction.options.getString('termo');
      if (optionTermo) termo = optionTermo;
    }

    let msgNavegacao;
    if (interaction && !interaction.replied && !interaction.deferred) {
      msgNavegacao = await interaction.reply({ content: '⏳ Preparando busca...', fetchReply: true });
    } else if (interaction) {
      msgNavegacao = await interaction.followUp({ content: '⏳ Preparando busca...', fetchReply: true });
    } else {
      msgNavegacao = await message.reply({ content: '⏳ Preparando busca...' });
    }

    if (!termo) {
      const embedNavegacao = new EmbedBuilder()
        .setColor("#02607a")
        .setTitle("<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109>")
        .setDescription("Envie no chat o termo que deseja pesquisar (ex: personagem, sistema de poder, mitologia, verso, etc.).");

      await msgNavegacao.edit({ embeds: [embedNavegacao], content: null }).catch(() => { });

      const filter = (m) => m.author.id === (interaction ? interaction.user.id : message.author.id);
      const collected = await (interaction ? interaction.channel : message.channel).awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] }).catch(() => null);

      if (!collected) {
        return msgNavegacao.edit({ embeds: [], content: "Tempo esgotado." }).catch(() => { });
      }
      termo = collected.first().content;
      await collected.first().delete().catch(() => { });
    }

    await msgNavegacao.edit({ embeds: [], content: '⏳ Buscando nas planilhas de Aparência e Universo...' }).catch(() => { });

    await this.processarBusca(termo, message || interaction, msgNavegacao, botLogChannel);
  }

  async processarBusca(termo, contextMsgOrInt, msgNavegacao, botLogChannel) {
    const author = contextMsgOrInt.author || contextMsgOrInt.user;
    const member = contextMsgOrInt.member;
    const guildId = contextMsgOrInt.guild.id;

    let resultados = [];
    try {
      resultados = await this.buscarResultadosUnificados(sheets, termo);
    } catch (err) {
      console.error(err);
      return msgNavegacao.edit({ content: "Erro ao acessar as planilhas.", embeds: [] }).catch(() => { });
    }

    let pag = 0;
    const embedPages = resultados.map((r, idx) => {
      const embed = new EmbedBuilder()
        .setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **`)
        .setColor(r.tipo === 'aparencia' ? "#212416" : "#4b0082")
        .setDescription(`<:patrickconcern:1407564230256758855> | Resultado ${idx + 1} de ${resultados.length}`);

      if (r.tipo === 'aparencia') {
        embed.addFields(
          { name: "**TIPO**", value: "👤 Aparência" },
          { name: "**APARÊNCIA**", value: r.aparencia ?? "—" },
          { name: "**UNIVERSO**", value: r.universo ?? "—" },
          { name: "**PERSONAGEM**", value: r.personagem ?? "—" },
          { name: "**JOGADOR**", value: r.jogador ?? "—" }
        );
      } else {
        embed.addFields(
          { name: "**TIPO**", value: "🌌 Verso" },
          { name: "**UNIVERSO**", value: r.universo ?? "—" },
          { name: "**ESCOPO/USO**", value: r.uso ?? "—" },
          { name: "**JOGADOR**", value: r.jogador ?? "—" }
        );
      }
      embed.setFooter({ text: `Página ${idx + 1}/${resultados.length}` });
      return embed;
    });

    if (resultados.length === 0) {
      embedPages.push(new EmbedBuilder()
        .setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **`)
        .setColor("#212416")
        .setDescription(`<:pepeOK:810735233309474876> | **Nenhum resultado encontrado.**\n\nO termo **${termo}** parece estar livre!\nUse os botões abaixo para registrá-lo.`)
      );
    }

    const navRow = async (idx) => {
      const userDb = await this.client.database.userData.findOne({ uid: author.id, uServer: guildId });
      const components = [
        new ButtonBuilder().setCustomId("reg_nova_ap").setEmoji("➕").setLabel("Aparência").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("reg_novo_verso").setEmoji("➕").setLabel("Verso").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("prev_page").setLabel("⏪").setStyle(ButtonStyle.Primary).setDisabled(idx === 0 || embedPages.length === 0),
        new ButtonBuilder().setCustomId("next_page").setLabel("⏩").setStyle(ButtonStyle.Primary).setDisabled(idx >= embedPages.length - 1 || embedPages.length === 0),
        new ButtonBuilder().setCustomId("close_page").setLabel("❌").setStyle(ButtonStyle.Secondary)
      ];

      const currentResult = resultados[idx];
      if (currentResult && userDb && member) {
        const isOwner = await normalizeText(currentResult.jogador) === await normalizeText(userDb.jogador);
        const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (isOwner || isAdmin) {
          const rowIndex = currentResult.rowIndex;
          if (currentResult.tipo === 'aparencia') {
            components.push(
              new ButtonBuilder().setCustomId(`edit_appearance_${rowIndex}`).setEmoji('✏️').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(`delete_appearance_${rowIndex}`).setEmoji('🗑️').setStyle(ButtonStyle.Danger)
            );
          } else {
          }
        }
      }

      const rows = [];
      for (let i = 0; i < components.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(components.slice(i, i + 5)));
      }
      return rows;
    };

    await msgNavegacao.edit({
      content: null,
      embeds: [embedPages[pag]],
      components: await navRow(pag),
    }).catch(() => { });

    let registroIniciado = false;
    const navCollector = msgNavegacao.createMessageComponentCollector({
      filter: (ii) => ii.user.id === author.id,
      time: 60000,
      idle: 30000
    });

    navCollector.on("collect", async (ii) => {
      switch (ii.customId) {
        case 'prev_page':
          pag = Math.max(0, pag - 1);
          break;
        case 'next_page':
          pag = Math.min(embedPages.length - 1, pag + 1);
          break;
        case 'close_page':
          navCollector.stop("closed");
          return;
        case 'reg_nova_ap':
          await handleRegistro('aparência', termo, msgNavegacao, ii, botLogChannel, this.client, sheets, false, [], true);
          return;
        case 'reg_novo_verso':
          await handleRegistro('verso', termo, msgNavegacao, ii, botLogChannel, this.client, sheets, false, resultados.filter(r => r.tipo === 'verso'), true);
          return;
        default:
          if (ii.customId.startsWith('edit_appearance_') || ii.customId.startsWith('delete_appearance_')) {
            return;
          }
          return;
      }

      await ii.update({
        embeds: [embedPages[pag]],
        components: await navRow(pag),
      }).catch(() => { });
    });

    navCollector.on("end", async (collected, reason) => {
      if (reason === "time" || reason === "closed" || reason === "idle") {
        msgNavegacao.edit({ components: [] }).catch(() => { });
      }
    });
  }

  async buscarResultadosUnificados(sheets, query) {
    if (!sheets) return [];

    const rawWords = normalizeText(query).split(' ');
    const stopWords = ['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'sistema'];
    const queryWords = rawWords.filter(w => w.length > 2 && !stopWords.includes(w));
    if (queryWords.length === 0) queryWords.push(normalizeText(query));

    const [resAparencias, resVersos] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID || "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
        range: "INDIVIDUAIS!A:D",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID || "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
        range: "UNIVERSO!A:C",
      })
    ]);

    const rowsAp = resAparencias.data.values || [];
    const rowsVer = resVersos.data.values || [];
    const resultados = [];

    // Busca em INDIVIDUAIS
    for (let rowIndex = 1; rowIndex < rowsAp.length; rowIndex++) {
      const row = rowsAp[rowIndex];
      if (!row) continue;
      const [aparencia, universo, personagem, jogador] = row;
      if (!aparencia) continue;

      const apNorm = normalizeText(aparencia);
      const uniNorm = normalizeText(universo);
      const perNorm = normalizeText(personagem);

      const textoCompleto = `${apNorm} ${uniNorm} ${perNorm}`;
      const wordsCompleto = textoCompleto.split(' ');

      let score = 0;

      if (apNorm === normalizeText(query) || uniNorm === normalizeText(query)) score += 50;

      for (const qWord of queryWords) {
        if (textoCompleto.includes(qWord)) {
          score += 5;
        } else {
          const limiar = Math.max(1, Math.floor(qWord.length / 4));
          for (const word of wordsCompleto) {
            if (calcularDistanciaLev(word, qWord) <= limiar) {
              score += 2;
              break;
            }
          }
        }
      }
      if (score > 0) {
        resultados.push({ tipo: 'aparencia', aparencia, universo, personagem, jogador, rowIndex: rowIndex + 1, score });
      }
    }

    for (let rowIndex = 1; rowIndex < rowsVer.length; rowIndex++) {
      const row = rowsVer[rowIndex];
      if (!row) continue;
      const [universo, uso, jogador] = row;
      if (!universo) continue;

      const uniNorm = normalizeText(universo);
      const usoNorm = normalizeText(uso);

      const textoCompleto = `${uniNorm} ${usoNorm}`;
      const wordsCompleto = textoCompleto.split(' ');

      let score = 0;

      // Bonus por exact match
      if (uniNorm === normalizeText(query)) score += 50;

      for (const qWord of queryWords) {
        if (textoCompleto.includes(qWord)) {
          score += 5;
        } else {
          const limiar = Math.max(1, Math.floor(qWord.length / 4));
          for (const word of wordsCompleto) {
            if (calcularDistanciaLev(word, qWord) <= limiar) {
              score += 2;
              break;
            }
          }
        }
      }
      if (score > 0) {
        resultados.push({ tipo: 'verso', universo, uso, jogador, rowIndex: rowIndex + 1, score });
      }
    }

    return resultados.sort((a, b) => b.score - a.score);
  }

};

function normalizeText(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function calcularDistanciaLev(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matriz = [];
  for (let i = 0; i <= b.length; i++) matriz[i] = [i];
  for (let j = 0; j <= a.length; j++) matriz[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matriz[i][j] = matriz[i - 1][j - 1];
      else matriz[i][j] = Math.min(matriz[i - 1][j - 1] + 1, matriz[i][j - 1] + 1, matriz[i - 1][j] + 1);
    }
  }
  return matriz[b.length][a.length];
}

async function buscarAparencias(sheets, tipo, target) {
  if (!sheets) return [];
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID || "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
    range: "INDIVIDUAIS!A:D",
  });
  const rows = res.data.values || [];
  const resultados = [];
  const targetNorm = normalizeText(target);

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row) continue;
    const [aparencia, universo, personagem, jogador] = row;
    if (!aparencia) continue;

    if (tipo === 'nome') {
      const aparNorm = normalizeText(aparencia);
      if (aparNorm.length < 2) continue;
      let ehSimilar = false;
      const palavrasApar = aparNorm.split(' ');
      const limiar = Math.max(1, Math.floor(targetNorm.length / 4));
      for (const palavra of palavrasApar) if (calcularDistanciaLev(palavra, targetNorm) <= limiar) { ehSimilar = true; break; }
      if (aparNorm.includes(targetNorm) || ehSimilar) resultados.push({ aparencia, universo, personagem, jogador, rowIndex: rowIndex + 1 });
    } else if (tipo === 'verso') {
      if (normalizeText(universo) === targetNorm) resultados.push({ aparencia, universo, personagem, jogador, rowIndex: rowIndex + 1 });
    }
  }
  return resultados;
}
