const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  StringSelectMenuComponent,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const fetch = require("node-fetch"); 
const Command = require("../../structures/Command");
const color = require("../../api/colors.json");
const { summarizeText } = require("../../api/resumir.js");
module.exports = class ficha extends Command {
  constructor(client) {
    super(client, {
      name: "ficha",
      category: "rpg",
      aliases: ["f", "criarficha", "registrar", "novopersonagem"],
      UserPermission: [""],
      clientPermission: null,
      OnlyDevs: false, // Mudei para false para permitir uso geral
      slash: true,
      description: "Gerencia fichas de personagem",
    });

    /* #region  CONFIG SLASH */
    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName("ficha")
        .setDescription(this.config.description)
        /* #region  OPÇÕES DE COMANDOS /ficha {ver, habilidade ou criar} */
        .addSubcommand((sub) =>
          sub
            .setName("criar")
            .setDescription("Cria uma nova ficha de personagem")
        )
        .addSubcommand((sub) =>
          sub.setName("ver").setDescription("Visualiza fichas de personagem")
        )
        .addSubcommand((sub) =>
          sub
            .setName("habilidade")
            .setDescription("Adiciona uma habilidade à ficha")
        );
      /* #endregion */
    }
    /* #endregion */
  }
  // #region FUNÇÕES ARMAZENAR APARÊNCIA, COLETAR RESPOSTA, CONFIRMAR BOTÃO, MOSTRAR FORMULARIO

  async coletarResposta(interaction, pergunta) {
    const channel = interaction.channel; // O canal onde a interação original ocorreu
    const author = interaction.user; // O autor da interação

    let perguntaMsg;
    if (pergunta) { // Só envia a mensagem de pergunta se ela for fornecida
      perguntaMsg = await interaction.followUp({
        content: pergunta,
        flags: 64, // Ephemeral
      });
    }

    const coletorResposta = channel.createMessageCollector({ //coletor da perguntaMsg
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

    if (perguntaMsg) {
      await perguntaMsg.delete().catch(() => {});
    }

    if (!collected) {
      await interaction.followUp({
        content: "<:berror:1406837900556898304> | **Tempo esgotado.** Operação cancelada.",
        flags: 64,
      });
      return null;
    }

    const resposta = collected.content;
    const attachment = collected.attachments.first();

    return { resposta, attachment, mensagemColetada: collected };
  }

  async armazemImagem(interaction, tipoItem, nomeItem, nomeFicha) {
    const resposta = await this.coletarResposta(interaction, null); // Não envia mais a pergunta, apenas espera a imagem.
    const attachment = resposta?.attachment;
    const canalArmazenamento = await this.client.channels.fetch('1444543166232530996').catch(() => null);

/* #region  DEBUG */
    if (!resposta || !resposta.attachment || !resposta.attachment.contentType?.startsWith("image/")) { //se não tem imagem ou se for arquvio, segue sem img
      await interaction.followUp({ content: "Nenhuma imagem válida foi enviada. Continuando sem imagem.", flags: 64 });
      return null;
    }

    if (!canalArmazenamento || !canalArmazenamento.isTextBased()) {
      console.error(`Canal de armazenamento (ID: 1444543166232530996) inválido ou não encontrado.`);
      await interaction.followUp({ content: "❌ Erro de configuração: O canal de armazenamento de imagens não foi encontrado.", flags: 64 });
      return null;
    }
/* #endregion */
    
  //backend
    try {
      const sentMessage = await canalArmazenamento.send({
        content: `Imagem para ${tipoItem} **${nomeItem}** da ficha **${nomeFicha}** (enviado por: ${interaction.user.username})`,
        files: [attachment]
      });

      const novaUrl = sentMessage.attachments.first()?.url;

      if (!novaUrl) {
        throw new Error("Não foi possível obter a URL da imagem após o envio para o canal de armazenamento.");
      }

      if (resposta && resposta.mensagemColetada) {
        await resposta.mensagemColetada.delete().catch(() => {});
      }

      return novaUrl;
    } catch (e) {
      console.error(`Erro ao enviar imagem para o canal de armazenamento (ID: 1444543166232530996):`, e);
      await interaction.followUp({ content: "❌ Ocorreu um erro ao salvar a imagem. Contate um administrador.", flags: 64 });
      return null;
    }
  }

  async formulario(interaction, modal, timeout = 1800000) {
    await interaction.showModal(modal); //exibir formulário

    try {
      const formEnviado = await interaction.awaitModalSubmit({
        filter: i => i.user.id === interaction.user.id && i.customId === modal.data.custom_id,
        time: timeout,
      });
      return formEnviado; //retorna respostas do form

    } catch (err) {
      if (err.code === 'InteractionCollectorError') {
        // O tempo esgotou, não precisa notificar o usuário pois o modal some.
      } else {
        console.error("Erro ao aguardar modal:", err);
      }
      return null;
    }
  }

  async botaoConfirma(interaction, mensagemPergunta, customLabelButtomY, customLabelButtomN, msgPersonalizadaUpdt) {
    const botoesRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('botaoConfirmaId').setLabel(customLabelButtomY).setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId('botaoNegaId').setLabel(customLabelButtomN).setStyle(ButtonStyle.Danger)
    );

    const msgBotao = await interaction.editReply({
      content: mensagemPergunta,
      components: [botoesRow],
      ephemeral: true,
      fetchReply: true,
    }).catch(() => interaction.followUp({ content: mensagemPergunta, components: [botoesRow], ephemeral: true, fetchReply: true }));

    try {
      const btnInteraction = await msgBotao.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 60000 });
      const confirmado = btnInteraction.customId === 'botaoConfirmaId';

      if (confirmado && msgPersonalizadaUpdt && msgPersonalizadaUpdt.length > 0) {
          await btnInteraction.update({ content: msgPersonalizadaUpdt, components: [] });
      } else if (!confirmado) {
          await btnInteraction.update({ content: "Operação cancelada.", components: [], embeds: [] });
      }
      
      return { confirmed: btnInteraction.customId === 'botaoConfirmaId', interaction: btnInteraction };
    } catch (e) {
      await msgBotao.edit({ content: "<:berror:1406837900556898304> | **Tempo esgotado.** Operação cancelada.", components: [] }).catch(() => {});
      return false;
    }
  }

  async splitDescription(text, maxLength = 2000) {
  const parts = [];
  if (!text) return parts;

  let currentChunk = text;
  while (currentChunk.length > 0) {
    if (currentChunk.length <= maxLength) {
      parts.push(currentChunk);
      break;
    }

    let splitIndex = currentChunk.lastIndexOf("\n\n", maxLength);
    if (splitIndex === -1)
      splitIndex = currentChunk.lastIndexOf("\n", maxLength);
    if (splitIndex === -1)
      splitIndex = currentChunk.lastIndexOf(" ", maxLength);
    if (splitIndex === -1) splitIndex = maxLength;

    parts.push(currentChunk.substring(0, splitIndex));
    currentChunk = currentChunk.substring(splitIndex).trim();
    if (currentChunk.length === 0 && parts.length > 0) break;
  }
  return parts;
  }

  async buscarImagemBackup(tipoItem, nomeItem, nomeFicha) {
    const canalArmazenamento = await this.client.channels.fetch('1444543166232530996').catch(() => null);
    if (!canalArmazenamento) return null;

    try {
      const messages = await canalArmazenamento.messages.fetch({ limit: 100 });
      let searchString;
      if (tipoItem === 'aparência') {
        searchString = `Aparência para **${nomeFicha}**`;
      } else {
        searchString = `Imagem para ${tipoItem} **${nomeItem}** da ficha **${nomeFicha}**`;
      }

      const foundMessage = messages.find(m => m.content.includes(searchString) && m.attachments.size > 0);

      if (foundMessage) {
        return foundMessage.attachments.first().url;
      }

      return null;
    } catch (error) {
      console.error("Erro ao buscar imagem no canal de backup:", error);
      return null;
    }
  }

  // #endregion

  async run(interaction) {
    const subComando = interaction.options.getSubcommand();

    switch (subComando) {
      case "criar":
        await this.backFichaCriar(interaction);
        break;
      case "ver":
        await this.backFichaVer(interaction);
        break;
      case "habilidade":
        await this.backFichaHabAdd(interaction);
        break;
    }
  }

  /* #region  BACK-END */

  /* #region  CRIAÇÃO DE FICHA */
  
  async backFichaCriar(interaction) {
    const msgInicial = await interaction.reply({
      content: "Iniciando criação de ficha...",
      ephemeral: true,
      fetchReply: true
    });
    try { 
      const modalFicha = new ModalBuilder()
        .setCustomId("modal_ficha_criar")
        .setTitle("Criação de Ficha de Personagem");

      const nomeInput = new TextInputBuilder()
        .setCustomId("criar_nome")
        .setLabel("Nome do Personagem")
        .setPlaceholder("O nome único do seu personagem.")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const racaInput = new TextInputBuilder()
        .setCustomId("criar_raca")
        .setLabel("Raça do Personagem")
        .setPlaceholder("Consulte as raças disponíveis no sistema.")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const reinoInput = new TextInputBuilder()
        .setCustomId("criar_reino")
        .setLabel("Reino de Origem")
        .setPlaceholder("Elysium, Ozark, Minerva, etc.")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const aparenciaInput = new TextInputBuilder()
        .setCustomId("criar_aparencia")
        .setLabel("Aparência (Nome, Universo)")
        .setPlaceholder("Ex: Kratos, God of War")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modalFicha.addComponents(
        new ActionRowBuilder().addComponents(nomeInput),
        new ActionRowBuilder().addComponents(racaInput),
        new ActionRowBuilder().addComponents(reinoInput),
        new ActionRowBuilder().addComponents(aparenciaInput)
      );

      const formEnviado = await this.formulario(interaction, modalFicha);

      if (!formEnviado) {
        return;
      }

      const fichaData = {
        nome: formEnviado.fields.getTextInputValue("criar_nome"),
        raca: formEnviado.fields.getTextInputValue("criar_raca"),
        reino: formEnviado.fields.getTextInputValue("criar_reino"),
        aparencia: formEnviado.fields.getTextInputValue("criar_aparencia"),
      };

      await formEnviado.deferUpdate(); // Apenas para confirmar que o modal foi recebido

      const querImagem = await this.botaoConfirma(msgInicial, "Deseja enviar uma imagem para a aparência?", "Sim", "Não", "Ok, agora envie a imagem no chat.");
      if (querImagem.confirmed) {
        fichaData.imagemURL = await this.armazemImagem(msgInicial, "a aparência", fichaData.nome, fichaData.nome);
      } else {
        await msgInicial.edit({ content: "Ok, continuando sem imagem." });
      }

      /* #region  SE JÁ HOUVER UMA FICHA DAQUELE PERSONAGEM */
      const fichaExistente = await this.client.database.Ficha.findOne({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        nome: fichaData.nome,
      });

      if (fichaExistente) {
        return msgInicial.edit({
          content: "❌ Você já possui um personagem com este nome!",
          ephemeral: true,
        });
      }
      /* #endregion */

      // CRIAÇÃO DA FICHA EM DATABASE
      const novaFic = await this.client.database.Ficha.create({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        nome: fichaData.nome,
        raca: fichaData.raca,
        reino: fichaData.reino,
        aparencia: fichaData.aparencia,
        imagemURL: fichaData.imagemURL,
        habilidades: [],
      });

      console.log(`[LOG FICHA] Ficha "${fichaData.nome}" criada por ${interaction.user.username} (${interaction.user.id}).`);

      try {
        const idCanLog = '1444579345736667147';
        const canalLog = await this.client.channels.fetch(idCanLog);

        if (canalLog) {
          const embedLog = new EmbedBuilder()
            .setColor("Green")
            .setTitle("📝 Nova Ficha Criada")
            .setDescription(`Uma nova ficha de personagem foi registrada no sistema.`)
            .addFields(
              { name: 'Personagem', value: novaFic.nome, inline: true },
              { name: 'Criador', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Raça', value: novaFic.raca, inline: false },
              { name: 'Reino', value: novaFic.reino, inline: false }
            )
            .setTimestamp();

          await canalLog.send({ embeds: [embedLog] });
        }
      } catch (e) { console.error("Erro ao enviar log de criação de ficha para o canal:", e); }

      //EMBED CONFIRMAÇÃO DE CRIAÇÃO DE FICHA
      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("✅ Ficha Criada!")
        .setDescription(
          `A ficha para **${fichaData.nome}** foi criada com sucesso!`
        );

      await msgInicial.edit({ content: '', embeds: [embed], components: [] });
    } catch (err) {
      console.error("Erro ao criar ficha:", err);
      const errorMessage = {
        content: `Ocorreu um erro ao criar a ficha! Erro: \`${err.message}\`.`,
        embeds: [],
        components: [],
        ephemeral: true
      };
      await (interaction.replied || interaction.deferred ? interaction.followUp(errorMessage) : interaction.reply(errorMessage)).catch(() => {});
    }
  }

  /* #region  ADICIONAR HABILIDADE NOVA */
  async backFichaHabAdd(interaction) {
    const msgInicial = await interaction.reply({
      content: "Buscando suas fichas...",
      ephemeral: true,
      fetchReply: true
    });

    const fichasDoUsuario = await this.client.database.Ficha.find({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });

    if (!fichasDoUsuario.length) {  // se não tem fichas

      return msgInicial.edit({
        content:
          "❌ Você não tem fichas registradas, precisa criar uma ficha primeiro com `/ficha criar`.",
        ephemeral: true,
      });
    }

    if (fichasDoUsuario.length > 1) {
      const options = fichasDoUsuario.map((ficha) => ({
        label: ficha.nome,
        description: `Raça: ${ficha.raca} | Reino: ${ficha.reino}`,
        value: ficha._id.toString(),
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_ficha_habilidade_add")
        .setPlaceholder("Selecione o personagem para adicionar a habilidade")
        .addOptions(options);

      const botoesRow = new ActionRowBuilder().addComponents(selectMenu);

      await msgInicial.edit({
        content: "Para qual personagem você quer adicionar esta habilidade?",
        components: [botoesRow],
        ephemeral: true,
      });

      const coletorResposta = msgBotao.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          i.customId === "select_ficha_habilidade_add",
        time: 6000000,
      });

      coletorResposta.on("collect", async (i) => {
        const fichaId = i.values[0];
        await i.deferUpdate();
        await this.backFichaUnicaHabAdd(msgInicial, i, fichaId);
      });

      coletorResposta.on("end", (collected) => {
        if (collected.size === 0) {
          msgInicial
            .editReply({ content: "Tempo esgotado.", components: [] })
            .catch(() => {});
        }
      });
    } else {
      await msgInicial.edit({ content: `Adicionando habilidade para **${fichasDoUsuario[0].nome}**...` });
      const fichaId = fichasDoUsuario[0]._id.toString();
      await this.backFichaUnicaHabAdd(interaction, fichaId);
    }
  }

  /* #endregion */

  /* #region  ADICIONAR HABILIDADE NOVA */
  async backFichaUnicaHabAdd(msgInicial, interaction, fichaId) {
    const modalHab = new ModalBuilder()
      .setCustomId(`modal_habilidade_add_${fichaId}`)
      .setTitle("Adicionar Nova Habilidade");

    const nomeInput = new TextInputBuilder().setCustomId('hab_nome').setLabel("Nome da Habilidade").setStyle(TextInputStyle.Short).setRequired(true);
    const categoriaInput = new TextInputBuilder().setCustomId('hab_categoria').setLabel("Categoria").setPlaceholder("Física, Mágica, Passiva, etc.").setStyle(TextInputStyle.Short).setRequired(true);
    const custoInput = new TextInputBuilder().setCustomId('hab_custo').setLabel("Custo (Opcional)").setStyle(TextInputStyle.Short).setRequired(false);
    const descricaoInput = new TextInputBuilder().setCustomId('hab_descricao').setLabel("Descrição da Habilidade").setStyle(TextInputStyle.Paragraph).setRequired(true);

    modalHab.addComponents(
      new ActionRowBuilder().addComponents(nomeInput),
      new ActionRowBuilder().addComponents(categoriaInput),
      new ActionRowBuilder().addComponents(custoInput),
      new ActionRowBuilder().addComponents(descricaoInput)
    );

    const formEnviado = await this.formulario(interaction, modalHab);
    if (!formEnviado) return;

    const dadosHabilidade = {
      nome: formEnviado.fields.getTextInputValue('hab_nome'),
      categoria: formEnviado.fields.getTextInputValue('hab_categoria'),
      custo: formEnviado.fields.getTextInputValue('hab_custo') || "Nenhum",
      descricao: formEnviado.fields.getTextInputValue('hab_descricao'),
    };

    const ficha = await this.client.database.Ficha.findById(fichaId);
    if (!ficha) {
      return formEnviado.editReply({ content: "Erro: A ficha selecionada não foi encontrada." });
    }    
    
    await formEnviado.deferUpdate();

    const confirmacaoImagem = await this.botaoConfirma(msgInicial, `Deseja adicionar uma imagem para a habilidade **${dadosHabilidade.nome}**?`, "Sim", "Não", "");
    if (confirmacaoImagem.confirmed) {
      const imageUrl = await this.armazemImagem(msgInicial, "a habilidade", dadosHabilidade.nome, ficha.nome);
      if (imageUrl) dadosHabilidade.imagemURL = imageUrl;
    }

    await msgInicial.edit({ content: 'Adicionando sub-habilidades...', components: [] });
    dadosHabilidade.subHabilidades = [];
    
    let confirmacaoSub;
    while ((confirmacaoSub = await this.botaoConfirma(formEnviado, "Deseja adicionar uma sub-habilidade?", "Sim", "Não", "")).confirmed) {

      const modalSub = new ModalBuilder()
        .setCustomId(`modal_sub_hab_add_${fichaId}_${Date.now()}`)
        .setTitle("Adicionar Sub-Habilidade");

      const nomeSubInput = new TextInputBuilder().setCustomId('sub_nome').setLabel("Nome da Sub-Habilidade").setStyle(TextInputStyle.Short).setRequired(true);
      const descSubInput = new TextInputBuilder().setCustomId('sub_desc').setLabel("Descrição").setStyle(TextInputStyle.Paragraph).setRequired(true);
      const custoSubInput = new TextInputBuilder().setCustomId('sub_custo').setLabel("Custo (Opcional)").setStyle(TextInputStyle.Short).setRequired(false);

      modalSub.addComponents(
        new ActionRowBuilder().addComponents(nomeSubInput),
        new ActionRowBuilder().addComponents(descSubInput),
        new ActionRowBuilder().addComponents(custoSubInput)
      );

      const formSubEnviado = await this.formulario(confirmacaoSub.interaction, modalSub);
      if (!formSubEnviado) break;

      const dadosSubHabilidade = {
        nome: formSubEnviado.fields.getTextInputValue('sub_nome'),
        descricao: formSubEnviado.fields.getTextInputValue('sub_desc'),
        custo: formSubEnviado.fields.getTextInputValue('sub_custo') || "Nenhum",
      };
      await formSubEnviado.deferUpdate();

      const confirmacaoImgSub = await this.botaoConfirma(formSubEnviado, `Deseja adicionar uma imagem para a sub-habilidade **${dadosSubHabilidade.nome}**?`, "Sim", "Não", "");
      if (confirmacaoImgSub && confirmacaoImgSub.confirmed) {
        const imageUrl = await this.armazemImagem(confirmacaoImgSub.interaction, "a sub-habilidade", dadosSubHabilidade.nome, ficha.nome);
        if (imageUrl) dadosSubHabilidade.imagemURL = imageUrl;
      }

      dadosHabilidade.subHabilidades.push(dadosSubHabilidade);
      await msgInicial.edit({ content: `✅ Sub-habilidade **${dadosSubHabilidade.nome}** adicionada.`, components: [] });
    }

    ficha.habilidades.push(dadosHabilidade);
    await ficha.save();

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("✅ Habilidade Adicionada!")
      .setDescription(
        `Habilidade **${dadosHabilidade.nome}** adicionada à ficha de **${ficha.nome}**.`
      );

    await msgInicial.edit({
      content: '',
      embeds: [embed],
      components: []
    });
  }
  /* #endregion */

  /* #region VISUALIZAÇÃO DE FICHA UNICA */
  async backFichaVer(interaction) {
    const fichasDoUsuario = await this.client.database.Ficha.find({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
    });

    if (!fichasDoUsuario.length) {
      return interaction.editReply({
        content: 
          "❌ Você não possui nenhuma ficha para visualizar. Use `/ficha criar` para começar.", ephemeral: true
      });
    }

    // Cria as opções para o menu de seleção
    const options = fichasDoUsuario.map((ficha) => ({
      label: ficha.nome,
      description: `Raça: ${ficha.raca} | Reino: ${ficha.reino}`,
      value: ficha._id.toString(), // O ID único da ficha
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_ficha_view")
      .setPlaceholder("Selecione uma ficha para visualizar")
      .addOptions(options);

    const botoesRow = new ActionRowBuilder().addComponents(selectMenu);

    const response = await interaction.reply({
      content: "Qual ficha você gostaria de ver?",
      components: [botoesRow], ephemeral: true
    });

    const coletorResposta = response.createMessageComponentCollector({
      filter: (i) =>
        i.user.id === interaction.user.id && i.customId === "select_ficha_view",
      time: 600000, // 10 minutos
    });

    coletorResposta.on("collect", async (i) => {
      const fichaId = i.values[0];
      await this.backFichaVerMultipla(i, fichaId); 
    });

    coletorResposta.on("end", (collected, reason) => {
      if (collected.size === 0) {
        interaction
          .editReply({ content: "Tempo esgotado.", components: [] })
          .catch(() => {});
      }
    });
  }

  /* #endregion */

  /* #region  VISUALIZAÇÃO DE FICHA MULTIPLA */
  async backFichaVerMultipla(interaction, fichaId) {
    try { 
      await interaction.deferReply({ ephemeral: true });

      let fichas = await this.client.database.Ficha.find({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      }).sort({ createdAt: -1 }); 

      if (!fichas.length) {
        return interaction.editReply({ content: "Nenhuma ficha encontrada.", ephemeral: true });
      }

      this.client.fichaStates.set(interaction.user.id, {
        currentPage: 0,
        fichas,
      });

      let currentFichaIndex = fichas.findIndex(
        (f) => f._id.toString() === fichaId.toString()
      );
      let pages = fichas.length;

      let fichaPrincipal = fichas[currentFichaIndex];
      if (!fichaPrincipal.imagemURL) {
        const backupUrl = await this.buscarImagemBackup('aparência', fichaPrincipal.nome, fichaPrincipal.nome);
        if (backupUrl) fichaPrincipal.imagemURL = backupUrl;
        await fichaPrincipal.save();
      }

      let viewMode = "ficha"; // 'ficha' ou 'habilidades'
      let currentHabilidadeIndex = 0;
      let currentDescPageIndex = 0;
      let currentSubHabilidadeIndex = 0;
      let habilidadePaiAtual = null;

      const categoryIcons = {
        fisica: "⚔️",
        magica: "✨",
        passiva: "🛡️",
        haki: "👑",
        sagrada: "🕊️",
        demoniaca: "😈",
        "aura de combate": "🔥",
        outros: "📁",
      };

      // Função para gerar embed da ficha
      const getFichaEmbed = (ficha) => {
        const embed = new EmbedBuilder()
          .setColor("Blue")
          .setTitle(`📝 Ficha: ${ficha.nome}`)
          .addFields(
            { name: "Reino", value: ficha.reino, inline: true },
            { name: "Raça", value: ficha.raca, inline: true },
            { name: "Aparência", value: ficha.aparencia },
            {
              name: "Habilidades",
              value: ficha.habilidades.length
                ? "Use os botões abaixo para ver as habilidades"
                : "Nenhuma habilidade registrada",
            }
          )
          .setFooter({ text: `Ficha ${currentFichaIndex + 1} de ${pages}` });

        if (ficha.imagemURL) {
          embed.setImage(ficha.imagemURL);
        }

        return embed;
      };

      const getHabilidadeEmbed = (habilidade, ficha, descPageIndex = 0) => {
        if (!habilidade) {
          return {
            embed: new EmbedBuilder()
              .setColor("Red")
              .setTitle("Erro de Visualização")
              .setDescription(
                "Não foi possível carregar os detalhes da habilidade. Tente novamente."
              ),
            components: [],
          };
        }

        const skillCategoriasPresentes = ficha.habilidades.filter(
          (s) =>
            (s.categoria.toLowerCase() || "outros") ===
            (habilidade.categoria.toLowerCase() || "outros")
        );

        const totalHabilidadesNaCategoria = skillCategoriasPresentes.length;

        const embed = new EmbedBuilder()
          .setColor("Purple")
          .setTitle(`🔮 Habilidade: ${habilidade.nome}`);

        if (habilidade.custo && habilidade.custo.toLowerCase() !== "nenhum") {
          embed.addFields({ name: "Custo", value: habilidade.custo, inline: true });
        } //se o custo estiver disponivel e não for "nenhum"

        if (habilidade.imagemURL) {
            embed.setImage(habilidade.imagemURL);
        }

        /* #region  PARAMTROS DE CONFIG */
        const MAX_DESC_LENGTH = 3500;
        const MAX_FIELD_LENGTH = 1024;
        let extraComponents = [];
        let pageDescs = [];
        /* #endregion */

        // Botões de Ação da Habilidade
        const actionRow = new ActionRowBuilder();
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`edit_habilidade_${ficha._id}_${habilidade._id}`)
                .setLabel("Editar")
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✏️')
        );
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`add_image_habilidade_${ficha._id}_${habilidade._id}`)
                .setLabel("Adicionar Imagem")
                .setStyle(ButtonStyle.Secondary)
        );
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`delete_habilidade_${ficha._id}_${habilidade._id}`)
                .setLabel("Excluir")
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️'));
        actionRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`add_subhabilidade_${ficha._id}_${habilidade._id}`)
                .setLabel("Adicionar Sub-habilidade")
                .setStyle(ButtonStyle.Success)
                .setEmoji('➕')
        );

        if (habilidade.descricao) {
          if (habilidade.descricao.length <= MAX_DESC_LENGTH) {
            embed.setDescription(habilidade.descricao || "Nenhuma descrição fornecida.");
          } else {
            pageDescs = this.splitDescription(habilidade.descricao, MAX_DESC_LENGTH);
            embed.setDescription(pageDescs[descPageIndex] ?? "");

            /* #region  BOTÕES DE PAGINAÇÃO PARTES DESCRIÇÕES */
            const descNavButtons = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("prev_desc_page")
                .setLabel("◀ Descrição")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(descPageIndex === 0),
              new ButtonBuilder()
                .setCustomId("next_desc_page")
                .setLabel("Descrição ▶")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(descPageIndex >= pageDescs.length - 1)
            );
            extraComponents.push(descNavButtons);
            /* #endregion */
          }
        } else {
            embed.setDescription("Nenhuma descrição fornecida.");
        }

        if (habilidade.subHabilidades && habilidade.subHabilidades.length > 0) {
            actionRow.addComponents(new ButtonBuilder()
                .setCustomId(`view_sub_habilidades_${habilidade._id}`)
                .setLabel("Ver Sub-habilidades")
                .setStyle(ButtonStyle.Secondary)
            );
        }

        if (actionRow.components.length > 0) {
            extraComponents.unshift(actionRow);
        }

        const footerParts = [
          `Habilidade ${habilidade.categoria} ${
            currentHabilidadeIndex + 1
          }/${totalHabilidadesNaCategoria}`,
        ]; //posição da habilidade na categoria

        if (pageDescs.length > 0) {
          // FRONT-END PAGINAÇÃO DA DESCRIÇÃO > 2000 CARACTERES
          embed.setTitle(
            `🔮 Habilidade: ${habilidade.nome} - DESCRIÇÃO DIVIDIDA`
          );
          footerParts.push(
            `Descrição - parte ${descPageIndex + 1}/${pageDescs.length}`
          );
        }

        embed.setFooter({ text: footerParts.join(" | ") });

        return { embed, components: extraComponents };
      };

      const getSubHabilidadeEmbed = (subHabilidade, habilidadePai) => {
        const embed = new EmbedBuilder()
          .setColor("Aqua")
          .setTitle(`SUB: ${subHabilidade.nome}`)
          .setDescription(subHabilidade.descricao || "Nenhuma descrição fornecida.");

        if (subHabilidade.custo && subHabilidade.custo.toLowerCase() !== "nenhum") {
          embed.addFields({ name: "Custo", value: subHabilidade.custo, inline: true });
        }

        if (subHabilidade.imagemURL) {
          embed.setImage(subHabilidade.imagemURL);
        }

        const actionButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`edit_sub_habilidade_${habilidadePai._id}_${subHabilidade._id}`)
                .setLabel("Editar")
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✏️'),
            new ButtonBuilder()
                .setCustomId(`add_image_sub_habilidade_${habilidadePai._id}_${subHabilidade._id}`)
                .setLabel("Adicionar Imagem")
                .setStyle(ButtonStyle.Secondary)
        );

        const totalSubHabilidades = habilidadePai.subHabilidades.length;
        embed.setFooter({ text: `Sub-habilidade ${currentSubHabilidadeIndex + 1} de ${totalSubHabilidades} | Pai: ${habilidadePai.nome}` });

        const navButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prevSubHab")
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentSubHabilidadeIndex === 0),
          new ButtonBuilder()
            .setCustomId("voltarHabilidadePai")
            .setLabel("Voltar à Habilidade")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("nextSubHab")
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentSubHabilidadeIndex >= totalSubHabilidades - 1)
        );

        return { embed, components: [actionButtons, navButtons] };
      };

      /* #region  FRONT-END BOTÕES DE NAVEGAÇÃO DA FICHA */
      // Botões padrão da visualização da Ficha
      const botNavFicha = (disablePrev, disableNext) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prevPage")
            .setLabel("◀️ Anterior")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disablePrev),
          new ButtonBuilder()
            .setCustomId("nextPage")
            .setLabel("Próximo ▶️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disableNext),
          new ButtonBuilder()
            .setCustomId("viewHabilidades")
            .setLabel("Ver Habilidades")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!fichas[currentFichaIndex].habilidades.length),
          new ButtonBuilder()
            .setCustomId(`edit_ficha_${fichas[currentFichaIndex]._id}`)
            .setLabel("Editar Ficha")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✏️'),
          new ButtonBuilder()
            .setCustomId(`delete_ficha_${fichas[currentFichaIndex]._id}`)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'));
      };

      // Botões de navegação das Habilidades
      const botNavHabs = (disablePrev, disableNext) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prevHab")
            .setLabel("◀️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disablePrev),
          new ButtonBuilder()
            .setCustomId("voltarFicha")
            .setLabel("Voltar para Ficha")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("nextHab")
            .setLabel("▶️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disableNext)
        );
      };
      /* #endregion */

      const message = await interaction.editReply({
        embeds: [getFichaEmbed(fichas[currentFichaIndex])],
        components: [
          botNavFicha(currentFichaIndex === 0, currentFichaIndex === pages - 1),
        ],
      });

      const coletorResposta = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 6000000,
        idle: 60000,
      });

      coletorResposta.on("collect", async (i) => {
        // Lógica para abrir modal de edição de ficha
        if (i.customId.startsWith("edit_ficha_")) {
            const fichaIdParaEditar = i.customId.split('_')[2];
            const fichaParaEditar = await this.client.database.Ficha.findById(fichaIdParaEditar);
            if (!fichaParaEditar) return i.reply({ content: "Ficha não encontrada.", ephemeral: true });

            const modal = new ModalBuilder().setCustomId(`modal_edit_ficha_${fichaIdParaEditar}`).setTitle(`Editando: ${fichaParaEditar.nome}`);
            
            const nomeInput = new TextInputBuilder().setCustomId('edit_nome').setLabel("Nome do Personagem").setStyle(TextInputStyle.Short).setValue(fichaParaEditar.nome).setRequired(true);
            const racaInput = new TextInputBuilder().setCustomId('edit_raca').setLabel("Raça").setStyle(TextInputStyle.Short).setValue(fichaParaEditar.raca).setRequired(true);
            const reinoInput = new TextInputBuilder().setCustomId('edit_reino').setLabel("Reino").setStyle(TextInputStyle.Short).setValue(fichaParaEditar.reino).setRequired(true);
            const aparenciaInput = new TextInputBuilder().setCustomId('edit_aparencia').setLabel("Aparência (Nome, Universo)").setStyle(TextInputStyle.Short).setValue(fichaParaEditar.aparencia).setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nomeInput),
                new ActionRowBuilder().addComponents(racaInput),
                new ActionRowBuilder().addComponents(reinoInput),
                new ActionRowBuilder().addComponents(aparenciaInput)
            );
            await i.showModal(modal);
            return; // Impede a atualização da mensagem principal
        }

        if (i.customId.startsWith("edit_habilidade_")) {
            const [,, fichaId, habilidadeId] = i.customId.split('_');
            const fichaSearch = await this.client.database.Ficha.findById(fichaId);
            const habilidadeParaEditar = fichaSearch.habilidades.id(habilidadeId);

            if (!habilidadeParaEditar) return i.reply({ content: "Habilidade não encontrada.", ephemeral: true });

            const modal = new ModalBuilder().setCustomId(`modal_edit_habilidade_${habilidadeId}`).setTitle(`Editando Habilidade: ${habilidadeParaEditar.nome}`);

            const nomeInput = new TextInputBuilder().setCustomId('edit_nome').setLabel("Nome da Habilidade").setStyle(TextInputStyle.Short).setValue(habilidadeParaEditar.nome).setRequired(true);
            const descricaoInput = new TextInputBuilder().setCustomId('edit_descricao').setLabel("Descrição da Habilidade").setStyle(TextInputStyle.Paragraph).setValue(habilidadeParaEditar.descricao).setRequired(true);
            const categoriaInput = new TextInputBuilder().setCustomId('edit_categoria').setLabel("Categoria").setStyle(TextInputStyle.Short).setValue(habilidadeParaEditar.categoria).setRequired(true);
            const custoInput = new TextInputBuilder().setCustomId('edit_custo').setLabel("Custo (Opcional)").setStyle(TextInputStyle.Short).setValue(habilidadeParaEditar.custo || "Nenhum").setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nomeInput),
                new ActionRowBuilder().addComponents(descricaoInput),
                new ActionRowBuilder().addComponents(categoriaInput),
                new ActionRowBuilder().addComponents(custoInput)
            );
            await i.showModal(modal);
            return;
        }

        if (i.customId.startsWith("add_image_habilidade_")) {
            const [,,, fichaId, habilidadeId] = i.customId.split('_');
            const modal = new ModalBuilder()
                .setCustomId(`modal_add_image_hab_${fichaId}_${habilidadeId}`)
                .setTitle('Adicionar Imagem à Habilidade');
            const urlInput = new TextInputBuilder()
                .setCustomId('hab_image_url')
                .setLabel('URL da Imagem')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('https://exemplo.com/imagem.png');
            modal.addComponents(new ActionRowBuilder().addComponents(urlInput));
            await i.showModal(modal);
            return;
        }

        if (i.customId.startsWith("add_image_sub_habilidade_")) {
            const [,,, habilidadePaiId, subHabilidadeId] = i.customId.split('_');
            const modal = new ModalBuilder()
                .setCustomId(`modal_add_image_subhab_${habilidadePaiId}_${subHabilidadeId}`)
                .setTitle('Adicionar Imagem à Sub-Habilidade');
            const urlInput = new TextInputBuilder()
                .setCustomId('subhab_image_url')
                .setLabel('URL da Imagem')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('https://exemplo.com/imagem.png');
            modal.addComponents(new ActionRowBuilder().addComponents(urlInput));
            await i.showModal(modal);
            return;
        }

        if (i.customId.startsWith("edit_sub_habilidade_")) {
            const [,,, habilidadePaiId, subHabilidadeId] = i.customId.split('_');
            const ficha = await this.client.database.Ficha.findOne({ "habilidades._id": habilidadePaiId });
            const habilidadePai = ficha.habilidades.id(habilidadePaiId);
            const subHab = habilidadePai.subHabilidades.id(subHabilidadeId);

            if (!subHab) return i.reply({ content: "Sub-habilidade não encontrada.", ephemeral: true });

            const modal = new ModalBuilder().setCustomId(`modal_edit_subhab_${habilidadePaiId}_${subHabilidadeId}`).setTitle(`Editando: ${subHab.nome}`);
            const nomeInput = new TextInputBuilder().setCustomId('edit_sub_nome').setLabel("Nome da Sub-Habilidade").setStyle(TextInputStyle.Short).setValue(subHab.nome).setRequired(true);
            const descInput = new TextInputBuilder().setCustomId('edit_sub_desc').setLabel("Descrição").setStyle(TextInputStyle.Paragraph).setValue(subHab.descricao).setRequired(true);
            const custoInput = new TextInputBuilder().setCustomId('edit_sub_custo').setLabel("Custo (Opcional)").setStyle(TextInputStyle.Short).setValue(subHab.custo || "Nenhum").setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nomeInput),
                new ActionRowBuilder().addComponents(descInput),
                new ActionRowBuilder().addComponents(custoInput)
            );
            await i.showModal(modal);
            return;
        }

        if (i.customId.startsWith("delete_habilidade_")) {
            const [,, fichaId, habilidadeId] = i.customId.split('_');
            
            const confirmacao = await this.botaoConfirma(i, "Você tem certeza que deseja excluir esta habilidade permanentemente?", "Sim, excluir", "Não", "");

            if (confirmacao.confirmed) {
                const fichaParaAtualizar = await this.client.database.Ficha.findById(fichaId);
                if (!fichaParaAtualizar) return confirmacao.interaction.reply({ content: "Ficha não encontrada.", ephemeral: true });

                fichaParaAtualizar.habilidades.pull({ _id: habilidadeId });
                await fichaParaAtualizar.save();

                await confirmacao.interaction.update({ content: "✅ Habilidade excluída com sucesso! A visualização será atualizada.", components: [], embeds: [] });
                viewMode = "habilidades"; // Volta para a lista de categorias
                coletorResposta.emit('collect', i); // Força a atualização da tela
            }
            return;
        }

        if (i.customId.startsWith("delete_ficha_")) {
            const fichaIdParaExcluir = i.customId.split('_')[2];
            
            await i.deferUpdate();

            const confirmacao = await this.botaoConfirma(i, "Você tem certeza que deseja excluir esta ficha permanentemente? Esta ação não pode ser desfeita.", "Sim, excluir", "Não", "");

            if (confirmacao.confirmed) {
                await this.client.database.Ficha.findByIdAndDelete(fichaIdParaExcluir);

                fichas = fichas.filter(f => f._id.toString() !== fichaIdParaExcluir);
                pages = fichas.length;

                if (pages === 0) {
                    await message.edit({ content: "Você não possui mais fichas para visualizar.", embeds: [], components: [] });
                    coletorResposta.stop();
                    return;
                }

                currentFichaIndex = Math.max(0, currentFichaIndex - 1);

                // Força a atualização da visualização para a próxima ficha
                await message.edit({ content: "✅ Ficha excluída com sucesso! Atualizando visualização...", embeds: [], components: [] });
                i.customId = 'noop'; // Um ID que não faz nada, apenas para reativar o coletor
                coletorResposta.emit('collect', i);
            }
            return;
        }

        if (i.customId.startsWith("add_subhabilidade_")) {
            const [,, fichaId, habilidadeId] = i.customId.split('_');
            const fichaParaEditar = await this.client.database.Ficha.findById(fichaId);
            const habilidadeParaEditar = fichaParaEditar.habilidades.id(habilidadeId);

            if (!habilidadeParaEditar) return i.reply({ content: "Habilidade não encontrada.", ephemeral: true });

            const modalSub = new ModalBuilder()
                .setCustomId(`modal_add_sub_${fichaId}_${habilidadeId}`)
                .setTitle(`Nova Sub para: ${habilidadeParaEditar.nome}`);

            const nomeSubInput = new TextInputBuilder().setCustomId('sub_nome').setLabel("Nome da Sub-Habilidade").setStyle(TextInputStyle.Short).setRequired(true);
            const descSubInput = new TextInputBuilder().setCustomId('sub_desc').setLabel("Descrição").setStyle(TextInputStyle.Paragraph).setRequired(true);
            const custoSubInput = new TextInputBuilder().setCustomId('sub_custo').setLabel("Custo (Opcional)").setStyle(TextInputStyle.Short).setRequired(false);

            modalSub.addComponents(
                new ActionRowBuilder().addComponents(nomeSubInput),
                new ActionRowBuilder().addComponents(descSubInput),
                new ActionRowBuilder().addComponents(custoSubInput)
            );

            const formSubEnviado = await this.formulario(i, modalSub);
            if (!formSubEnviado) return;

            const dadosSubHabilidade = {
                nome: formSubEnviado.fields.getTextInputValue('sub_nome'),
                descricao: formSubEnviado.fields.getTextInputValue('sub_desc'),
                custo: formSubEnviado.fields.getTextInputValue('sub_custo') || "Nenhum",
            };

            habilidadeParaEditar.subHabilidades.push(dadosSubHabilidade);
            await fichaParaEditar.save();
            await formSubEnviado.reply({ content: `✅ Sub-habilidade **${dadosSubHabilidade.nome}** adicionada com sucesso! Navegue novamente para vê-la.`, ephemeral: true });
            
        }

        if (viewMode === "ficha") {
          if (i.customId === "prevPage") {
            currentFichaIndex--;
          } else if (i.customId === "nextPage") {
            currentFichaIndex++;
          } else if (i.customId === "viewHabilidades") {
            viewMode = "habilidades";
            currentHabilidadeIndex = 0;
            currentDescPageIndex = 0;
          }
        } else if (viewMode === "habilidades") {
            if (i.customId.startsWith("view_category_")) {
                const category = i.customId.substring("view_category_".length);
                viewMode = `habilidade_categoria_${category}`;
                currentHabilidadeIndex = 0;
                currentDescPageIndex = 0;
            } else if (i.customId === "voltarFicha") {
                viewMode = "ficha";
            }
        } else if (viewMode.startsWith("habilidade_categoria_")) {
          if (i.customId === "prevHab") {
            currentHabilidadeIndex--;
            currentDescPageIndex = 0;
          } else if (i.customId === "nextHab") {
            currentHabilidadeIndex++;
            currentDescPageIndex = 0;
          } else if (i.customId === "voltarHabilidades") {
            viewMode = "habilidades";
            currentHabilidadeIndex = 0;
            currentDescPageIndex = 0;
          } else if (i.customId === "prev_desc_page") {
            if (currentDescPageIndex > 0) currentDescPageIndex--;
          } else if (i.customId === "next_desc_page") {
            currentDescPageIndex++;
          } else if (i.customId.startsWith("view_sub_habilidades_")) {
            viewMode = "sub_habilidades";
            currentSubHabilidadeIndex = 0;
            currentDescPageIndex = 0; // Reseta paginação da descrição principal
          }
        }
        
        try {
          if (viewMode === "ficha") {
            await i.update({ // Atualiza a mensagem com base no modo de visualização
              embeds: [getFichaEmbed(fichas[currentFichaIndex])],
              components: [
                botNavFicha(
                  currentFichaIndex === 0,
                  currentFichaIndex === pages - 1
                ),
              ],
            });
          } else if (viewMode === "habilidades") {
            const fichaAtual = fichas[currentFichaIndex];
            const skillsByCategory = fichaAtual.habilidades.reduce(
              (acc, skill) => {
                const category = skill.categoria.toLowerCase() || "outros";
                if (!acc[category]) acc[category] = [];
                acc[category].push(skill);
                return acc;
              },
              {}
            );

            const categoryButtons = Object.keys(skillsByCategory).map(
              (category) =>
                new ButtonBuilder()
                  .setCustomId(`view_category_${category}`)
                  .setLabel(
                    category.charAt(0).toUpperCase() + category.slice(1)
                  )
                  .setStyle(ButtonStyle.Secondary)
                  .setEmoji(categoryIcons[category] || "📁")
            );

            const legendDescription = Object.keys(skillsByCategory)
              .map(
                (cat) =>
                  `${categoryIcons[cat] || "📁"} **${
                    cat.charAt(0).toUpperCase() + cat.slice(1)
                  }**`
              )
              .join("\n");

            const legendEmbed = new EmbedBuilder()
              .setColor("Greyple")
              .setTitle("Categorias de Habilidades")
              .setDescription(
                legendDescription || "Nenhuma habilidade para mostrar."
              );

            const botoesRows = [];
            for (let i = 0; i < categoryButtons.length; i += 5) {
              botoesRows.push(
                new ActionRowBuilder().addComponents(
                  categoryButtons.slice(i, i + 5)
                )
              );
            }
            botoesRows.push(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("voltarFicha")
                  .setLabel("Voltar para a Ficha")
                  .setStyle(ButtonStyle.Danger)
              )
            );

            await i.update({
              embeds: [legendEmbed],
              components: botoesRows,
            });
          } else if (viewMode.startsWith("habilidade_categoria_")) {
            const fichaAtual = fichas[currentFichaIndex];
            const currentCategory = viewMode.substring(
              "habilidade_categoria_".length
            );
            const skillCategoriasPresentes = fichaAtual.habilidades.filter(
              (s) => (s.categoria.toLowerCase() || "outros") === currentCategory
            );
            const totalHabilidades = skillCategoriasPresentes.length;

            const navButtons = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("prevHab")
                .setLabel("◀️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentHabilidadeIndex === 0),
              new ButtonBuilder()
                .setCustomId("voltarHabilidades")
                .setLabel("Voltar às Categorias")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId("nextHab")
                .setLabel("▶️")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentHabilidadeIndex >= totalHabilidades - 1)
            );

            habilidadePaiAtual = skillCategoriasPresentes[currentHabilidadeIndex];

            // Lógica de busca automática de imagem para a habilidade
            if (!habilidadePaiAtual.imagemURL) {
              const backupUrl = await this.buscarImagemBackup('a habilidade', habilidadePaiAtual.nome, fichaAtual.nome);
              if (backupUrl) {
                habilidadePaiAtual.imagemURL = backupUrl;
                await fichaAtual.save();
              }
            }
            const { embed: habilidadeEmbed, components: extraComponents } =
              getHabilidadeEmbed(
                habilidadePaiAtual,
                fichaAtual,
                currentDescPageIndex
              );

            await i.update({
              embeds: [habilidadeEmbed],
              components: [navButtons, ...extraComponents],
            });
          } else if (viewMode === "sub_habilidades") {
            const fichaAtual = fichas[currentFichaIndex];
            if (!habilidadePaiAtual) throw new Error("Habilidade pai não encontrada para visualizar sub-habilidades.");

            if (i.customId === "prevSubHab") currentSubHabilidadeIndex--;
            if (i.customId === "nextSubHab") currentSubHabilidadeIndex++;
            if (i.customId === "voltarHabilidadePai") {
                viewMode = `habilidade_categoria_${habilidadePaiAtual.categoria.toLowerCase()}`;
                i.customId = 'noop'; // Evita re-processamento
                coletorResposta.emit('collect', i); // Re-emite a interação para o coletor processar o novo viewMode
                return; // Pula o resto da execução atual
            }
            
            const subHabilidadeAtual = habilidadePaiAtual.subHabilidades[currentSubHabilidadeIndex];
            // Lógica de busca automática de imagem para a sub-habilidade
            if (!subHabilidadeAtual.imagemURL) {
                const backupUrl = await this.buscarImagemBackup('a sub-habilidade', subHabilidadeAtual.nome, fichaAtual.nome);
                if (backupUrl) {
                    subHabilidadeAtual.imagemURL = backupUrl;
                    const fichaParaSalvar = await this.client.database.Ficha.findById(fichaAtual._id);
                    await fichaParaSalvar.save();
                }
            }
            const { embed: subEmbed, components: subComponents } = getSubHabilidadeEmbed(subHabilidadeAtual, habilidadePaiAtual);

            await i.update({ embeds: [subEmbed], components: subComponents });
          }
        } catch (error) {
          if (error.code !== "InteractionAlreadyReplied") {
            console.error("Erro ao atualizar interação no coletor:", error);
          }
        }
      });

      coletorResposta.on("end", () => {
        message
          .edit({
            components: [],
          })
          .catch(() => {});
      });
    } catch (err) {
      console.error("Erro ao visualizar fichas:", err);
      return interaction.editReply({
        content: "Ocorreu um erro ao exibir a ficha!", ephemeral: true
      });
    }
  }
  /* #endregion */
  /* #endregion */
};

