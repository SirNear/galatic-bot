const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    PermissionsBitField
} = require('discord.js');
const Command = require('../../structures/Command');
const color = require('../../api/colors.json');

/**
 * Garante que o documento do servidor exista no banco de dados e possua os arrays inicializados.
 */
async function getOrCreateServerConfig(client, guildId) {
    let server = await client.database.Guilds.findById(guildId);
    if (!server) {
        server = new client.database.Guilds({ _id: guildId });
        await server.save();
    }
    if (!Array.isArray(server.deleteRestrictedCategories)) {
        server.deleteRestrictedCategories = [];
    }
    if (!Array.isArray(server.deleteRestrictedChannels)) {
        server.deleteRestrictedChannels = [];
    }
    return server;
}

/**
 * Formata a exibição de um canal salvo no banco (ID puro ou menção <#id>).
 */
function formatChannelValue(guild, rawValue) {
    if (!rawValue || rawValue === 'Não definido' || rawValue === '#punições') {
        return rawValue || '`Não definido`';
    }
    const cleanId = String(rawValue).replace(/[<#>]/g, '').trim();
    const ch = guild?.channels?.cache?.get(cleanId);
    if (ch) return `<#${ch.id}> (\`#${ch.name}\`)`;
    if (/^\d{15,22}$/.test(cleanId)) return `<#${cleanId}>`;
    return `\`${rawValue}\``;
}

/**
 * Formata a exibição de um cargo salvo no banco (ID puro ou menção <@&id>).
 */
function formatRoleValue(guild, rawValue) {
    if (!rawValue || rawValue === 'Não definido' || rawValue === '@mutado') {
        return rawValue || '`Não definido`';
    }
    const cleanId = String(rawValue).replace(/[<@&>]/g, '').trim();
    const role = guild?.roles?.cache?.get(cleanId);
    if (role) return `<@&${role.id}> (\`@${role.name}\`)`;
    if (/^\d{15,22}$/.test(cleanId)) return `<@&${cleanId}>`;
    return `\`${rawValue}\``;
}

/**
 * Formata a exibição de uma categoria salva no banco.
 */
function formatCategoryValue(guild, rawValue) {
    if (!rawValue || rawValue === 'Não definido') return '`Não definida`';
    const cleanId = String(rawValue).replace(/[<#>]/g, '').trim();
    const cat = guild?.channels?.cache?.get(cleanId);
    if (cat) return `📁 **${cat.name}** (\`${cat.id}\`)`;
    return `\`${rawValue}\``;
}

/**
 * Constrói o payload (embed + componentes) do Painel Principal do Servidor.
 */
function buildMainPanelPayload(client, guild, server, statusNotice = null) {
    const guildIcon = guild.iconURL() || client.user.displayAvatarURL();
    const isAutoMuteOn = server.warnTag === 'Ativado';
    const restrictedCatCount = (server.deleteRestrictedCategories || []).length;
    const restrictedChanCount = (server.deleteRestrictedChannels || []).length;

    const embed = new EmbedBuilder()
        .setColor(color.green || '#2ecc71')
        .setTitle('⚙️ | Painel de Configurações do Servidor')
        .setDescription(
            (statusNotice ? `> ${statusNotice}\n\n` : '') +
            'Selecione abaixo qual configuração ou sistema do servidor você deseja gerenciar.'
        )
        .addFields(
            {
                name: '📌 Prefixo Legacy',
                value: `\`${server.prefix || 'g!'}\``,
                inline: true
            },
            {
                name: '⚖️ Canal de Punições',
                value: formatChannelValue(guild, server.cPunicoes),
                inline: true
            },
            {
                name: '🔇 Cargo de Mute',
                value: formatRoleValue(guild, server.cargoMute),
                inline: true
            },
            {
                name: '🚨 Mute Automático (Warns)',
                value: isAutoMuteOn
                    ? `🟢 **Ativado** (Limite: \`${server.warnNumber || '3'} warns\`)`
                    : '🔴 **Desativado**',
                inline: true
            },
            {
                name: '🛡️ Cargo de Moderação (Staff)',
                value: formatRoleValue(guild, server.staffRole),
                inline: true
            },
            {
                name: '👁️ Categoria de Monitoramento',
                value: formatCategoryValue(guild, server.monitorCategory),
                inline: true
            },
            {
                name: '🗑️ Deleção de Mensagens do Bot (Reação 🗑️)',
                value:
                    `📁 **Categorias Restritas:** \`${restrictedCatCount}\`  •  💬 **Canais Restritos Individualmente:** \`${restrictedChanCount}\`\n` +
                    `*Em categorias ou canais restritos, reagir com 🗑️ não apagará mensagens do bot.*`,
                inline: false
            }
        )
        .setThumbnail(guildIcon)
        .setFooter({ text: `${guild.name} • Painel Administrativo Interativo` })
        .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('painel_cfg_punicoes')
            .setLabel('Canal de Punições')
            .setEmoji('⚖️')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('painel_cfg_prefix')
            .setLabel('Prefixo')
            .setEmoji('📌')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('painel_cfg_mute')
            .setLabel('Cargo de Mute')
            .setEmoji('🔇')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('painel_cfg_automute')
            .setLabel('Mute Automático')
            .setEmoji('🚨')
            .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('painel_cfg_staff')
            .setLabel('Cargo de Moderação')
            .setEmoji('🛡️')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('painel_cfg_monitor')
            .setLabel('Cat. Monitoramento')
            .setEmoji('👁️')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('painel_del_home_0')
            .setLabel('Restrições de Deleção (🗑️)')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Success)
    );

    return { embeds: [embed], components: [row1, row2] };
}

/**
 * Constrói a tela de listagem de Categorias para configurar restrições da função de deleção (🗑️).
 */
function buildDeleteCategoriesPayload(guild, server, page = 0, statusNotice = null) {
    const allCategories = Array.from(
        guild.channels.cache
            .filter(c => c.type === ChannelType.GuildCategory)
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .values()
    );

    const uncategorizedChannels = guild.channels.cache.filter(
        c => c.type !== ChannelType.GuildCategory && !c.parentId && !c.isThread?.()
    );

    const categoryItems = allCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        channels: Array.from(
            guild.channels.cache
                .filter(c => c.parentId === cat.id && c.type !== ChannelType.GuildCategory)
                .sort((a, b) => a.rawPosition - b.rawPosition)
                .values()
        )
    }));

    if (uncategorizedChannels.size > 0) {
        categoryItems.push({
            id: 'uncategorized',
            name: 'Canais Sem Categoria',
            channels: Array.from(uncategorizedChannels.sort((a, b) => a.rawPosition - b.rawPosition).values())
        });
    }

    const pageSize = 25;
    const totalPages = Math.max(1, Math.ceil(categoryItems.length / pageSize));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const pageCategories = categoryItems.slice(safePage * pageSize, (safePage + 1) * pageSize);

    const restrictedCats = new Set(server.deleteRestrictedCategories || []);
    const restrictedChans = new Set(server.deleteRestrictedChannels || []);

    const lines = pageCategories.map((cat, idx) => {
        const globalIdx = safePage * pageSize + idx + 1;
        const isCatRestricted = restrictedCats.has(cat.id);
        const restrictedChildCount = cat.channels.filter(ch => restrictedChans.has(ch.id)).length;

        let badge = '🟢 **Liberada**';
        if (isCatRestricted) {
            badge = '🔒 **Categoria Toda Restrita**';
        } else if (restrictedChildCount > 0) {
            badge = `⚠️ **${restrictedChildCount}/${cat.channels.length} canal(is) restrito(s)**`;
        }

        return `**${globalIdx}.** 📁 **${cat.name}** (${cat.channels.length} canais) — ${badge}`;
    });

    const embed = new EmbedBuilder()
        .setColor('#e67e22')
        .setTitle(`🗑️ | Restrições de Deleção por Reação (🗑️)${totalPages > 1 ? ` • Pág. ${safePage + 1}/${totalPages}` : ''}`)
        .setDescription(
            (statusNotice ? `> ${statusNotice}\n\n` : '') +
            'Selecione uma **Categoria** no menu abaixo para restringir/liberar toda a categoria ou navegar em seus canais individualmente.\n\n' +
            `📊 **Resumo Atual:** \`${restrictedCats.size}\` categoria(s) restrita(s) • \`${restrictedChans.size}\` canal(is) restrito(s) individualmente.\n\n` +
            (lines.length > 0 ? lines.join('\n').substring(0, 3500) : '*Nenhuma categoria encontrada neste servidor.*')
        )
        .setFooter({ text: 'Restringir significa que reagir com 🗑️ não apagará mensagens do bot no local.' });

    const components = [];

    if (pageCategories.length > 0) {
        const selectOptions = pageCategories.map(cat => {
            const isCatRestricted = restrictedCats.has(cat.id);
            const restrictedChildCount = cat.channels.filter(ch => restrictedChans.has(ch.id)).length;
            let statusDesc = `🟢 Liberada • ${cat.channels.length} canal(is)`;
            if (isCatRestricted) statusDesc = `🔒 Restrita (Toda a categoria) • ${cat.channels.length} canal(is)`;
            else if (restrictedChildCount > 0) statusDesc = `⚠️ ${restrictedChildCount} canal(is) restrito(s) de ${cat.channels.length}`;

            return {
                label: cat.name.substring(0, 100),
                description: statusDesc.substring(0, 100),
                value: cat.id,
                emoji: isCatRestricted ? '🔒' : (restrictedChildCount > 0 ? '⚠️' : '📁')
            };
        });

        components.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`painel_del_pickcat_${safePage}`)
                    .setPlaceholder('📁 Selecione uma categoria para configurar...')
                    .addOptions(selectOptions)
            )
        );
    }

    const navRow = new ActionRowBuilder();
    if (totalPages > 1) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`painel_del_home_${safePage - 1}`)
                .setLabel('◀️ Pág. Ant.')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage <= 0),
            new ButtonBuilder()
                .setCustomId('painel_del_noop')
                .setLabel(`Pág. ${safePage + 1}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`painel_del_home_${safePage + 1}`)
                .setLabel('Próx. Pág. ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage >= totalPages - 1)
        );
    }

    navRow.addComponents(
        new ButtonBuilder()
            .setCustomId('painel_home')
            .setLabel('Voltar ao Painel')
            .setEmoji('↩️')
            .setStyle(ButtonStyle.Primary)
    );
    components.push(navRow);

    return { embeds: [embed], components };
}

/**
 * Constrói a visão de gerenciamento de uma Categoria específica (Restringir toda a categoria ou Navegar nos canais).
 */
function buildCategoryManagePayload(guild, server, categoryId, statusNotice = null) {
    const isUncategorized = categoryId === 'uncategorized';
    const category = isUncategorized ? null : guild.channels.cache.get(categoryId);

    if (!isUncategorized && !category) {
        return buildDeleteCategoriesPayload(guild, server, 0, '❌ Categoria não encontrada.');
    }

    const categoryName = isUncategorized ? 'Canais Sem Categoria' : category.name;
    const childChannels = Array.from(
        guild.channels.cache
            .filter(c =>
                c.type !== ChannelType.GuildCategory &&
                !c.isThread?.() &&
                (isUncategorized ? !c.parentId : c.parentId === categoryId)
            )
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .values()
    );

    const restrictedCats = new Set(server.deleteRestrictedCategories || []);
    const restrictedChans = new Set(server.deleteRestrictedChannels || []);
    const isCatRestricted = restrictedCats.has(categoryId);

    const channelLines = childChannels.map((ch, idx) => {
        const isChanIndividuallyRestricted = restrictedChans.has(ch.id);
        let status = '🟢 Liberado';
        if (isCatRestricted && isChanIndividuallyRestricted) {
            status = '🔒 Restrito (Categoria + Individual)';
        } else if (isCatRestricted) {
            status = '🔒 Restrito (Pela Categoria)';
        } else if (isChanIndividuallyRestricted) {
            status = '🔒 **Restrito Individualmente**';
        }
        return `**${idx + 1}.** <#${ch.id}> (\`#${ch.name}\`) — ${status}`;
    });

    const restrictedChildrenCount = childChannels.filter(ch => restrictedChans.has(ch.id)).length;

    const embed = new EmbedBuilder()
        .setColor(isCatRestricted ? '#e74c3c' : '#2ecc71')
        .setTitle(`📁 | Gerenciar Categoria: ${categoryName}`)
        .setDescription(
            (statusNotice ? `> ${statusNotice}\n\n` : '') +
            `**Status Geral da Categoria:** ${isCatRestricted ? '🔒 **RESTRITA** *(Deleção por 🗑️ bloqueada em toda a categoria)*' : '🟢 **LIBERADA**'}\n` +
            `**Canais Restritos Individualmente nesta Categoria:** \`${restrictedChildrenCount}\` de \`${childChannels.length}\`\n\n` +
            `**Canais da Categoria (${childChannels.length}):**\n` +
            (channelLines.length > 0 ? channelLines.join('\n').substring(0, 3300) : '*Esta categoria não possui canais.*')
        )
        .setFooter({ text: 'Você pode restringir toda a categoria de uma vez ou navegar nos canais para restringi-los individualmente.' });

    const rowActions = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`painel_del_togglecat_${categoryId}`)
            .setLabel(isCatRestricted ? 'Liberar Toda a Categoria' : 'Restringir Toda a Categoria')
            .setEmoji(isCatRestricted ? '🔓' : '🔒')
            .setStyle(isCatRestricted ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`painel_del_navchans_${categoryId}_0`)
            .setLabel(`Navegar nos Canais (${childChannels.length})`)
            .setEmoji('📂')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(childChannels.length === 0)
    );

    if (restrictedChildrenCount > 0) {
        rowActions.addComponents(
            new ButtonBuilder()
                .setCustomId(`painel_del_clearcat_${categoryId}`)
                .setLabel('Liberar Todos os Canais')
                .setEmoji('🧹')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    const rowBack = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('painel_del_home_0')
            .setLabel('Voltar às Categorias')
            .setEmoji('↩️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('painel_home')
            .setLabel('Painel Principal')
            .setEmoji('🏠')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [rowActions, rowBack] };
}

/**
 * Constrói a tela de navegação nos canais de uma categoria e controle individual de canal.
 */
function buildCategoryChannelsNavPayload(guild, server, categoryId, page = 0, selectedChannelId = null, statusNotice = null) {
    const isUncategorized = categoryId === 'uncategorized';
    const category = isUncategorized ? null : guild.channels.cache.get(categoryId);
    if (!isUncategorized && !category) {
        return buildDeleteCategoriesPayload(guild, server, 0, '❌ Categoria não encontrada.');
    }

    const categoryName = isUncategorized ? 'Canais Sem Categoria' : category.name;
    const childChannels = Array.from(
        guild.channels.cache
            .filter(c =>
                c.type !== ChannelType.GuildCategory &&
                !c.isThread?.() &&
                (isUncategorized ? !c.parentId : c.parentId === categoryId)
            )
            .sort((a, b) => a.rawPosition - b.rawPosition)
            .values()
    );

    const pageSize = 25;
    const totalPages = Math.max(1, Math.ceil(childChannels.length / pageSize));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const pageChannels = childChannels.slice(safePage * pageSize, (safePage + 1) * pageSize);

    const restrictedCats = new Set(server.deleteRestrictedCategories || []);
    const restrictedChans = new Set(server.deleteRestrictedChannels || []);
    const isCatRestricted = restrictedCats.has(categoryId);

    const selectedChannel = selectedChannelId ? guild.channels.cache.get(selectedChannelId) : null;
    const isSelectedChanRestricted = selectedChannel ? restrictedChans.has(selectedChannel.id) : false;

    const channelLines = pageChannels.map((ch, idx) => {
        const globalIdx = safePage * pageSize + idx + 1;
        const isRestr = restrictedChans.has(ch.id);
        const pointer = selectedChannel?.id === ch.id ? '➡️ ' : '';
        return `${pointer}**${globalIdx}.** <#${ch.id}> (\`#${ch.name}\`) — ${isRestr ? '🔒 **Restrito Individualmente**' : '🟢 Liberado'}`;
    });

    const embed = new EmbedBuilder()
        .setColor(selectedChannel ? (isSelectedChanRestricted ? '#e74c3c' : '#2ecc71') : '#3498db')
        .setTitle(`📂 | Canais de: ${categoryName}${totalPages > 1 ? ` • Pág. ${safePage + 1}/${totalPages}` : ''}`)
        .setDescription(
            (statusNotice ? `> ${statusNotice}\n\n` : '') +
            (isCatRestricted
                ? `⚠️ **Nota:** A categoria inteira **${categoryName}** está marcada como restrita. Mesmo assim, você pode configurar os canais individualmente abaixo.\n\n`
                : 'Selecione um canal no menu abaixo para **restringir ou liberar individualmente** a função de apagar mensagens do bot (`🗑️`).\n\n') +
            (selectedChannel
                ? `🎯 **Canal em Foco:** <#${selectedChannel.id}> (\`#${selectedChannel.name}\`)\n` +
                  `**Status Individual:** ${isSelectedChanRestricted ? '🔒 **RESTRITO** *(Reação 🗑️ bloqueada neste canal)*' : '🟢 **LIBERADO** *(Reação 🗑️ permitida neste canal)*'}\n\n`
                : '') +
            `**Lista de Canais (${childChannels.length}):**\n` +
            (channelLines.length > 0 ? channelLines.join('\n').substring(0, 3200) : '*Nenhum canal disponível.*')
        )
        .setFooter({ text: 'Selecione qualquer canal no menu abaixo para alterar seu status de restrição.' });

    const components = [];

    if (pageChannels.length > 0) {
        const options = pageChannels.map(ch => {
            const isRestr = restrictedChans.has(ch.id);
            return {
                label: `#${ch.name}`.substring(0, 100),
                description: isRestr ? '🔒 Restrito Individualmente (Clique para gerenciar)' : '🟢 Liberado (Clique para gerenciar)',
                value: ch.id,
                default: selectedChannel?.id === ch.id,
                emoji: isRestr ? '🔒' : '🟢'
            };
        });

        components.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`painel_del_pickchan_${categoryId}_${safePage}`)
                    .setPlaceholder('💬 Selecione um canal para restringir ou liberar...')
                    .addOptions(options)
            )
        );
    }

    if (selectedChannel) {
        const chanActionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`painel_del_togglechan_${categoryId}_${selectedChannel.id}_${safePage}`)
                .setLabel(isSelectedChanRestricted ? `Liberar #${selectedChannel.name}`.substring(0, 80) : `Restringir #${selectedChannel.name}`.substring(0, 80))
                .setEmoji(isSelectedChanRestricted ? '🔓' : '🔒')
                .setStyle(isSelectedChanRestricted ? ButtonStyle.Success : ButtonStyle.Danger)
        );
        components.push(chanActionRow);
    }

    const navRow = new ActionRowBuilder();
    if (totalPages > 1) {
        navRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`painel_del_navchans_${categoryId}_${safePage - 1}`)
                .setLabel('◀️ Pág. Ant.')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage <= 0),
            new ButtonBuilder()
                .setCustomId(`painel_del_navchans_${categoryId}_${safePage + 1}`)
                .setLabel('Próx. Pág. ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safePage >= totalPages - 1)
        );
    }

    navRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`painel_del_cat_${categoryId}`)
            .setLabel('Voltar à Categoria')
            .setEmoji('↩️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('painel_del_home_0')
            .setLabel('Categorias')
            .setEmoji('📁')
            .setStyle(ButtonStyle.Secondary)
    );
    components.push(navRow);

    return { embeds: [embed], components };
}

