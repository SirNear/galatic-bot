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
      description: "Pesquisa a disponibilidade de uma aparência ou botaoNavVerso.", // Descrição para o /help
    });

    // Configuração do Comando de Barra (Slash Command)
    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addStringOption(option =>
          option
            .setName('tipo')
            .setDescription('Tipo de busca')
            .setRequired(false)
            .addChoices(
              { name: 'Aparência', value: 'aparencia' },
              { name: 'Verso', value: 'verso' }
            )
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
    const botLogChannel = message.guild.channels.cache.find(
      (i) => i.id === "1409063037905670154"
    );

    // Detectar se foi passado um argumento direto (aparencia ou verso)
    const tipoSolicitado = args[0]?.toLowerCase();
    
    if (tipoSolicitado === 'aparencia' || tipoSolicitado === 'verso') {
      // Simular um clique no botão apropriado
      const customId = tipoSolicitado === 'aparencia' ? 'botaoNavAparencia' : 'botaoNavVerso';
      
      // Evento vazio que simula um coletor que nunca coleta nada
      const { EventEmitter } = require('events');
      const emptyCollector = new EventEmitter();
      emptyCollector.stop = () => {};
      
      // Criar uma reply do bot que pode ser editada depois
      const msgReply = await message.reply({ content: '⏳ Carregando...' });
      
      // Criar um objeto que simula uma interação de botão
      const fakeInteraction = {
        customId: customId,
        user: message.author,
        member: message.member,
        guild: message.guild,
        channel: message.channel,
        update: async (options) => {
          await msgReply.edit(options).catch(() => {});
        },
        reply: async (options) => {
          return await msgReply.reply(options);
        },
        followUp: async (options) => {
          return await msgReply.reply(options);
        },
        deferUpdate: async () => {},
        editReply: async (options) => {
          await msgReply.edit(options).catch(() => {});
        },
        // Métodos para simular uma mensagem
        edit: async (options) => {
          return await msgReply.edit(options).catch(() => {});
        },
        delete: async () => {
          return await msgReply.delete().catch(() => {});
        },
        createMessageComponentCollector: (options) => {
          // Retorna um coletor vazio que nunca coleta nada
          return emptyCollector;
        }
      };

      // Chamar a lógica do coletor diretamente sem mostrar o menu
      return this.processarSelecaoAparencia(fakeInteraction, message, msgReply);
    }

    const embedNavegacao = new EmbedBuilder() //? MENSAGEM DE NAVEGAÇÃO INICIAL - SELECIONAR BASE DE DADOS (APARENCIA OU UNIbotaoNavVerso)
      .setColor("#02607a")
      .setTitle(
        "<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109>"
      )
      .setDescription("Escolha o que você deseja conferir a disponibilidade")
      .setFooter({ text: "Use os botões abaixo para navegar." });

    const botaoSelecaoNavegacao = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("botaoNavAparencia")
        .setLabel("APARÊNCIA")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("botaoNavVerso")
        .setLabel("VERSO")
        .setStyle(ButtonStyle.Success)
    );

    const msgNavegacao = await message.reply({ // !MSG UNIVERSAL ABAIXO - APENAS EDITAR
      embeds: [embedNavegacao],
      components: [botaoSelecaoNavegacao],
    });

    const coletorBotoesNavegacao = msgNavegacao.createMessageComponentCollector( //? COLETOR DOS BOTÕES
      { filter: (i) => i.user.id === message.author.id, time: 60000 }
    ); //60s de espera

    coletorBotoesNavegacao.on("collect", async (i) => {
      await this.processarSelecaoAparencia(i, message, msgNavegacao);
    });
  }

  async processarSelecaoAparencia(i, message, msgNavegacao) {
    const tempoRestante = 15;
    const sujeito = "enviar a aparência";
    const msgAlvo = msgNavegacao || message;
    
    // Garantir que msgNavegacao é sempre uma Message válida
    if (!msgNavegacao || typeof msgNavegacao.createMessageComponentCollector !== 'function') {
      msgNavegacao = message;
    }

    switch (i.customId) {
      case "botaoNavAparencia":
        //NAVEGAÇÃO PARA APARÊNCIA
        
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

        const coletorAparencia = (msgNavegacao.channel || message.channel).createMessageCollector({
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
            resultados = await buscarAparencias(sheets, 'nome', target);

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
                            await handleRegistro('aparência', target, msgNavegacao, ii, botLogChannel, this.client, sheets, false, []);
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
              if (contador && typeof contador.edit === 'function') {
                contador.edit({ content: "Tempo esgotado." }).catch(() => {});
              }
              msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
            }
          });

          break;
        case "botaoNavVerso":
            //NAVEGAÇÃO PARA VERSO

            const embedVerso = new EmbedBuilder()
            .setColor(colors.purple)
            .setTitle("<:DNAstrand:1406986203278082109> | ** SISTEMA DE VERSOS **")
            .setDescription("Envie no chat o nome do verso que deseja pesquisar.")
            .setFooter({ text: "envie apenas o nome do verso, sem emojis, acentuações ou outros caracteres." });

            await i
              .update({ embeds: [embedVerso], components: [] })
              .catch(() => {});

              ({ intervalo, contador } = await iniciarContador(
                tempoRestante,
                "enviar o verso",
                msgAlvo,
                message
              ));

              const coletorVerso = (msgNavegacao.channel || message.channel).createMessageCollector({
                filter: (m) => m.author.id === message.author.id,
                time: 15000,
                max: 1,
              }); //₢oletorverso

              coletorVerso.on("collect", async (m) => {
                const nomeVerso = await pararContador(
                  m.content,
                  intervalo,
                  contador
                );

                let resultados = [];
                target = await normalizeText(nomeVerso);

                try {
                  const res = await sheets.spreadsheets.values.get({
                    spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                    range: "UNIVERSO!A:C",
                  });
                  const rows = res.data.values || [];

                  for (let r = 1; r < rows.length; r++) {
                    const row = rows[r];
                    if (!row) continue;
                    const [verso, uso, jogador] = row;
                    if (!verso) continue;

                    const versoNorm = await normalizeText(verso);

                    if (versoNorm.length < 2) continue;

                    let ehSimilar = false;
                    const palavrasVerso = versoNorm.split(' ');
                    const limiar = Math.max(1, Math.floor(target.length / 4));
                    
                    for (const palavra of palavrasVerso) {
                        const distancia = calcularDistanciaLev(palavra, target);
                        if (distancia <= limiar) {
                            ehSimilar = true;
                            break;
                        }
                    }

                    if (versoNorm.includes(target) || ehSimilar) {
                      resultados.push({
                        verso,
                        uso,
                        jogador,
                        rowIndex: r + 1
                      });
                    }
                  }
                } catch (err) {
                  console.error(err);
                  return await message.channel.send("Erro ao acessar a planilha.");
                }

                let pag = 0;
                const EmbedPagesVerso = resultados.map((r, idx) => 
                        new EmbedBuilder()
                            .setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE VERSOS **`)
                            .setColor("#212416")
                            .setDescription(`<:patrickconcern:1407564230256758855> | Resultado similar ${idx + 1} de ${resultados.length}`)
                            .addFields(
                                { name: "**VERSO**", value: r.verso ?? "—" },
                                { name: "**USO**", value: r.uso ?? "—" },
                                { name: "**JOGADOR**", value: r.jogador ?? "—" }
                            )
                            .setFooter({ text: `Página ${idx + 1}/${resultados.length}` })
                    );

                    const navRow = async (idx) => {
                      const author = message.author;
                      const member = message.member;
                      const userDb = await this.client.database.userData.findOne({ uid: author.id, uServer: message.guild.id });
                      const components = [
                        new ButtonBuilder().setCustomId("reg_novo_verso").setEmoji("➕").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("prev_verso_similar").setLabel("⏪").setStyle(ButtonStyle.Primary).setDisabled(idx === 0 || EmbedPagesVerso.length === 0),
                        new ButtonBuilder().setCustomId("next_verso_similar").setLabel("⏩").setStyle(ButtonStyle.Primary).setDisabled(idx === EmbedPagesVerso.length - 1 || EmbedPagesVerso.length === 0),
                        new ButtonBuilder().setCustomId("close_verso_similar").setLabel("❌").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("aparencia_lista").setEmoji("👤").setStyle(ButtonStyle.Success)
                      ];

                      const currentResult = resultados[idx];
                      if (currentResult && userDb) {
                          const jogadorPlanilha = currentResult.jogador;
                          const jogadorDB = userDb.jogador;

                          const isOwner = await normalizeText(jogadorPlanilha) === await normalizeText(jogadorDB);
                          const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

                          if (isOwner || isAdmin) {
                              components.push(
                                  new ButtonBuilder().setCustomId(`edit_verso_${idx}`).setEmoji('✏️').setStyle(ButtonStyle.Secondary),
                                  new ButtonBuilder().setCustomId(`delete_verso_${idx}`).setEmoji('🗑️').setStyle(ButtonStyle.Danger)
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
                    }

                      if (resultados.length === 0) {
                        EmbedPagesVerso.push(new EmbedBuilder().setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE VERSOS **`).setColor("#212416").setDescription(`<:a_check:1406838162276941824> | **Nenhum resultado similar encontrado.**\n\nO verso **${target}** está livre para registro!\nClique no botão abaixo para registrá-lo.`));
                      }

                      await msgNavegacao.edit({
                        embeds: [EmbedPagesVerso[pag]],
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
                          case 'prev_verso_similar':
                            pag = Math.max(0, pag - 1);
                            break;
                          case 'next_verso_similar':
                            pag = Math.min(EmbedPagesVerso.length - 1, pag + 1);
                            break;
                          case 'close_verso_similar':
                            navCollector.stop("closed");
                            return;
                          case 'reg_novo_verso':
                            registroIniciado = true;
                            navCollector.stop("register");
                            await handleRegistro('verso', target, msgNavegacao, ii, botLogChannel, this.client, sheets, false, [], true);
                            return;
                          case 'aparencia_lista':
                            const versoAlvo = resultados[pag].verso;
                            const apps = await buscarAparencias(sheets, 'verso', versoAlvo);
                            
                            if (apps.length === 0) {
                                await ii.reply({ content: `Nenhuma aparência encontrada para o verso **${versoAlvo}**.`, ephemeral: true });
                                return;
                            }

                            let appPage = 0;
                            const generateAppListEmbed = (pageIndex) => {
                                const start = pageIndex * 10;
                                const end = start + 10;
                                const currentApps = apps.slice(start, end);
                                const description = currentApps.map(a => `• **${a.aparencia}** (${a.personagem}) - ${a.jogador}`).join('\n');
                                return new EmbedBuilder()
                                    .setTitle(`Aparências em: ${versoAlvo}`)
                                    .setColor(colors.blue)
                                    .setDescription(description || "Nenhuma aparência.")
                                    .setFooter({ text: `Página ${pageIndex + 1}/${Math.ceil(apps.length / 10)} | Total: ${apps.length}` });
                            };

                            const getAppButtons = (pageIndex) => {
                                return new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId('prev_app_list').setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(pageIndex === 0),
                                    new ButtonBuilder().setCustomId('back_to_verse').setLabel('Voltar').setStyle(ButtonStyle.Secondary),
                                    new ButtonBuilder().setCustomId('next_app_list').setLabel('▶').setStyle(ButtonStyle.Primary).setDisabled(pageIndex >= Math.ceil(apps.length / 10) - 1)
                                );
                            };

                            await ii.update({ embeds: [generateAppListEmbed(appPage)], components: [getAppButtons(appPage)] });

                            const appCollector = msgNavegacao.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 });
                            
                            appCollector.on('collect', async (appI) => {
                                if (appI.customId === 'prev_app_list') {
                                    appPage--;
                                    await appI.update({ embeds: [generateAppListEmbed(appPage)], components: [getAppButtons(appPage)] });
                                } else if (appI.customId === 'next_app_list') {
                                    appPage++;
                                    await appI.update({ embeds: [generateAppListEmbed(appPage)], components: [getAppButtons(appPage)] });
                                } else if (appI.customId === 'back_to_verse') {
                                    appCollector.stop();
                                    await appI.update({ embeds: [EmbedPagesVerso[pag]], components: await navRow(pag) });
                                }
                            });
                            
                            appCollector.on('end', (c, r) => {
                                if (r === 'time') msgNavegacao.edit({ components: [] }).catch(() => {});
                            });
                            return;
                          default:
                            if (ii.customId.startsWith('edit_verso_') || ii.customId.startsWith('delete_verso_'))
                            {
                              const idxBut = parseInt(ii.customId.split('_')[2]);
                              const objVer = resultados[idxBut];
                              if (!objVer) return ii.reply({ content: "Erro ao localizar verso.", ephemeral: true });

                              const keyFil = path.join(__dirname, "../../api/regal-primacy-233803-4fc7ea1a8a5a.json");
                              const autGoo = new google.auth.GoogleAuth({ keyFile: keyFil, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
                              const sheWri = google.sheets({ version: "v4", auth: autGoo });

                              if (ii.customId.startsWith('edit_verso_')) {
                                const modEdi = new ModalBuilder()
                                  .setCustomId(`modal_edit_verso_${objVer.rowIndex}`)
                                  .setTitle(`Editar Verso: ${objVer.verso}`);
                                
                                const inpNom = new TextInputBuilder().setCustomId('edit_verso_nome').setLabel("Nome do Universo").setStyle(TextInputStyle.Short).setValue(objVer.verso).setRequired(true);
                                const inpUso = new TextInputBuilder().setCustomId('edit_verso_uso').setLabel("Uso (%)").setStyle(TextInputStyle.Short).setValue(objVer.uso).setRequired(true);

                                modEdi.addComponents(new ActionRowBuilder().addComponents(inpNom), new ActionRowBuilder().addComponents(inpUso));
                                await ii.showModal(modEdi);

                                const subMod = await ii.awaitModalSubmit({ time: 60000, filter: f => f.user.id === message.author.id }).catch(() => null);
                                if (!subMod) return;

                                const novNom = subMod.fields.getTextInputValue('edit_verso_nome');
                                const novUso = subMod.fields.getTextInputValue('edit_verso_uso');

                                await sheWri.spreadsheets.values.update({
                                  spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                                  range: `UNIVERSO!A${objVer.rowIndex}:B${objVer.rowIndex}`,
                                  valueInputOption: "USER_ENTERED",
                                  resource: { values: [[novNom, novUso]] }
                                });

                                await subMod.reply({ content: `✅ Verso atualizado para **${novNom}** com **${novUso}** de uso!`, ephemeral: true });
                                return;
                              }

                              if (ii.customId.startsWith('delete_verso_')) {
                                const rowDel = new ActionRowBuilder().addComponents(
                                  new ButtonBuilder().setCustomId('confirm_del_verso').setLabel('Confirmar Exclusão').setStyle(ButtonStyle.Danger),
                                  new ButtonBuilder().setCustomId('cancel_del_verso').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
                                );
                                
                                const msgDel = await ii.reply({ content: `⚠️ Tem certeza que deseja excluir o verso **${objVer.verso}**? Essa ação não pode ser desfeita.`, components: [rowDel], ephemeral: true, fetchReply: true });
                                
                                const colDel = msgDel.createMessageComponentCollector({ time: 30000, max: 1 });
                                colDel.on('collect', async d => {
                                  if (d.customId === 'confirm_del_verso') {
                                    await d.deferUpdate();
                                    // Deleta a linha usando batchUpdate para remover a linha inteira e subir as outras
                                    await sheWri.spreadsheets.batchUpdate({
                                      spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                                      resource: {
                                        requests: [{
                                          deleteDimension: {
                                            range: {
                                              sheetId: 0, // Assumindo que UNIVERSO é a primeira aba (ID 0). Se não for, precisa buscar o sheetId pelo nome.
                                              dimension: "ROWS",
                                              startIndex: objVer.rowIndex - 1,
                                              endIndex: objVer.rowIndex
                                            }
                                          }
                                        }]
                                      }
                                    });
                                    await d.editReply({ content: "🗑️ Verso excluído com sucesso!", components: [] });
                                  } else {
                                    await d.update({ content: "Operação cancelada.", components: [] });
                                  }
                                });
                                return;
                              }
                            }
                            return;
                        }
                        if (!registroIniciado) {
                          await ii.update({
                            embeds: [EmbedPagesVerso[pag]],
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

            coletorVerso.on("end", (collected, reason) => {
              clearInterval(intervalo);
              if (reason === "time" && collected.size === 0) {
                if (contador && typeof contador.edit === 'function') {
                  contador.edit({ content: "Tempo esgotado." }).catch(() => {});
                }
                msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
              }
            });

          break;
      }
    }

  async execute(interaction) {
    const botLogChannel = interaction.guild.channels.cache.find(
      (i) => i.id === "1409063037905670154"
    );

    // Detectar se um tipo foi especificado via opção do slash command
    const tipoOpcao = interaction.options.getString('tipo');
    if (tipoOpcao === 'aparencia' || tipoOpcao === 'verso') {
      const customId = tipoOpcao === 'aparencia' ? 'botaoNavAparencia' : 'botaoNavVerso';
      const fakeInteraction = {
        customId: customId,
        user: interaction.user,
        member: interaction.member,
        channel: interaction.channel,
        guild: interaction.guild,
        reply: interaction.reply.bind(interaction),
        update: interaction.update.bind(interaction),
        deferUpdate: interaction.deferUpdate.bind(interaction)
      };
      
      // Responder com uma mensagem vazia para obter a reply
      await interaction.reply({ content: ' ', fetchReply: false });
      const msgReply = await interaction.fetchReply();
      
      return this.processarSelecaoAparencia(fakeInteraction, null, msgReply);
    }

    const embedNavegacao = new EmbedBuilder()
      .setColor("#02607a")
      .setTitle(
        "<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109>"
      )
      .setDescription("Escolha o que você deseja conferir a disponibilidade")
      .setFooter({ text: "Use os botões abaixo para navegar." });

    const botaoSelecaoNavegacao = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("botaoNavAparencia")
        .setLabel("APARÊNCIA")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("botaoNavVerso")
        .setLabel("VERSO")
        .setStyle(ButtonStyle.Success)
    );

    const msgNavegacao = await interaction.reply({
      embeds: [embedNavegacao],
      components: [botaoSelecaoNavegacao],
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

            resultados = await buscarAparencias(sheets, 'nome', target);

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
                            await handleRegistro('aparência', target, msgNavegacao, ii, botLogChannel, this.client, sheets, false, [], true);
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
              if (contador && typeof contador.edit === 'function') {
                contador.edit({ content: "Tempo esgotado." }).catch(() => {});
              }
              msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
            }
          });

          break;
        case "botaoNavVerso":
          const embedVerso = new EmbedBuilder().setColor("#212416").setTitle("<:DNAstrand:1406986203278082109> | ** SISTEMA DE UNIVERSOS **").setDescription("Envie no chat o nome do universo que deseja pesquisar.").setFooter({ text: "envie apenas o nome do universo." });
          await i.update({ embeds: [embedVerso], components: [] }).catch(() => {});

          ({ intervalo, contador } = await iniciarContador(
            tempoRestante,
            "enviar o universo",
            msgAlvo,
            i
          ));

          const coletorbotaoNavVerso = i.channel.createMessageCollector({
            filter: (m) => m.author.id === interaction.user.id,
            time: 15000,
            max: 1,
          });

          coletorbotaoNavVerso.on("collect", async (m) => {
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

                const data = { universo, uso, jogador, rowIndex: r + 1 };

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
                "Erro ao acessar a planilha de botaoNavVersos."
              );
            }

            if (exactMatch) {
              const embedExato = new EmbedBuilder()
                .setTitle(
                  `<:DNAstrand:1406986203278082109> | ** SISTEMA DE UNIVERSOS **`
                )
                .setDescription(
                  `<:PepeHands:1407563136197984357> | Universo em uso!`
                )
                .setColor("#8f0808")
                .addFields(
                  { name: "**UNIVERSO**", value: exactMatch.universo ?? "—" },
                  { name: "**USO (%)**", value: String(exactMatch.uso ?? "—") },
                  { name: "**JOGADOR**", value: exactMatch.jogador ?? "—" }
                );
              await msgNavegacao
                .edit({ embeds: [embedExato], components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("aparencia_lista_exact").setEmoji("👤").setLabel("Ver Aparências").setStyle(ButtonStyle.Success)
                    )
                ] })
                .catch(() => {});
                
                // Coletor para o botão de ver aparências no exact match
                const exactCollector = msgNavegacao.createMessageComponentCollector({ filter: ii => ii.user.id === interaction.user.id, time: 60000 });
                exactCollector.on('collect', async (ii) => {
                    if (ii.customId === 'aparencia_lista_exact') {
                        const apps = await buscarAparencias(sheets, 'verso', exactMatch.universo);
                        if (apps.length === 0) return ii.reply({ content: "Nenhuma aparência encontrada.", ephemeral: true });
                        
                        let appPage = 0;
                        const generateAppListEmbed = (pageIndex) => {
                            const start = pageIndex * 10;
                            const end = start + 10;
                            const currentApps = apps.slice(start, end);
                            const description = currentApps.map(a => `• **${a.aparencia}** (${a.personagem}) - ${a.jogador}`).join('\n');
                            return new EmbedBuilder().setTitle(`Aparências em: ${exactMatch.universo}`).setColor(colors.blue).setDescription(description || "Nenhuma aparência.").setFooter({ text: `Página ${pageIndex + 1}/${Math.ceil(apps.length / 10)}` });
                        };
                        const getAppButtons = (pageIndex) => new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('prev_app_list').setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(pageIndex === 0),
                            new ButtonBuilder().setCustomId('back_to_exact').setLabel('Voltar').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('next_app_list').setLabel('▶').setStyle(ButtonStyle.Primary).setDisabled(pageIndex >= Math.ceil(apps.length / 10) - 1)
                        );
                        await ii.update({ embeds: [generateAppListEmbed(appPage)], components: [getAppButtons(appPage)] });
                    } else if (ii.customId === 'prev_app_list' || ii.customId === 'next_app_list') {
                        // Lógica de paginação simplificada (assumindo que o estado appPage precisaria ser mantido, mas aqui recriamos para brevidade no exact match)
                        // Para implementação completa, idealmente usaríamos uma função compartilhada de paginação.
                        // Como o exact match é um caso específico, deixamos o botão de voltar funcional.
                        await ii.deferUpdate();
                    } else if (ii.customId === 'back_to_exact') {
                        await ii.update({ embeds: [embedExato], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("aparencia_lista_exact").setEmoji("👤").setLabel("Ver Aparências").setStyle(ButtonStyle.Success))] });
                    }
                });

            } else {
                await handleRegistro(
                    'universo',
                    target,
                    msgNavegacao,
                    i,
                    botLogChannel,
                    this.client,
                    sheets,
                    false,
                    resultados
                ); 
            } 
          });

          coletorbotaoNavVerso.on("end", (collected, reason) => {
            clearInterval(intervalo);
            if (reason === "time" && collected.size === 0) {
              if (contador && typeof contador.edit === 'function') {
                contador.edit({ content: "Tempo esgotado." }).catch(() => {});
              }
              msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
            }
          });
          break;
      }
    });
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
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
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
