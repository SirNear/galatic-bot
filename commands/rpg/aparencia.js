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
            .setDescription('Termo de busca (personagem, verso, @usuário, ID ou "histórico")')
            .setRequired(false)
        )
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Buscar todas as aparências/versos de um usuário específico')
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


  async run(context) {
    let message, args, server, interaction;
    if (context.isCommand && context.isCommand()) {
      interaction = context;
      args = [];
    } else {
      message = context.message;
      args = context.args || [];
      server = context.server;
      interaction = context.interaction;
    }
    const guild = message ? message.guild : interaction.guild;
    const botLogChannel = guild.channels.cache.find((i) => i.id === "1409063037905670154");

    let termo = args.join(' ').trim();
    let targetUser = null;

    if (interaction && interaction.options) {
      const optionTermo = interaction.options.getString('termo');
      if (optionTermo) termo = optionTermo;
      const optionUsuario = interaction.options.getUser('usuario');
      if (optionUsuario) targetUser = optionUsuario;
    }

    // Se nenhum usuário foi passado pela opção 'usuario', verifica se o termo contém menção ou ID
    if (!targetUser && termo) {
      const mentionMatch = termo.match(/<@!?(\d{17,20})>/);
      if (mentionMatch) {
        targetUser = await this.client.users.fetch(mentionMatch[1]).catch(() => null);
        termo = termo.replace(mentionMatch[0], '').trim();
      } else if (/^\d{17,20}$/.test(termo.trim())) {
        const potentialUser = await this.client.users.fetch(termo.trim()).catch(() => null);
        if (potentialUser) {
          targetUser = potentialUser;
          termo = '';
        }
      }
    }

    let msgNavegacao;
    if (interaction && !interaction.replied && !interaction.deferred) {
      msgNavegacao = await interaction.reply({ content: '⏳ Preparando busca...', fetchReply: true });
    } else if (interaction) {
      msgNavegacao = await interaction.followUp({ content: '⏳ Preparando busca...', fetchReply: true });
    } else {
      msgNavegacao = await message.reply({ content: '⏳ Preparando busca...' });
    }

    // Função oculta de Histórico Simplificado
    const termoNorm = normalizeText(termo);
    const triggersHistorico = ['historico', 'h', 'hist'];
    if (triggersHistorico.includes(termoNorm)) {
      const userAlvo = targetUser || (interaction ? interaction.user : message.author);
      return this.processarHistoricoUsuario(userAlvo, message || interaction, msgNavegacao, botLogChannel);
    }

    // Se um usuário foi especificado, busca todas as aparências/versos dele em ordem alfabética
    if (targetUser) {
      return this.processarBuscaUsuario(targetUser, message || interaction, msgNavegacao, botLogChannel, termo);
    }

    if (!termo) {
      const embedNavegacao = new EmbedBuilder()
        .setColor("#02607a")
        .setTitle("<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109>")
        .setDescription("Envie no chat o termo que deseja pesquisar (ex: personagem, verso, @usuário, ID ou 'histórico').");

      await msgNavegacao.edit({ embeds: [embedNavegacao], content: null }).catch(() => { });

      const filter = (m) => m.author.id === (interaction ? interaction.user.id : message.author.id);
      const collected = await (interaction ? interaction.channel : message.channel).awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] }).catch(() => null);

      if (!collected) {
        return msgNavegacao.edit({ embeds: [], content: "Tempo esgotado." }).catch(() => { });
      }
      termo = collected.first().content.trim();
      await collected.first().delete().catch(() => { });

      // Re-verifica se o termo digitado foi menção ou ID
      const secondMention = termo.match(/<@!?(\d{17,20})>/);
      if (secondMention) {
        targetUser = await this.client.users.fetch(secondMention[1]).catch(() => null);
        termo = termo.replace(secondMention[0], '').trim();
      } else if (/^\d{17,20}$/.test(termo.trim())) {
        const potentialUser = await this.client.users.fetch(termo.trim()).catch(() => null);
        if (potentialUser) {
          targetUser = potentialUser;
          termo = '';
        }
      }

      const secondTermoNorm = normalizeText(termo);
      if (triggersHistorico.includes(secondTermoNorm)) {
        const userAlvo = targetUser || (interaction ? interaction.user : message.author);
        return this.processarHistoricoUsuario(userAlvo, message || interaction, msgNavegacao, botLogChannel);
      }

      if (targetUser) {
        return this.processarBuscaUsuario(targetUser, message || interaction, msgNavegacao, botLogChannel, termo);
      }
    }

    await msgNavegacao.edit({ embeds: [], content: '⏳ Buscando nas planilhas de Aparência e Universo...' }).catch(() => { });

    await this.processarBusca(termo, message || interaction, msgNavegacao, botLogChannel);
  }

  async processarBuscaUsuario(targetUser, contextMsgOrInt, msgNavegacao, botLogChannel, filtroInicial = '') {
    const author = contextMsgOrInt.author || contextMsgOrInt.user;
    const member = contextMsgOrInt.member;
    const guild = contextMsgOrInt.guild;
    const guildId = guild.id;

    await msgNavegacao.edit({ embeds: [], content: `⏳ Carregando registros de **${targetUser.username}**...` }).catch(() => { });

    let targetMember = null;
    try {
      targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    } catch (_) {}

    const targetUserDb = await this.client.database.userData.findOne({ uid: targetUser.id, uServer: guildId }).catch(() => null);

    const identifiers = new Set([
      normalizeText(targetUserDb?.jogador),
      normalizeText(targetUser.username),
      normalizeText(targetMember?.nickname),
      normalizeText(targetMember?.displayName),
      normalizeText(targetUser.id)
    ].filter(Boolean));

    let resAparencias, resVersos;
    try {
      [resAparencias, resVersos] = await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId: process.env.SPREADSHEET_ID || "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
          range: "INDIVIDUAIS!A:D",
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId: process.env.SPREADSHEET_ID || "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
          range: "UNIVERSO!A:C",
        })
      ]);
    } catch (err) {
      console.error(err);
      return msgNavegacao.edit({ content: "Erro ao acessar as planilhas do Google.", embeds: [] }).catch(() => { });
    }

    const rowsAp = resAparencias.data.values || [];
    const rowsVer = resVersos.data.values || [];

    const allUserAps = [];
    for (let rowIndex = 1; rowIndex < rowsAp.length; rowIndex++) {
      const row = rowsAp[rowIndex];
      if (!row) continue;
      const [aparencia, universo, personagem, jogador] = row;
      if (!aparencia) continue;
      const jogNorm = normalizeText(jogador);
      if (identifiers.has(jogNorm)) {
        allUserAps.push({
          tipo: 'aparencia',
          aparencia,
          universo,
          personagem: personagem || '—',
          jogador: jogador || '—',
          rowIndex: rowIndex + 1
        });
      }
    }
    // Ordem alfabética
    allUserAps.sort((a, b) => (a.aparencia || '').localeCompare(b.aparencia || '', 'pt-BR', { sensitivity: 'base' }));

    const allUserVersos = [];
    for (let rowIndex = 1; rowIndex < rowsVer.length; rowIndex++) {
      const row = rowsVer[rowIndex];
      if (!row) continue;
      const [universo, uso, jogador] = row;
      if (!universo) continue;
      const jogNorm = normalizeText(jogador);
      if (identifiers.has(jogNorm)) {
        allUserVersos.push({
          tipo: 'verso',
          universo,
          uso: uso || '—',
          jogador: jogador || '—',
          rowIndex: rowIndex + 1
        });
      }
    }
    // Ordem alfabética
    allUserVersos.sort((a, b) => (a.universo || '').localeCompare(b.universo || '', 'pt-BR', { sensitivity: 'base' }));

    let currentMode = 'aparencia'; // 'aparencia' | 'verso'
    let filtro = filtroInicial ? filtroInicial.trim() : '';
    let pag = 0;

    const getActiveList = () => {
      const base = currentMode === 'aparencia' ? allUserAps : allUserVersos;
      if (!filtro) return base;
      const fNorm = normalizeText(filtro);
      return base.filter(item => {
        if (item.tipo === 'aparencia') {
          return normalizeText(item.aparencia).includes(fNorm) ||
                 normalizeText(item.universo).includes(fNorm) ||
                 normalizeText(item.personagem).includes(fNorm);
        } else {
          return normalizeText(item.universo).includes(fNorm) ||
                 normalizeText(item.uso).includes(fNorm);
        }
      });
    };

    const targetDisplayName = targetMember?.displayName || targetUser.username;

    const buildEmbed = (list, index) => {
      const embed = new EmbedBuilder()
        .setTitle(`<:DNAstrand:1406986203278082109> | ** REGISTROS DE ${targetDisplayName.toUpperCase()} **`)
        .setColor(currentMode === 'aparencia' ? "#212416" : "#4b0082");

      if (list.length === 0) {
        const modeLabel = currentMode === 'aparencia' ? 'aparência' : 'verso';
        embed.setDescription(`<:berror:1406837900556898304> | Nenhuma ${modeLabel} encontrada para **${targetDisplayName}**${filtro ? ` com o filtro **"${filtro}"**` : ''}.\n\nClique no botão da lupa 🔍 para buscar ou alterne a visualização.`);
        return embed;
      }

      const r = list[index];
      embed.setDescription(`<:patrickconcern:1407564230256758855> | ${currentMode === 'aparencia' ? 'Aparência' : 'Verso'} ${index + 1} de ${list.length}${filtro ? ` • 🔍 Filtro: \`${filtro}\`` : ''}`);

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

      embed.setFooter({ text: `Página ${index + 1}/${list.length} • Ordem Alfabética` });
      return embed;
    };

    const buildComponents = async (list, index) => {
      const components = [];

      // Navegação básica (se houver itens)
      components.push(
        new ButtonBuilder().setCustomId("user_prev_page").setLabel("⏪").setStyle(ButtonStyle.Primary).setDisabled(index === 0 || list.length === 0),
        new ButtonBuilder().setCustomId("user_next_page").setLabel("⏩").setStyle(ButtonStyle.Primary).setDisabled(index >= list.length - 1 || list.length === 0)
      );

      // Alternância entre Aparências e Versos (NUNCA os dois juntos!)
      if (currentMode === 'aparencia') {
        components.push(
          new ButtonBuilder()
            .setCustomId("user_view_versos")
            .setEmoji("🌌")
            .setLabel(`Ver Versos (${allUserVersos.length})`)
            .setStyle(ButtonStyle.Secondary)
        );
      } else {
        components.push(
          new ButtonBuilder()
            .setCustomId("user_view_aparencias")
            .setEmoji("👤")
            .setLabel(`Ver Aparências (${allUserAps.length})`)
            .setStyle(ButtonStyle.Secondary)
        );
      }

      // Botão de Lupa (Buscar na lista do usuário)
      components.push(
        new ButtonBuilder()
          .setCustomId("user_lupa_search")
          .setEmoji("🔍")
          .setLabel("Buscar")
          .setStyle(ButtonStyle.Secondary)
      );

      // Propor Troca (se estiver vendo aparências e for de outro jogador)
      const currentResult = list[index];
      if (currentResult && currentMode === 'aparencia' && targetUser.id !== author.id) {
        components.push(
          new ButtonBuilder()
            .setCustomId(`propor_troca_${currentResult.rowIndex}`)
            .setEmoji('🔃')
            .setLabel('Propor Troca')
            .setStyle(ButtonStyle.Primary)
        );
      }

      // Botão para limpar filtro se houver um ativo
      if (filtro) {
        components.push(
          new ButtonBuilder()
            .setCustomId("user_clear_filter")
            .setEmoji("🔄")
            .setLabel("Limpar Filtro")
            .setStyle(ButtonStyle.Secondary)
        );
      }

      // Cancelar / Fechar
      components.push(
        new ButtonBuilder()
          .setCustomId("close_page")
          .setLabel("❌")
          .setStyle(ButtonStyle.Danger)
      );

      const rows = [];
      for (let i = 0; i < components.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(components.slice(i, i + 5)));
      }
      return rows;
    };

    let activeList = getActiveList();

    await msgNavegacao.edit({
      content: null,
      embeds: [buildEmbed(activeList, pag)],
      components: await buildComponents(activeList, pag),
    }).catch(() => { });

    const navCollector = msgNavegacao.createMessageComponentCollector({
      filter: (ii) => ii.user.id === author.id,
      time: 120000,
      idle: 60000
    });

    navCollector.on("collect", async (ii) => {
      activeList = getActiveList();

      switch (ii.customId) {
        case 'user_prev_page':
          pag = Math.max(0, pag - 1);
          await ii.update({
            embeds: [buildEmbed(activeList, pag)],
            components: await buildComponents(activeList, pag)
          }).catch(() => {});
          break;

        case 'user_next_page':
          pag = Math.min(activeList.length - 1, pag + 1);
          await ii.update({
            embeds: [buildEmbed(activeList, pag)],
            components: await buildComponents(activeList, pag)
          }).catch(() => {});
          break;

        case 'user_view_versos':
          currentMode = 'verso';
          filtro = '';
          pag = 0;
          activeList = getActiveList();
          await ii.update({
            embeds: [buildEmbed(activeList, pag)],
            components: await buildComponents(activeList, pag)
          }).catch(() => {});
          break;

        case 'user_view_aparencias':
          currentMode = 'aparencia';
          filtro = '';
          pag = 0;
          activeList = getActiveList();
          await ii.update({
            embeds: [buildEmbed(activeList, pag)],
            components: await buildComponents(activeList, pag)
          }).catch(() => {});
          break;

        case 'user_clear_filter':
          filtro = '';
          pag = 0;
          activeList = getActiveList();
          await ii.update({
            embeds: [buildEmbed(activeList, pag)],
            components: await buildComponents(activeList, pag)
          }).catch(() => {});
          break;

        case 'close_page':
          navCollector.stop("closed");
          return;

        case 'user_lupa_search': {
          const modalId = `user_search_modal_${Date.now()}`;
          const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle(`Buscar em ${targetDisplayName.substring(0, 30)}`);

          const input = new TextInputBuilder()
            .setCustomId('user_search_query')
            .setLabel(`Qual ${currentMode === 'aparencia' ? 'aparência' : 'verso'} deseja buscar?`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Digite o nome da aparência ou verso...')
            .setValue(filtro || '')
            .setRequired(false);

          modal.addComponents(new ActionRowBuilder().addComponents(input));
          await ii.showModal(modal);

          const submitted = await ii.awaitModalSubmit({
            filter: m => m.customId === modalId && m.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (submitted) {
            filtro = submitted.fields.getTextInputValue('user_search_query').trim();
            pag = 0;
            activeList = getActiveList();
            await submitted.update({
              embeds: [buildEmbed(activeList, pag)],
              components: await buildComponents(activeList, pag)
            }).catch(() => {});
          }
          break;
        }

        default:
          if (ii.customId.startsWith('propor_troca_')) {
            const rowIndex = ii.customId.replace('propor_troca_', '');
            await require('../../api/APARENCIA/troca.js').handleProporTroca(
              ii,
              rowIndex,
              activeList.find(r => r.rowIndex == rowIndex) || allUserAps.find(r => r.rowIndex == rowIndex),
              sheets,
              this.client
            );
            return;
          }
          break;
      }
    });

    navCollector.on("end", async (collected, reason) => {
      if (reason === "time" || reason === "closed" || reason === "idle") {
        msgNavegacao.edit({ components: [] }).catch(() => { });
      }
    });
  }

  async processarHistoricoUsuario(targetUser, contextMsgOrInt, msgNavegacao, botLogChannel) {
    const author = contextMsgOrInt.author || contextMsgOrInt.user;
    const guild = contextMsgOrInt.guild;
    const guildId = guild.id;

    await msgNavegacao.edit({ embeds: [], content: `⏳ Carregando histórico de registros de **${targetUser.username}**...` }).catch(() => { });

    let targetMember = null;
    try {
      targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    } catch (_) {}

    const targetUserDb = await this.client.database.userData.findOne({ uid: targetUser.id, uServer: guildId }).catch(() => null);

    const identifiers = new Set([
      normalizeText(targetUserDb?.jogador),
      normalizeText(targetUser.username),
      normalizeText(targetMember?.nickname),
      normalizeText(targetMember?.displayName),
      normalizeText(targetUser.id)
    ].filter(Boolean));

    let resAparencias, resVersos;
    try {
      [resAparencias, resVersos] = await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId: process.env.SPREADSHEET_ID || "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
          range: "INDIVIDUAIS!A:D",
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId: process.env.SPREADSHEET_ID || "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
          range: "UNIVERSO!A:C",
        })
      ]);
    } catch (err) {
      console.error(err);
      return msgNavegacao.edit({ content: "Erro ao acessar as planilhas do Google.", embeds: [] }).catch(() => { });
    }

    const rowsAp = resAparencias.data.values || [];
    const rowsVer = resVersos.data.values || [];

    const historicoItens = [];

    // Linhas em INDIVIDUAIS (mais ao final da planilha = registros mais recentes)
    for (let rowIndex = 1; rowIndex < rowsAp.length; rowIndex++) {
      const row = rowsAp[rowIndex];
      if (!row) continue;
      const [aparencia, universo, personagem, jogador] = row;
      if (!aparencia) continue;
      const jogNorm = normalizeText(jogador);
      if (identifiers.has(jogNorm)) {
        historicoItens.push({
          tipo: 'aparencia',
          aparencia,
          universo,
          personagem: personagem || 'Sem personagem',
          jogador,
          rowIndex: rowIndex + 1
        });
      }
    }

    // Linhas em UNIVERSO
    for (let rowIndex = 1; rowIndex < rowsVer.length; rowIndex++) {
      const row = rowsVer[rowIndex];
      if (!row) continue;
      const [universo, uso, jogador] = row;
      if (!universo) continue;
      const jogNorm = normalizeText(jogador);
      if (identifiers.has(jogNorm)) {
        historicoItens.push({
          tipo: 'verso',
          universo,
          uso: uso || 'Domínio Total',
          jogador,
          rowIndex: rowIndex + 1
        });
      }
    }

    // Ordena do mais recente para o mais antigo (rowIndex decrescente)
    historicoItens.sort((a, b) => b.rowIndex - a.rowIndex);

    const targetDisplayName = targetMember?.displayName || targetUser.username;

    if (historicoItens.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle(`📜 Histórico de Registros • ${targetDisplayName}`)
        .setColor('#02607a')
        .setDescription(`Nenhum registro de aparência ou verso encontrado no histórico de **${targetDisplayName}**.`);
      return msgNavegacao.edit({ content: null, embeds: [emptyEmbed], components: [] }).catch(() => {});
    }

    // Formatação exata solicitada: NOME DA APARENCIA - UNIVERSO (Personagem)
    const formattedLines = historicoItens.map(item => {
      if (item.tipo === 'aparencia') {
        return `• **${item.aparencia}** - ${item.universo} (${item.personagem})`;
      } else {
        return `• 🌌 **${item.universo}** - ${item.uso} (Verso)`;
      }
    });

    const pageSize = 15;
    const totalPages = Math.ceil(formattedLines.length / pageSize);
    let currentPage = 0;

    const buildHistoryEmbed = (page) => {
      const start = page * pageSize;
      const chunk = formattedLines.slice(start, start + pageSize);
      return new EmbedBuilder()
        .setTitle(`📜 Histórico Simplificado de Registros • ${targetDisplayName}`)
        .setColor('#02607a')
        .setDescription(
          `Histórico dos registros mais recentes de aparências e versos de **${targetDisplayName}**:\n\n` +
          chunk.join('\n')
        )
        .setFooter({ text: `Página ${page + 1}/${totalPages} • Total: ${formattedLines.length} registros (Mais recentes primeiro)` })
        .setTimestamp();
    };

    const buildHistoryComponents = (page) => {
      if (totalPages <= 1) return [];
      return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('hist_prev').setLabel('◀️ Anterior').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('hist_next').setLabel('Próximo ▶️').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1),
        new ButtonBuilder().setCustomId('close_page').setLabel('❌').setStyle(ButtonStyle.Secondary)
      )];
    };

    await msgNavegacao.edit({
      content: null,
      embeds: [buildHistoryEmbed(0)],
      components: buildHistoryComponents(0)
    }).catch(() => {});

    if (totalPages > 1) {
      const collector = msgNavegacao.createMessageComponentCollector({
        filter: i => i.user.id === author.id,
        time: 120000
      });

      collector.on('collect', async i => {
        if (i.customId === 'hist_prev') {
          currentPage = Math.max(0, currentPage - 1);
        } else if (i.customId === 'hist_next') {
          currentPage = Math.min(totalPages - 1, currentPage + 1);
        } else if (i.customId === 'close_page') {
          collector.stop('closed');
          return;
        }

        await i.update({
          embeds: [buildHistoryEmbed(currentPage)],
          components: buildHistoryComponents(currentPage)
        }).catch(() => {});
      });

      collector.on('end', () => {
        msgNavegacao.edit({ components: [] }).catch(() => {});
      });
    }
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
        const jogadorPlanilha = normalizeText(currentResult.jogador);
        // Compara com múltiplos identificadores do usuário para cobrir registros antigos
        // onde o nome pode ter sido diferente (apelido, nick no servidor, username, etc.)
        const isOwner = (
          jogadorPlanilha === normalizeText(userDb.jogador) ||
          jogadorPlanilha === normalizeText(author.username) ||
          jogadorPlanilha === normalizeText(member.nickname || '') ||
          jogadorPlanilha === normalizeText(member.displayName || '')
        );
        const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (isOwner || isAdmin) {
          const rowIndex = currentResult.rowIndex;
          if (currentResult.tipo === 'aparencia') {
            components.push(
              new ButtonBuilder().setCustomId(`edit_appearance_${rowIndex}`).setEmoji('✏️').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(`delete_appearance_${rowIndex}`).setEmoji('🗑️').setStyle(ButtonStyle.Danger)
            );
          } else if (currentResult.tipo === 'verso') {
            components.push(
              new ButtonBuilder().setCustomId(`delete_verso_${rowIndex}`).setEmoji('🗑️').setStyle(ButtonStyle.Danger)
            );
          }
        } 
        
        if (!isOwner && currentResult.tipo === 'aparencia') {
          const rowIndex = currentResult.rowIndex;
          components.push(
            new ButtonBuilder().setCustomId(`propor_troca_${rowIndex}`).setEmoji('🔃').setLabel('Propor Troca').setStyle(ButtonStyle.Primary)
          );
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
          if (ii.customId.startsWith('propor_troca_')) {
            const rowIndex = ii.customId.replace('propor_troca_', '');
            await require('../../api/APARENCIA/troca.js').handleProporTroca(ii, rowIndex, resultados.find(r => r.rowIndex == rowIndex), sheets, this.client);
            return;
          }
          if (
            ii.customId.startsWith('edit_appearance_') || 
            ii.customId.startsWith('delete_appearance_') ||
            ii.customId.startsWith('delete_verso_') ||
            ii.customId.startsWith('confirm_delete_verso_')
          ) {
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
