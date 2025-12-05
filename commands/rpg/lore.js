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

function paginateText(text, maxLength = 4000) {
    const parts = [];
    if (!text) return parts;

    let currentChunk = text;
    while (currentChunk.length > 0) {
        if (currentChunk.length <= maxLength) {
            parts.push(currentChunk);
            break;
        }

        let splitIndex = currentChunk.lastIndexOf('\n\n', maxLength);
        if (splitIndex === -1) splitIndex = currentChunk.lastIndexOf('\n', maxLength);
        if (splitIndex === -1) splitIndex = currentChunk.lastIndexOf(' ', maxLength);
        if (splitIndex === -1) splitIndex = maxLength;
        parts.push(currentChunk.substring(0, splitIndex));
        currentChunk = currentChunk.substring(splitIndex).trim();
    }
    return parts;}

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

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('<a:spinnyman:1433853169884205106> | Organização de Lore')
      .setDescription('Reaja com o emoji 1️⃣ na **primeira** mensagem do seu RP.')
      .setColor('#0099ff')
      .setFooter({ text: 'Você tem 2 minutos para reagir.' });    
    
    await interaction.reply({ embeds: [embed], flags: 64 });
    const replyMessage = await interaction.fetchReply();
    
    const reactionFilter = (reaction, user) => user.id === interaction.user.id;
    
    let startTimeout, endTimeout;

    
    const startCollector = async (reaction, user) => {
        if (!reactionFilter(reaction, user)) return;

    
        if (reaction.emoji.name === '1️⃣') {
            clearTimeout(startTimeout); // Limpa o timeout de início
            clearTimeout(startTimeout);
            const loreInicio = reaction.message;
            this.client.removeListener('messageReactionAdd', startCollector); 

            embed.setDescription('Ótimo! Agora reaja com 2️⃣ na **última** mensagem do seu RP.');
            await interaction.editReply({ embeds: [embed] });

            const endCollector = async (endReaction, endUser) => {
                if (!reactionFilter(endReaction, endUser)) return;

                if (endReaction.emoji.name === '2️⃣') {
                    clearTimeout(endTimeout); // Limpa o timeout de fim
                if (!reactionFilter(endReaction, endUser) || endReaction.emoji.name !== '2️⃣') return;
    
                try {
                    clearTimeout(endTimeout);
                    const loreFim = endReaction.message;
                    this.client.removeListener('messageReactionAdd', endCollector);

    
                    if (loreInicio.createdTimestamp > loreFim.createdTimestamp) {
                        await interaction.followUp({ content: '❌ A mensagem de início deve ser anterior à mensagem de fim. Operação cancelada.', flags: 64 });
                        return;
                    }

                    await interaction.editReply({ content: 'Coletando e formatando as mensagens... Isso pode levar um momento.', embeds: [], components: []});

                    try {
                        const messages = await this.fetchMessagesBetween(loreInicio.channel, loreInicio.id, loreFim.id);
                        
                        let finalPages = [];
                        let textBlock = [];
                        await processarMensagens(interaction, [loreInicio], this.client);
                    } catch (err) {
                        console.error("Erro ao buscar ou paginar a lore:", err);
                        await interaction.followUp({ content: '❌ Ocorreu um erro ao processar sua lore. Verifique se eu tenho permissão para ler o histórico de mensagens neste canal.', ephemeral: true });
                    }
                } catch (error) {
                    console.error("Erro no coletor da reação final:", error);
                    await interaction.editReply({ content: '❌ Ocorreu um erro inesperado.', embeds: [], components: [] });
                }
            };
    
            const botoesEscolha = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('lore_apenas_inicio').setLabel('Usar apenas esta mensagem').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('lore_adicionar_fim').setLabel('Adicionar mensagem final').setStyle(ButtonStyle.Primary)
            );
    
            const msgEscolha = await interaction.editReply({
                content: 'Você quer usar apenas a mensagem selecionada ou adicionar uma mensagem final para criar um intervalo?',
                embeds: [],
                components: [botoesEscolha]
            });
    
            const filtroBotao = i => i.user.id === interaction.user.id && (i.customId === 'lore_apenas_inicio' || i.customId === 'lore_adicionar_fim');
            const coletorBotao = msgEscolha.createMessageComponentCollector({ filter: filtroBotao, componentType: ComponentType.Button, time: 60000, max: 1 });
    
            coletorBotao.on('collect', async i => {
                if (i.customId === 'lore_apenas_inicio') {
                    await i.update({ content: 'Coletando e formatando a mensagem... Isso pode levar um momento.', components: [] });
                    await processarMensagens(interaction, [loreInicio], this.client);
                } else if (i.customId === 'lore_adicionar_fim') {
                    await i.update({
                        content: 'Ótimo! Agora reaja com 2️⃣ na **última** mensagem do seu RP.',
                        components: []
                    });
                    this.client.on('messageReactionAdd', endCollector);
                    endTimeout = setTimeout(() => {
                        this.client.removeListener('messageReactionAdd', endCollector);
                        interaction.editReply({ content: '⏰ Tempo esgotado para reagir à mensagem final. Operação cancelada.', embeds: [] }).catch(() => {});
                    }, 120000);
                }
            });
    
            coletorBotao.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    interaction.editReply({ content: '⏰ Tempo esgotado para a escolha. Operação cancelada.', components: [] }).catch(() => {});
                }
            });
        }
    }; 
    this.client.on('messageReactionAdd', startCollector);
    
    startTimeout = setTimeout(() => {
        this.client.removeListener('messageReactionAdd', startCollector);
        interaction.editReply({ content: '⏰ Tempo esgotado para reagir à mensagem inicial. Operação cancelada.', embeds: [] }).catch(() => {});
    }, 120000); 
  }
};

                        const processAndPaginateTextBlock = (imageUrl = null) => {
                            if (textBlock.length > 0) {
                                const fullText = textBlock.join('\n\n');
                                const textPages = paginateText(fullText);
                                textPages.forEach(pageContent => {
                                    finalPages.push({
                                        content: pageContent,
                                        imageUrl: imageUrl
                                    });
                                });
                                textBlock = [];
                            }
                        };
