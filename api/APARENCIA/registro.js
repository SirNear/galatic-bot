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

async function handleRegistro(
  tipo,
  target,
  msgNavegacao,
  message,
  sChannel,
  client,
  sheets,
  exactMatch,
  resultados
) {
  let userDb = await client.database.userData.findById(
    `${message.author.globalName} ${message.guild.name}`
  );

  /* #region  CONFIGURAÇÃO - SELEÇÃO VERSO OU APARÊNCIA */
  const configs = {
    aparência: {
      tituloSistema:
        "<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109> ",
      nomeItem: "Aparência",
      nomeItemNoArtigo: "a aparência", // Para gramática correta
      labelCampo1: "Nome da Aparência",
      labelCampo2: "Universo de Origem",
      labelCampo3: "Personagem do RPG",
      customIdCampo1: "campoNome",
      customIdCampo2: "campoUniverso",
      customIdCampo3: "campoPersonagem",
      rangePlanilha: "INDIVIDUAIS!A:D", // Colunas A a D
      colunasPlanilha: (args) => [
        args.argNome,
        args.argUniverso,
        args.argPersonagem,
        args.argJogador,
      ],
    },
    verso: {
      tituloSistema:
        "<:DNAstrand:1406986203278082109>+ | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109> ",
      nomeItem: "Verso",
      nomeItemNoArtigo: "o verso",
      /* #region  CAMPOS MODAL/FORMULARIO */
      labelCampo1: "Nome do Verso",
      labelCampo2: "% de uso atual",
      labelCampo3: null, // Não precisamos do terceiro campo para versos
      /* #endregion */
      customIdCampo1: "campoVerso",
      customIdCampo2: "campoUso",
      rangePlanilha: "UNIVERSO!A:C",
      colunasPlanilha: (args) => [args.argNome, args.argUso, args.argJogador],
      customIdAParenciasUsadas: "campoAparenciasVerso", 
    },
  };

  const config = configs[tipo]; // Seleciona a configuração correta
  if (!config) {
    console.error("Tipo de registro inválido:", tipo);
    return;
  }
  /* #endregion */

  /* #region  se tiver termos próximos E exatMatch */
  if (exactMatch === false && resultados.length > 0) {
    let pages = [];

    // Página 0: oferta de registro
    const embedRegistro = new EmbedBuilder()
      .setTitle(`✅ | **${config.nomeItem.toUpperCase()} DISPONÍVEL!**`)
      .setDescription(
        `A aparência **${target}** está disponível.\n\nEncontramos também resultados similares. Selecione "SIM" para registrar **${target}**, ou "NÃO" para ver os outros resultados.`
      )
      .setColor("#00ff00");
    pages.push(embedRegistro);

    // Cria as páginas para os resultados similares
    resultados.forEach((r, idx) => {
      const pageEmbed = new EmbedBuilder()
        .setTitle(config.tituloSistema)
        .setColor("#212416")
        .setDescription(
          `<:patrickconcern:1407564230256758855> | Resultado similar ${
            idx + 1
          } de ${resultados.length}`
        )
        .addFields(
          // Adapta os campos para serem genéricos
          {
            name: `**${config.nomeItem.toUpperCase()}**`,
            value: r.aparencia ?? r.verso ?? "—",
          },
          { name: "**UNIVERSO**", value: r.universo ?? "—" },
          { name: "**PERSONAGEM**", value: r.personagem ?? "—" },
          { name: "**JOGADOR**", value: r.jogador ?? "—" }
        );
      pages.push(pageEmbed);
    });

    // Adiciona o número da página no rodapé
    pages.forEach((embed, idx) =>
      embed.setFooter({ text: `Página ${idx + 1}/${pages.length}` })
    );

    let page = 0; //DEFINE PAGINA 0 PARA EXIBIR SIM E NÃO - registro sempre na primeira pagina

    /* #region  BOTÕES NAVEGÇAÃO */
    const navRow = (idx) => {
      //página 0 (oferta de registro), mostra SIM/NÃO
      if (idx === 0) {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("sim_registro_paginado")
            .setLabel("SIM")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("nao_ver_similares")
            .setLabel("NÃO")
            .setStyle(ButtonStyle.Danger)
        );
      }
      // navegação / paginação
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev_paginado")
          .setLabel("⏪")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(idx === 1),
        new ButtonBuilder()
          .setCustomId("next_paginado")
          .setLabel("⏩")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(idx === pages.length - 1),
        new ButtonBuilder()
          .setCustomId("close_paginado")
          .setLabel("❌")
          .setStyle(ButtonStyle.Danger)
      );
    };
    /* #endregion */

    await msgNavegacao
      .edit({ embeds: [pages[page]], components: [navRow(page)] })
      .catch(() => {});

    const navCollector = msgNavegacao.createMessageComponentCollector({
      filter: (ii) => ii.user.id === message.author.id,
      time: 60000,
    });

    /* #region  PAGINAÇÃO */
    navCollector.on("collect", async (ii) => {
      switch (ii.customId) {
        case "sim_registro_paginado":
          navCollector.stop();
          await handleRegistro(
            tipo,
            target,
            msgNavegacao,
            message,
            sChannel,
            client,
            sheets
          ); // Chamada recursiva para o fluxo simples
          break;
        case "nao_ver_similares":
          page = 1; // Pula para a primeira página de resultados navegação
          await ii
            .update({ embeds: [pages[page]], components: [navRow(page)] })
            .catch(() => {});
          break;
        case "prev_paginado":
          page = Math.max(1, page - 1);
          await ii
            .update({ embeds: [pages[page]], components: [navRow(page)] })
            .catch(() => {});
          break;
        case "next_paginado":
          page = Math.min(pages.length - 1, page + 1);
          await ii
            .update({ embeds: [pages[page]], components: [navRow(page)] })
            .catch(() => {});
          break;
        case "close_paginado":
          navCollector.stop("closed");
          break;
      }
    });
    /* #endregion */

    navCollector.on("end", async (collected, reason) => {
      if (reason === "closed") {
        await msgNavegacao.delete().catch(() => {});
        message
          .reply({
            content:
              "<a:cdfpatpat:1407135944456536186> | **NAVEGAÇÃO FINALIZADA!**",
          })
          .catch(() => {});
      } else {
        await msgNavegacao.edit({ components: [] }).catch(() => {});
      }
    });

    /* #endregion */
  } else {
    /* #region  BOTÃO e EMBED - DESEJA REGISTRAR? */
    const embedEmpty = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle(`** ${config.tituloSistema} **`)
      .setDescription(`${config.nomeItem} ${target} disponível!`)
      .addFields({
        name: `Deseja registrar ${config.nomeItemNoArtigo}?`,
        value: "Clique no botão para responder",
      });

    const botaoSelecaoRegistro = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("sim_registro")
        .setLabel("SIM")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("nao_registro")
        .setLabel("NÃO")
        .setStyle(ButtonStyle.Danger)
    );
    /* #endregion */

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
      coletorBotoesRegistro.stop(); // Para o coletor após o primeiro clique

      if (ii.customId === "sim_registro") {
        /* #region  FORMULÁRIO DE REGISTRO PADRÃO - VERSO E APARÊNCIA */
        const formularioRegisto = new ModalBuilder()
          .setCustomId("formularioGenerico")
          .setTitle(`Registro de ${config.nomeItem}`);

        const campo1 = new TextInputBuilder()
          .setCustomId(config.customIdCampo1)
          .setLabel(config.labelCampo1)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue(target);
        const campo2 = new TextInputBuilder()
          .setCustomId(config.customIdCampo2)
          .setLabel(config.labelCampo2)
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        formularioRegisto.addComponents(
          new ActionRowBuilder().addComponents(campo1),
          new ActionRowBuilder().addComponents(campo2)
        );
        /* #endregion */

        // Adiciona o terceiro campo apenas se for para 'aparência'
        // campos = config.labelCampo{numero 1-3} - ver nas configs

        /* #region  LABEL APARÊNCIA */
        if (config.labelCampo3) {
          // se for aparência, tem o labelCampo3 = personagem
          const campo3 = new TextInputBuilder()
            .setCustomId(config.customIdCampo3)
            .setLabel(config.labelCampo3)
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          // inserir cmapo3 (personagem) no formulário
          formularioRegisto.addComponents(
            new ActionRowBuilder().addComponents(campo3)
          );
        }
        /* #endregion */

        //mostrar formulario
        await ii.showModal(formularioRegisto);

        //envio do formulário
        ii.awaitModalSubmit({ time: 150000 })
          .then(async (modalInteraction) => {
            await modalInteraction.deferUpdate(); //confirma envio

            //PASSAR ARGUMENTOS ENVIADOS NO FORMULÁRIO
            const args = {
              argNome: modalInteraction.fields.getTextInputValue(
                config.customIdCampo1
              ),
              argUniverso:
                tipo === "aparência"
                  ? modalInteraction.fields.getTextInputValue(
                      config.customIdCampo2
                    )
                  : null,
              argUso:
                tipo === "verso"
                  ? modalInteraction.fields.getTextInputValue(
                      config.customIdCampo2
                    )
                  : null,
              argPersonagem:
                tipo === "aparência"
                  ? modalInteraction.fields.getTextInputValue(
                      config.customIdCampo3
                    )
                  : null,
              argJogador: userDb.jogador,
            };

            // LÓGICA VERSO DAQUI PRA BAIXO
            //verifica se a pessoa colocou % ou não e se não, insere
            if (
              tipo === "verso" &&
              (args.argUso !== null || args.argUso !== 0)
            ) {
              let usoValue = String(args.argUso).trim();
              if (!usoValue.endsWith("%")) {
                const parsedUso = parseFloat(usoValue);
                if (!isNaN(parsedUso)) {
                  usoValue = `${parsedUso}%`;
                }
              }
              args.argUso = usoValue; // Atualiza o valor de uso formatado
            }

            /* #region ACHJAR LINHA VAZIA PARA REGISTRAR*/
            const res = await sheets.spreadsheets.values.get({
              spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
              range: config.rangePlanilha,
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
              scopes: ["https://www.googleapis.com/auth/spreadsheets"],
            });
            let sheetsUp = google.sheets({
              version: "v4",
              auth: authUp,
            });

            const valoresParaPlanilha = config.colunasPlanilha(args);

            const [sheetName, columnRange] = config.rangePlanilha.split("!");
            const lastColumn = columnRange.split(":")[1];

            const rangeFinal = `${sheetName}!A${i + 1}:${lastColumn}${i + 1}`;

            await sheetsUp.spreadsheets.values.update({
              spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
              range: rangeFinal,
              valueInputOption: "USER_ENTERED",
              resource: {
                majorDimension: "ROWS",
                values: [valoresParaPlanilha],
              },
            });
            /* #endregion */

            // verifica se o uso registrado pelo usuario é maior que 0, então obriga a inserir aparências
            if (tipo === "verso" && parseFloat(args.argUso) > 0) {
              /* #region  FORMULARIO DE APARENCIAS JA USADAS */
              let title = `Aparências usadas: ${args.argNome}`;
              if (title.length > 45) {
                const acronym = args.argNome
                  .split(/\s+/)
                  .map((word) => word.charAt(0))
                  .join('');
                title = `Aparências usadas: ${acronym}`;
              }

              const formularioAparencias = new ModalBuilder() //formulário para registrar aparencia ja usadas
                .setCustomId("formularioAparenciasVerso")
                .setTitle(title.slice(0, 45));

              const idParaInput = config.customIdAParenciasUsadas;
              if (typeof idParaInput !== 'string') {
                console.error('ERRO IMINENTE! O customId é undefined. Variáveis atuais:', { tipo, config });
              }

              const campoAparencias = new TextInputBuilder() //campo para inserir aparencias
                .setCustomId(idParaInput)
                .setLabel("Aparências (Nome, Universo, Personagem)")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setPlaceholder(
                  "Ex: Aparencia1 Universo1 Personagem1\nOutraAparencia2 OutroUniverso2 OutroPersonagem2"
                );

              formularioAparencias.addComponents(
                new ActionRowBuilder().addComponents(campoAparencias)
              );
              /* #endregion */

              /* #region  BOTÃO PARA REGISTRAR APARÊNCIAS */
              const addAppearancesButton = new ButtonBuilder()
                .setCustomId("add_appearances_for_verso")
                .setLabel("Adicionar Aparências Utilizadas")
                .setStyle(ButtonStyle.Primary);

              const row = new ActionRowBuilder().addComponents(
                addAppearancesButton
              );
              /* #endregion */

              const msgRegistroAparenciasVerso =
                await modalInteraction.followUp({
                  content: `<:cpnews:1411060646019338406> | O verso "${args.argNome}" foi registrado. Como o uso é ${args.argUso}, é obrigatório adicionar as aparências já utilizadas. Clique no botão abaixo para isso ou a ação será cancelada.`,
                  components: [row],
                  flags: 64,
                  fetchReply: true,
                });

              try {
                const botaoRegistroAparenciaVerso =
                  await msgRegistroAparenciasVerso.awaitMessageComponent({
                    filter: (i) => i.user.id === message.author.id,
                    time: 150000,
                  });

                await botaoRegistroAparenciaVerso.showModal(
                  formularioAparencias
                );
                const aparenciasModalInteraction =
                  await botaoRegistroAparenciaVerso.awaitModalSubmit({
                    time: 3000000,
                  });
                await aparenciasModalInteraction.deferUpdate();

                const aparenciasTexto =
                  aparenciasModalInteraction.fields.getTextInputValue(
                    config.customIdAParenciasUsadas
                  );

                const aparenciasArray = aparenciasTexto
                  .split("\n")
                  .filter((line) => line.trim() !== "");

                if (aparenciasArray.length > 0) {
                  const aparenciasParaRegistrar = [];
                  for (const aparenciaStr of aparenciasArray) {
                    const parts = aparenciaStr.trim().split(/\s+/);
                    let nomeAparencia, universoAparencia, personagemAparencia;

                    if (parts.length >= 3) {
                      personagemAparencia = parts.pop();
                      universoAparencia = parts.pop();
                      nomeAparencia = parts.join(" ");
                    } else {
                      nomeAparencia = aparenciaStr.trim();
                      universoAparencia = "Desconhecido";
                      personagemAparencia = "Desconhecido";
                    }

                    aparenciasParaRegistrar.push([
                      nomeAparencia,
                      universoAparencia,
                      personagemAparencia,
                      args.argJogador,
                    ]);
                  }

                  const resAparencias = await sheets.spreadsheets.values.get({
                    spreadsheetId:
                      "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                    range: "INDIVIDUAIS!A:D",
                  });

                  await sheetsUp.spreadsheets.values.append({
                    spreadsheetId:
                      "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                    range: `INDIVIDUAIS!A1`,
                    valueInputOption: "USER_ENTERED",
                    resource: {
                      majorDimension: "ROWS",
                      values: aparenciasParaRegistrar,
                    },
                  });

                  const aparenciasNomes = aparenciasParaRegistrar.map(
                    (a) => a[0]
                  );
                  const itemsPerPage = 10;
                  const pages = [];
                  for (
                    let i = 0;
                    i < aparenciasNomes.length;
                    i += itemsPerPage
                  ) {
                    pages.push(aparenciasNomes.slice(i, i + itemsPerPage));
                  }

                  let currentPageIndex = 0;

                  const generateEmbed = (pageData, totalPages) => {
                    const embed = new EmbedBuilder()
                      .setColor("#00ff00")
                      .setTitle(`Aparências Registradas`)
                      .setDescription(
                        `Total: ${aparenciasNomes.length} aparências`
                      )
                      .addFields({
                        name: `Página ${currentPageIndex + 1}/${totalPages}`,
                        value:
                          pageData.join("\n") ||
                          "Nenhuma aparência para exibir nesta página.",
                      });
                    return embed;
                  };

                  const getActionRow = (totalPages) => {
                    const row = new ActionRowBuilder();
                    if (totalPages > 1) {
                      row.addComponents(
                        new ButtonBuilder()
                          .setCustomId("prev_page")
                          .setLabel("Anterior")
                          .setStyle(ButtonStyle.Primary)
                          .setDisabled(currentPageIndex === 0),
                        new ButtonBuilder()
                          .setCustomId("next_page")
                          .setLabel("Próximo")
                          .setStyle(ButtonStyle.Primary)
                          .setDisabled(currentPageIndex === totalPages - 1)
                      );
                    }
                    return row;
                  };

                  const totalPages = pages.length > 0 ? pages.length : 1;
                  const initialEmbed = generateEmbed(
                    pages[currentPageIndex] || [],
                    totalPages
                  );
                  const initialActionRow = getActionRow(totalPages);

                  const replyMessage =
                    await aparenciasModalInteraction.followUp({
                      content: `<a:cat_dance:1409062402288521266> | ${aparenciasParaRegistrar.length} aparências foram registradas com sucesso!`,
                      embeds: [initialEmbed],
                      components: totalPages > 1 ? [initialActionRow] : [],
                      flags: 64,
                      fetchReply: true,
                    });

                  if (totalPages > 1) {
                    const collector =
                      replyMessage.createMessageComponentCollector({
                        filter: (i) => i.user.id === message.author.id,
                        time: 300000,
                      });

                    collector.on("collect", async (i) => {
                      if (i.customId === "prev_page") {
                        currentPageIndex--;
                      } else if (i.customId === "next_page") {
                        currentPageIndex++;
                      }

                      const newEmbed = generateEmbed(
                        pages[currentPageIndex],
                        totalPages
                      );
                      const newActionRow = getActionRow(totalPages);

                      await i.update({
                        embeds: [newEmbed],
                        components: [newActionRow],
                      });
                    });

                    collector.on("end", async () => {
                      await replyMessage
                        .edit({ components: [] })
                        .catch(() => {});
                    });
                  }
                }

                await msgRegistroAparenciasVerso
                  .edit({ components: [] })
                  .catch(() => {});
              } catch (aparenciasError) {
                console.error(
                  "Erro ao coletar ou processar aparências opcionais:",
                  aparenciasError
                );
                reply
                  .edit({
                    content:
                      "Tempo esgotado para inserir aparências ou ocorreu um erro.",
                    components: [],
                  })
                  .catch(() => {});
              }
            } else {
              modalInteraction.followUp({
                content: `<a:cat_dance:1409062402288521266> | ${
                  config.nomeItem
                } "${args.argNome}" foi registrad${
                  tipo === "aparência" ? "a" : "o"
                } com sucesso!`,
                flags: 64,
              });
            }

            console.log(
              `SISTEMA DE APARENCIAS | o jogador ${args.argJogador} registrou ${
                tipo === "aparencia" ? "a" : "o"
              } ${config.nomeItem} ${args.argNome} ${
                config.nomeItem === "aparencia"
                  ? `do universo ${args.argUniverso}`
                  : null
              } !`
            );
          })
          .catch(console.error);
      } else if (ii.customId === "nao_registro") {
        msgNavegacao.delete().catch(() => {});
        await message
          .reply({
            content:
              "<a:cdfpatpat:1407135944456536186> | **REGISTRO CANCELADO!**",
          })
          .catch(() => {});
      }
    }); //coletorBotoesRegistro.collect
  }
} //async function

module.exports = { handleRegistro };
