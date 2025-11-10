const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const Command = require('../../structures/Command');
const moment = require('moment');
moment.locale("pt-br");

module.exports = class lore extends Command {
  constructor(client) {
    super(client, {
      // Configurações do Comando prefixo
      name: "lore", 
      description: "organiza sua lore em capítulos", 
      category: "rpg",
      aliases: [],
      UserPermission: [], 
      clientPermission: [], 
      OnlyDevs: false, 
      slash: true, 
    });

    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
    }
  }

  async fetchMessagesBetween(channel, startId, endId) {
    const allMessages = [];
    let lastId = endId;
    let reachedStart = false;

    const endMessage = await channel.messages.fetch(endId);
    allMessages.push(endMessage);

    while (!reachedStart) {
      const options = { limit: 100, before: lastId };
      const messages = await channel.messages.fetch(options);

      if (messages.size === 0) break;

      for (const message of messages.values()) {
        if (message.id === startId) {
          reachedStart = true;
          break;
        }
        allMessages.push(message);
      }
      lastId = messages.last().id;
    }
    const startMessage = await channel.messages.fetch(startId);
    allMessages.push(startMessage);
    return allMessages.reverse();
  }

  paginateText(text, maxLength = 4000) {
    const pages = [];
    if (!text) return pages;

    let remainingText = text;
    while (remainingText.length > 0) {
        if (remainingText.length <= maxLength) {
            pages.push(remainingText);
            break;
        } 

        let splitIndex = remainingText.lastIndexOf('\n\n', maxLength);
        if (splitIndex === -1) {
            splitIndex = remainingText.lastIndexOf('.', maxLength);
        }
        if (splitIndex === -1) {
            splitIndex = remainingText.lastIndexOf(' ', maxLength);
        }
        if (splitIndex === -1) splitIndex = maxLength;

        pages.push(remainingText.substring(0, splitIndex + 1));
        remainingText = remainingText.substring(splitIndex + 1).trim();
    }
    return pages;
  }

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('<a:spinnyman:1433853169884205106> | Organização de Lore')
      .setDescription('Reaja com o emoji 👍 na **primeira** mensagem do seu RP.')
      .setColor('#0099ff')
      .setFooter({ text: 'Você tem 2 minutos para reagir.' });
    
    const replyMessage = await interaction.reply({ embeds: [embed], fetchReply: true });

    const reactionFilter = (reaction, user) => user.id === interaction.user.id && reaction.message.channel.id === interaction.channelId;
    
    let startTimeout, endTimeout;

    const startCollector = async (reaction, user) => {
        if (!reactionFilter(reaction, user)) return;

        if (reaction.emoji.name === '👍') {
            clearTimeout(startTimeout); // Limpa o timeout de início
            const loreInicio = reaction.message;
            this.client.removeListener('messageReactionAdd', startCollector); 

            embed.setDescription('Ótimo! Agora reaja com 👎 na **última** mensagem do seu RP.');
            await replyMessage.edit({ embeds: [embed] });

            const endCollector = async (endReaction, endUser) => {
                if (!reactionFilter(endReaction, endUser)) return;

                if (endReaction.emoji.name === '👎' && endReaction.message.id !== loreInicio.id) {
                    clearTimeout(endTimeout); // Limpa o timeout de fim
                    const loreFim = endReaction.message;
                    this.client.removeListener('messageReactionAdd', endCollector);

                    if (loreInicio.createdTimestamp > loreFim.createdTimestamp) {
                        await replyMessage.channel.send({ content: '❌ A mensagem de início deve ser anterior à mensagem de fim. Operação cancelada.' });
                        return;
                    }

                    await replyMessage.edit({ content: 'Coletando e formatando as mensagens... Isso pode levar um momento.', embeds: [], components: [] });

                    try {
                        const messages = await this.fetchMessagesBetween(interaction.channel, loreInicio.id, loreFim.id);
                        
                        let finalPages = [];
                        let textBlock = [];

                        const processAndPaginateTextBlock = (imageUrl = null) => {
                            if (textBlock.length > 0) {
                                const fullText = textBlock.join('\n\n');
                                const textPages = this.paginateText(fullText);
                                textPages.forEach(pageContent => {
                                    finalPages.push({
                                        content: pageContent,
                                        imageUrl: imageUrl
                                    });
                                });
                                textBlock = [];
                            }
                        };

                        for (let i = 0; i < messages.length; i++) {
                            const msg = messages[i];
                            const hasText = msg.content && msg.content.trim() !== '';

                            if (hasText) {
                                textBlock.push(msg.content);
                            }

                            const imageAttachment = msg.attachments.find(att => att.contentType?.startsWith('image/'));

                            // Se a mensagem atual tem uma imagem, ou se é a última mensagem do loop,
                            // processamos o bloco de texto acumulado até agora.
                            if (imageAttachment || i === messages.length - 1) {
                                processAndPaginateTextBlock(imageAttachment?.url ?? null);
                            }
                        }

                        const pages = finalPages.map(page => {
                            // Garante que o conteúdo nunca seja nulo para evitar erros
                            return { content: page.content || ' ', imageUrl: page.imageUrl || null };
                        });

                        if (pages.length === 0) {
                            await replyMessage.edit({ content: 'Nenhuma mensagem encontrada no intervalo selecionado.' });
                            return;
                        }

                        let currentPage = 0;

                        const generateEmbed = (pageIndex) => {
                            return new EmbedBuilder()
                                .setTitle(`<a:spinnyman:1433853169884205106> | Lore Organizada`)
                                .setDescription(pages[pageIndex].content.substring(0, 4096))
                                .setImage(pages[pageIndex].imageUrl)
                                .setColor('#0099ff')
                                .setFooter({ text: `Página ${pageIndex + 1} de ${pages.length}` });
                        };

                        const getButtons = (pageIndex) => {
                            return new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('prev_page')
                                    .setLabel('◀️ Anterior')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(pageIndex === 0),
                                new ButtonBuilder()
                                    .setCustomId('next_page')
                                    .setLabel('Próximo ▶️')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(pageIndex >= pages.length - 1)
                            );
                        };

                        const loreMessage = await replyMessage.edit({
                            embeds: [generateEmbed(currentPage)],
                            components: pages.length > 1 ? [getButtons(currentPage)] : [],
                        });

                            const confirmButton = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('confirm_lore')
                                    .setLabel('Salvar Lore')
                                    .setStyle(ButtonStyle.Success)
                                    .setEmoji('✅'),
                                new ButtonBuilder()
                                    .setCustomId('cancel_lore')
                                    .setLabel('Cancelar')
                                    .setStyle(ButtonStyle.Danger)
                                    .setEmoji('❌')
                            );

                        await replyMessage.edit({
                            embeds: [generateEmbed(currentPage)],
                            components: pages.length > 1 ? [getButtons(currentPage), confirmButton] : [confirmButton]
                        });

                        const allComponentsCollector = loreMessage.createMessageComponentCollector({
                            componentType: ComponentType.Button,
                            filter: i => i.user.id === interaction.user.id,
                            time: 300000 
                        });

                        allComponentsCollector.on('collect', async (i) => {
                                if (i.customId === 'prev_page') {
                                    currentPage--;
                                    await i.update({ embeds: [generateEmbed(currentPage)], components: [getButtons(currentPage), confirmButton] });
                                } else if (i.customId === 'next_page') {
                                    currentPage++;
                                    await i.update({ embeds: [generateEmbed(currentPage)], components: [getButtons(currentPage), confirmButton] });
                                } else if (i.customId === 'confirm_lore') {
                                    this.client.fichaStates.set(interaction.user.id, {
                                        pages: pages,
                                        rawMessages: messages // Armazena as mensagens originais
                                    });

                                    const modal = new ModalBuilder()
                                        .setCustomId('lore_modal_config')
                                        .setTitle('Configuração Final da Lore');

                                    const titleInput = new TextInputBuilder()
                                        .setCustomId('lore_title')
                                        .setLabel("Título da Lore")
                                        .setStyle(TextInputStyle.Short)
                                        .setRequired(true);

                                    const chapterInput = new TextInputBuilder()
                                        .setCustomId('lore_chapter')
                                        .setLabel("Nome/Número do Capítulo")
                                        .setStyle(TextInputStyle.Short)
                                        .setPlaceholder('Ex: "Capítulo 1", "Prólogo", etc.')
                                        .setRequired(true);

                                    modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(chapterInput));

                                    await i.showModal(modal);
 
                                    allComponentsCollector.stop();

                                } else if (i.customId === 'cancel_lore') {
                                    await i.update({ content: '❌ Operação de lore cancelada.', embeds: [], components: [] });
                                    allComponentsCollector.stop();
                                }
                            });

                        allComponentsCollector.on('end', (collected, reason) => {
                                if (reason === 'time') replyMessage.edit({ content: 'Tempo para confirmação esgotado.', embeds: [], components: [] }).catch(() => {});
                        });
                    } catch (err) {
                        console.error("Erro ao buscar ou paginar a lore:", err);
                        await interaction.followUp({ content: '❌ Ocorreu um erro ao processar sua lore. Verifique se eu tenho permissão para ler o histórico de mensagens neste canal.', flags: 64 });
                    }
                }
            }; 
            this.client.on('messageReactionAdd', endCollector);

            endTimeout = setTimeout(() => {
                this.client.removeListener('messageReactionAdd', endCollector);
                replyMessage.edit({ content: '⏰ Tempo esgotado para reagir à mensagem final. Operação cancelada.', embeds: [] }).catch(() => {});
            }, 120000); 
        }
    }; 
    this.client.on('messageReactionAdd', startCollector);
    
    startTimeout = setTimeout(() => {
        this.client.removeListener('messageReactionAdd', startCollector);
        replyMessage.edit({ content: '⏰ Tempo esgotado para reagir à mensagem inicial. Operação cancelada.', embeds: [] }).catch(() => {});
    }, 120000); 
  }
};
