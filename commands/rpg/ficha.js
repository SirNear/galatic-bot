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
  SlashCommandBuilder,
} = require("discord.js");
const Command = require("../../structures/Command");
const error = require("../../api/error.js");
const color = require("../../api/colors.json");

module.exports = class ficha extends Command {
  constructor(client) {
    super(client, {
      name: "ficha",
      category: "rpg",
      aliases: ["f"],
      UserPermission: [""],
      clientPermission: null,
      OnlyDevs: true,
      slash: true,
      description: "Gerencia fichas de personagem",
    });

    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addSubcommand((sub) =>
          sub
            .setName("criar")
            .setDescription("Cria uma nova ficha de personagem")
        )
        .addSubcommand((sub) =>
          sub
            .setName("habilidade")
            .setDescription("Adiciona uma habilidade à ficha")
            .addStringOption((opt) =>
              opt
                .setName("categoria")
                .setDescription("Categoria da habilidade")
                .setRequired(true)
                .addChoices(
                  { name: "Mágica", value: "magica" },
                  { name: "Física", value: "fisica" },
                  { name: "Passiva", value: "passiva" },
                  { name: "Sagrada", value: "sagrada" },
                  { name: "Amaldiçoada", value: "amaldicoada" },
                  { name: "Haki", value: "haki" },
                  { name: "Outra", value: "outra" }
                )
            )
        );
    }
  }

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "criar") {
      await this.handleFichaCreate(interaction);
    } else if (subcommand === "habilidade") {
      await this.handleHabilidadeAdd(interaction);
    }
  }

  async handleFichaCreate(interaction) {
    const modal = new ModalBuilder()
      .setCustomId("fichaCreate")
      .setTitle("Criar Ficha de Personagem");

    let campoNome = new TextInputBuilder()
      .setCustomId("campoNome")
      .setLabel("Nome do Personagem")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    let campoReino = new TextInputBuilder()
      .setCustomId("campoReino")
      .setLabel("Reino")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    let campoRaca = new TextInputBuilder()
      .setCustomId("campoRaca")
      .setLabel("Raça")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    let campoAparencia = new TextInputBuilder()
      .setCustomId("campoAparencia")
      .setLabel("Aparência")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue("Insira o nome do personagem e o universo pertencente");

    const actionRowNome = new ActionRowBuilder().addComponents(campoNome);
    const actionRowReino = new ActionRowBuilder().addComponents(campoReino);
    const actionRowRaca = new ActionRowBuilder().addComponents(campoRaca);
    const actionRowAparencia = new ActionRowBuilder().addComponents(
      campoAparencia
    );

    modal.addComponents(
      actionRowNome,
      actionRowReino,
      actionRowRaca,
      actionRowAparencia
    );

    await interaction.showModal(modal);
  }

  async handleHabilidadeAdd(interaction) {
    const categoria = interaction.options.getString("categoria");

    const modal = new ModalBuilder()
      .setCustomId(`habilidade_${categoria}`)
      .setTitle(
        `Nova Habilidade ${categoria.charAt(0).toUpperCase() + categoria.slice(1)}`
      );

    const nomeInput = new TextInputBuilder()
      .setCustomId("nome")
      .setLabel("Nome da Habilidade")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descricaoInput = new TextInputBuilder()
      .setCustomId("descricao")
      .setLabel("Descrição (max 1000 caracteres)")
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(1000)
      .setRequired(true);

    const subHabilidade1 = new TextInputBuilder()
      .setCustomId("sub1")
      .setLabel("Sub-habilidade 1 (opcional)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    const subHabilidade2 = new TextInputBuilder()
      .setCustomId("sub2")
      .setLabel("Sub-habilidade 2 (opcional)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    const prerequisito = new TextInputBuilder()
      .setCustomId("prereq")
      .setLabel("Pré-requisitos (opcional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nomeInput),
      new ActionRowBuilder().addComponents(descricaoInput),
      new ActionRowBuilder().addComponents(subHabilidade1),
      new ActionRowBuilder().addComponents(subHabilidade2),
      new ActionRowBuilder().addComponents(prerequisito)
    );

    await interaction.showModal(modal);
  }

  // Mantenha o método run() para compatibilidade com comandos prefixados
  async run({ message, args, client, server }) {
    let userDb = await this.client.database.userData.findById(
      `${message.author.globalName} ${message.guild.name}`
    );

    /* #region  FORMULÁRIO */
    let formularioRegisto = new ModalBuilder()
      .setCustomId("esqueletoFormularioRegistro")
      .setTitle("Registro de Ficha");

    let campoNome = new TextInputBuilder()
      .setCustomId("campoNome")
      .setLabel("Nome do Personagem")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    let campoReino = new TextInputBuilder()
      .setCustomId("campoReino")
      .setLabel("Reino")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    let campoRaca = new TextInputBuilder()
      .setCustomId("campoRaca")
      .setLabel("Raça")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    let campoAparencia = new TextInputBuilder()
      .setCustomId("campoAparencia")
      .setLabel("Aparência")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue("Insira o nome do personagem e o universo pertencente");

    const actionRowNome = new ActionRowBuilder().addComponents(campoNome);
    const actionRowReino = new ActionRowBuilder().addComponents(campoReino);
    const actionRowRaca = new ActionRowBuilder().addComponents(campoRaca);
    const actionRowAparencia = new ActionRowBuilder().addComponents(
      campoAparencia
    );

    formularioRegisto.addComponents(
      actionRowNome,
      actionRowReino,
      actionRowRaca,
      actionRowAparencia
    );
    /* #endregion */

    /* #region  BOTÕES */
    const botoesConfirmacao = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirma")
        .setLabel("SIM")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("cancela")
        .setLabel("CANCELAR")
        .setStyle(ButtonStyle.Danger)
    );

    let mensagemConfirmacao = await message.reply({
      content: "Deseja iniciar a inscrição da ficha de um novo personagem?",
      ephemeral: true,
      components: [botoesConfirmacao],
    });

    const coletorBotao = mensagemConfirmacao.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 60000,
    });
    /* #endregion */

    coletorBotao.on("collect", async (interaction) => {
      if (interaction.customId === "confirma") {
        await interaction.showModal(formularioRegisto);

        // Agora, esperando pela interação no modal
        const filter = (interaction) =>
          interaction.customId === "esqueletoFormularioRegistro";
        interaction
          .awaitModalSubmit({ filter, time: 150000 })
          .then(async (modalInteraction) => {
            await modalInteraction.deferUpdate();

            /* #region VALORES COLETADOS DO FORMULÁRIO */
            let pName = await modalInteraction.fields.getTextInputValue(
              "campoNome"
            );
            let pRaca = await modalInteraction.fields.getTextInputValue(
              "campoRaca"
            );
            let pReino = await modalInteraction.fields.getTextInputValue(
              "campoReino"
            );
            let pAparencia = await modalInteraction.fields.getTextInputValue(
              "campoAparencia"
            );
            /* #endregion */

            let embedSucess = new EmbedBuilder()
              .setColor(color.green)
              .setTitle(
                "<:YaroCheck:1408857786221330443> | **Ficha Registrada!**"
              )
              .setDescription("Confira os valores:")
              .addFields(
                {
                  name: "<:membroCDS:1408857982363500556> | **Nome**",
                  value: pName,
                  inline: true,
                },
                {
                  name: "<:7992_AmongUs_Investigate:1408858074734919861> | **Aparência**",
                  value: pAparencia,
                  inline: true,
                },
                {
                  name: "<a:NeekoGroove:1408860306029150349> | **Raça**",
                  value: pRaca,
                  inline: true,
                },
                {
                  name: "<:iglu:1408859733632483388>| **Reino**",
                  value: pReino,
                  inline: true,
                }
              );

            await mensagemConfirmacao.edit({
              embeds: [embedSucess],
              components: [],
            });

            message.channel.send(
              "**Ficha registrada com sucesso!** Deseja registrar _habilidades_ agora?"
            );
            console.log(
              `Ficha registrada: Nome: ${pName}, Raça: ${pRaca}, Reino: ${pReino}, Aparência: ${pAparencia} por ${message.author.tag}(${userDb.jogador})`
            );

            coletorHabilidades = message.channel.createMessageCollector({
              filter: (m) => m.author.id === message.author.id,
              time: 60000,
              max: 1,
            });
          })
          .catch((err) => {
            console.error("Erro ao capturar o modal:", err);
            message.channel.send("Houve um erro ao processar o formulário.");
          });
      } else {
        console.log("Botão CANCELAR clicado, cancelando a ação...");
        return error.cancelMsg(mensagemConfirmacao);
      }
    });
  }
};
