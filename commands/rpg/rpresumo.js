const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
  ChannelType,
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

  async fetchMessages(channel, startId, endId) {
    const messages = [];
    let cursor = endId;
    let stop = false;

    // Tenta incluir a mensagem final se ela pertencer a este canal e for válida
    if (endId) {
        try {
            const endMsg = await channel.messages.fetch(endId);
            messages.push(endMsg);
        } catch (e) {
            // Mensagem não existe neste canal, apenas usamos o ID como referência de tempo
        }
    }

    while (!stop) {
        const options = { limit: 100 };
        if (cursor) options.before = cursor;

    try {
        const fetched = await channel.messages.fetch(options);
        if (fetched.size === 0) break;

        for (const msg of fetched.values()) {
            if (startId && BigInt(msg.id) < BigInt(startId)) {
                stop = true;
                break;
            }
            if (msg.id !== endId) messages.push(msg);
        }
        cursor = fetched.last()?.id;
    } catch (e) {
        console.error(`Erro ao buscar mensagens no canal ${channel.name}:`, e);
        break;
    }
    }
    return messages;
  }

  async execute(interaction) {
    const startId = interaction.options.getString('inicio');
    let endId = interaction.options.getString('fim');
    const targetChannel = interaction.options.getChannel('canal') || interaction.channel;
    const ehCategoria = targetChannel.type === ChannelType.GuildCategory;

    await interaction.deferReply({ flags: 64 });

    // Identificar canais para processar
    let channelsToProcess = [];
    
    if (ehCategoria) {
        // Garante que os canais estão em cache
        await interaction.guild.channels.fetch();
        const children = interaction.guild.channels.cache.filter(c => c.parentId === targetChannel.id);
        
        for (const child of children.values()) {
            if (child.isTextBased() && child.type !== ChannelType.GuildForum) {
                channelsToProcess.push(child);
            } else if (child.type === ChannelType.GuildForum) {
                try {
                    const active = await child.threads.fetchActive();
                    const archived = await child.threads.fetchArchived({ type: 'public', limit: 50 });
                    channelsToProcess.push(...active.threads.values(), ...archived.threads.values());
                } catch (e) { console.error(e); }
            }
        }
    } else if (targetChannel.type === ChannelType.GuildForum) {
        try {
            const active = await targetChannel.threads.fetchActive();
            const archived = await targetChannel.threads.fetchArchived({ type: 'public', limit: 50 });
            channelsToProcess.push(...active.threads.values(), ...archived.threads.values());
        } catch (e) { console.error(e); }
    } else if (targetChannel.isTextBased()) {
        channelsToProcess.push(targetChannel);
    } else {
        return interaction.editReply({ content: '❌ Tipo de canal inválido ou não suportado.' });
    }

    if (channelsToProcess.length === 0) {
        return interaction.editReply({ content: '❌ Nenhum canal de texto encontrado para processar.' });
    }

    try {
        // Validação básica de ordem (Snowflakes são cronológicos)
        if (startId && BigInt(startId) > BigInt(endId)) {
            return interaction.editReply({ content: '❌ O ID da mensagem inicial deve ser menor (mais antigo) que o ID da mensagem final.' });
        }

        let allMessages = [];
        let processedCount = 0;

        await interaction.editReply({ content: `⏳ Coletando mensagens de ${channelsToProcess.length} canais/tópicos...` });

        for (const ch of channelsToProcess) {
            const msgs = await this.fetchMessages(ch, startId, endId);
            allMessages.push(...msgs);
            processedCount++;
            
            if (processedCount % 2 === 0 || processedCount === channelsToProcess.length) {
                await interaction.editReply({ content: `⏳ Coletando mensagens... (${processedCount}/${channelsToProcess.length} canais processados | ${allMessages.length} mensagens coletadas)` });
            }
        }

        // Ordena todas as mensagens cronologicamente
        allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        
        // Busca Lores de todos os canais envolvidos
        const channelIds = channelsToProcess.map(c => c.id);
        const channelLores = await this.client.database.Lore.find({ channelId: { $in: channelIds } });
        const loreMap = new Map(channelLores.map(l => [l.messageId, l]));

        let aiText = [];
        let fileText = [];

        fileText.push(`============================================================`);
        fileText.push(`TRANSCRICAO DE RP - ALVO: ${targetChannel.name}`);
        fileText.push(`GERADO EM: ${new Date().toLocaleString('pt-BR')}`);
        fileText.push(`============================================================\n`);
        
        for (const msg of allMessages) {
            const lore = loreMap.get(msg.id);
            const time = msg.createdAt ? msg.createdAt.toLocaleString('pt-BR') : 'Data desconhecida';
            const channelName = msg.channel.name || 'Desconhecido';
            
            if (lore) {
                aiText.push(`\n--- [INÍCIO DA LORE: ${lore.title}] ---\n`);
                
                fileText.push(`\n${'='.repeat(20)} [LORE: ${lore.title.toUpperCase()}] ${'='.repeat(20)}`);
                fileText.push(`Canal: ${channelName} | Autor: ${msg.author.username} | Data: ${time}\n`);

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
                    fileText.push(`[${time}] [${channelName}] ${msg.author.username}:`);
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

        if (ehCategoria) {
            const datAtu = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
            const nomCan = targetChannel.name.replace(/[^a-zA-Z0-9-_]/g, '_');
            const traBuf = Buffer.from(textForFile, 'utf-8');
            const anexo = new AttachmentBuilder(traBuf, { name: `mensagens-${nomCan}-${datAtu}.txt` });

            return interaction.editReply({
                content: '📝 Modo de categoria ativado. O resumo por IA foi pulado para economizar recursos. Apenas a transcrição completa foi gerada.',
                files: [anexo]
            });
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

            const datAtu = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
            const nomCan = targetChannel.name;

            return [
                new AttachmentBuilder(transcriptBuffer, { name: `mensagens-${nomCan}-${datAtu}.txt` }),
                new AttachmentBuilder(summaryBuffer, { name: `resumo-${nomCan}-${datAtu}.txt` })
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