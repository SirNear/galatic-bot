const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  TextInputStyle,
  TextInputBuilder,
  ModalBuilder,
  ButtonStyle,
  ComponentType,
  PermissionsBitField,
} = require("discord.js");
const Command = require("../../structures/Command");

module.exports = class quest extends Command {
  constructor(client) {
    super(client, {
      // Configurações do Comando prefixo
      name: "quest",
      description: "Registra uma nova quest para o rpg!",
      category: "rpg",
      aliases: [
        "missao",
        "quest",
        "qc",
        "criarmissao",
        "criarquest",
        "questcriar",
      ],
      UserPermission: [],
      clientPermission: [],
      OnlyDevs: false,
      slash: true,
    });

    // Configuração do Comando de Barra (Slash Command)
    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addSubcommand((subcommand) =>
          subcommand
            .setName("criar")
            .setDescription("Cria uma nova quest")
            .addStringOption(option =>
                option.setName('nome')
                    .setDescription('O nome da sua nova quest.')
                    .setRequired(true))
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("ver")
            .setDescription("Ver informações sobre uma quest existente")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("excluir")
            .setDescription("Exclui uma quest existente")
        );
    }
  }

  async run({ message, args, client, server }) {
    await message.reply("Comando de prefixo executado!");
  }

  async execute(interaction) {
    const subcomando = interaction.options.getSubcommand();

    switch (subcomando) {
      case "criar":
        const approvalRoleId = '731974690125643869'; 
        const approvalChannelId = '1422258818183729355'; 
        const userHasApprovalRole = interaction.member.roles.cache.has(approvalRoleId);

        const nomeDaQuest = interaction.options.getString('nome', true);

        const modal = this.buildCreateQuestModal();
        await interaction.showModal(modal);

        const modalSubmit = await interaction.awaitModalSubmit({
            filter: i => i.user.id === interaction.user.id && i.customId === 'criar_quest_modal',
            time: 600000 // 10 minutos
        }).catch(() => null);

        if (!modalSubmit) {
            return; 
        }

        try {
            await modalSubmit.deferReply({ flags: 64 });
        } catch (error) {
            if (error.code === 10062) { 
                console.log("A interação do modal de criação de quest expirou antes do envio.");
            }
            return;
        }

        try {
          const questData = {};
          questData.nome = nomeDaQuest; 
          questData.descricao = modalSubmit.fields.getTextInputValue("descricao");
          const maxPlayersInput = modalSubmit.fields.getTextInputValue("maxPlayers");
          questData.recompensa = modalSubmit.fields.getTextInputValue("recompensa");
          const dataInicioInput = modalSubmit.fields.getTextInputValue("dataInicio");

          if (isNaN(parseInt(maxPlayersInput, 10))) {
              await modalSubmit.editReply({ content: "❌ O número máximo de jogadores deve ser um número. A criação da quest foi cancelada." });
              return;
          }
          questData.maxPlayers = parseInt(maxPlayersInput, 10);

          const dataInicioDate = parseDate(dataInicioInput);
          if (!dataInicioDate || dataInicioDate < new Date()) {
              await modalSubmit.editReply({ content: "❌ A data de início é inválida ou está no passado. Use o formato DD/MM/AAAA HH:mm. A criação da quest foi cancelada." });
              return;
          }

          questData.dataInicio = dataInicioInput;
          questData.dataInicioTimestamp = dataInicioDate.getTime();
          questData.regras = modalSubmit.fields.getTextInputValue("regras");

          if (userHasApprovalRole) {
              await this.createAndPostQuest(interaction, questData, modalSubmit);
          } else {
              await this.sendForApproval(interaction, questData, modalSubmit, approvalChannelId);
          }

        } catch (error) {
          console.error("Erro ao criar quest:", error);
          await modalSubmit.editReply({ content: "Ocorreu um erro inesperado ao criar a quest." }).catch(() => {});
        }
        break;
      case "ver": {
        const questsDoMestre = await this.client.database.Quest.find({
          mestre: interaction.user.id
        });

        if (questsDoMestre.length === 0) {
          return interaction.reply({ content: "❌ Você ainda não criou nenhuma quest.", flags: 64 });
        }

        const verOptions = questsDoMestre.slice(0, 25).map(quest => ({
          label: quest.nome.substring(0, 100),
          description: `Status: ${quest.status}`.substring(0, 100),
          value: quest._id.toString(),
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('ver_quest_menu')
          .setPlaceholder('Selecione uma de suas quests para ver os detalhes...')
          .addOptions(verOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const reply = await interaction.reply({
          content: "Selecione uma de suas quests no menu abaixo:",
          components: [row],
          flags: 64,
        });

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          filter: i => i.user.id === interaction.user.id,
          time: 300_000 // 5 minutos
        });

        collector.on('collect', async i => {
          const questId = i.values[0];
          const questSelecionada = questsDoMestre.find(q => q._id.toString() === questId);

          let embed = new EmbedBuilder()
            .setTitle(`<:AwOo:810735164145270835> | QUEST - ${questSelecionada.nome.substring(0, 256)}`)
            .setDescription(questSelecionada.descricao.substring(0, 4096))
            .setColor("Blue")
            .addFields(
              { name: "Vagas", value: `${questSelecionada.participantes.length} / ${questSelecionada.maxPlayers.toString()}`, inline: true },
              { name: "Status", value: questSelecionada.status, inline: true },
              { name: "Recompensa", value: (questSelecionada.recompensa || "Nenhuma recompensa definida.").substring(0, 1024) },
              { name: "Regras", value: (questSelecionada.regras || "Nenhuma regra definida.").substring(0, 1024) },
              { name: "Início", value: `<t:${Math.floor(questSelecionada.dataInicioTimestamp / 1000)}:F>` }
            );

          await i.reply({ embeds: [embed], flags: 64 });
        });

        collector.on('end', () => {
          interaction.editReply({ content: 'O tempo para selecionar uma quest expirou.', components: [] }).catch(() => {});
        });
        break;
      }
      case "excluir": {
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const query = isAdmin ? {} : { mestre: interaction.user.id };

        const quests = await this.client.database.Quest.find(query);

        if (quests.length === 0) {
            return interaction.reply({ content: "❌ Nenhuma quest para excluir foi encontrada.", flags: 64 });
        }

        const excluirOptions = quests.slice(0, 25).map(quest => ({
            label: quest.nome.substring(0, 100),
            description: `ID: ${quest._id.toString()}`.substring(0, 100),
            value: quest._id.toString(),
        }));

        const excluirSelectMenu = new StringSelectMenuBuilder()
            .setCustomId('excluir_quest_menu')
            .setPlaceholder('Selecione uma quest para excluir...')
            .addOptions(excluirOptions);

        const excluirRow = new ActionRowBuilder().addComponents(excluirSelectMenu);

        const replyExcluir = await interaction.reply({
            content: isAdmin ? "Selecione a quest que deseja excluir:" : "Selecione uma de suas quests para excluir:",
            components: [excluirRow],
            flags: 64,
        });

        const collectorExcluir = replyExcluir.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: i => i.user.id === interaction.user.id && i.customId === 'excluir_quest_menu',
            time: 300000 // 5 minutos
        });

        collectorExcluir.on('collect', async i => {
            const questId = i.values[0];
            const questParaExcluir = await this.client.database.Quest.findById(questId);

            if (!questParaExcluir) {
                return i.update({ content: "❌ Esta quest não foi encontrada ou já foi excluída.", components: [] });
            }

            // Exclui o fórum associado, se existir
            if (questParaExcluir.forumChannelId) {
                try {
                    const forumChannel = await i.guild.channels.fetch(questParaExcluir.forumChannelId);
                    if (forumChannel) await forumChannel.delete(`Quest "${questParaExcluir.nome}" excluída por ${i.user.tag}`);
                } catch (error) {
                    console.warn(`Não foi possível excluir o fórum (ID: ${questParaExcluir.forumChannelId}) da quest. Pode já ter sido deletado. Erro: ${error.message}`);
                }
            }

            await this.client.database.Quest.findByIdAndDelete(questId);

            await i.update({ content: `✅ A quest **"${questParaExcluir.nome}"** foi excluída com sucesso.`, components: [] });
            collectorExcluir.stop();
        });

        collectorExcluir.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: '⏰ O tempo para selecionar uma quest expirou.', components: [] }).catch(() => {});
            }
        });
        break;
      }

    }
  }

  buildCreateQuestModal(prefillData = {}) {
    const modal = new ModalBuilder()
      .setCustomId("criar_quest_modal")
      .setTitle("CRIAÇÃO DE QUEST");

    const descricaoInput = new TextInputBuilder().setCustomId("descricao").setLabel("Descrição da História").setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(prefillData.descricao || '');
    const maxPlayersInput = new TextInputBuilder()
        .setCustomId("maxPlayers")
        .setLabel("Número Máximo de Jogadores")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("Apenas números. Ex: 4")
        .setValue(prefillData.maxPlayers?.toString() || '');
    const regrasInput = new TextInputBuilder()
        .setCustomId("regras")
        .setLabel("Regras da Quest")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue('Regras, todas as regras da quest devem estar em seu anúncio e quem participar, significa que aceitou narrar nessas condições. Criar regras durante a quest é proibido, muitas vezes isso é para seguir um fluxo imaginário decente narrado por uma pessoa só, com exceção do personagem sofrer alguma penalidade (maldições, estigmas e coisas do tipo) por consequências da missão, mas não trate essa parte como absoluto. Leve em conta também número limite de personagens e claro, se a pessoa quiser sair, é decisão dela, assim como expulsão é do mestre, desde que compense o tempo perdido.');
    const recompensaInput = new TextInputBuilder()
        .setCustomId("recompensa")
        .setLabel("Recompensa da Quest")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Uma ideia base do que pode ser adquirido.');
    const dataInicioInput = new TextInputBuilder()
        .setCustomId("dataInicio")
        .setLabel("Data e Hora de Início (DD/MM/AAAA HH:mm)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("Ex: 25/12/2025 20:30")
        .setValue(prefillData.dataInicio || '');

    modal.addComponents(
      new ActionRowBuilder().addComponents(descricaoInput),
      new ActionRowBuilder().addComponents(maxPlayersInput),
      new ActionRowBuilder().addComponents(regrasInput),
      new ActionRowBuilder().addComponents(recompensaInput),
      new ActionRowBuilder().addComponents(dataInicioInput)
    );

    return modal;
  }

  async createAndPostQuest(interaction, questData, modalSubmit) {
    try {
        const novaQuest = await this.client.database.Quest.create({
            ...questData,
            participantes: [],
            status: 'aberta',
            mestre: interaction.user.id
        });

        const forumChannel = await this.client.channelQuest(interaction.guild, novaQuest);
        if (forumChannel) {
            novaQuest.forumChannelId = forumChannel.id;
        } else {
            console.error(`Falha ao criar o fórum para a quest ${novaQuest.nome}. A quest foi criada mesmo assim.`);
        }

        const canalDeQuestsId = "1421911686998265946";
        const canalDeQuests = await this.client.channels.fetch(canalDeQuestsId).catch(() => null);

        if (canalDeQuests) {
            const questEmbedPublico = new EmbedBuilder()
                .setTitle(`<:AwOo:810735164145270835> | QUEST - ${questData.nome}`)
                .setDescription(questData.descricao)
                .setColor("Blue")
                .addFields(
                    { name: "Mestre", value: `<@${novaQuest.mestre}>`, inline: true },
                    { name: "Vagas", value: `0 / ${questData.maxPlayers.toString()}`, inline: true },
                    { name: "Recompensa", value: questData.recompensa },
                    { name: "Regras", value: questData.regras.substring(0, 1024) },
                    { name: "Início", value: `<t:${Math.floor(novaQuest.dataInicioTimestamp / 1000)}:F>` }
                )
                .setFooter({ text: `clique no botão abaixo para participar da quest` });

            let participacaoRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`participar_quest_${novaQuest._id}`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji("<:7190_linkpepehype:810735233203699752>")
            );

            const questMessage = await canalDeQuests.send({ content: `📢 **Nova Quest Disponível! ** 📢 \n`, embeds: [questEmbedPublico], components: [participacaoRow] });

            novaQuest.messageId = questMessage.id;
            novaQuest.channelId = questMessage.channel.id;
            await novaQuest.save();

            await this.client.loadQuestCollectors();
        }

        if (modalSubmit) {
            let replyContent = '✅ Quest criada e enviada com sucesso!';
            if (forumChannel) {
                replyContent += ` O chat da quest está localizado em <#${forumChannel.id}>.`;
            }
            await modalSubmit.editReply({ content: replyContent });
        }

    } catch (dbError) {
        console.error("Erro ao salvar a quest no banco de dados:", dbError);
        if (modalSubmit) {
            await modalSubmit.editReply({ content: "Ocorreu um erro ao salvar a quest. Por favor, tente novamente." });
        }
    }
  }

  async sendForApproval(interaction, questData, modalSubmit, approvalChannelId) {
    const approvalChannel = await this.client.channels.fetch(approvalChannelId).catch(() => null);
    if (!approvalChannel) {
        return modalSubmit.editReply({ content: "❌ Erro: O canal de aprovação não foi encontrado. Contate um administrador." });
    }

    const pendingQuest = await this.client.database.PendingQuest.create({
        ...questData,
        creatorId: interaction.user.id,
    });

    const approvalEmbed = new EmbedBuilder()
        .setTitle(`📝 QUEST PARA APROVAR`)
        .setAuthor({ name: `Criador: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setColor("Yellow")
        .addFields(
            { name: "Nome", value: questData.nome },
            { name: "Descrição", value: questData.descricao.substring(0, 1024) },
            { name: "Vagas", value: questData.maxPlayers.toString(), inline: true },
            { name: "Início", value: `<t:${Math.floor(questData.dataInicioTimestamp / 1000)}:R>`, inline: true },
            { name: "Recompensa", value: questData.recompensa.substring(0, 1024) },
            { name: "Regras", value: questData.regras.substring(0, 1024) }
        )
        .setFooter({ text: `ID da Quest Pendente: ${pendingQuest._id}` });

    const approvalButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`approve_quest_${pendingQuest._id}`)
            .setLabel("Aprovar")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`reject_quest_${pendingQuest._id}`)
            .setLabel("Rejeitar")
            .setStyle(ButtonStyle.Danger)
    );

    const approvalMessage = await approvalChannel.send({ embeds: [approvalEmbed], components: [approvalButtons] });
    pendingQuest.approvalMessageId = approvalMessage.id;
    await pendingQuest.save();

    await modalSubmit.editReply({ content: "✅ Sua quest foi enviada para aprovação da moderação." });
  }
};
function parseDate(dateString) {
    const match = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
    if (!match) return null;

    const [, day, month, year, hours, minutes] = match;
    const date = new Date(year, month - 1, day, hours, minutes);

    return !isNaN(date.getTime()) ? date : null;
}
