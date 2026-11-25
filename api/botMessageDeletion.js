const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField
} = require('discord.js');
const config = require('../config.json');

// Canais de log oficiais: Servidor da ADM (bot-log) e Servidor de Testes
const ADM_BOT_LOG_CHANNEL_ID = '1409063037905670154';
const TEST_SERVER_LOG_CHANNEL_ID = config.logChannelId || '1423848686391394454';

// Canais de sistema estritamente protegidos onde nenhuma mensagem deve ser apagada via 🗑️
const PROTECTED_SYSTEM_CHANNELS = new Set([
    '1502919510787887104', // Fila de Upgrades
    '1502919601107763252', // Avaliação de Upgrades (Staff)
    '1510784621904793740', // Painéis de Monitoramento (Cron, IA, DB)
    '1409063037905670154', // Bot-log ADM
    '1423848686391394454', // Log Servidor de Testes
    '1510784425275822120', // Log detalhado de IA
]);

// Prefixos de customId de componentes que identificam mensagens importantes/permanentes de sistemas
const PROTECTED_COMPONENT_PREFIXES = [
    'lore_read_',
    'lore_manage_',
    'upgrade_queue_open_',
    'upgrade_adm_avaliar_',
    'categoria_',
    'buy_item_',
    'prev_item_',
    'next_item_',
    'approve_loja_',
    'reject_loja_',
    'approve_quest_',
    'reject_quest_',
    'quest_join_',
    'quest_leave_',
    'quest_conclude_',
    'quest_cancel_',
    'cron_',
    'db_',
    'ai_log_',
    'genesis_',
    'botmsg_del_'
];

// Mapa em memória para evitar múltiplos prompts simultâneos na mesma mensagem
const pendingConfirmations = new Map();

/**
 * Obtém o ID do canal e o ID da categoria (incluindo suporte a tópicos/fóruns).
 */
function resolveChannelAndCategoryIds(channel) {
    if (!channel) return { channelId: null, parentChannelId: null, categoryId: null };

    if (typeof channel.isThread === 'function' && channel.isThread()) {
        return {
            channelId: channel.id,
            parentChannelId: channel.parentId || null,
            categoryId: channel.parent?.parentId || null
        };
    }

    return {
        channelId: channel.id,
        parentChannelId: null,
        categoryId: channel.parentId || null
    };
}

/**
 * Verifica se o canal ou a categoria atual está restrito(a) nas configurações do /painel.
 */
async function isChannelOrCategoryRestricted(client, message, serverDoc = null) {
    if (!message?.guild || !message?.channel) return false;

    const server = serverDoc || await client.database?.Guilds?.findById(message.guild.id).lean().catch(() => null);
    if (!server) return false;

    const { channelId, parentChannelId, categoryId } = resolveChannelAndCategoryIds(message.channel);

    const restrictedCategories = Array.isArray(server.deleteRestrictedCategories) ? server.deleteRestrictedCategories : [];
    const restrictedChannels = Array.isArray(server.deleteRestrictedChannels) ? server.deleteRestrictedChannels : [];

    if (categoryId && restrictedCategories.includes(categoryId)) {
        return true;
    }

    if (channelId && restrictedChannels.includes(channelId)) {
        return true;
    }

    if (parentChannelId && restrictedChannels.includes(parentChannelId)) {
        return true;
    }

    return false;
}

/**
 * Verifica se uma mensagem do bot faz parte de uma estrutura importante/permanente de sistema
 * (ex: mensagem principal de /lore, fila/avaliação de /upgrade, vitrine/aprovação de /loja,
 * quadro de /quest, painéis de monitoramento, reaction roles, embeds fixos, backups ou logs).
 */
