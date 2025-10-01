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
        );
    }
  }

  async execute(interaction) {
    await interaction.deferReply(); // Corrigido aviso de depreciação

    const channel = interaction.options.getChannel("canal");
    if(channel.id === '731974691228745820' || channel.id === '731974691228745823') return interaction.editReply({ content: 'mas ai você tá querendo abusar de mim né, pra que tu quer isso?' })

    try {
      await interaction.editReply({ content: `<a:chickendonut:1423040252460925000> | Coletando mensagens do canal <#${channel.id}>. Isso pode levar um tempo.` });

      let allMessages = [];
      let lastId;
      
      if (channel.type === ChannelType.GuildForum) {
        const fetchedThreads = await channel.threads.fetch();
        const threads = Array.from(fetchedThreads.threads.values());
        
        for (const thread of threads) {
          if (allMessages.length >= 1000) break;
          
          let threadMessages = [];
          let lastThreadMessageId;
          while (true) {
            const messages = await thread.messages.fetch({ limit: 100, before: lastThreadMessageId });
            if (messages.size === 0) break;
            
            messages.forEach(msg => {
              if(msg.content.includes('//') || msg.content.includes('off')) return;
              threadMessages.push(msg);
            });
            lastThreadMessageId = messages.last()?.id;
          }
          allMessages.push(...threadMessages);
        }
      } else {
        // Lógica existente para canais de texto e threads
        while (allMessages.length < 1000) {
          const options = { limit: 100 };
          if (lastId) {
            options.before = lastId;
          }
  
          const messages = await channel.messages.fetch(options);
          if (messages.size === 0) {
            break;
          }
  
          messages.forEach(msg => allMessages.push(msg));
          lastId = messages.last().id;
        }
      }

      // Garante que não tenhamos mais de 1000 mensagens se o último lote ultrapassar o limite.
      if (allMessages.length > 1000) {
        allMessages = allMessages.slice(0, 1000);
      }

      if (allMessages.length === 0) {
        return interaction.editReply({ content: "Não encontrei nenhuma mensagem nesse canal." });
      }

      const orderedMessages = allMessages.reverse();

      const formattedText = orderedMessages
        .map(msg => `[${moment(msg.createdAt).format("DD/MM/YYYY HH:mm:ss")}] ${msg.author.tag}: ${msg.content}`)
        .join("\n\n---\n\n");

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
      });

      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 300000, // 5 minutos
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'prev_page') {
          currentPage--;
        } else if (i.customId === 'next_page') {
          currentPage++;
        } else if (i.customId === 'summarize_page') {
          await i.reply({ content: '<a:aNgErY:1423045205979828345> | Resumindo de novo... (preguiçoso do caralho)'});
          try {
            const fullSummaryText = pages.join('\n\n');
            const finalSummaryArray = await summarizeSummary(fullSummaryText);

            const summaryEmbed = new EmbedBuilder()
              .setColor("Gold")
              .setTitle(`🤖 Resumo do Resumo`)
              .setDescription(finalSummaryArray[0]);
            await i.editReply({ content: '<:monkaStab:810735232458031145> | Ta ai, enche mais o saco não', embeds: [summaryEmbed] });
          } catch (summaryError) {
            await i.editReply({ content: '❌ Ocorreu um erro ao tentar gerar o resumo final.' }).catch(() => {});
          }
          return; // Impede a execução do i.update() abaixo, que é apenas para paginação.
        }

        // Este update só deve ocorrer para os botões de paginação.
        await i.update({ embeds: [generateEmbed(currentPage)], components: [getButtons(currentPage)] });
      });

      collector.on('end', () => {
        message.edit({ components: [] }).catch(() => {});
      });

    } catch (err) {
      console.error("Erro ao executar /rpresumo:", err);
      await interaction.editReply({ content: "❌ Ocorreu um erro ao tentar buscar as mensagens. Verifique se eu tenho permissão para ver o canal." }).catch(() => {});
    }
  }
};
