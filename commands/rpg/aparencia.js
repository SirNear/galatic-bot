const {
  Discord,
  ModalBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
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

module.exports = class aparencia extends Command {
  constructor(client) {
    super(client, {
      name: "aparencia",
      category: "rpg",
      aliases: ['ap', 'aparencias', 'aparência', 'aparências', 'pesquisaraparencia', 'pesquisaraparência', 'pesquisarap', 'pesquisaraparecia', 'pesquisaraparencias', 'pesquisaraparências    ', 'pesquisaraparecias'],
      UserPermission: [""],
      clientPermission: null,
      OnlyDevs: false,
    });
  }

  async run({ message, args, client, server }) {
    const sChannel = await message.guild.channels.cache.find((i) => i.id === "1409063037905670154");
const userDb = await client.database.userData.findById(`${message.author.globalName} ${message.guild.name}`);


    async function handleRegistro(msgNavegacao, message, client, embedEmpty, sChannel, target) {
        const botaoSelecaoRegistro = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("sim_ap")
                .setLabel("SIM")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("nao_ap")
                .setLabel("NÃO")
                .setStyle(ButtonStyle.Danger)
        );

        await msgNavegacao
            .edit({
                embeds: [embedEmpty],
                components: [botaoSelecaoRegistro],
            })
            .catch(() => {});

        const coletorBotoesRegistro = msgNavegacao.createMessageComponentCollector({
            filter: (ii) => ii.user.id === message.author.id,
            time: 15000,
        });

        coletorBotoesRegistro.on("collect", async (ii) => {
            switch(ii.customId) {
                case 'sim_ap':
                    /* #region  BOTÃO REGISTRO */
                    const botaoSelecaoRegistro =
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId("sim_ap")
                                .setLabel("SIM")
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId("nao_ap")
                                .setLabel("NÃO")
                                .setStyle(ButtonStyle.Danger)
                        );
                    /* #endregion */

                    await msgNavegacao
                    .edit({
                        embeds: [embedEmpty],
                        components: [botaoSelecaoRegistro],})
                    .catch(() => {});

                    const coletorBotoesRegistro =
                    msgNavegacao.createMessageComponentCollector({
                        filter: (ii) => ii.user.id === message.author.id,
                        time: 15000,
                    });
                        /* #region  FORMULARIO */
                        let formularioRegisto = new ModalBuilder()
                        .setCustomId("esqueletoFormularioRegistro")
                        .setTitle("Registro de Ficha");

                        let campoNome = new TextInputBuilder()
                        .setCustomId("campoNome")
                        .setLabel("Nome da Aparência")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                        let campoUniverso = new TextInputBuilder()
                        .setCustomId("campoUniverso")
                        .setLabel("Universo de Origem")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                        let campoPersonagem = new TextInputBuilder()
                        .setCustomId("campoPersonagem")
                        .setLabel("Personagem do RPG")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                        const actionRowNome = new ActionRowBuilder().addComponents(
                        campoNome
                        );
                        const actionRowUniverso =
                        new ActionRowBuilder().addComponents(campoUniverso);
                        const actionRowPersonagem =
                        new ActionRowBuilder().addComponents(campoPersonagem);

                        formularioRegisto.addComponents(
                        actionRowNome,
                        actionRowUniverso,
                        actionRowPersonagem
                        );
                        /* #endregion */

                        await ii.showModal(formularioRegisto);

                        const filter = (ii) => ii.customId === "esqueletoFormularioRegistro"; 
                        
                        ii.awaitModalSubmit({ filter, time: 150000 }).then( async (modalInteraction) => { 
                            await modalInteraction.deferUpdate();

                            /* #region  PARAMETROS DE REGISTRO */
                            
                            let argNome =
                            await modalInteraction.fields.getTextInputValue(
                                "campoNome"
                            );
                            let argUniverso =
                            await modalInteraction.fields.getTextInputValue(
                                "campoUniverso"
                            );
                            let argPersonagem =
                            await modalInteraction.fields.getTextInputValue(
                                "campoPersonagem"
                            );
                            let argJogador = await userDb.jogador;

                            /* #endregion */

                            /* #region   ACHJAR LINHA VAZIA*/
                            const res = await sheets.spreadsheets.values.get({
                            spreadsheetId:
                                "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                            range: "A:D",
                            });
                            const rows = res.data.values || [];
                            let i = 0;
                            for (i = 0; i < rows.length; i++) {
                            if (!rows[i][0]) break;
                            }
                            const path = require("path");
                            const keyFilePath = path.join(
                            __dirname,
                            "../../api/regal-primacy-233803-4fc7ea1a8a5a.json"
                            );

                            let authUp = new google.auth.GoogleAuth({
                            keyFile: keyFilePath,
                            scopes: [
                                "https://www.googleapis.com/auth/spreadsheets",
                            ], // Escopo para ler e escrever
                            });
                            let sheetsUp = google.sheets({
                            version: "v4",
                            auth: authUp,
                            });

                            await sheetsUp.spreadsheets.values.update({
                            spreadsheetId:
                                "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                            range: `INDIVIDUAIS!A${i + 1}:D${i + 1}`,
                            valueInputOption: "USER_ENTERED",
                            resource: {
                                majorDimension: "ROWS",
                                values: [
                                [argNome, argUniverso, argPersonagem, argJogador],
                                ],
                            },
                            });
                            /* #endregion */

                            message.reply({
                            content: `<a:cat_dance:1409062402288521266> | A aparência ${argNome} do universo de ${argUniverso} foi registrada com sucesso para o personagem ${argPersonagem} em nome de ${argJogador}`,
                            });

                            logs.AparenciaRegistrada(message,userDb,argNome,argUniverso,argPersonagem,sChannel);
                        }); //ii.awaitModalSubmit
                        
                    break;
                case 'nao_ap':
                    msgNavegacao.delete().catch(() => {});
                    await message.reply({
                        content: "<a:cdfpatpat:1407135944456536186> | **REGISTRO CANCELADO!** Tudo bem, você pode reservar depois, se estiver disponível",
                    }).catch(() => {});

                    break;
                default:
                    return;
            }
        });//coletorBotoesRegistro
    } //handleRegisto

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
            let tempoRestante = 15;
            let sujeito = "enviar a aparência";
            let msgAlvo = msgNavegacao;
            let { intervalo, contador } = await iniciarContador(
              tempoRestante,
              sujeito,
              msgAlvo,
              message
            );
            /* #endregion */

            const coletorAparencia =
              msgNavegacao.channel.createMessageCollector({
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

            function normalizeText(s) {
                return String(s || "")
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^\w\s-]/g, "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase();
            }

            const target = normalizeText(nomeAparencia);

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
                    const aparNorm = normalizeText(aparencia);
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

            // PONTO-CHAVE 1: Verificamos PRIMEIRO se existe uma correspondência exata.
            const exactMatch = resultados.find(r => normalizeText(r.aparencia) === target);

            // CENÁRIO 1: Uma correspondência exata FOI encontrada.
            if (exactMatch) {
                const embedExato = new EmbedBuilder()
                    .setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **`)
                    .setDescription(`<:PepeHands:1407563136197984357> | Aparência em uso!`)
                    .setColor("#8f0808")
                    .addFields(
                        { name: "**APARÊNCIA**", value: exactMatch.aparencia ?? "—" },
                        { name: "**UNIVERSO**", value: exactMatch.universo ?? "—" },
                        { name: "**PERSONAGEM**", value: exactMatch.personagem ?? "—" },
                        { name: "**JOGADOR**", value: exactMatch.jogador ?? "—" }
                    );
                await msgNavegacao.edit({ embeds: [embedExato], components: [] }).catch(() => {});
            
            // CENÁRIO 2: NENHUMA correspondência exata foi encontrada.
            } else {
                // SUB-CENÁRIO 2.1: Não há NENHUM resultado (nem exato, nem similar).
                if (resultados.length === 0) {
                    const embedEmpty = new EmbedBuilder()
                        .setColor("#00ff00")
                        .setTitle("<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **")
                        .setDescription(`Aparência ${target} disponível!`)
                        .addFields({
                            name: "Deseja registrar a aparência?",
                            value: "Clique no botão para responder",
                        });
                    await handleRegistro(msgNavegacao, message, client, embedEmpty, sChannel, target);
                
                // SUB-CENÁRIO 2.2: Não há resultado exato, MAS HÁ resultados similares.
                } else {
                    // PONTO-CHAVE 2: É aqui que a sua lógica desejada é construída.
                    let pages = [];

                    // Criamos a primeira página especial que oferece o registro.
                    const embedRegistro = new EmbedBuilder()
                        .setTitle(`✅ | **APARÊNCIA DISPONÍVEL!**`)
                        .setDescription(
                            `Aparência **${target}** está disponível para registro.\n\nEncontramos também resultados similares. Selecione "SIM" para registrar **${target}**, ou "NÃO" para ver os outros resultados encontrados.`
                        )
                        .setColor("#00ff00");
                    pages.push(embedRegistro);

                    // Adicionamos as páginas dos resultados similares.
                    resultados.forEach((r, idx) => {
                        const pageEmbed = new EmbedBuilder()
                            .setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **`)
                            .setColor("#212416")
                            .setDescription(`<:patrickconcern:1407564230256758855> | Resultado similar ${idx + 1} de ${resultados.length}`)
                            .addFields(
                                { name: "**APARÊNCIA**", value: r.aparencia ?? "—" },
                                { name: "**UNIVERSO**", value: r.universo ?? "—" },
                                { name: "**PERSONAGEM**", value: r.personagem ?? "—" },
                                { name: "**JOGADOR**", value: r.jogador ?? "—" }
                            );
                        pages.push(pageEmbed);
                    });
                    
                    // A lógica de paginação abaixo é a mesma da versão anterior,
                    // mas agora ela é acionada no momento correto.
                    pages.forEach((embed, idx) => {
                        embed.setFooter({ text: `Página ${idx + 1}/${pages.length}` });
                    });

                    let page = 0;

                    const navRow = (idx) => {
                        if (idx === 0) { // A primeira página é sempre a de registro
                            return new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId("sim_ap").setLabel("SIM").setStyle(ButtonStyle.Success),
                                new ButtonBuilder().setCustomId("nao_ap").setLabel("NÃO").setStyle(ButtonStyle.Danger)
                            );
                        }
                        
                        return new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("prev_ap").setLabel("⏪").setStyle(ButtonStyle.Primary).setDisabled(idx === 1),
                            new ButtonBuilder().setCustomId("next_ap").setLabel("⏩").setStyle(ButtonStyle.Primary).setDisabled(idx === pages.length - 1),
                            new ButtonBuilder().setCustomId("close_ap").setLabel("❌").setStyle(ButtonStyle.Danger)
                        );
                    };

                    await msgNavegacao.edit({ embeds: [pages[page]], components: [navRow(page)] }).catch(() => {});

                    const navCollector = msgNavegacao.createMessageComponentCollector({ filter: (ii) => ii.user.id === message.author.id, time: 60000 });

                    navCollector.on("collect", async (ii) => {
                        // A lógica do coletor permanece a mesma
                        // ... (código do coletor da versão anterior)
                        // (O código completo do coletor está incluído abaixo para facilitar o copiar e colar)
                        switch (ii.customId) {
                            case 'sim_ap':
                                navCollector.stop();
                                const formularioRegisto = new ModalBuilder().setCustomId("esqueletoFormularioRegistro").setTitle("Registro de Ficha");
                                const campoNome = new TextInputBuilder().setCustomId("campoNome").setLabel("Nome da Aparência").setStyle(TextInputStyle.Short).setRequired(true).setValue(target);
                                const campoUniverso = new TextInputBuilder().setCustomId("campoUniverso").setLabel("Universo de Origem").setStyle(TextInputStyle.Short).setRequired(true);
                                const campoPersonagem = new TextInputBuilder().setCustomId("campoPersonagem").setLabel("Personagem do RPG").setStyle(TextInputStyle.Short).setRequired(true);
                                formularioRegisto.addComponents(new ActionRowBuilder().addComponents(campoNome), new ActionRowBuilder().addComponents(campoUniverso), new ActionRowBuilder().addComponents(campoPersonagem));
                                await ii.showModal(formularioRegisto);
                                const filter = (modalInteraction) => modalInteraction.customId === 'esqueletoFormularioRegistro' && modalInteraction.user.id === ii.user.id;
                                ii.awaitModalSubmit({ filter, time: 150000 })
                                    .then(async (modalInteraction) => {
                                        await modalInteraction.deferUpdate();
                                        await msgNavegacao.edit({ components: [] }).catch(()=>{});
                                        let userDb = await this.client.database.userData.findById(`${message.author.globalName} ${message.guild.name}`);
                                        let argNome = await modalInteraction.fields.getTextInputValue("campoNome");
                                        let argUniverso = await modalInteraction.fields.getTextInputValue("campoUniverso");
                                        let argPersonagem = await modalInteraction.fields.getTextInputValue("campoPersonagem");
                                        let argJogador = await userDb.jogador;
                                        const res = await sheets.spreadsheets.values.get({ spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo", range: "A:D" });
                                        const rows = res.data.values || [];
                                        let i = 0;
                                        for (i = 0; i < rows.length; i++) { if (!rows[i][0]) break; }
                                        const path = require("path");
                                        const keyFilePath = path.join(__dirname, "../../api/regal-primacy-233803-4fc7ea1a8a5a.json");
                                        let authUp = new google.auth.GoogleAuth({ keyFile: keyFilePath, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
                                        let sheetsUp = google.sheets({ version: "v4", auth: authUp });
                                        await sheetsUp.spreadsheets.values.update({
                                            spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                                            range: `INDIVIDUAIS!A${i + 1}:D${i + 1}`,
                                            valueInputOption: "USER_ENTERED",
                                            resource: { majorDimension: "ROWS", values: [[argNome, argUniverso, argPersonagem, argJogador]] },
                                        });
                                        message.reply({ content: `<a:cat_dance:1409062402288521266> | A aparência ${argNome} do universo de ${argUniverso} foi registrada com sucesso para o personagem ${argPersonagem} em nome de ${argJogador}` });
                                        logs.AparenciaRegistrada(message, userDb, argNome, argUniverso, argPersonagem, sChannel);
                                    })
                                    .catch(err => {
                                        if (err.code !== 'InteractionCollectorError') console.error("Erro ao processar modal de registro:", err);
                                        msgNavegacao.delete().catch(() => {});
                                    });
                                break;
                            case 'nao_ap':
                                page = 1;
                                await ii.update({ embeds: [pages[page]], components: [navRow(page)] }).catch(() => {});
                                break;
                            case 'prev_ap':
                                page = Math.max(1, page - 1); // Não deixa voltar para a página 0
                                await ii.update({ embeds: [pages[page]], components: [navRow(page)] }).catch(() => {});
                                break;
                            case 'next_ap':
                                page = Math.min(pages.length - 1, page + 1);
                                await ii.update({ embeds: [pages[page]], components: [navRow(page)] }).catch(() => {});
                                break;
                            case 'close_ap':
                                navCollector.stop("closed");
                                break;
                        }
                    });

                    navCollector.on("end", async (collected, reason) => {
                        if (reason === "closed") {
                            await msgNavegacao.delete().catch(() => {});
                            message.reply({ content: "<a:cdfpatpat:1407135944456536186> | **NAVEGAÇÃO FINALIZADA!**" }).catch(() => {});
                        } else {
                            await msgNavegacao.edit({ components: [] }).catch(() => {});
                        }
                    });
                }
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
                .setTitle("<:DNAstrand:1406986203278082109> | ** SISTEMA DE VERSOS **")
                .setDescription("Envie no chat o nome do verso que deseja pesquisar.")
                .setFooter({ text: "envie apenas o nome do verso." });

            await msgNavegacao.edit({ embeds: [embedVerso], components: [] }).catch(() => {}); 

            /* #region contador */
            intervalo, contador = await iniciarContador(
              tempoRestante,
              sujeito,
              msgAlvo,
              message
            );
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
            function normalizeText(s) {
              return String(s || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^\w\s-]/g, "")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();
            }

            const targetV = normalizeText(verseName);

            let resultadosVerso = [];
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

                const uniNorm = normalizeText(universo);

                // Ignora entradas muito curtas/ruidosas (ex.: "N")
                if (uniNorm.length < 2) continue;

                // aceitar igualdade e correspondência parcial com limites (evita "N" casando)
                if (
                  uniNorm === targetV ||
                  (uniNorm.length >= 3 && uniNorm.includes(targetV)) ||
                  (targetV.length >= 3 && targetV.includes(uniNorm))
                ) {
                  resultadosVerso.push({ universo, uso, jogador });
                }
              } //for
            } catch (err) {
              console.error(err);
              await message.channel.send(
                "Erro ao acessar a planilha de versos."
              );
              return;
            }

            if (resultadosVerso.length === 0) {
              const embedOk = new EmbedBuilder()
                .setTitle("✅ Verso Disponível")
                .setColor("#00ff00")
                .setDescription(
                  `Verso **${verseName}** não está sendo utilizado.`
                );
              await msgNavegacao
                .edit({ embeds: [embedOk], components: [] })
                .catch(() => {});
              return;
            }//if (resultadosVerso.length === 0)

            /* #region  EMBED PAGES VERSO */
            const pagesV = resultadosVerso.map((r, idx) =>
              new EmbedBuilder()
                .setTitle(
                  `<:DNAstrand:1406986203278082109> | VERSO | Resultado ${
                    idx + 1
                  } de ${resultadosVerso.length}`
                )
                .setColor("#212416")
                .setDescription(`Verso: **${r.universo ?? "—"}**`)
                .addFields(
                  { name: "USO (%)", value: String(r.uso ?? "—") },
                  { name: "JOGADOR", value: r.jogador ?? "—" }
                )
                .setFooter({
                  text: `Página ${idx + 1}/${resultadosVerso.length}`,
                })
            );
            /* #endregion */

           /* #region  NAVEGADOR PAGINAS VERSO */
            let pageV = 0;
            const navRowV = (idx) =>
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("prev_v")
                  .setLabel("⏪")
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(idx === 0),
                new ButtonBuilder()
                  .setCustomId("next_v")
                  .setLabel("⏩")
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(idx === pagesV.length - 1),
                new ButtonBuilder()
                  .setCustomId("close_v")
                  .setLabel("❌")
                  .setStyle(ButtonStyle.Danger)
              );

            await msgNavegacao
              .edit({ embeds: [pagesV[pageV]], components: [navRowV(pageV)] })
              .catch(() => {});

            const navCollectorV = msgNavegacao.createMessageComponentCollector({
              filter: (ii) => ii.user.id === message.author.id,
              time: 60000,
            });
            navCollectorV.on("collect", async (ii) => {
              await ii.deferUpdate().catch(() => {});

              if (ii.customId === "prev_v") {

                pageV = Math.max(0, pageV - 1);
                await msgNavegacao.edit({
                    embeds: [pagesV[pageV]],
                    components: [navRowV(pageV)],
                  }).catch(() => {});

              } else if (ii.customId === "next_v") {
                pageV = Math.min(pagesV.length - 1, pageV + 1);

                await msgNavegacao.edit({
                    embeds: [pagesV[pageV]],
                    components: [navRowV(pageV)],
                  }).catch(() => {});

              } else if (ii.customId === "close_v") {
                navCollectorV.stop("closed");
                msgNavegacao.delete().catch(() => {});

                message.reply({
                    content: "<a:cdfpatpat:1407135944456536186> | **NAVEGAÇÃO FINALIZADA!**",
                  }).catch(() => {});

              }//if (ii.customId === 'close_v')
            }); //navCollectorV.on('collect')

            navCollectorV.on("end", async () => {
              await msgNavegacao.edit({ embeds: [], components: [] }) .catch(() => {});
            });
           /* #endregion */
         
            })
          
           coletorVerso.on("end", (collected, reason) => {
            clearInterval(intervalV);
            if (reason === "time" && collected.size === 0) {
              contadorV.edit({ content: "Tempo esgotado." }).catch(() => {});
            }
            // limpa o embed de resultado do fluxo de versos ao terminar
            msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
          });
            break;
        default: return
        }
  })
 }
}