async function processarMensagens(interaction, messages, client) {
    try {
        let paginasFinais = [];
        let blocoTexto = [];

                        for (let i = 0; i < messages.length; i++) {
                            const msg = messages[i];
                            const hasText = msg.content && msg.content.trim() !== '';
        const processarBlocoTexto = (imageUrl = null) => {
            if (blocoTexto.length > 0) {
                const textoCompleto = blocoTexto.join('\n\n');
                const paginasTexto = paginateText(textoCompleto);
                paginasTexto.forEach((conteudoPag, index) => {
                    const imgUrl = (index === 0) ? imageUrl : null;
                    paginasFinais.push({ content: conteudoPag, imageUrl: imgUrl });
                });
                blocoTexto = [];
            } else if (imageUrl) {
                paginasFinais.push({ content: ' ', imageUrl: imageUrl });
            }
        };

                            if (hasText) {
                                textBlock.push(msg.content);
                            }
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const temTexto = msg.content && msg.content.trim() !== '';
            const anexoImagem = msg.attachments.find(att => att.contentType?.startsWith('image/'));

                            const imageAttachment = msg.attachments.find(att => att.contentType?.startsWith('image/'));
            if (anexoImagem) {
                processarBlocoTexto();
                if (temTexto) blocoTexto.push(msg.content);
                processarBlocoTexto(anexoImagem.url);
            } else if (temTexto) {
                blocoTexto.push(msg.content);
            }
        }
        processarBlocoTexto();

                            // Se a mensagem atual tem uma imagem, ou se é a última mensagem do loop,
                            // processamos o bloco de texto acumulado até agora.
                            if (imageAttachment || i === messages.length - 1) {
                                processAndPaginateTextBlock(imageAttachment?.url ?? null);
                            }
                        }
        const pages = paginasFinais.map(page => ({ content: page.content || ' ', imageUrl: page.imageUrl || null }));

                        const pages = finalPages.map(page => {
                            // Garante que o conteúdo nunca seja nulo para evitar erros
                            return { content: page.content || ' ', imageUrl: page.imageUrl || null };
                        });
        if (pages.length === 0) {
            await interaction.editReply({ content: 'Nenhuma mensagem ou conteúdo válido encontrado.' });
            return;
        }

                        if (pages.length === 0) {
                            await interaction.editReply({ content: 'Nenhuma mensagem encontrada no intervalo selecionado.' });
                            return;
                        }
        let paginaAtual = 0;

                        let currentPage = 0;
        const gerarEmb = (pagIdx) => {
            return new EmbedBuilder()
                .setTitle(`<a:spinnyman:1433853169884205106> | Lore Organizada`)
                .setDescription(pages[pagIdx].content.substring(0, 4096))
                .setImage(pages[pagIdx].imageUrl)
                .setColor('#0099ff')
                .setFooter({ text: `Página ${pagIdx + 1} de ${pages.length}` });
        };

                        const generateEmbed = (pageIndex) => {
                            return new EmbedBuilder()
                                .setTitle(`<a:spinnyman:1433853169884205106> | Lore Organizada`)
                                .setDescription(pages[pageIndex].content.substring(0, 4096))
                                .setImage(pages[pageIndex].imageUrl)
                                .setColor('#0099ff')
                                .setFooter({ text: `Página ${pageIndex + 1} de ${pages.length}` });
                        };
        const obterBotoes = (pagIdx) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev_page').setLabel('◀️ Anterior').setStyle(ButtonStyle.Primary).setDisabled(pagIdx === 0),
                new ButtonBuilder().setCustomId('next_page').setLabel('Próximo ▶️').setStyle(ButtonStyle.Primary).setDisabled(pagIdx >= pages.length - 1)
            );
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
        const botoesConfirmacao = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_lore').setLabel('Salvar Lore').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('cancel_lore').setLabel('Cancelar').setStyle(ButtonStyle.Danger).setEmoji('❌')
        );

                        await interaction.editReply({
                            embeds: [generateEmbed(currentPage)],
                            components: pages.length > 1 ? [getButtons(currentPage)] : [],
                            content: 'Pré-visualização da sua lore:'
                        });
        const componentes = pages.length > 1 ? [obterBotoes(paginaAtual), botoesConfirmacao] : [botoesConfirmacao];

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
            embeds: [gerarEmb(paginaAtual)],
            components: componentes,
            content: 'Pré-visualização da sua lore:'
        });

                        await interaction.editReply({
                            embeds: [generateEmbed(currentPage)],
                            components: pages.length > 1 ? [getButtons(currentPage), confirmButton] : [confirmButton],
                        });
        const msgLore = await interaction.fetchReply();
        const coletorComponentes = msgLore.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === interaction.user.id,
            time: 300000
        });

                        const loreMessage = await interaction.fetchReply();
                        const allComponentsCollector = loreMessage.createMessageComponentCollector({
                            componentType: ComponentType.Button,
                            filter: i => i.user.id === interaction.user.id,
                            time: 300000 
                        });
        coletorComponentes.on('collect', async (i) => {
            if (i.customId === 'prev_page') {
                paginaAtual--;
                await i.update({ embeds: [gerarEmb(paginaAtual)], components: [obterBotoes(paginaAtual), botoesConfirmacao] });
            } else if (i.customId === 'next_page') {
                paginaAtual++;
                await i.update({ embeds: [gerarEmb(paginaAtual)], components: [obterBotoes(paginaAtual), botoesConfirmacao] });
            } else if (i.customId === 'confirm_lore') {
                client.fichaStates.set(interaction.user.id, {
                    pages: pages,
                    rawMessages: messages
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
                const modal = new ModalBuilder().setCustomId('lore_modal_config').setTitle('Configuração Final da Lore');
                const inpTitulo = new TextInputBuilder().setCustomId('lore_title').setLabel("Título da Lore").setStyle(TextInputStyle.Short).setRequired(true);
                const inpCapitulo = new TextInputBuilder().setCustomId('lore_chapter').setLabel("Nome/Número do Capítulo").setStyle(TextInputStyle.Short).setPlaceholder('Ex: "Capítulo 1", "Prólogo", etc.').setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(inpTitulo), new ActionRowBuilder().addComponents(inpCapitulo));

                                    const modal = new ModalBuilder()
                                        .setCustomId('lore_modal_config')
                                        .setTitle('Configuração Final da Lore');
                await i.showModal(modal);
                coletorComponentes.stop();

                                    const titleInput = new TextInputBuilder()
                                        .setCustomId('lore_title')
                                        .setLabel("Título da Lore")
                                        .setStyle(TextInputStyle.Short)
                                        .setRequired(true);
            } else if (i.customId === 'cancel_lore') {
                await i.update({ content: '❌ Operação de lore cancelada.', embeds: [], components: [] });
                coletorComponentes.stop();
            }
        });

                                    const chapterInput = new TextInputBuilder()
                                        .setCustomId('lore_chapter')
                                        .setLabel("Nome/Número do Capítulo")
                                        .setStyle(TextInputStyle.Short)
                                        .setPlaceholder('Ex: "Capítulo 1", "Prólogo", etc.')
                                        .setRequired(true);
        coletorComponentes.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: 'Tempo para confirmação esgotado.', embeds: [], components: [] }).catch(() => {});
            }
        });
    } catch (err) {
        console.error("Erro ao processar mensagens da lore:", err);
        await interaction.followUp({ content: '❌ Ocorreu um erro ao processar sua lore.', ephemeral: true });
    }
}

                                    modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(chapterInput));

                                    await i.showModal(modal);
 
                                    allComponentsCollector.stop();

                                } else if (i.customId === 'cancel_lore') {
                                    await i.update({ content: '❌ Operação de lore cancelada.', embeds: [], components: [] });
                                    allComponentsCollector.stop();
                                }
                            });

                        allComponentsCollector.on('end', (collected, reason) => {
                                if (reason === 'time') interaction.editReply({ content: 'Tempo para confirmação esgotado.', embeds: [], components: [] }).catch(() => {});
                        });
                    } catch (err) {
                        console.error("Erro ao buscar ou paginar a lore:", err);
                        await interaction.followUp({ content: '❌ Ocorreu um erro ao processar sua lore. Verifique se eu tenho permissão para ler o histórico de mensagens neste canal.', ephemeral: true });
                    }
                }
            }; 
            this.client.on('messageReactionAdd', endCollector);

            endTimeout = setTimeout(() => {
                this.client.removeListener('messageReactionAdd', endCollector);
                interaction.editReply({ content: '⏰ Tempo esgotado para reagir à mensagem final. Operação cancelada.', embeds: [] }).catch(() => {});
            }, 120000); 
        }
    }; 
    this.client.on('messageReactionAdd', startCollector);
    
    startTimeout = setTimeout(() => {
        this.client.removeListener('messageReactionAdd', startCollector);
        interaction.editReply({ content: '⏰ Tempo esgotado para reagir à mensagem inicial. Operação cancelada.', embeds: [] }).catch(() => {});
    }, 120000); 
  }
};

module.exports.paginateText = paginateText;
