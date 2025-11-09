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
    
    await interaction.reply({ embeds: [embed], flags: 64 });

    const reactionFilter = (reaction, user) => user.id === interaction.user.id && reaction.message.channel.id === interaction.channelId;
    const startCollector = async (reaction, user) => {
        if (!reactionFilter(reaction, user)) return;

        if (reaction.emoji.name === '👍') {
            const loreInicio = reaction.message;
            this.client.removeListener('messageReactionAdd', startCollector); 

            embed.setDescription('Ótimo! Agora reaja com 👎 na **última** mensagem do seu RP.');
            await interaction.editReply({ embeds: [embed] });

            const endCollector = async (endReaction, endUser) => {
                if (!reactionFilter(endReaction, endUser)) return;

                if (endReaction.emoji.name === '👎' && endReaction.message.id !== loreInicio.id) {
                    const loreFim = endReaction.message;
                    this.client.removeListener('messageReactionAdd', endCollector);

                    if (loreInicio.createdTimestamp > loreFim.createdTimestamp) {
                        await interaction.followUp({ content: '❌ A mensagem de início deve ser anterior à mensagem de fim. Operação cancelada.', flags: 64 });
                        return;
                    }

                    await interaction.editReply({ content: 'Coletando e formatando as mensagens... Isso pode levar um momento.', embeds: [] });

                    try {
                        const messages = await this.fetchMessagesBetween(interaction.channel, loreInicio.id, loreFim.id);
                        const formattedText = messages
                            .filter(msg => msg.content.trim() !== '')
                            .map(msg => msg.content)
                            .join("\n\n");

                        // Ajuste para a nova estrutura de página
                        const pages = this.paginateText(formattedText).map(content => ({
                            content: content
                        }));

                        if (pages.length === 0) {
                            await interaction.editReply({ content: 'Nenhuma mensagem encontrada no intervalo selecionado.' });
                            return;
                        }

                        let currentPage = 0;

                        const generateEmbed = (pageIndex) => {
                            return new EmbedBuilder()
                                .setTitle(`<a:spinnyman:1433853169884205106> | Lore Organizada`)
                                .setDescription(pages[pageIndex].content)
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

                        const loreMessage = await interaction.editReply({
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

                        await interaction.editReply({
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
                                        pages: pages
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
                                if (collected.size === 0) loreMessage.edit({ content: 'Tempo para confirmação esgotado.', embeds: [], components: [] }).catch(() => {});
                        });
                    } catch (err) {
                        console.error("Erro ao buscar ou paginar a lore:", err);
                        await interaction.followUp({ content: '❌ Ocorreu um erro ao processar sua lore. Verifique se eu tenho permissão para ler o histórico de mensagens neste canal.', flags: 64 });
                    }
                }
            }; 
            this.client.on('messageReactionAdd', endCollector);

            setTimeout(() => {
                this.client.removeListener('messageReactionAdd', endCollector);
                interaction.editReply({ content: '⏰ Tempo esgotado para reagir à mensagem final. Operação cancelada.', embeds: [] }).catch(() => {});
            }, 120000); 
        }
    }; 
    this.client.on('messageReactionAdd', startCollector);

    setTimeout(() => {
        this.client.removeListener('messageReactionAdd', startCollector);
        interaction.editReply({ content: '⏰ Tempo esgotado para reagir à mensagem inicial. Operação cancelada.', embeds: [] }).catch(() => {});
    }, 120000); 
  }
};