async function isProtectedSystemMessage(client, message, serverDoc = null) {
    if (!message) return true;

    const channelId = message.channel?.id;
    const parentChannelId = message.channel?.parentId;

    // 1. Verifica canais de sistema protegidos
    if (PROTECTED_SYSTEM_CHANNELS.has(channelId) || (parentChannelId && PROTECTED_SYSTEM_CHANNELS.has(parentChannelId))) {
        return { protected: true, reason: 'Canal de sistema protegido (Fila, Logs ou Painéis).' };
    }

    if (process.env.BACKUP_CHANNEL_ID && (channelId === process.env.BACKUP_CHANNEL_ID || parentChannelId === process.env.BACKUP_CHANNEL_ID)) {
        return { protected: true, reason: 'Canal de backups do sistema.' };
    }

    const server = serverDoc || await client.database?.Guilds?.findById(message.guild?.id).lean().catch(() => null);
    if (server?.cPunicoes) {
        const punicoesChannelId = String(server.cPunicoes).replace(/[<#>]/g, '').trim();
        if (punicoesChannelId && channelId === punicoesChannelId) {
            return { protected: true, reason: 'Canal oficial de registro de punições.' };
        }
    }

    // 2. Verifica componentes interativos da mensagem (botões e menus de sistemas importantes)
    if (Array.isArray(message.components) && message.components.length > 0) {
        for (const row of message.components) {
            const rowComponents = row.components || [];
            for (const comp of rowComponents) {
                const cid = comp.customId || comp.data?.custom_id || '';
                if (!cid) continue;

                for (const prefix of PROTECTED_COMPONENT_PREFIXES) {
                    if (cid.startsWith(prefix)) {
                        return {
                            protected: true,
                            reason: 'Mensagem principal ou painel permanente de sistema (/lore, /upgrade, /loja, /quest ou painel).'
                        };
                    }
                }
            }
        }
    }

    // 3. Verifica títulos/rodapés de embeds de painéis fixos e filas
    if (Array.isArray(message.embeds) && message.embeds.length > 0) {
        for (const emb of message.embeds) {
            const title = (emb.title || '').toLowerCase();
            const footer = (emb.footer?.text || '').toLowerCase();

            if (
                title.includes('painel de monitoramento cron') ||
                title.includes('monitoramento do banco de dados') ||
                title.includes('painel de monitoramento de ia') ||
                footer.includes('fila de notas') ||
                footer.includes('fila de avaliação')
            ) {
                return { protected: true, reason: 'Painel de monitoramento ou fila oficial de avaliação.' };
            }
        }
    }

    // 4. Consulta o banco de dados para garantir que não é uma mensagem principal registrada
    const db = client.database;
    if (db) {
        try {
            const msgId = message.id;
            const [
                isLoreMain,
                isUpgradeQueue,
                isLojaMain,
                isQuestMain,
                isPendingQuest,
                isFixedEmbed,
                isReactionRole,
                isPanelConfig,
                isAiPanel
            ] = await Promise.all([
                db.Lore?.exists({ messageId: msgId }).catch(() => null),
                db.UpgradeModel?.exists({ $or: [{ filaMessageId: msgId }, { pendenteMessageId: msgId }] }).catch(() => null),
                db.LojaModel?.exists({ messageId: msgId }).catch(() => null),
                db.Quest?.exists({ messageId: msgId }).catch(() => null),
                db.PendingQuest?.exists({ approvalMessageId: msgId }).catch(() => null),
                db.EmbedModel?.exists({ messageId: msgId }).catch(() => null),
                db.ReactionRoles?.exists({ messageId: msgId }).catch(() => null),
                db.PanelConfig?.exists({ messageId: msgId }).catch(() => null),
                db.AiUsage?.exists({ panelMessageId: msgId }).catch(() => null)
            ]);

            if (isLoreMain) return { protected: true, reason: 'Mensagem principal eterna de uma Lore (/lore).' };
            if (isUpgradeQueue) return { protected: true, reason: 'Mensagem oficial da fila/avaliação de Upgrades (/upgrade).' };
            if (isLojaMain) return { protected: true, reason: 'Vitrine principal de uma Loja (/loja).' };
            if (isQuestMain || isPendingQuest) return { protected: true, reason: 'Quadro oficial ou solicitação de Quest (/quest).' };
            if (isFixedEmbed) return { protected: true, reason: 'Mensagem de Embed permanente (/embed).' };
            if (isReactionRole) return { protected: true, reason: 'Painel de cargos por reação (/reactionrole).' };
            if (isPanelConfig || isAiPanel) return { protected: true, reason: 'Painel de monitoramento administrativo do bot.' };
        } catch (err) {
            console.warn('[BOT-MSG-DEL] Aviso ao verificar proteção no banco:', err.message);
        }
    }

    return { protected: false, reason: null };
}

/**
 * Extrai um resumo legível do conteúdo da mensagem do bot antes de ser apagada para registro no log.
 */
function summarizeBotMessage(message) {
    const parts = [];

    if (message.content && message.content.trim()) {
        parts.push(`**Texto:** ${message.content.trim().substring(0, 600)}`);
    }

    if (Array.isArray(message.embeds) && message.embeds.length > 0) {
        const embSummaries = message.embeds.map((e, i) => {
            const t = e.title ? `[Título: ${e.title}]` : `[Embed #${i + 1}]`;
            const d = e.description ? e.description.replace(/\s+/g, ' ').trim().substring(0, 250) : 'Sem descrição';
            return `${t} ${d}`;
        });
        parts.push(`**Embed(s):** ${embSummaries.join(' | ').substring(0, 600)}`);
    }

    if (message.attachments && message.attachments.size > 0) {
        const attNames = Array.from(message.attachments.values()).map(a => a.name || 'anexo').join(', ');
        parts.push(`**Anexos (${message.attachments.size}):** ${attNames.substring(0, 200)}`);
    }

    return parts.length > 0 ? parts.join('\n').substring(0, 1024) : '*Mensagem sem conteúdo textual (apenas componentes/mídia)*';
}

/**
 * Envia o log da exclusão para o servidor de testes E para o bot-log do servidor da administração.
 */
async function sendBotMessageDeletionLog(client, { executor, guild, channel, messageId, messageSummary, messageCreatedAt }) {
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const createdTimestamp = messageCreatedAt ? Math.floor(new Date(messageCreatedAt).getTime() / 1000) : null;

    const logEmbed = new EmbedBuilder()
        .setTitle('🗑️ Mensagem do Bot Apagada via Reação')
        .setColor('#e67e22')
        .setAuthor({
            name: `${executor.tag} (${executor.id})`,
            iconURL: executor.displayAvatarURL()
        })
        .setDescription(
            `Uma mensagem do bot foi apagada manualmente após reação com 🗑️ e confirmação do usuário.`
        )
        .addFields(
            {
                name: '👤 Executor',
                value: `<@${executor.id}> (\`${executor.tag}\` | ID: \`${executor.id}\`)`,
                inline: true
            },
            {
                name: '📍 Canal & Servidor',
                value: `<#${channel.id}> (\`#${channel.name || channel.id}\`)\nServidor: **${guild.name}** (\`${guild.id}\`)`,
                inline: true
            },
            {
                name: '🆔 Dados da Mensagem',
                value: `ID: \`${messageId}\`\nEnviada em: ${createdTimestamp ? `<t:${createdTimestamp}:f>` : 'Desconhecido'}\nApagada em: <t:${nowTimestamp}:f>`,
                inline: false
            },
            {
                name: '📄 Conteúdo da Mensagem Apagada',
                value: messageSummary,
                inline: false
            }
        )
        .setFooter({ text: 'Sistema de Limpeza de Mensagens do Bot • Galatic Bot' })
        .setTimestamp();

    console.log(`[BOT-MSG-DELETE] Mensagem ${messageId} do bot apagada por ${executor.tag} (${executor.id}) no canal #${channel.name} (${channel.id}) [Servidor: ${guild.name}].`);

    // Envia para ambos os canais de log (Servidor da ADM + Servidor de Testes) sem duplicar se forem o mesmo ID
    const targetLogChannels = [...new Set([ADM_BOT_LOG_CHANNEL_ID, TEST_SERVER_LOG_CHANNEL_ID].filter(Boolean))];

    for (const logChanId of targetLogChannels) {
        try {
            const logChannel = client.channels.cache.get(logChanId) || await client.channels.fetch(logChanId).catch(() => null);
            if (logChannel && logChannel.isTextBased()) {
                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        } catch (err) {
            console.warn(`[BOT-MSG-DELETE] Não foi possível enviar log ao canal ${logChanId}:`, err.message);
        }
    }
}

/**
 * Trata o evento de reação 🗑️ adicionada em uma mensagem do bot.
 */
async function handleBotMessageTrashReaction(client, reaction, user) {
    try {
        if (!user || user.bot) return false;

        const emojiName = reaction.emoji?.name;
        if (emojiName !== '🗑️' && emojiName !== '🗑') return false;

        if (reaction.partial) {
            const fetchedReaction = await reaction.fetch().catch(() => null);
            if (!fetchedReaction) return false;
        }

        let message = reaction.message;
        if (!message) return false;
        if (message.partial) {
            message = await message.fetch().catch(() => null);
            if (!message) return false;
        }

        if (!message.guild || !message.channel) return false;

        // Só atua se a mensagem reagida pertencer ao próprio bot
        if (!message.author || message.author.id !== client.user?.id) return false;

        // Ignora se a mensagem reagida for o próprio aviso de confirmação de deleção
        const isSelfPrompt = message.components?.some(row =>
            (row.components || []).some(c => (c.customId || c.data?.custom_id || '').startsWith('botmsg_del_'))
        );
        if (isSelfPrompt) return false;

        // Remove a reação 🗑️ do usuário para manter a mensagem limpa
        await reaction.users.remove(user.id).catch(() => {});

        const serverDoc = await client.database?.Guilds?.findById(message.guild.id).lean().catch(() => null);

        // 1. Verifica se a categoria ou canal foi restringido no /painel
        const isRestricted = await isChannelOrCategoryRestricted(client, message, serverDoc);
        if (isRestricted) {
            return true;
        }

        // 2. Verifica se é uma mensagem importante de sistema (/lore, /upgrade, /loja, /quest, painéis, etc.)
        const protection = await isProtectedSystemMessage(client, message, serverDoc);
        if (protection.protected) {
            return true;
        }

        // Evita abrir múltiplos avisos para a mesma mensagem
        if (pendingConfirmations.has(message.id)) {
            return true;
        }

        // Envia prompt compacto para acionar a confirmação efêmera
        const rowConfirm = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`botmsg_del_confirm_${message.id}_${user.id}`)
                .setLabel('Apagar Mensagem')
                .setEmoji('🗑️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`botmsg_del_cancel_${message.id}_${user.id}`)
                .setLabel('Cancelar')
                .setEmoji('✖️')
                .setStyle(ButtonStyle.Secondary)
        );

        const promptMsg = await message.channel.send({
            content: `🗑️ <@${user.id}>, você reagiu para apagar uma mensagem do bot. Clique abaixo para confirmar:`,
            components: [rowConfirm],
            reply: { messageReference: message.id, failIfNotExists: false }
        }).catch(() => null);

        if (!promptMsg) return true;

        const timeoutId = setTimeout(async () => {
            pendingConfirmations.delete(message.id);
            await promptMsg.delete().catch(() => {});
        }, 30000);

        pendingConfirmations.set(message.id, {
            promptMessageId: promptMsg.id,
            requesterId: user.id,
            timeoutId
        });

        return true;
    } catch (error) {
        console.error('[BOT-MSG-DELETE] Erro ao processar reação 🗑️:', error);
        return false;
    }
}

/**
 * Trata o clique nos botões de confirmar/cancelar exclusão da mensagem do bot,
 * respondendo em mensagem efêmera (flags: 64).
 */
async function handleBotMessageDeleteInteraction(interaction, client) {
    const customId = interaction.customId;
    if (!customId.startsWith('botmsg_del_')) return;

    // Formato: botmsg_del_confirm_<targetMsgId>_<requesterId>
    const parts = customId.split('_');
    const action = parts[2]; // 'confirm' | 'cancel' | 'finalconfirm'
    const targetMsgId = parts[3];
    const requesterId = parts[4];

    const isOwnerOrAdmin =
        interaction.user.id === requesterId ||
        interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator) ||
        interaction.member?.permissions?.has(PermissionsBitField.Flags.ManageMessages) ||
        client.owners?.includes(interaction.user.id);

    if (!isOwnerOrAdmin) {
        return interaction.reply({
            content: '❌ Apenas o usuário que reagiu com 🗑️ (ou um moderador/administrador) pode interagir com esta confirmação.',
            flags: 64
        });
    }

    const pending = pendingConfirmations.get(targetMsgId);

    if (action === 'cancel') {
        if (pending) {
            clearTimeout(pending.timeoutId);
            pendingConfirmations.delete(targetMsgId);
        }
        await interaction.message?.delete().catch(() => {});
        return interaction.reply({
            content: '❌ Exclusão da mensagem do bot cancelada.',
            flags: 64
        });
    }

    // Se clicou no botão do chat, remove o prompt do chat e abre confirmação/executa em mensagem efêmera
    if (action === 'confirm') {
        if (pending) {
            clearTimeout(pending.timeoutId);
            pendingConfirmations.delete(targetMsgId);
        }

        // Remove a mensagem auxiliar do canal imediatamente para não poluir o chat
        await interaction.message?.delete().catch(() => {});

        const targetMessage = await interaction.channel?.messages.fetch(targetMsgId).catch(() => null);
        if (!targetMessage) {
            return interaction.reply({
                content: '⚠️ A mensagem do bot já foi apagada ou não pôde ser encontrada.',
                flags: 64
            });
        }

        // Revalida restrições e proteção de sistema por segurança
        const serverDoc = await client.database?.Guilds?.findById(interaction.guild.id).lean().catch(() => null);
        if (await isChannelOrCategoryRestricted(client, targetMessage, serverDoc)) {
            return interaction.reply({
                content: '🔒 A função de apagar mensagens do bot está restrita neste canal ou categoria.',
                flags: 64
            });
        }

        const protection = await isProtectedSystemMessage(client, targetMessage, serverDoc);
        if (protection.protected) {
            return interaction.reply({
                content: `🛡️ Esta mensagem pertence a uma parte importante de sistema e não pode ser apagada via reação.\n*Motivo:* ${protection.reason}`,
                flags: 64
            });
        }

        const summary = summarizeBotMessage(targetMessage);
        const createdAt = targetMessage.createdAt;

        try {
            await targetMessage.delete();
        } catch (delErr) {
            return interaction.reply({
                content: `❌ Não foi possível apagar a mensagem: ${delErr.message}`,
                flags: 64
            });
        }

        // Envia resposta efêmera ao jogador
        await interaction.reply({
            content: '✅ Mensagem do bot apagada com sucesso!',
            flags: 64
        });

        // Registra o log tanto no servidor de testes quanto no bot-log do servidor da adm
        await sendBotMessageDeletionLog(client, {
            executor: interaction.user,
            guild: interaction.guild,
            channel: interaction.channel,
            messageId: targetMsgId,
            messageSummary: summary,
            messageCreatedAt: createdAt
        });
    }
}

module.exports = {
    handleBotMessageTrashReaction,
    handleBotMessageDeleteInteraction,
    isProtectedSystemMessage,
    isChannelOrCategoryRestricted
};