async function handleFichaInteraction(interaction, client) {
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('modal_edit_ficha_')) {
            const fichaId = interaction.customId.split('_')[3];
            const ficha = await client.database.Ficha.findById(fichaId);
            if (!ficha) return interaction.reply({ content: "Ficha não encontrada.", ephemeral: true });

            ficha.nome = interaction.fields.getTextInputValue('edit_nome');
            ficha.raca = interaction.fields.getTextInputValue('edit_raca');
            ficha.reino = interaction.fields.getTextInputValue('edit_reino');
            ficha.aparencia = interaction.fields.getTextInputValue('edit_aparencia');

            await ficha.save();
            return interaction.reply({ content: "✅ Ficha atualizada com sucesso! A visualização será atualizada em breve.", ephemeral: true });
        }

        if (interaction.customId.startsWith('modal_edit_habilidade_')) {
            const habilidadeId = interaction.customId.split('_')[3];
            const ficha = await client.database.Ficha.findOne({ "habilidades._id": habilidadeId });
            if (!ficha) return interaction.reply({ content: "Habilidade ou ficha não encontrada.", ephemeral: true });

            const habilidade = ficha.habilidades.id(habilidadeId);
            if (!habilidade) return interaction.reply({ content: "Habilidade não encontrada.", ephemeral: true });

            habilidade.nome = interaction.fields.getTextInputValue('edit_nome');
            habilidade.descricao = interaction.fields.getTextInputValue('edit_descricao');
            habilidade.categoria = interaction.fields.getTextInputValue('edit_categoria');
            habilidade.custo = interaction.fields.getTextInputValue('edit_custo');

            await ficha.save();
            return interaction.reply({ content: "✅ Habilidade atualizada com sucesso! A visualização será atualizada em breve.", ephemeral: true });
        }

        if (interaction.customId.startsWith('modal_edit_subhab_')) {
            const [,,, habilidadePaiId, subHabilidadeId] = interaction.customId.split('_');
            const ficha = await client.database.Ficha.findOne({ "habilidades._id": habilidadePaiId });
            if (!ficha) return interaction.reply({ content: "Ficha não encontrada.", ephemeral: true });

            const habilidadePai = ficha.habilidades.id(habilidadePaiId);
            const subHab = habilidadePai.subHabilidades.id(subHabilidadeId);
            if (!subHab) return interaction.reply({ content: "Sub-habilidade não encontrada.", ephemeral: true });

            subHab.nome = interaction.fields.getTextInputValue('edit_sub_nome');
            subHab.descricao = interaction.fields.getTextInputValue('edit_sub_desc');
            subHab.custo = interaction.fields.getTextInputValue('edit_sub_custo');

            await ficha.save();
            return interaction.reply({ content: "✅ Sub-habilidade atualizada com sucesso! A visualização será atualizada em breve.", ephemeral: true });
        }
    }
}
