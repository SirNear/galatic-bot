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
let tempoRestante;
let sujeito ;
let msgAlvo ;
let intervalo, contador ;
let deletable ;

module.exports = class reservar extends Command {
  constructor(client) {
    super(client, {
      name: "reservar",
      category: "rpg",
      aliases: ["reservaraparencia", "reserva", 'res'],
      UserPermission: [""],
      clientPermission: null,
      OnlyDevs: false,
      structure: "aparecia/universo",
    });
  }

  async run({ message, args, client, server }) {

    let deletable = []

    deletable.push(message)

    async function cancelamento(deletable) {
        if (!Array.isArray(deletable)) return; // Garante que é um array

        console.log(`Cancelando e tentando apagar ${deletable.length} mensagens.`);
        
        // Tenta apagar as mensagens em massa (mais eficiente)
        // Filtra para remover qualquer item que não seja uma mensagem válida
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

    let choose = args[0];

    const userDb = await this.client.database.userData.findOne({ _id: `${message.author.globalName} ${message.guild.name}` });

    let embedRAparencia = new EmbedBuilder()
      .setColor(color.dblue)
      .setTitle(
        '<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109>'
      )
      .setFooter({ text: "Reserva de Aparência" });


    switch (choose) {
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
                deletable.push(img)
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
      case "universo" || "verso":
        message.reply({content: 'Ainda não implementado! Chega de reservar universo, toma vergonha na cara.'})
        break;
      default:
        error.helpCmd(server, this.config, message);
    }
  }
};