/**
 * Trata todas as interações (botões, menus de seleção e modais) do /painel.
 */
async function handlePainelInteraction(interaction, client) {
    if (!interaction.guild) return;

    const isAdm =
        interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator) ||
        client.owners?.includes(interaction.user.id);

    if (!isAdm) {
        return interaction.reply({
            content: '❌ Apenas **Administradores** do servidor podem utilizar o `/painel`.',
            flags: 64
        });
    }

    const customId = interaction.customId;
    if (customId === 'painel_del_noop') {
        return interaction.deferUpdate().catch(() => {});
    }

    const server = await getOrCreateServerConfig(client, interaction.guild.id);

    // ─── RETORNO AO PAINEL PRINCIPAL ───────────────────────────────────────────
    if (customId === 'painel_home') {
        const payload = buildMainPanelPayload(client, interaction.guild, server);
        return interaction.update(payload);
    }

    // ─── 1. CANAL DE PUNIÇÕES ──────────────────────────────────────────────────
    if (customId === 'painel_cfg_punicoes') {
        const embed = new EmbedBuilder()
            .setColor(color.blue || '#3498db')
            .setTitle('⚖️ | Configurar Canal de Punições')
            .setDescription(
                `O canal de punições recebe todos os registros de **Warns, Mutes, Kicks e Bans** aplicados pela equipe.\n\n` +
                `**Canal Atual:** ${formatChannelValue(interaction.guild, server.cPunicoes)}\n\n` +
                `Selecione o novo canal de texto no menu abaixo:`
            );

        const selectRow = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('painel_select_punicoes')
                .setPlaceholder('Selecione o canal de punições...')
                .setChannelTypes(ChannelType.GuildText)
        );

        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('painel_home').setLabel('Voltar ao Painel').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({ embeds: [embed], components: [selectRow, backRow] });
    }

    if (interaction.isChannelSelectMenu() && customId === 'painel_select_punicoes') {
        const channelId = interaction.values[0];
        server.cPunicoes = `<#${channelId}>`;
        await server.save();
        const payload = buildMainPanelPayload(client, interaction.guild, server, `✅ **Canal de Punições** alterado para <#${channelId}>!`);
        return interaction.update(payload);
    }

    // ─── 2. PREFIXO DO SERVIDOR ────────────────────────────────────────────────
    if (customId === 'painel_cfg_prefix') {
        const modal = new ModalBuilder()
            .setCustomId('painel_modal_prefix')
            .setTitle('Alterar Prefixo do Servidor');

        const prefixInput = new TextInputBuilder()
            .setCustomId('prefix_value')
            .setLabel('Novo Prefixo (Ex: g!, !, ?)')
            .setStyle(TextInputStyle.Short)
            .setValue(server.prefix || 'g!')
            .setMinLength(1)
            .setMaxLength(10)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(prefixInput));
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === 'painel_modal_prefix') {
        const newPrefix = interaction.fields.getTextInputValue('prefix_value').trim() || 'g!';
        server.prefix = newPrefix;
        await server.save();
        const payload = buildMainPanelPayload(client, interaction.guild, server, `✅ **Prefixo do servidor** atualizado para \`${newPrefix}\`!`);
        if (interaction.message) {
            return interaction.update(payload).catch(() => interaction.reply({ ...payload, flags: 64 }));
        }
        return interaction.reply({ ...payload, flags: 64 });
    }

    // ─── 3. CARGO DE MUTE ──────────────────────────────────────────────────────
    if (customId === 'painel_cfg_mute') {
        const embed = new EmbedBuilder()
            .setColor(color.blue || '#3498db')
            .setTitle('🔇 | Configurar Cargo de Mute')
            .setDescription(
                `O cargo de Mute é atribuído aos membros silenciados pelo comando \`/mute\` ou pelo **Sistema de Mute Automático**.\n\n` +
                `**Cargo Atual:** ${formatRoleValue(interaction.guild, server.cargoMute)}\n\n` +
                `Selecione um cargo existente no menu abaixo ou clique em **Criar Cargo "Mutado"** para que o bot crie e configure o cargo automaticamente:`
            );

        const selectRow = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('painel_select_mute')
                .setPlaceholder('Selecione o cargo de Mute...')
        );

        const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('painel_create_muterole')
                .setLabel('Criar Cargo "Mutado" Automaticamente')
                .setEmoji('➕')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('painel_home')
                .setLabel('Voltar ao Painel')
                .setEmoji('↩️')
                .setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({ embeds: [embed], components: [selectRow, btnRow] });
    }

    if (interaction.isRoleSelectMenu() && customId === 'painel_select_mute') {
        const roleId = interaction.values[0];
        server.cargoMute = `<@&${roleId}>`;
        await server.save();
        const payload = buildMainPanelPayload(client, interaction.guild, server, `✅ **Cargo de Mute** definido como <@&${roleId}>!`);
        return interaction.update(payload);
    }

    if (customId === 'painel_create_muterole') {
        await interaction.deferUpdate();
        try {
            let muterole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'mutado');
            if (!muterole) {
                muterole = await interaction.guild.roles.create({
                    name: 'Mutado',
                    color: '#3F0875',
                    permissions: [],
                    reason: 'Cargo de Mute criado automaticamente via /painel'
                });
            }

            // Configura permissões básicas nos canais de texto
            const channels = interaction.guild.channels.cache.filter(c => c.isTextBased?.() && c.permissionOverwrites);
            for (const ch of channels.values()) {
                await ch.permissionOverwrites.edit(muterole.id, {
                    SendMessages: false,
                    AddReactions: false,
                    SendMessagesInThreads: false,
                    Speak: false
                }).catch(() => {});
            }

            server.cargoMute = `<@&${muterole.id}>`;
            await server.save();

            const payload = buildMainPanelPayload(client, interaction.guild, server, `✅ Cargo <@&${muterole.id}> criado/configurado e definido como **Cargo de Mute**!`);
            return interaction.editReply(payload);
        } catch (err) {
            const payload = buildMainPanelPayload(client, interaction.guild, server, `❌ Erro ao criar cargo de Mute: ${err.message}`);
            return interaction.editReply(payload);
        }
    }

    // ─── 4. SISTEMA DE MUTE AUTOMÁTICO (WARNS) ─────────────────────────────────
    if (customId === 'painel_cfg_automute' || customId === 'painel_automute_toggle') {
        if (customId === 'painel_automute_toggle') {
            server.warnTag = server.warnTag === 'Ativado' ? 'Desativado' : 'Ativado';
            await server.save();
        }

        const isAtivado = server.warnTag === 'Ativado';
        const embed = new EmbedBuilder()
            .setColor(isAtivado ? '#2ecc71' : '#e74c3c')
            .setTitle('🚨 | Configuração do Sistema de Mute Automático')
            .setDescription(
                `O sistema de **Auto Silenciamento** aplica um mute automático (de 2 horas) quando um membro atinge o limite configurado de avisos (\`/warn\`).\n\n` +
                `• **Status Atual:** ${isAtivado ? '🟢 **Ativado**' : '🔴 **Desativado**'}\n` +
                `• **Limite de Warns para Mute:** \`${server.warnNumber || '3'} aviso(s)\`\n` +
                `• **Cargo de Mute Associado:** ${formatRoleValue(interaction.guild, server.cargoMute)}`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('painel_automute_toggle')
                .setLabel(isAtivado ? 'Desativar Sistema' : 'Ativar Sistema')
                .setEmoji(isAtivado ? '🔴' : '🟢')
                .setStyle(isAtivado ? ButtonStyle.Danger : ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('painel_automute_warns')
                .setLabel(`Alterar Limite (${server.warnNumber || '3'} Warns)`)
                .setEmoji('🔢')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('painel_home')
                .setLabel('Voltar ao Painel')
                .setEmoji('↩️')
                .setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({ embeds: [embed], components: [row] });
    }

    if (customId === 'painel_automute_warns') {
        const modal = new ModalBuilder()
            .setCustomId('painel_modal_warnnumber')
            .setTitle('Limite de Warns para Mute Automático');

        const numInput = new TextInputBuilder()
            .setCustomId('warn_number_value')
            .setLabel('Quantidade máxima de warns (apenas números)')
            .setStyle(TextInputStyle.Short)
            .setValue(String(server.warnNumber || '3'))
            .setPlaceholder('Ex: 3')
            .setMinLength(1)
            .setMaxLength(3)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(numInput));
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === 'painel_modal_warnnumber') {
        const rawNum = parseInt(interaction.fields.getTextInputValue('warn_number_value').trim(), 10);
        if (isNaN(rawNum) || rawNum < 1 || rawNum > 100) {
            return interaction.reply({ content: '❌ Informe um número válido entre 1 e 100.', flags: 64 });
        }
        server.warnNumber = String(rawNum);
        await server.save();
        const payload = buildMainPanelPayload(client, interaction.guild, server, `✅ **Limite de Warns** atualizado para \`${rawNum}\`!`);
        if (interaction.message) {
            return interaction.update(payload).catch(() => interaction.reply({ ...payload, flags: 64 }));
        }
        return interaction.reply({ ...payload, flags: 64 });
    }

    // ─── 5. CARGO DE MODERAÇÃO (STAFF) ─────────────────────────────────────────
    if (customId === 'painel_cfg_staff') {
        const embed = new EmbedBuilder()
            .setColor(color.blue || '#3498db')
            .setTitle('🛡️ | Configurar Cargo de Moderação (Staff)')
            .setDescription(
                `Membros com este cargo recebem permissões nos comandos de moderação (\`/warn\`, \`/clearwarn\`, \`/mute\`, \`/kick\`, \`/monitorar\`) e visualização nos canais de monitoramento.\n\n` +
                `**Cargo Atual:** ${formatRoleValue(interaction.guild, server.staffRole)}\n\n` +
                `Selecione o cargo de Moderação no menu abaixo:`
            );

        const selectRow = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
                .setCustomId('painel_select_staff')
                .setPlaceholder('Selecione o cargo de Moderação...')
        );

        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('painel_home').setLabel('Voltar ao Painel').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({ embeds: [embed], components: [selectRow, backRow] });
    }

    if (interaction.isRoleSelectMenu() && customId === 'painel_select_staff') {
        const roleId = interaction.values[0];
        server.staffRole = `<@&${roleId}>`;
        await server.save();
        const payload = buildMainPanelPayload(client, interaction.guild, server, `✅ **Cargo de Moderação** definido como <@&${roleId}>!`);
        return interaction.update(payload);
    }

    // ─── 6. CATEGORIA DE MONITORAMENTO ─────────────────────────────────────────
    if (customId === 'painel_cfg_monitor') {
        const embed = new EmbedBuilder()
            .setColor(color.blue || '#3498db')
            .setTitle('👁️ | Configurar Categoria de Monitoramento')
            .setDescription(
                `Define a categoria onde serão criados os canais privados de espelhamento quando a staff utilizar o comando \`/monitorar\`.\n\n` +
                `**Categoria Atual:** ${formatCategoryValue(interaction.guild, server.monitorCategory)}\n\n` +
                `Selecione a categoria desejada no menu abaixo:`
            );

        const selectRow = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('painel_select_monitor')
                .setPlaceholder('Selecione a categoria de monitoramento...')
                .setChannelTypes(ChannelType.GuildCategory)
        );

        const backRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('painel_home').setLabel('Voltar ao Painel').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({ embeds: [embed], components: [selectRow, backRow] });
    }

    if (interaction.isChannelSelectMenu() && customId === 'painel_select_monitor') {
        const categoryId = interaction.values[0];
        server.monitorCategory = categoryId;
        await server.save();
        const catObj = interaction.guild.channels.cache.get(categoryId);
        const payload = buildMainPanelPayload(
            client,
            interaction.guild,
            server,
            `✅ **Categoria de Monitoramento** alterada para 📁 **${catObj?.name || categoryId}**!`
        );
        return interaction.update(payload);
    }

    // ─── 7. RESTRIÇÕES DE DELEÇÃO DE MENSAGEM DO BOT (🗑️) ─────────────────────
    // 7.1 Lista de Categorias (Paginada)
    if (customId.startsWith('painel_del_home_')) {
        const page = parseInt(customId.replace('painel_del_home_', ''), 10) || 0;
        const payload = buildDeleteCategoriesPayload(interaction.guild, server, page);
        return interaction.update(payload);
    }

    // 7.2 Seleção de Categoria no Dropdown
    if (interaction.isStringSelectMenu() && customId.startsWith('painel_del_pickcat_')) {
        const categoryId = interaction.values[0];
        const payload = buildCategoryManagePayload(interaction.guild, server, categoryId);
        return interaction.update(payload);
    }

    // 7.3 Voltar para a Visão de uma Categoria Específica
    if (customId.startsWith('painel_del_cat_')) {
        const categoryId = customId.replace('painel_del_cat_', '');
        const payload = buildCategoryManagePayload(interaction.guild, server, categoryId);
        return interaction.update(payload);
    }

    // 7.4 Restringir / Liberar Toda a Categoria
    if (customId.startsWith('painel_del_togglecat_')) {
        const categoryId = customId.replace('painel_del_togglecat_', '');
        const idx = server.deleteRestrictedCategories.indexOf(categoryId);
        let notice = '';

        if (idx === -1) {
            server.deleteRestrictedCategories.push(categoryId);
            notice = '🔒 **Categoria inteira restringida!** A função de apagar mensagens do bot com 🗑️ foi desativada em todos os canais desta categoria.';
        } else {
            server.deleteRestrictedCategories.splice(idx, 1);
            notice = '🔓 **Categoria liberada!** A função de apagar mensagens do bot com 🗑️ voltou a funcionar (exceto em canais restritos individualmente).';
        }

        server.markModified('deleteRestrictedCategories');
        await server.save();

        const payload = buildCategoryManagePayload(interaction.guild, server, categoryId, notice);
        return interaction.update(payload);
    }

    // 7.5 Limpar todas as restrições individuais de canais de uma categoria
    if (customId.startsWith('painel_del_clearcat_')) {
        const categoryId = customId.replace('painel_del_clearcat_', '');
        const isUncategorized = categoryId === 'uncategorized';
        const childIds = new Set(
            interaction.guild.channels.cache
                .filter(c =>
                    c.type !== ChannelType.GuildCategory &&
                    !c.isThread?.() &&
                    (isUncategorized ? !c.parentId : c.parentId === categoryId)
                )
                .map(c => c.id)
        );

        server.deleteRestrictedChannels = (server.deleteRestrictedChannels || []).filter(id => !childIds.has(id));
        server.markModified('deleteRestrictedChannels');
        await server.save();

        const payload = buildCategoryManagePayload(
            interaction.guild,
            server,
            categoryId,
            '🧹 Todas as restrições individuais de canais desta categoria foram removidas!'
        );
        return interaction.update(payload);
    }

    // 7.6 Navegar nos Canais da Categoria
    if (customId.startsWith('painel_del_navchans_')) {
        const parts = customId.replace('painel_del_navchans_', '').split('_');
        const categoryId = parts[0];
        const page = parseInt(parts[1] || '0', 10) || 0;
        const payload = buildCategoryChannelsNavPayload(interaction.guild, server, categoryId, page);
        return interaction.update(payload);
    }

    // 7.7 Selecionar Canal Individualmente no Dropdown
    if (interaction.isStringSelectMenu() && customId.startsWith('painel_del_pickchan_')) {
        const parts = customId.replace('painel_del_pickchan_', '').split('_');
        const categoryId = parts[0];
        const page = parseInt(parts[1] || '0', 10) || 0;
        const selectedChannelId = interaction.values[0];

        const payload = buildCategoryChannelsNavPayload(
            interaction.guild,
            server,
            categoryId,
            page,
            selectedChannelId
        );
        return interaction.update(payload);
    }

    // 7.8 Restringir / Liberar Canal Individualmente
    if (customId.startsWith('painel_del_togglechan_')) {
        const parts = customId.replace('painel_del_togglechan_', '').split('_');
        const categoryId = parts[0];
        const channelId = parts[1];
        const page = parseInt(parts[2] || '0', 10) || 0;

        const idx = server.deleteRestrictedChannels.indexOf(channelId);
        let notice = '';

        if (idx === -1) {
            server.deleteRestrictedChannels.push(channelId);
            notice = `🔒 Canal <#${channelId}> **restringido individualmente**! A deleção via reação 🗑️ não funcionará nele.`;
        } else {
            server.deleteRestrictedChannels.splice(idx, 1);
            notice = `🔓 Canal <#${channelId}> **liberado individualmente**!`;
        }

        server.markModified('deleteRestrictedChannels');
        await server.save();

        const payload = buildCategoryChannelsNavPayload(
            interaction.guild,
            server,
            categoryId,
            page,
            channelId,
            notice
        );
        return interaction.update(payload);
    }
}

