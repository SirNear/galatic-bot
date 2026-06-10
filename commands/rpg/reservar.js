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
const Command = require("../../structures/Command");
const error = require("../../api/error.js");
const color = require("../../api/colors.json");
const { iniciarContador, pararContador } = require("../../api/contador.js");
const logs = require("../../api/logs.js");

module.exports = class reservar extends Command {
  constructor(client) {
    super(client, {
      name: "reservar",
      category: "rpg",
      aliases: ["reservaraparencia", "reserva", 'res'],
      description: "Inicia o processo de reserva de uma aparência para um jogador.",
      UserPermission: [""],
      clientPermission: null,
      OnlyDevs: false,
      structure: "aparencia | verso",
    });
  }

  async run({ message, args, client, server }) {
    let tempoRestante;
    let sujeito;
    let msgAlvo;
    let intervalo, contador;
    let deletable = [];

    deletable.push(message);

    async function cancelamento(deletable) {
        if (!Array.isArray(deletable)) return; // Garante que é um array

        console.log(`Cancelando e tentando apagar ${deletable.length} mensagens.`);
        
        const mensagensValidas = deletable.filter(m => m && m.deletable);
        
        if (mensagensValidas.length > 0) {
            try {
                await mensagensValidas[0].channel.bulkDelete(mensagensValidas);
            } catch (error) {
                console.error("Erro ao tentar apagar mensagens em massa, tentando individualmente:", error.message);
                // Se o bulkDelete falhar (mensagens antigas), tenta apagar uma por uma
                for (const msg of mensagensValidas) {
                    await msg.delete().catch(() => {});
                }
            }
        }
    }

    const canalReservaId = "1410385607317913640";
    let canalReserva = await message.guild.channels.fetch(canalReservaId).catch(() => null);
    
    if (!canalReserva || !canalReserva.isTextBased()) {
        return message.reply({ content: "Erro: O canal de reservas não foi encontrado ou não tenho permissão para vê-lo." });
    }

    let choose = args[0] ? args[0].toLowerCase() : null;

    const userDb = await this.client.database.userData.findOne({ uid: message.author.id, uServer: message.guild.id });
    
    if (!userDb) {
        return message.reply({ content: "Você não possui um registro no banco de dados. Envie alguma mensagem no servidor para ser registrado automaticamente!" });
    }

    const executarReserva = async (tipo) => {
        let embedRAparencia = new EmbedBuilder()
          .setColor(color.dblue)
          .setTitle(
            '<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109>'
          )
          .setFooter({ text: "Reserva de Aparência" });

        switch (tipo) {
      case "aparencia":
        embedRAparencia.setDescription(
          `Envie o **nome da aparência** que deseja reservar`
        );

        let msgAparencia = await message.reply({ embeds: [embedRAparencia] });

        deletable.push(msgAparencia)

        /* #region  CONTADOR */
        sujeito = "enviar aparência";
        msgAlvo = msgAparencia;
        tempoRestante = 30;

        ({intervalo, contador }= await iniciarContador(
          tempoRestante,
          sujeito,
          msgAlvo,
          message
        ))
        /* #endregion */

        deletable.push(contador)

        let coletorRAparenciaNome =
          await msgAparencia.channel.createMessageCollector({
            filter: (m) => m.author.id === message.author.id,
            time: 120000,
            max: 1,
          });

        coletorRAparenciaNome.on("collect", async (m) => {
            deletable.push(m)
          let aparencia = await pararContador(m.content, intervalo, contador);

          embedRAparencia.addFields({
            name: "**NOME DA APARÊNCIA**",
            value: aparencia,
            inline: true,
          });
          embedRAparencia.setDescription(
            "Envie o **nome do universo** a qual essa aparência pertence"
          );

          msgAparencia.edit({ embeds: [embedRAparencia] });

          sujeito = "enviar o nome do universo";
          tempoRestante = 30;

          ({intervalo, contador} = await iniciarContador(tempoRestante, sujeito, msgAlvo, message));

          deletable.push(contador)

          let coletorRAparenciaVerso = await msgAparencia.channel.createMessageCollector({
              filter: (m2) => m2.author.id === message.author.id,
              time: 120000,
              max: 1,
            });

          coletorRAparenciaVerso.on("collect", async (msg) => {
            deletable.push(msg)
            let verso = await pararContador(msg.content, intervalo, contador);

            embedRAparencia.addFields({
                name: "**UNIVERSO DA APARÊNCIA**",
                value: verso,
                inline: true,
            });
            embedRAparencia.setDescription('Envie a **IMAGEM** da aparência')
            embedRAparencia.setFooter({text: 'não envie link, apenas imagem!'})

            sujeito = 'enviar a imagem da aparência'
            tempoRestante = 250;

            ({intervalo, contador} = await iniciarContador(tempoRestante, sujeito, msgAlvo, message))

            deletable.push(contador)

            msgAparencia.edit({embeds: [embedRAparencia]})

            let coletorRAparenciaImagem =
              await msgAparencia.channel.createMessageCollector({
                filter: (m3) => m3.author.id === message.author.id,
                time: 300000,
                max: 1,
              });
        
            coletorRAparenciaImagem.on("collect", async (img) => {
              let imageAttachment = img.attachments.first();
              const imgUrl = await pararContador(imageAttachment.url, intervalo, contador)
              
              embedRAparencia.setImage(`${imgUrl}`);
              embedRAparencia.setDescription("Confira os dados abaixos");
              embedRAparencia.setTimestamp()
              embedRAparencia.setFooter({text: '.'})

              const confirmacaoBotao = new ActionRowBuilder() //BOTÕES DE CONFIRMAÇÃO DE REGISTRO
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId("confirma")
                    .setLabel("CONFIRMAR")
                    .setStyle(ButtonStyle.Success),
                  new ButtonBuilder()
                    .setCustomId("cancela")
                    .setLabel("CANCELAR")
                    .setStyle(ButtonStyle.Danger)
                );

            let mensagemConfirmacao = await message.reply({
                embeds: [embedRAparencia],
                components: [confirmacaoBotao],
            });


            const coletorConfirmacao =
            mensagemConfirmacao.createMessageComponentCollector({
                filter: (i) => i.user.id === message.author.id,
                time: 15000,
            });

            deletable.push(mensagemConfirmacao)


            coletorConfirmacao.on("collect", async (i) => {
                switch (i.customId) {
                    case "confirma":
                        logs.AparenciaRegistrada(message, userDb, aparencia, verso, imgUrl, canalReserva)
                        message.channel.bulkDelete(deletable).catch(() => {});
                        message.reply({
                            content: `<:YaroCheck:1408857786221330443> | Aparência ${aparencia} reservada! Verifique no canal <#${canalReserva.id}> !`,
                        });
                        
                    break;
                    case "cancela":
                        message.channel.bulkDelete(deletable).catch(() => {});
                        message.reply({
                            content:
                            "<a:cdfpatpat:1407135944456536186> | **RESERVA CANCELADA!** Tudo bem, você pode reservar depois, se estiver disponível",
                        });
                    break;
                }
            }); // coletorConfirmacao.collect

            coletorConfirmacao.on("end", async (collected, reason) => {
                if (reason === "time" && collected.size === 0) return cancelamento(deletable);
            }) //₢oletorConfirmacao.end

            }); //coletorRAparenciaImagem.collect

            coletorRAparenciaImagem.on("end", (collected, reason) => {
              if (reason === "time" && collected.size === 0) {
                message.reply({
                  content:
                    "⏰ | O tempo para enviar uma imagem esgotou. Por favor, execute o comando novamente.",
                  ephemeral: true,
                });
                return;
              }
            }); //coletorRAparenciaImagem.end

          }); //coletorRAparenciaVerso.collect

          coletorRAparenciaVerso.on('end', async (collected, reason) => {
            if (reason === "time" && collected.size === 0) return cancelamento(deletable)
          }) //coletorRAparenciaVerso.end

        }); //coletorRAaparenciaNome.collect

        coletorRAparenciaNome.on('end', async (collected, reason) => {
            if (reason === "time" && collected.size === 0) return cancelamento(deletable)
        })

        break;
      case "universo":
      case "verso":
        let embedRVerso = new EmbedBuilder()
          .setColor(color.purple)
          .setTitle('<:DNAstrand:1406986203278082109> | ** SISTEMA DE VERSOS ** | <:DNAstrand:1406986203278082109>')
          .setDescription(`Envie o **nome do verso** que deseja reservar`)
          .setFooter({ text: "Reserva de Verso" });

        let msgVerso = await message.reply({ embeds: [embedRVerso] });
        deletable.push(msgVerso);

        sujeito = "enviar o nome do verso";
        msgAlvo = msgVerso;
        tempoRestante = 60;

        ({intervalo, contador} = await iniciarContador(tempoRestante, sujeito, msgAlvo, message));
        deletable.push(contador);

        let coletorRVersoNome = await msgVerso.channel.createMessageCollector({
            filter: (m) => m.author.id === message.author.id,
            time: 120000,
            max: 1,
        });

        coletorRVersoNome.on("collect", async (m) => {
            deletable.push(m);
            let versoNome = await pararContador(m.content, intervalo, contador);

            embedRVerso.addFields({
                name: "**NOME DO VERSO**",
                value: versoNome,
                inline: false,
            });
            embedRVerso.setDescription("Selecione abaixo o **Escopo de Integração** para este verso:");

            const botoesEscopo = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("escopo_total").setLabel("Total / Completo").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("escopo_poder").setLabel("Sistema de Poder").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("escopo_lore").setLabel("Lore / Facções").setStyle(ButtonStyle.Primary)
            );

            await msgVerso.edit({ embeds: [embedRVerso], components: [botoesEscopo] });

            sujeito = "selecionar o escopo";
            tempoRestante = 60;
            ({intervalo, contador} = await iniciarContador(tempoRestante, sujeito, msgAlvo, message));
            deletable.push(contador);

            let coletorEscopo = msgVerso.createMessageComponentCollector({
                filter: (i) => i.user.id === message.author.id,
                time: 120000,
                max: 1
            });

            coletorEscopo.on("collect", async (iEscopo) => {
                await iEscopo.deferUpdate().catch(()=>{});
                let escopoSelecionado = "";
                switch(iEscopo.customId) {
                    case "escopo_total": escopoSelecionado = "Total / Completo"; break;
                    case "escopo_poder": escopoSelecionado = "Sistema de Poder"; break;
                    case "escopo_lore": escopoSelecionado = "Lore / Facções"; break;
                }
                
                await pararContador("Escopo selecionado", intervalo, contador);

                embedRVerso.addFields({
                    name: "**ESCOPO**",
                    value: escopoSelecionado,
                    inline: false,
                });
                embedRVerso.setDescription("Confira os dados abaixo:");
                embedRVerso.setTimestamp();

                const confirmacaoBotaoVerso = new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId("confirma_verso").setLabel("CONFIRMAR").setStyle(ButtonStyle.Success),
                  new ButtonBuilder().setCustomId("cancela_verso").setLabel("CANCELAR").setStyle(ButtonStyle.Danger)
                );

                let mensagemConfirmacaoVerso = await message.reply({
                    embeds: [embedRVerso],
                    components: [confirmacaoBotaoVerso],
                });
                deletable.push(mensagemConfirmacaoVerso);

                const coletorConfirmacaoVerso = mensagemConfirmacaoVerso.createMessageComponentCollector({
                    filter: (i) => i.user.id === message.author.id,
                    time: 60000,
                    max: 1
                });

                coletorConfirmacaoVerso.on("collect", async (iConf) => {
                    switch (iConf.customId) {
                        case "confirma_verso":
                            logs.VersoRegistrado(message, userDb, versoNome, escopoSelecionado, canalReserva);
                            message.channel.bulkDelete(deletable).catch(() => {});
                            message.reply({
                                content: `<:YaroCheck:1408857786221330443> | Verso ${versoNome} reservado! Verifique no canal <#${canalReserva.id}> !`,
                            });
                        break;
                        case "cancela_verso":
                            message.channel.bulkDelete(deletable).catch(() => {});
                            message.reply({
                                content: "<a:cdfpatpat:1407135944456536186> | **RESERVA CANCELADA!** Tudo bem, você pode reservar depois, se estiver disponível",
                            });
                        break;
                    }
                });

                coletorConfirmacaoVerso.on("end", async (collected, reason) => {
                    if (reason === "time" && collected.size === 0) return cancelamento(deletable);
                });
            });

            coletorEscopo.on("end", async (collected, reason) => {
                if (reason === "time" && collected.size === 0) return cancelamento(deletable);
            });
        });

        coletorRVersoNome.on('end', async (collected, reason) => {
            if (reason === "time" && collected.size === 0) return cancelamento(deletable);
        });

        break;
          default:
            error.helpCmd(server, this.config, message);
            break;
        }
    };

    if (!choose) {
        const embedNav = new EmbedBuilder()
          .setColor(color.purple)
          .setTitle('<:DNAstrand:1406986203278082109> | ** SISTEMA DE RESERVAS ** | <:DNAstrand:1406986203278082109>')
          .setDescription("O que você deseja reservar?")
          .setFooter({ text: "Escolha uma das opções abaixo." });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("res_ap").setLabel("APARÊNCIA").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("res_ve").setLabel("VERSO").setStyle(ButtonStyle.Success)
        );

        let msgEscolha = await message.reply({ embeds: [embedNav], components: [row] });
        deletable.push(msgEscolha);

        const col = msgEscolha.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000, max: 1 });
        
        col.on('collect', async i => {
            await i.deferUpdate().catch(()=>{});
            await executarReserva(i.customId === "res_ap" ? "aparencia" : "verso");
        });
        
        col.on('end', (c, r) => {
            if(r === 'time' && c.size === 0) cancelamento(deletable);
        });
    } else {
        await executarReserva(choose);
    }
  }
};
