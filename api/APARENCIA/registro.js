const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  EmbedBuilder,
} = require("discord.js");
const { google } = require("googleapis");
const path = require("path");

// Configurações unificadas para os tipos de registro
const REGISTRY_CONFIG = {
  'aparência': {
    titulo: "<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **",
    nomeItem: "Aparência",
    artigo: "a",
    campos: [
      { id: 'argNome', label: 'Nome da Aparência', style: TextInputStyle.Short, required: true },
      { id: 'argUniverso', label: 'Universo de Origem', style: TextInputStyle.Short, required: true },
      { id: 'argPersonagem', label: 'Personagem do RPG', style: TextInputStyle.Short, required: true }
    ],
    range: "INDIVIDUAIS!A:D",
    mapearLinha: (dados) => [dados.argNome, dados.argUniverso, dados.argPersonagem, dados.jogador]
  },
  'verso': {
    titulo: "<:DNAstrand:1406986203278082109> | ** SISTEMA DE VERSOS **",
    nomeItem: "Verso",
    artigo: "o",
    campos: [
      { id: 'argNome', label: 'Nome do Verso', style: TextInputStyle.Short, required: true },
      { id: 'argUso', label: '% de uso atual', style: TextInputStyle.Short, required: true }
    ],
    range: "UNIVERSO!A:C",
    mapearLinha: (dados) => [dados.argNome, dados.argUso, dados.jogador],
    posRegistro: handleVersoPostRegister // Função específica para pós-registro de verso
  }
};

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function handleRegistro(tipo, target, msgNavegacao, interaction, sChannel, client, sheets, exactMatch, resultados, skipConfirmation = false) {
  const config = REGISTRY_CONFIG[tipo];
  if (!config) return console.error(`Tipo de registro desconhecido: ${tipo}`);

  const user = interaction.user || interaction.author;
  const guild = interaction.guild;
  const userDb = await client.database.userData.findOne({ uid: user.id, uServer: guild.id });

  // 1. Fluxo de Resultados Similares (Navegação)
  if (!skipConfirmation && exactMatch === false && resultados.length > 0) {
    return handleSimilarResults(tipo, target, msgNavegacao, interaction, sChannel, client, sheets, resultados, config);
  }

  // 2. Fluxo de Registro (Direto ou Confirmação)
  if (skipConfirmation) {
    return showRegistrationModal(interaction, config, target, userDb, sheets, client);
  } else {
    return showAvailabilityPrompt(msgNavegacao, interaction, config, target, userDb, sheets, client);
  }
} //async function

async function handleSimilarResults(tipo, target, msgNavegacao, interaction, sChannel, client, sheets, resultados, config) {
  let page = 0;
  const generateEmbed = (idx) => {
    const r = resultados[idx];
    return new EmbedBuilder()
      .setTitle(config.titulo)
      .setColor("#212416")
      .setDescription(`<:patrickconcern:1407564230256758855> | Resultado similar ${idx + 1} de ${resultados.length}`)
      .addFields(
        { name: `**${config.nomeItem.toUpperCase()}**`, value: r.aparencia ?? r.verso ?? "—" },
        { name: "**UNIVERSO**", value: r.universo ?? "—" },
        { name: "**PERSONAGEM**", value: r.personagem ?? "—" },
        { name: "**JOGADOR**", value: r.jogador ?? "—" }
      )
      .setFooter({ text: `Página ${idx + 1}/${resultados.length}` });
  };

  const generateButtons = (idx) => {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("sim_registro_paginado").setLabel("SIM").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("prev_paginado").setLabel("⏪").setStyle(ButtonStyle.Primary).setDisabled(idx === 0),
      new ButtonBuilder().setCustomId("next_paginado").setLabel("⏩").setStyle(ButtonStyle.Primary).setDisabled(idx === resultados.length - 1),
      new ButtonBuilder().setCustomId("close_paginado").setLabel("❌").setStyle(ButtonStyle.Danger)
    );
  };

  // Página inicial: Oferta de registro
  const embedRegistro = new EmbedBuilder()
    .setTitle(`✅ | **${config.nomeItem.toUpperCase()} DISPONÍVEL!**`)
    .setDescription(`A aparência **${target}** está disponível.\n\nEncontramos também resultados similares. Selecione "SIM" para registrar **${target}**, ou navegue para ver os outros resultados.`)
    .setColor("#00ff00");

  await msgNavegacao.edit({ embeds: [embedRegistro], components: [generateButtons(0)], fetchReply: false }).catch(() => {});

  const collector = msgNavegacao.createMessageComponentCollector({ filter: (i) => i.user.id === interaction.user.id, time: 60000 });

  collector.on("collect", async (i) => {
    switch (i.customId) {
      case "sim_registro_paginado":
        collector.stop();
        await showRegistrationModal(i, config, target, await client.database.userData.findOne({ uid: interaction.user.id, uServer: interaction.guild.id }), sheets, client);
        break;
      case "prev_paginado":
        page = Math.max(0, page - 1);
        await i.update({ embeds: [generateEmbed(page)], components: [generateButtons(page)] });
        break;
      case "next_paginado":
        page = Math.min(resultados.length - 1, page + 1);
        await i.update({ embeds: [generateEmbed(page)], components: [generateButtons(page)] });
        break;
      case "close_paginado":
        collector.stop("closed");
        break;
    }
  });

  collector.on("end", (c, r) => {
    if (r === "closed") msgNavegacao.delete().catch(() => {});
    else msgNavegacao.edit({ components: [] }).catch(() => {});
  });
}