module.exports = class painel extends Command {
    constructor(client) {
        super(client, {
            name: 'painel',
            category: 'config',
            aliases: ['config', 'cfg'],
            description: 'Abre o painel interativo de configurações gerais e sistemas do servidor.',
            UserPermission: ['Administrator'],
            clientPermission: null,
            OnlyDevs: false,
            slash: true
        });

        this.data = new SlashCommandBuilder()
            .setName('painel')
            .setDescription('Abre o painel interativo de configurações gerais e sistemas do servidor.')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);
    }

    /**
     * Execução via Slash Command (/painel)
     */
    async execute(interaction) {
        const isAdm =
            interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator) ||
            this.client.owners?.includes(interaction.user.id);

        if (!isAdm) {
            return interaction.reply({
                content: '❌ Você precisa da permissão de **Administrador** para acessar o painel do servidor.',
                flags: 64
            });
        }

        const server = await getOrCreateServerConfig(this.client, interaction.guild.id);
        const payload = buildMainPanelPayload(this.client, interaction.guild, server);
        return interaction.reply({ ...payload, flags: 64 });
    }

    /**
     * Execução via Comando de Prefixo (g!painel)
     */
    async run({ message }) {
        const isAdm =
            message.member?.permissions?.has(PermissionsBitField.Flags.Administrator) ||
            this.client.owners?.includes(message.author.id);

        if (!isAdm) {
            return message.reply('❌ Você precisa da permissão de **Administrador** para acessar o painel do servidor.');
        }

        const server = await getOrCreateServerConfig(this.client, message.guild.id);
        const payload = buildMainPanelPayload(this.client, message.guild, server);
        return message.reply(payload);
    }
};

module.exports.handlePainelInteraction = handlePainelInteraction;
