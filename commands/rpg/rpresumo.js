const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ChannelType,
  ButtonBuilder,
  MessageFlags, // Importar MessageFlags
} = require("discord.js");
const Command = require("../../structures/Command");
const error = require("../../api/error.js");
const moment = require("moment");
moment.locale("pt-br"); // Define o local para português do Brasil
const { resumirRP, summarizeSummary } = require("../../api/resumir.js");


module.exports = class rpresumo extends Command {
  constructor(client) {
    super(client, {
      name: "rpresumo", 
      description: "Resume uma série de textos de um rp em um só texto", 
      category: "rpg", 
      aliases: ["rpr", "resumirrp", "rpbackup"],
      UserPermission: [], 
      clientPermission: [], 
      OnlyDevs: false, 
      slash: true,
    });

    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addChannelOption((option) =>
          option
            .setName("canal")
            .setDescription("O canal do qual você deseja extrair as mensagens.")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.GuildForum)
        )
        .addStringOption((option) =>
            option
                .setName('data_inicio')
                .setDescription('Data de início para filtrar as mensagens (DD/MM/AAAA).')
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName('data_fim')
                .setDescription('Data de fim para filtrar as mensagens (DD/MM/AAAA).')
                .setRequired(false)
        );
    }
  }

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.options.getChannel("canal");
    const dataInicioStr = interaction.options.getString("data_inicio");
    const dataFimStr = interaction.options.getString("data_fim");

    let dataInicio, dataFim;

    if (dataInicioStr) {
        dataInicio = moment(dataInicioStr, 'DD/MM/YYYY').startOf('day');
        if (!dataInicio.isValid()) return interaction.editReply({ content: '❌ A data de início é inválida. Use o formato DD/MM/AAAA.' });
    }
    if (dataFimStr) {
        dataFim = moment(dataFimStr, 'DD/MM/YYYY').endOf('day');
        if (!dataFim.isValid()) return interaction.editReply({ content: '❌ A data de fim é inválida. Use o formato DD/MM/AAAA.' });
    }
    if (dataInicio && dataFim && dataInicio.isAfter(dataFim)) return interaction.editReply({ content: '❌ A data de início não pode ser posterior à data de fim.' });

    if(channel.id === '731974691228745820' || channel.id === '731974691228745823') return interaction.editReply({ content: 'mas ai você tá querendo abusar de mim né, pra que tu quer isso?' })

    try {
      await interaction.editReply({ content: `<a:chickendonut:1423040252460925000> | Coletando mensagens do canal <#${channel.id}>. Isso pode levar um tempo.${dataInicio || dataFim ? ' Aplicando filtro de data...' : ''}` });

      let allMessages = [];
      let lastId;
      
      if (channel.type === ChannelType.GuildForum) {
        await interaction.editReply({ content: `<a:chickendonut:1423040252460925000> | Coletando postagens ativas e arquivadas do fórum <#${channel.id}>. Isso pode levar um tempo.` });
        const activeThreads = await channel.threads.fetch();
        const archivedThreads = await channel.threads.fetchArchived();
        
        const threads = [...activeThreads.threads.values(), ...archivedThreads.threads.values()];
        
        for (const thread of threads) {
          if (allMessages.length >= 10000) break;
          
          let threadMessages = [];
          let lastThreadMessageId;
          while (true) {
            const messages = await thread.messages.fetch({ limit: 100, before: lastThreadMessageId });
            if (messages.size === 0) break;
            
            messages.forEach(msg => {
              if(msg.content.includes('//') || msg.content.includes('off')) return;
              const msgDate = moment(msg.createdAt);
              const withinDateRange = 
                (!dataInicio || msgDate.isSameOrAfter(dataInicio)) &&
                (!dataFim || msgDate.isSameOrBefore(dataFim));

              if (withinDateRange) threadMessages.push(msg);
            });
            lastThreadMessageId = messages.last()?.id;
          }
          allMessages.push(...threadMessages);
        }
      } else {
        while (allMessages.length < 10000) {
          const options = { limit: 100 };
          if (lastId) {
            options.before = lastId;
          }
  
          const messages = await channel.messages.fetch(options);
          if (messages.size === 0) {
            break;
          }
  
          messages.forEach(msg => {
            const msgDate = moment(msg.createdAt);
            const withinDateRange = 
              (!dataInicio || msgDate.isSameOrAfter(dataInicio)) &&
              (!dataFim || msgDate.isSameOrBefore(dataFim));

            if (withinDateRange) allMessages.push(msg);
          });
          lastId = messages.last().id;
        }
      }

      if (allMessages.length > 10000) {
        allMessages = allMessages.slice(0, 10000);
      }

      if (allMessages.length === 0) {
        return interaction.editReply({ content: "Não encontrei nenhuma mensagem nesse canal." });
      }

      const orderedMessages = allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      const idsMen = orderedMessages.map((msg) => msg.id);
      const lorEnc = await this.client.database.Lore.find({ messageId: { $in: idsMen } }).lean();
      const mapLor = new Map(lorEnc.map((lor) => [lor.messageId, lor]));

      const menFor = [];

      for (const msg of orderedMessages) {
        const dadLor = mapLor.get(msg.id);
        if (dadLor) {
          dadLor.chapters.forEach((cap) => {
            const conCap = cap.pages.map((pag) => pag.content).join('\n\n');
            menFor.push(`[${moment(msg.createdAt).format("DD/MM/YYYY HH:mm:ss")}] ${msg.author.tag} (Lore: ${dadLor.title} - ${cap.name}):\n${conCap}`);
          });
        } else {
          menFor.push(`[${moment(msg.createdAt).format("DD/MM/YYYY HH:mm:ss")}] ${msg.author.tag}: ${msg.content}`);
        }
      }

      const formattedText = menFor.join("\n\n---\n\n");

      const logBuffer = Buffer.from(formattedText, "utf-8");
      const logAttachment = new AttachmentBuilder(logBuffer, { name: `mensagens-${channel.name}.txt` });

      await interaction.editReply({ content: `<a:typingpeped:1423040738983411843> | ${allMessages.length} mensagens coletadas! Agora, estou resumindo o RP...` });

      const pages = await resumirRP(formattedText);
      let currentPage = 0;

      const summaryFullText = pages.join('\n\n---\n\n');
      const summaryBuffer = Buffer.from(summaryFullText, "utf-8");
      const summaryAttachment = new AttachmentBuilder(summaryBuffer, { name: `resumo-${channel.name}.txt` });

      const generateEmbed = (pageIndex) => {
        return new EmbedBuilder()
          .setColor("Blue")
          .setTitle(`📝 Resumo do RP em #${channel.name}`)
          .setDescription(pages[pageIndex])
          .setFooter({ text: `Página ${pageIndex + 1} de ${pages.length} | Arquivos .txt com todas as mensagens do chat e o resumo completo estão anexados.` });
      };

      const getButtons = (pageIndex) => {
        const row = new ActionRowBuilder();

        if (pages.length > 1) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId('prev_page')
              .setLabel('◀️ Anterior')
              .setStyle('Primary')
              .setDisabled(pageIndex === 0),
            new ButtonBuilder()
              .setCustomId('next_page')
              .setLabel('Próximo ▶️')
              .setStyle('Primary')
              .setDisabled(pageIndex === pages.length - 1)
          );
        }

        row.addComponents(
          new ButtonBuilder().setCustomId('summarize_page').setLabel('Resumir').setStyle('Secondary')
        );

        return row;
      };

      const message = await interaction.editReply({
        content: "✅ Resumo gerado com sucesso!",
        embeds: [generateEmbed(currentPage)],
        files: [logAttachment, summaryAttachment],
        components: [getButtons(currentPage)],
        ephemeral: false
      });

      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 900000 // 15 minutes
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'prev_page') {
          currentPage--;
        } else if (i.customId === 'next_page') {
          currentPage++;
        } else if (i.customId === 'summarize_page') {
          await i.reply({ content: '<a:aNgErY:1423045205979828345> | Resumindo de novo... (preguiçoso do caralho)', flags: MessageFlags.Ephemeral});
          try {
            const fullSummaryText = pages.join('\n\n');
            const finalSummaryArray = await summarizeSummary(fullSummaryText);

            const summaryEmbed = new EmbedBuilder()
              .setColor("Gold")
              .setTitle(`🤖 Resumo do Resumo`)
              .setDescription(finalSummaryArray[0]);
            await i.followUp({ content: '<:monkaStab:810735232458031145> | Ta ai, enche mais o saco não', embeds: [summaryEmbed], flags: MessageFlags.Ephemeral });
          } catch (summaryError) {
            await i.followUp({ content: '❌ Ocorreu um erro ao tentar gerar o resumo final.', flags: MessageFlags.Ephemeral }).catch(() => {});
          }
          return; 
        }

        await i.update({ embeds: [generateEmbed(currentPage)], components: [getButtons(currentPage)] });
      });

      collector.on('end', () => {
        message.edit({ components: [] }).catch(() => {});
      });

    } catch (err) {
      console.error("Erro ao executar /rpresumo:", err);
      if (err.status === 503) {
        await interaction.editReply({ content: "🔧 O Gemini (IA que utilizo para resumir) está sobrecarregada no momento. Por favor, tente novamente em alguns minutos." }).catch(() => {});
      } else if (err.status === 429) {
        await interaction.editReply({ content: "⏳ O limite de uso da IA foi atingido (Quota Exceeded). Por favor, tente novamente mais tarde." }).catch(() => {});
      } else {
        await interaction.editReply({ content: "❌ Ocorreu um erro ao tentar buscar as mensagens ou gerar o resumo. Verifique se eu tenho permissão para ver o canal." }).catch(() => {});
      }
    }
  }
};
