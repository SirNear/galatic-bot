const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const Command = require('../../structures/Command');
const { extractTextFromAttachment } = require('../../api/documentParser');
const moment = require('moment');
moment.locale("pt-br");

/**
 * Pagina o texto em blocos de até maxLength caracteres (padrão 4000 para embeds do Discord).
 */
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
    if (splitIndex === -1) splitIndex = currentChunk.lastIndexOf('. ', maxLength);
    if (splitIndex === -1) splitIndex = currentChunk.lastIndexOf(' ', maxLength);
    if (splitIndex === -1) splitIndex = maxLength;

    parts.push(currentChunk.substring(0, splitIndex).trim());
    currentChunk = currentChunk.substring(splitIndex).trim();
  }
  return parts.filter(p => p.length > 0);
}

module.exports = class lore extends Command {
  constructor(client) {
    super(client, {
      name: "lore",
      description: "Organiza sua lore em capítulos a partir do chat ou arquivo anexado (.txt / .pdf)",
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
        .addSubcommand((sub) =>
          sub
            .setName("criar")
            .setDescription("Organiza e publica uma nova lore em capítulos a partir do chat ou arquivo (.txt / .pdf)")
            .addAttachmentOption((option) =>
              option
                .setName("arquivo")
                .setDescription("Anexe um arquivo .txt ou .pdf com o conteúdo da lore para formatação automática.")
                .setRequired(false)
            )
            .addStringOption((option) =>
              option
                .setName("titulo")
                .setDescription("Título da Lore (opcional, pode definir na Main Page).")
                .setRequired(false)
            )
            .addStringOption((option) =>
              option
                .setName("capitulo")
                .setDescription("Nome ou número do Capítulo (opcional, padrão: Capítulo 1).")
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("lista")
            .setDescription("Acessa o catálogo de todas as lores inclusas no sistema e permite navegar até elas")
            .addStringOption((option) =>
              option
                .setName("busca")
                .setDescription("Filtrar lores por título ou sinopse (opcional).")
                .setRequired(false)
            )
            .addUserOption((option) =>
              option
                .setName("autor")
                .setDescription("Filtrar lores criadas por um autor específico (opcional).")
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("sincronizar")
            .setDescription("Sincroniza e adiciona o botão 💾 em todas as mensagens fixas de lores do servidor")
        );
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

  /**
   * Processa a importação automática de um arquivo (.txt ou .pdf) e encaminha para a configuração da Main Page.
   */
  async processFileLore(attachment, user, channel, interaction = null, options = {}) {
    try {
      const parsed = await extractTextFromAttachment(attachment);
      const textPages = paginateText(parsed.text, 4000);

      if (textPages.length === 0) {
        const errMsg = '❌ O arquivo anexado não contém texto válido legível para gerar páginas.';
        if (interaction) return interaction.editReply({ content: errMsg });
        return channel.send({ content: errMsg });
      }

      const finalPages = textPages.map(pageContent => ({
        content: pageContent,
        imageUrl: null,
      }));

      const cleanFileName = (parsed.fileName || 'Minha Lore')
        .replace(/\.(txt|pdf|log|md)$/i, '')
        .replace(/[_-]+/g, ' ')
        .trim();

      const title = options.titulo || cleanFileName || 'Minha Lore';
      const chapter = options.capitulo || 'Capítulo 1';

      // Cria mensagem sintética para manter compatibilidade com o sistema de backup (messagesToTxt)
      const mockMsg = {
        createdAt: new Date(),
        createdTimestamp: Date.now(),
        author: user,
        channel: channel,
        content: parsed.text,
        attachments: { size: 0, forEach: () => { }, find: () => null },
        deletable: false,
        delete: async () => { },
      };

      this.client.fichaStates.set(user.id, {
        pages: finalPages,
        rawMessages: [mockMsg],
        title,
        chapter,
        synopsis: '',
        coverImageUrl: null,
        sourceFileName: parsed.fileName,
        fileType: parsed.fileType,
        channelId: channel.id,
        guildId: channel.guild?.id,
        createdTimestamp: Date.now(),
      });

      const introEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📚 Lore Importada com Sucesso!')
        .setDescription(
          `📄 **Arquivo Processado:** \`${parsed.fileName}\` (${parsed.fileType.toUpperCase()})\n` +
          `📖 **Páginas Geradas Automaticamente:** \`${finalPages.length}\` *(máx. 4.000 caracteres por página)*\n` +
          `📝 **Título Provisório:** "${title}"\n` +
          `📑 **Capítulo:** "${chapter}"\n\n` +
          `⚙️ **Página Inicial (Main Page):**\n` +
          `Antes de salvar e salvar sua lore no canal, você precisa configurar a **Main Page** (a mensagem eterna de apresentação da sua lore com título, sinopse/descritor e imagem de capa).\n\n` +
          `Clique em **Configurar Main Page** abaixo para preencher os dados e visualizar como ficará no canal antes de publicar!`
        )
        .setFooter({ text: 'Revise e edite a Main Page antes de sacramentar.' });

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('lore_btn_setup_mainpage')
          .setLabel('Configurar Main Page')
          .setEmoji('⚙️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('lore_btn_preview_pages_0')
          .setLabel('Ver Páginas do Texto')
          .setEmoji('📖')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('lore_btn_cancel')
          .setLabel('Cancelar')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
      );

      const payload = {
        content: null,
        embeds: [introEmbed],
        components: [actionRow],
      };

      if (interaction) {
        return await interaction.editReply(payload);
      } else {
        return await channel.send(payload);
      }
    } catch (err) {
      console.error('[LORE-FILE] Erro ao processar arquivo para Lore:', err);
      const errMsg = `❌ Ocorreu um erro ao ler o arquivo para a lore: ${err.message}`;
      if (interaction) return interaction.editReply({ content: errMsg });
      return channel.send({ content: errMsg });
    }
  }

  /**
   * Exibe o catálogo paginado de todas as lores inclusas no sistema e permite navegar diretamente até elas,
   * abrir sua Main Page, ler os capítulos ou baixar o PDF.
   */
  async executeListaLores(interaction, options = {}) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 64 });
    }

    const guildId = interaction.guild?.id;
    let searchTerm = (options.busca || '').trim();
    const targetAuthor = options.autor || null;

    const query = {};
    if (guildId) query.guildId = guildId;
    if (targetAuthor) query.createdBy = targetAuthor.id;

    let allLores = await this.client.database.Lore.find(query).sort({ createdAt: -1 }).lean().catch(() => []);
    if (!allLores || allLores.length === 0) {
      // Fallback caso lores antigas tenham sido salvas sem guildId compatível
      if (guildId && !targetAuthor) {
        allLores = await this.client.database.Lore.find({}).sort({ createdAt: -1 }).lean().catch(() => []);
      }
    }

    if (!allLores || allLores.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle('📚 Catálogo de Lores do Sistema')
        .setColor('#0099ff')
        .setDescription(
          targetAuthor
            ? `❌ Nenhuma lore encontrada para o autor <@${targetAuthor.id}>.`
            : '❌ Ainda não há nenhuma lore registrada no sistema. Use `/lore criar` para publicar a primeira!'
        );
      return interaction.editReply({ embeds: [emptyEmbed], components: [] });
    }

    const getFilteredLores = () => {
      if (!searchTerm) return allLores;
      const lower = searchTerm.toLowerCase();
      return allLores.filter(l => {
        const t = (l.title || '').toLowerCase();
        const s = (l.synopsis || '').toLowerCase();
        const cNames = (l.chapters || []).map(c => (c?.name || '').toLowerCase()).join(' ');
        return t.includes(lower) || s.includes(lower) || cNames.includes(lower);
      });
    };

    const ITEMS_PER_PAGE = 8;
    let currentPage = 0;

    const buildCatalogView = (pageIndex) => {
      const filtered = getFilteredLores();
      const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
      const safePage = Math.max(0, Math.min(pageIndex, totalPages - 1));
      const slice = filtered.slice(safePage * ITEMS_PER_PAGE, (safePage + 1) * ITEMS_PER_PAGE);

      const embed = new EmbedBuilder()
        .setTitle('📚 Catálogo de Lores do Sistema')
        .setColor('#0099ff')
        .setTimestamp();

      const filterBadges = [];
      if (targetAuthor) filterBadges.push(`👤 **Autor:** <@${targetAuthor.id}>`);
      if (searchTerm) filterBadges.push(`🔍 **Filtro:** \`${searchTerm}\``);
      const filterHeader = filterBadges.length > 0 ? `${filterBadges.join('  •  ')}\n\n` : '';

      if (filtered.length === 0) {
        embed.setDescription(
          `${filterHeader}❌ Nenhuma lore encontrada com o termo **"${searchTerm}"**.\nClique em **Limpar Busca** ou **Buscar Lore** abaixo para tentar outro termo.`
        );
        embed.setFooter({ text: `0 de ${allLores.length} lore(s) no sistema` });
      } else {
        const lines = slice.map((loreItem, idx) => {
          const globalNum = safePage * ITEMS_PER_PAGE + idx + 1;
          const gId = loreItem.guildId || guildId || '@me';
          const jumpUrl = (loreItem.channelId && loreItem.messageId)
            ? `https://discord.com/channels/${gId}/${loreItem.channelId}/${loreItem.messageId}`
            : null;

          const chapCount = Array.isArray(loreItem.chapters) ? loreItem.chapters.length : 0;
          const pageCount = (loreItem.chapters || []).reduce((acc, c) => acc + (Array.isArray(c?.pages) ? c.pages.length : 0), 0);
          const dateTs = loreItem.createdAt ? Math.floor(new Date(loreItem.createdAt).getTime() / 1000) : null;
          const synPreview = loreItem.synopsis
            ? `\n   *“${loreItem.synopsis.replace(/\r?\n/g, ' ').substring(0, 110)}${loreItem.synopsis.length > 110 ? '...' : ''}”*`
            : '';

          return (
            `**${globalNum}. ${loreItem.title || 'Lore Sem Título'}**\n` +
            `   👤 <@${loreItem.createdBy}> • 📍 <#${loreItem.channelId}> • 📑 \`${chapCount}\` cap(s) (\`${pageCount}\` pág.)` +
            `${dateTs ? ` • 🗓️ <t:${dateTs}:d>` : ''}` +
            `${jumpUrl ? `\n   🔗 **[Ir para a Mensagem no Canal ↗](${jumpUrl})**` : ''}` +
            `${synPreview}`
          );
        });

        embed.setDescription(
          `${filterHeader}Selecione uma lore no menu abaixo para **navegar até a Main Page**, **ler seus capítulos** ou **baixar o PDF completo (💾)**:\n\n` +
          lines.join('\n\n')
        );
        embed.setFooter({
          text: `Página ${safePage + 1} de ${totalPages} • Exibindo ${slice.length} de ${filtered.length} lore(s) (Total no sistema: ${allLores.length})`
        });
      }

      const components = [];

      if (slice.length > 0) {
        const selectOptions = slice.map((loreItem, idx) => {
          const globalNum = safePage * ITEMS_PER_PAGE + idx + 1;
          const chapCount = Array.isArray(loreItem.chapters) ? loreItem.chapters.length : 0;
          const pageCount = (loreItem.chapters || []).reduce((acc, c) => acc + (Array.isArray(c?.pages) ? c.pages.length : 0), 0);
          return {
            label: `${globalNum}. ${(loreItem.title || 'Lore Sem Título')}`.substring(0, 100),
            description: `${chapCount} capítulo(s) • ${pageCount} página(s) • Clique para abrir e navegar`.substring(0, 100),
            value: loreItem.messageId,
            emoji: '📖',
          };
        });

        components.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('lore_catalog_select')
              .setPlaceholder('📖 Selecione uma Lore desta página para navegar até ela...')
              .addOptions(selectOptions)
          )
        );
      }

      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('lore_catalog_prev')
          .setLabel('◀️ Anterior')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(safePage <= 0),
        new ButtonBuilder()
          .setCustomId('lore_catalog_page_info')
          .setLabel(`Pág. ${safePage + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('lore_catalog_next')
          .setLabel('Próxima ▶️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(safePage >= totalPages - 1),
        new ButtonBuilder()
          .setCustomId('lore_catalog_search')
          .setLabel('Buscar Lore')
          .setEmoji('🔍')
          .setStyle(ButtonStyle.Secondary)
      );

      if (searchTerm) {
        navRow.addComponents(
          new ButtonBuilder()
            .setCustomId('lore_catalog_clear_search')
            .setLabel('Limpar Busca')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Danger)
        );
      }

      components.push(navRow);
      return { embed, components, safePage };
    };

    const buildLoreDetailView = async (loreDoc) => {
      const gId = loreDoc.guildId || guildId || '@me';
      const jumpUrl = (loreDoc.channelId && loreDoc.messageId)
        ? `https://discord.com/channels/${gId}/${loreDoc.channelId}/${loreDoc.messageId}`
        : null;

      const creatorUser = await this.client.users.fetch(loreDoc.createdBy).catch(() => interaction.user);
      const chapCount = Array.isArray(loreDoc.chapters) ? loreDoc.chapters.length : 0;
      const pageCount = (loreDoc.chapters || []).reduce((acc, c) => acc + (Array.isArray(c?.pages) ? c.pages.length : 0), 0);
      const eternalDescription = loreDoc.synopsis || loreDoc.chapters?.[0]?.pages?.[0]?.content || 'Clique em "📖 Ler Lore" abaixo para iniciar a leitura.';

      const detailEmbed = new EmbedBuilder()
        .setTitle(loreDoc.title || 'Lore')
        .setColor('#0099ff')
        .setAuthor({ name: `Lore por ${creatorUser.username}`, iconURL: creatorUser.displayAvatarURL() })
        .setDescription(eternalDescription.substring(0, 4096))
        .addFields(
          { name: '📍 Canal da Lore', value: `<#${loreDoc.channelId}>`, inline: true },
          { name: '📚 Estrutura', value: `\`${chapCount}\` capítulo(s) • \`${pageCount}\` página(s)`, inline: true },
          { name: '🔗 Acesso Direto', value: jumpUrl ? `[Ir para a Mensagem Original ↗](${jumpUrl})` : 'Indisponível', inline: true }
        )
        .setFooter({ text: `📚 ${chapCount} capítulo(s) • Clique em "📖 Ler Lore" para ler ou "💾" para baixar em PDF` })
        .setTimestamp(loreDoc.createdAt ? new Date(loreDoc.createdAt) : new Date());

      const coverToUse = loreDoc.coverImageUrl || loreDoc.chapters?.[0]?.pages?.[0]?.imageUrl || null;
      if (coverToUse) {
        const { resolveValidLoreImageUrl } = require('../../events/loreInteraction.js');
        const validCover = await resolveValidLoreImageUrl(coverToUse, this.client, loreDoc, 0, 0).catch(() => coverToUse);
        if (validCover && validCover.startsWith('http')) {
          detailEmbed.setImage(validCover);
        }
      }

      const rowActions = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`lore_read_${loreDoc.messageId}_0_0_0_ephemeral`)
          .setLabel('📖 Ler Lore')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`lore_download_pdf_${loreDoc.messageId}`)
          .setEmoji('💾')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`lore_chapters-list_${loreDoc.messageId}`)
          .setLabel('Capítulos')
          .setEmoji('📚')
          .setStyle(ButtonStyle.Secondary)
      );

      if (jumpUrl) {
        rowActions.addComponents(
          new ButtonBuilder()
            .setLabel('Ir até a Mensagem')
            .setEmoji('🔗')
            .setStyle(ButtonStyle.Link)
            .setURL(jumpUrl)
        );
      }

      rowActions.addComponents(
        new ButtonBuilder()
          .setCustomId('lore_catalog_back')
          .setLabel('Voltar ao Catálogo')
          .setEmoji('↩️')
          .setStyle(ButtonStyle.Secondary)
      );

      const rows = [rowActions];

      if (interaction.user.id === loreDoc.createdBy) {
        rows.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`lore_manage_edit-title_${loreDoc.messageId}`)
              .setLabel('Editar Informações')
              .setEmoji('✏️')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`lore_add_chapter_${loreDoc.messageId}`)
              .setLabel('Adicionar Capítulo')
              .setEmoji('➕')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`lore_add_backup_${loreDoc.messageId}`)
              .setLabel('Importar .TXT / .PDF')
              .setEmoji('📥')
              .setStyle(ButtonStyle.Secondary)
          )
        );
      }

      return { embed: detailEmbed, components: rows };
    };

    const initialView = buildCatalogView(currentPage);
    currentPage = initialView.safePage;

    const replyMsg = await interaction.editReply({
      content: null,
      embeds: [initialView.embed],
      components: initialView.components,
    });

    const collector = replyMsg.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('lore_catalog_'),
      time: 300000,
    });

    collector.on('collect', async (i) => {
      try {
        if (i.customId === 'lore_catalog_prev') {
          currentPage = Math.max(0, currentPage - 1);
          const view = buildCatalogView(currentPage);
          currentPage = view.safePage;
          await i.update({ embeds: [view.embed], components: view.components });
        } else if (i.customId === 'lore_catalog_next') {
          currentPage++;
          const view = buildCatalogView(currentPage);
          currentPage = view.safePage;
          await i.update({ embeds: [view.embed], components: view.components });
        } else if (i.customId === 'lore_catalog_back') {
          const view = buildCatalogView(currentPage);
          currentPage = view.safePage;
          await i.update({ embeds: [view.embed], components: view.components });
        } else if (i.customId === 'lore_catalog_clear_search') {
          searchTerm = '';
          currentPage = 0;
          const view = buildCatalogView(currentPage);
          currentPage = view.safePage;
          await i.update({ embeds: [view.embed], components: view.components });
        } else if (i.customId === 'lore_catalog_search') {
          const modalId = `lore_catalog_search_modal_${Date.now()}`;
          const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle('Buscar Lore no Sistema');

          const searchInput = new TextInputBuilder()
            .setCustomId('lore_search_input')
            .setLabel('Título, capítulo ou palavra-chave da sinopse')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ex: Tessitura, Mancha Negra, Prólogo...')
            .setValue(searchTerm)
            .setRequired(false);

          modal.addComponents(new ActionRowBuilder().addComponents(searchInput));
          await i.showModal(modal);

          const submitted = await i.awaitModalSubmit({
            filter: (m) => m.customId === modalId && m.user.id === interaction.user.id,
            time: 60000,
          }).catch(() => null);

          if (submitted) {
            searchTerm = submitted.fields.getTextInputValue('lore_search_input').trim();
            currentPage = 0;
            const view = buildCatalogView(currentPage);
            currentPage = view.safePage;
            await submitted.update({ embeds: [view.embed], components: view.components }).catch(() => {});
          }
        } else if (i.customId === 'lore_catalog_select' && i.isStringSelectMenu()) {
          const selectedMessageId = i.values[0];
          const selectedLore = allLores.find((l) => l.messageId === selectedMessageId)
            || await this.client.database.Lore.findOne({ messageId: selectedMessageId }).lean().catch(() => null);

          if (!selectedLore) {
            return i.reply({ content: '❌ Esta lore não foi encontrada.', flags: 64 });
          }

          await i.deferUpdate().catch(() => {});
          const detailView = await buildLoreDetailView(selectedLore);
          await interaction.editReply({ embeds: [detailView.embed], components: detailView.components });
        }
      } catch (err) {
        console.error('[LORE CATALOG] Erro na interação do catálogo de lores:', err);
      }
    });
  }

  async execute(interaction) {
    let subcommand = 'criar';
    try {
      subcommand = interaction.options.getSubcommand(false) || 'criar';
    } catch (_) {
      subcommand = 'criar';
    }

    if (subcommand === 'lista') {
      const busca = interaction.options.getString('busca');
      const autor = interaction.options.getUser('autor');
      return this.executeListaLores(interaction, { busca, autor });
    }

    if (subcommand === 'sincronizar') {
      await interaction.deferReply({ flags: 64 });
      const { syncPreExistingLores } = require('../../events/loreInteraction.js');
      const result = await syncPreExistingLores(this.client);
      return interaction.editReply({
        content: `✅ Sincronização concluída! **${result?.updatedCount || 0}** mensagem(ns) de lore atualizada(s) com o botão 💾 (Total verificado: ${result?.totalCount || 0}).`
      });
    }

    const attachment = interaction.options.getAttachment('arquivo');
    const titulo = interaction.options.getString('titulo');
    const capitulo = interaction.options.getString('capitulo');

    // ─── MODO 1: Importação Automática de Arquivo (.txt ou .pdf) ────────────────
    if (attachment) {
      await interaction.deferReply({ flags: 64 });
      return this.processFileLore(attachment, interaction.user, interaction.channel, interaction, { titulo, capitulo });
    }

    // ─── MODO DEV / TESTE ─────────────────────────────────────────────────────
    if (this.client.maintenance && this.client.owners.includes(interaction.user.id)) {
      const textoLorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\n".repeat(15);

      await interaction.reply({ content: '🛠️ Modo desenvolvedor ativo: Auto-preenchendo lore com Lorem Ipsum...', flags: 64 });

      const finalPages = [];
      const textPages = paginateText(textoLorem);
      textPages.forEach(pageContent => {
        finalPages.push({ content: pageContent, imageUrl: null });
      });

      let currentPage = 0;
      const generateEmbed = (pageIndex) => {
        return new EmbedBuilder()
          .setTitle(`<a:spinnyman:1433853169884205106> | Lore Organizada (DEV MODE)`)
          .setDescription(finalPages[pageIndex].content.substring(0, 4096))
          .setColor('#0099ff')
          .setFooter({ text: `Página ${pageIndex + 1} de ${finalPages.length}` });
      };

      const getButtons = (pageIndex) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('prev_page').setLabel('◀️ Anterior').setStyle(ButtonStyle.Primary).setDisabled(pageIndex === 0),
          new ButtonBuilder().setCustomId('next_page').setLabel('Próximo ▶️').setStyle(ButtonStyle.Primary).setDisabled(pageIndex >= finalPages.length - 1)
        );
      };

      const confirmButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_lore').setLabel('Configurar Main Page').setStyle(ButtonStyle.Success).setEmoji('⚙️'),
        new ButtonBuilder().setCustomId('cancel_lore').setLabel('Cancelar').setStyle(ButtonStyle.Danger).setEmoji('❌')
      );

      await interaction.editReply({
        embeds: [generateEmbed(currentPage)],
        components: finalPages.length > 1 ? [getButtons(currentPage), confirmButton] : [confirmButton],
        content: 'Pré-visualização da sua lore:'
      });

      const loreMessage = await interaction.fetchReply();
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
          const mockMsg = { createdTimestamp: Date.now(), deletable: false, delete: async () => { }, content: textoLorem, author: interaction.user, channel: interaction.channel, attachments: { size: 0, find: () => null } };

          this.client.fichaStates.set(interaction.user.id, {
            pages: finalPages,
            rawMessages: [mockMsg],
            title: "Lore de Teste Dev",
            chapter: "Capítulo 1",
            synopsis: "",
            coverImageUrl: null
          });

          const modal = new ModalBuilder().setCustomId('lore_modal_mainpage').setTitle('Configuração da Main Page');
          const titleInput = new TextInputBuilder().setCustomId('lore_title').setLabel("Título da Lore").setStyle(TextInputStyle.Short).setValue("Lore de Teste Dev").setRequired(true);
          const chapterInput = new TextInputBuilder().setCustomId('lore_chapter').setLabel("Nome/Número do Capítulo").setStyle(TextInputStyle.Short).setValue("Capítulo 1").setRequired(true);
          const synopsisInput = new TextInputBuilder().setCustomId('lore_synopsis').setLabel("Descritor / Sinopse (Página Inicial)").setStyle(TextInputStyle.Paragraph).setPlaceholder("Escreva um resumo ou apresentação para a mensagem eterna da lore...").setRequired(false);
          const coverInput = new TextInputBuilder().setCustomId('lore_cover_image').setLabel("URL da Imagem de Capa (Opcional)").setStyle(TextInputStyle.Short).setPlaceholder("https://exemplo.com/capa.png").setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(chapterInput),
            new ActionRowBuilder().addComponents(synopsisInput),
            new ActionRowBuilder().addComponents(coverInput)
          );

          await i.showModal(modal);
          allComponentsCollector.stop();

        } else if (i.customId === 'cancel_lore') {
          await i.update({ content: '❌ Operação de lore cancelada.', embeds: [], components: [] });
          allComponentsCollector.stop();
        }
      });

      return;
    }

    // ─── MODO 2: Seleção por Reações (1️⃣ e 2️⃣) OU Envio de Arquivo (.txt / .pdf) no Chat ────────────────────
    const embed = new EmbedBuilder()
      .setTitle('<a:spinnyman:1433853169884205106> | Organização de Lore')
      .setDescription(
        'Escolha como deseja criar sua Lore:\n\n' +
        '1️⃣ **Via Mensagens do Chat:** Reaja com o emoji **1️⃣** na **primeira** mensagem do seu RP no chat (e depois **2️⃣** na última).\n' +
        '📄 **Via Arquivo (.txt ou .pdf):** Simplesmente **envie o arquivo `.txt` ou `.pdf` neste canal agora** (ou use `/lore arquivo:...`) para formatar e publicar automaticamente!'
      )
      .setColor('#0099ff')
      .setFooter({ text: 'Você tem 2 minutos para reagir à mensagem inicial ou enviar um arquivo .txt/.pdf.' });

    await interaction.reply({ embeds: [embed], flags: 64 });

    const reactionFilter = (reaction, user) => user.id === interaction.user.id;
    let startTimeout, endTimeout;

    // Coletor paralelo caso o usuário envie um arquivo .txt ou .pdf no canal após rodar /lore
    const fileMsgFilter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
    const fileCollector = interaction.channel.createMessageCollector({ filter: fileMsgFilter, time: 120000 });

    fileCollector.on('collect', async (msg) => {
      const docAtt = msg.attachments.find(att => {
        const n = (att.name || '').toLowerCase();
        const ct = (att.contentType || '').toLowerCase();
        return n.endsWith('.txt') || n.endsWith('.pdf') || n.endsWith('.md') || n.endsWith('.log') || ct.includes('pdf') || ct.startsWith('text/');
      });
      if (!docAtt) return;

      clearTimeout(startTimeout);
      this.client.removeListener('messageReactionAdd', startCollector);
      fileCollector.stop('file_received');

      await interaction.editReply({ content: `📥 Arquivo **${docAtt.name}** recebido! Processando e paginando sua lore...`, embeds: [], components: [] }).catch(() => {});
      await this.processFileLore(docAtt, interaction.user, interaction.channel, interaction, { titulo, capitulo });
      await msg.delete().catch(() => {});
    });

    const startCollector = async (reaction, user) => {
      if (!reactionFilter(reaction, user)) return;

      if (reaction.emoji.name === '1️⃣') {
        clearTimeout(startTimeout);
        fileCollector.stop('reaction_started');
        const loreInicio = reaction.message;
        this.client.removeListener('messageReactionAdd', startCollector);

        embed.setDescription('Ótimo! Agora reaja com 2️⃣ na **última** mensagem do seu RP.');
        await interaction.editReply({ embeds: [embed] });

        const endCollector = async (endReaction, endUser) => {
          if (!reactionFilter(endReaction, endUser)) return;

          if (endReaction.emoji.name === '2️⃣') {
            clearTimeout(endTimeout);
            const loreFim = endReaction.message;
            this.client.removeListener('messageReactionAdd', endCollector);

            if (loreInicio.createdTimestamp > loreFim.createdTimestamp) {
              await interaction.followUp({ content: '❌ A mensagem de início deve ser anterior à mensagem de fim. Operação cancelada.', flags: 64 });
              return;
            }

            await interaction.editReply({ content: 'Coletando e formatando as mensagens... Isso pode levar um momento.', embeds: [], components: [] });

            try {
              const messages = await this.fetchMessagesBetween(loreInicio.channel, loreInicio.id, loreFim.id);

              let finalPages = [];
              let textBlock = [];

              const processAndPaginateTextBlock = (imageUrl = null) => {
                if (textBlock.length > 0) {
                  const fullText = textBlock.join('\n\n');
                  const textPages = paginateText(fullText);
                  textPages.forEach((pageContent) => {
                    finalPages.push({
                      content: pageContent,
                      imageUrl: imageUrl
                    });
                  });
                  textBlock = [];
                } else if (imageUrl) {
                  if (finalPages.length > 0 && !finalPages[finalPages.length - 1].imageUrl) {
                    finalPages[finalPages.length - 1].imageUrl = imageUrl;
                  } else {
                    finalPages.push({
                      content: ' ',
                      imageUrl: imageUrl
                    });
                  }
                }
              };

              for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                const hasText = msg.content && msg.content.trim() !== '';

                if (hasText) {
                  textBlock.push(msg.content);
                }

                const imageAttachment = msg.attachments.find(att =>
                  att.contentType?.startsWith('image/') ||
                  /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(att.url || att.name || '')
                );

                if (imageAttachment) {
                  processAndPaginateTextBlock(imageAttachment.url);
                } else if (i === messages.length - 1) {
                  processAndPaginateTextBlock(null);
                }
              }

              const pages = finalPages.map(page => ({
                content: page.content || ' ',
                imageUrl: page.imageUrl || null
              }));

              if (pages.length === 0) {
                await interaction.editReply({ content: 'Nenhuma mensagem encontrada no intervalo selecionado.' });
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

              const confirmButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('confirm_lore')
                  .setLabel('Configurar Main Page')
                  .setStyle(ButtonStyle.Success)
                  .setEmoji('⚙️'),
                new ButtonBuilder()
                  .setCustomId('cancel_lore')
                  .setLabel('Cancelar')
                  .setStyle(ButtonStyle.Danger)
                  .setEmoji('❌')
              );

              await interaction.editReply({
                embeds: [generateEmbed(currentPage)],
                components: pages.length > 1 ? [getButtons(currentPage), confirmButton] : [confirmButton],
                content: 'Pré-visualização do texto da sua lore:'
              });

              const loreMessage = await interaction.fetchReply();
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
                    rawMessages: messages,
                    title: "Minha Lore",
                    chapter: "Capítulo 1",
                    synopsis: "",
                    coverImageUrl: null
                  });

                  const modal = new ModalBuilder()
                    .setCustomId('lore_modal_mainpage')
                    .setTitle('Configuração da Main Page');

                  const titleInput = new TextInputBuilder()
                    .setCustomId('lore_title')
                    .setLabel("Título da Lore")
                    .setStyle(TextInputStyle.Short)
                    .setValue("Minha Lore")
                    .setRequired(true);

                  const chapterInput = new TextInputBuilder()
                    .setCustomId('lore_chapter')
                    .setLabel("Nome/Número do Capítulo")
                    .setStyle(TextInputStyle.Short)
                    .setValue("Capítulo 1")
                    .setPlaceholder('Ex: "Capítulo 1", "Prólogo", etc.')
                    .setRequired(true);

                  const synopsisInput = new TextInputBuilder()
                    .setCustomId('lore_synopsis')
                    .setLabel("Descritor / Sinopse (Página Inicial)")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Resumo ou apresentação para a mensagem eterna da lore (Opcional)')
                    .setRequired(false);

                  const coverInput = new TextInputBuilder()
                    .setCustomId('lore_cover_image')
                    .setLabel("URL da Imagem de Capa (Opcional)")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('https://exemplo.com/capa.png')
                    .setRequired(false);

                  modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(chapterInput),
                    new ActionRowBuilder().addComponents(synopsisInput),
                    new ActionRowBuilder().addComponents(coverInput)
                  );

                  await i.showModal(modal);
                  allComponentsCollector.stop();

                } else if (i.customId === 'cancel_lore') {
                  await i.update({ content: '❌ Operação de lore cancelada.', embeds: [], components: [] });
                  allComponentsCollector.stop();
                }
              });

              allComponentsCollector.on('end', (collected, reason) => {
                if (reason === 'time') interaction.editReply({ content: 'Tempo para confirmação esgotado.', embeds: [], components: [] }).catch(() => { });
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
          interaction.editReply({ content: '⏰ Tempo esgotado para reagir à mensagem final. Operação cancelada.', embeds: [] }).catch(() => { });
        }, 120000);
      }
    };
    this.client.on('messageReactionAdd', startCollector);

    startTimeout = setTimeout(() => {
      this.client.removeListener('messageReactionAdd', startCollector);
      fileCollector.stop('timeout');
      interaction.editReply({ content: '⏰ Tempo esgotado para reagir à mensagem inicial ou enviar um arquivo. Operação cancelada.', embeds: [] }).catch(() => { });
    }, 120000);
  }

  /**
   * Suporte a comando de prefixo (!lore com anexo)
   */
  async run({ message, args }) {
    const attachment = message.attachments.first();
    if (attachment) {
      return this.processFileLore(attachment, message.author, message.channel, null, {
        titulo: args.join(" ").trim() || null,
      });
    }

    return message.reply(
      "ℹ️ Para criar uma lore, use `/lore criar` (ou envie um arquivo `.txt` / `.pdf` junto com `!lore [título]`). Para ver e navegar por todas as lores do sistema, use `/lore lista`!"
    );
  }
};

module.exports.paginateText = paginateText;