async function showAvailabilityPrompt(msgNavegacao, interaction, config, target, userDb, sheets, client) {
  const embed = new EmbedBuilder()
    .setColor("#00ff00")
    .setTitle(`** ${config.titulo} **`)
    .setDescription(`${config.nomeItem} ${target} disponível!`)
    .addFields({ name: `Deseja registrar ${config.artigo} ${config.nomeItem.toLowerCase()}?`, value: "Clique no botão para responder" });

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("sim_registro").setLabel("SIM").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("nao_registro").setLabel("NÃO").setStyle(ButtonStyle.Danger)
  );

  await msgNavegacao.edit({ embeds: [embed], components: [buttons], fetchReply: false }).catch(() => {});

  const collector = msgNavegacao.createMessageComponentCollector({ filter: (i) => i.user.id === interaction.user.id, time: 15000 });

  collector.on("collect", async (i) => {
    if (i.customId === "sim_registro") {
      collector.stop();
      await showRegistrationModal(i, config, target, userDb, sheets, client);
    } else {
      collector.stop();
      msgNavegacao.delete().catch(() => {});
      interaction.channel.send({ content: "<a:cdfpatpat:1407135944456536186> | **REGISTRO CANCELADO!**" }).catch(() => {});
    }
  });
}

async function showRegistrationModal(interaction, config, target, userDb, sheets, client) {
  const modal = new ModalBuilder().setCustomId("modal_registro_generico").setTitle(`Registro de ${config.nomeItem}`);
  
  config.campos.forEach(campo => {
    const input = new TextInputBuilder()
      .setCustomId(campo.id)
      .setLabel(campo.label)
      .setStyle(campo.style)
      .setRequired(campo.required);
    
    if (campo.id === 'argNome' || campo.id === 'argVerso') input.setValue(target);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  });

  await interaction.showModal(modal);

  const modalInteraction = await interaction.awaitModalSubmit({ time: 150000, filter: i => i.user.id === interaction.user.id }).catch(() => null);
  if (!modalInteraction) return;

  await modalInteraction.deferUpdate();

  const args = {
    argNome: modalInteraction.fields.getTextInputValue(config.campos[0].id),
    argUniverso: config.campos[1].id === 'argUniverso' ? modalInteraction.fields.getTextInputValue('argUniverso') : null,
    argPersonagem: config.campos[2]?.id === 'argPersonagem' ? modalInteraction.fields.getTextInputValue('argPersonagem') : null,
    argUso: config.campos[1].id === 'argUso' ? modalInteraction.fields.getTextInputValue('argUso') : null,
    jogador: userDb?.jogador || interaction.user.username
  };

  const keyFilePath = path.join(__dirname, "../../api/regal-primacy-233803-4fc7ea1a8a5a.json");
  const auth = new google.auth.GoogleAuth({ keyFile: keyFilePath, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheetsUp = google.sheets({ version: "v4", auth });

  if (config.nomeItem === 'Aparência') {
    const resUni = await sheetsUp.spreadsheets.values.get({
      spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
      range: "UNIVERSO!A:C"
    });
    const rowsUni = resUni.data.values || [];
    
    const userVersos = rowsUni.filter(r => normalize(r[2]) === normalize(args.jogador));
    
    const incompleteVersos = userVersos.filter(r => {
      const usoStr = String(r[1] || "0").replace('%', '').replace(',', '.');
      const uso = parseFloat(usoStr);
      return uso < 100;
    });

    if (incompleteVersos.length > 0) {
      const targetVerso = normalize(args.argUniverso);
      const ownsTarget = userVersos.some(r => normalize(r[0]) === targetVerso);

      if (!ownsTarget && userDb.tokenAp <= 0) {
        const listaPendencias = incompleteVersos.map(r => `• **${r[0]}** (${r[1]})`).join('\n');
        return modalInteraction.followUp({
          content: `<:berror:1406837900556898304> | **Registro Bloqueado!**\n\nVocê possui universos com uso incompleto. Para registrar uma nova aparência, você deve completar seus universos atuais ou registrar a aparência em um universo que você já possui.\n\n**Suas Pendências:**\n${listaPendencias}\n\n**Universo tentado:** ${args.argUniverso}`,
          flags: 64
        });
      }
    }
  }

  if(userDb.tokenAp > 0) {
    userDb.tokenAp -= 1;
    await userDb.save();
    await modalInteraction.followUp({ content: `<:ctokenap:1409062391083031040> | Você utilizou um espaço de reserva por ter descartado uma aparência para registrar ${config.artigo} ${config.nomeItem.toLowerCase()}.`, flags: 64 });
  }

  // Salvar na planilha
  const res = await sheetsUp.spreadsheets.values.get({ spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo", range: config.range });
  const nextRow = (res.data.values || []).length + 1;

  const values = config.mapearLinha(args);
  const [sheetName] = config.range.split("!");
  
  await sheetsUp.spreadsheets.values.update({
    spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
    range: `${sheetName}!A${nextRow}`,
    valueInputOption: "USER_ENTERED",
    resource: { values: [values] }
  });

  if (config.posRegistro) {
    await config.posRegistro(modalInteraction, args, sheetsUp, client);
  } else {
    await modalInteraction.followUp({ content: `<a:cat_dance:1409062402288521266> | ${config.nomeItem} "${args.argNome}" foi registrad${config.artigo} com sucesso!`, flags: 64 });
  }
  
  console.log(`SISTEMA DE REGISTRO | ${args.jogador} registrou ${config.nomeItem} ${args.argNome}`);
}

async function handleVersoPostRegister(interaction, args, sheets, client) {
  if (!args.argUso || parseFloat(args.argUso) <= 0) {
    return interaction.followUp({ content: `<a:cat_dance:1409062402288521266> | Verso "${args.argNome}" registrado com sucesso!`, flags: 64 });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("add_apps_verso").setLabel("Adicionar Aparências Utilizadas").setStyle(ButtonStyle.Primary)
  );

  const msg = await interaction.followUp({
    content: `<:cpnews:1411060646019338406> | Verso registrado! Como o uso é ${args.argUso}, adicione as aparências já utilizadas.`,
    components: [row],
    flags: 64,
    fetchReply: true
  });

  const btn = await msg.awaitMessageComponent({ time: 60000 }).catch(() => null);
  if (!btn) return msg.edit({ components: [] });

  const modal = new ModalBuilder().setCustomId("modal_apps_verso").setTitle("Aparências Usadas");
  const input = new TextInputBuilder().setCustomId("apps_input").setLabel("Lista (Nome Universo Personagem)").setStyle(TextInputStyle.Paragraph).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));

  await btn.showModal(modal);
  const submit = await btn.awaitModalSubmit({ time: 300000 }).catch(() => null);
  if (!submit) return;

  await submit.deferUpdate();
  const lines = submit.fields.getTextInputValue("apps_input").split("\n").filter(l => l.trim());
  const rows = lines.map(line => {
    const parts = line.trim().split(/\s+/);
    const char = parts.pop() || "Desconhecido";
    const uni = parts.pop() || "Desconhecido";
    const name = parts.join(" ") || line;
    return [name, uni, char, args.jogador];
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
    range: "INDIVIDUAIS!A1",
    valueInputOption: "USER_ENTERED",
    resource: { values: rows }
  });

  await submit.followUp({ content: `✅ ${rows.length} aparências adicionadas ao verso!`, flags: 64 });
}

module.exports = { handleRegistro };
