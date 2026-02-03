const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
} = require('discord.js');
const Command = require('../../structures/Command');
const { resumirRP, summarizeSummary } = require('../../api/resumir.js');

module.exports = class rpresumo extends Command {
  constructor(client) {
    super(client, {
      name: "rpresumo",
      description: "Resume um RP, identificando e incluindo conteúdo de Lores.",
      category: "rpg",
      aliases: ["resumir", "resumorpg"],
      UserPermission: [],
      clientPermission: [],
      OnlyDevs: false,
      slash: true,
    });

    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addStringOption(option => 
            option.setName('inicio')
                .setDescription('ID da mensagem inicial do RP')
                .setRequired(false))
        .addChannelOption(option => 
            option.setName('canal')
                .setDescription('Canal onde o RP ocorreu (opcional)')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('fim')
                .setDescription('ID da mensagem final do RP (opcional)')
                .setRequired(false));
    }
  }

  async fetchMessagesBetween(channel, startId, endId) {
    const allMessages = [];
    let lastId = endId;
    let reachedStart = false;

    try {
        const endMessage = await channel.messages.fetch(endId);
        allMessages.push(endMessage);
    } catch (e) {
        console.error("Erro ao buscar mensagem final:", e);
        return [];
    }

    while (!reachedStart) {
      const options = { limit: 100, before: lastId };
      const messages = await channel.messages.fetch(options);

      if (messages.size === 0) break;

      for (const message of messages.values()) {
        if (startId && message.id === startId) {
          reachedStart = true;
          allMessages.push(message);
          break;
        }
        allMessages.push(message);
      }
      lastId = messages.last().id;
    }
    
    try {
        if (startId && !reachedStart) {
            const startMessage = await channel.messages.fetch(startId);
            allMessages.push(startMessage);
        }
    } catch (e) {
        console.error("Erro ao buscar mensagem inicial:", e);
    }
    
    return allMessages.reverse();
  }

  async execute(interaction) {
    const startId = interaction.options.getString('inicio');
    let endId = interaction.options.getString('fim');
    const channel = interaction.options.getChannel('canal') || interaction.channel;

    await interaction.deferReply({ flags: 64 });

    if (!channel.isTextBased()) {
        return interaction.editReply({ content: '❌ O canal selecionado deve ser um canal de texto.' });
    }

    try {
        // Se não houver ID final, pega a última mensagem do canal
        if (!endId) {
            const lastMessages = await channel.messages.fetch({ limit: 1 });
            if (lastMessages.size === 0) {
                return interaction.editReply({ content: '❌ Não há mensagens neste canal para resumir.' });
            }
            endId = lastMessages.first().id;
        }

        // Validação básica de ordem (Snowflakes são cronológicos)
        if (startId && BigInt(startId) > BigInt(endId)) {
            return interaction.editReply({ content: '❌ O ID da mensagem inicial deve ser menor (mais antigo) que o ID da mensagem final.' });
        }

        await interaction.editReply({ content: '⏳ Coletando mensagens e verificando Lores...' });

        const messages = await this.fetchMessagesBetween(channel, startId, endId);
        
        // Otimização: Busca todas as Lores do canal de uma vez para evitar múltiplas consultas ao banco dentro do loop
        const channelLores = await this.client.database.Lore.find({ channelId: channel.id });
        const loreMap = new Map(channelLores.map(l => [l.messageId, l]));

        let aiText = [];
        let fileText = [];

        fileText.push(`============================================================`);
        fileText.push(`TRANSCRICAO DE RP - CANAL: ${channel.name}`);
        fileText.push(`GERADO EM: ${new Date().toLocaleString('pt-BR')}`);
        fileText.push(`============================================================\n`);
        
        for (const msg of messages) {
            const lore = loreMap.get(msg.id);
            const time = msg.createdAt ? msg.createdAt.toLocaleString('pt-BR') : 'Data desconhecida';
            
            if (lore) {
                aiText.push(`\n--- [INÍCIO DA LORE: ${lore.title}] ---\n`);
                
                fileText.push(`\n${'='.repeat(20)} [LORE: ${lore.title.toUpperCase()}] ${'='.repeat(20)}`);
                fileText.push(`Autor: ${msg.author.username} | Data: ${time}\n`);

                for (const chapter of lore.chapters) {
                    aiText.push(`Capítulo: ${chapter.name}`);
                    fileText.push(`\n>> CAPÍTULO: ${chapter.name}`);
                    fileText.push('-'.repeat(40));
                    for (const page of chapter.pages) {
                        aiText.push(page.content);
                        fileText.push(page.content);
                    }
                }
                aiText.push(`\n--- [FIM DA LORE: ${lore.title}] ---\n`);
                fileText.push(`\n${'='.repeat(20)} [FIM DA LORE] ${'='.repeat(20)}\n`);
            } else {
                if (msg.content && msg.content.trim().length > 0) {
                    aiText.push(`${msg.author.username}: ${msg.content}`);
                    fileText.push(`[${time}] ${msg.author.username}:`);
                    fileText.push(`${msg.content}`);
                    fileText.push('-'.repeat(60));
                }
            }
        }

        const textToSummarize = aiText.join('\n');
        const textForFile = fileText.join('\n');

        if (textToSummarize.length < 10) {
                return interaction.editReply({ content: '❌ Texto insuficiente para resumir.' });
        }

        await interaction.editReply({ content: '🤖 Gerando resumo com IA... Isso pode levar alguns segundos.' });
        
        let summaryPages = await resumirRP(textToSummarize);
        
        let currentPage = 0;
        const generateEmbed = (page) => new EmbedBuilder()
            .setTitle('📄 Resumo do RP')
            .setColor('#00ff00')
            .setDescription(summaryPages[page] || "Resumo vazio.")
            .setFooter({ text: `Página ${page + 1}/${summaryPages.length} | Gerado por IA` });

        const getButtons = (page) => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev_sum').setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
            new ButtonBuilder().setCustomId('next_sum').setLabel('▶').setStyle(ButtonStyle.Primary).setDisabled(page === summaryPages.length - 1),
            new ButtonBuilder().setCustomId('resumir_mais').setLabel('Resumir Mais').setStyle(ButtonStyle.Secondary).setEmoji('📉')
        );

        const generateAttachments = (fullTxt, summaryPgs) => {
            const transcriptBuffer = Buffer.from(fullTxt, 'utf-8');
            const summaryBuffer = Buffer.from(summaryPgs.join('\n\n'), 'utf-8');
            return [
                new AttachmentBuilder(transcriptBuffer, { name: `mensanges ${channelLores.name}.txt` }),
                new AttachmentBuilder(summaryBuffer, { name: `resumo_final_${channelLores.name}.txt` })
            ];
        };

        const response = await interaction.editReply({ 
            content: null, 
            embeds: [generateEmbed(currentPage)], 
            components: [getButtons(currentPage)],
            files: generateAttachments(textForFile, summaryPages)
        });

        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 300000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: 'Apenas quem solicitou pode interagir.', ephemeral: true });
            
            if (i.customId === 'prev_sum') currentPage--;
            if (i.customId === 'next_sum') currentPage++;
            
            if (i.customId === 'resumir_mais') {
                await i.update({ content: '🤖 Condensando o resumo...', components: [] });
                try {
                    const currentSummaryText = summaryPages.join('\n');
                    const newSummary = await summarizeSummary(currentSummaryText);
                    summaryPages = newSummary; // Atualiza as páginas com o novo resumo
                    currentPage = 0; // Volta para a primeira página
                    
                    await interaction.editReply({
                        content: null,
                        embeds: [generateEmbed(currentPage)],
                        components: [getButtons(currentPage)],
                        files: generateAttachments(textForFile, summaryPages)
                    });
                    return; // Retorna para não tentar dar update de novo abaixo
                } catch (err) {
                    console.error(err);
                    await interaction.followUp({ content: '❌ Erro ao tentar resumir mais.', ephemeral: true });
                }
            }

            await i.update({ 
                embeds: [generateEmbed(currentPage)], 
                components: [getButtons(currentPage)] 
            });
        });

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: '❌ Ocorreu um erro ao processar o resumo. Verifique os IDs e permissões.' });
    }
  }
};