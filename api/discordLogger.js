const { EmbedBuilder, AuditLogEvent } = require('discord.js');

const LOG_CHANNEL_ID = "1409063037905670154";

async function sendLog(client, embed) {
    try {
        const channel = client.channels.cache.get(LOG_CHANNEL_ID) || await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (channel) {
            await channel.send({ embeds: [embed] });
        }
    } catch (e) {
        console.error("Erro ao enviar log para o bot-log:", e);
    }
}

async function fetchAuditLog(guild, type, targetId) {
    try {
        const logs = await guild.fetchAuditLogs({ type, limit: 10 });
        // Encontra a entrada que corresponde ao ID do alvo, ocorrida nos últimos 10 segundos
        const entry = logs.entries.find(e => e.targetId === targetId && (Date.now() - e.createdTimestamp < 10000));
        return entry || null;
    } catch (e) {
        return null;
    }
}

async function logChannelCreate(client, channel) {
    const embed = new EmbedBuilder()
        .setTitle('📁 Canal/Categoria Criado')
        .setColor('#2ecc71')
        .setDescription(`O canal **${channel.name}** (<#${channel.id}>) foi criado.`)
        .setTimestamp();

    if (channel.parent) embed.addFields({ name: "Categoria Pai", value: channel.parent.name, inline: true });

    const audit = await fetchAuditLog(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    if (audit) {
        embed.setAuthor({ name: audit.executor.tag, iconURL: audit.executor.displayAvatarURL() });
        embed.addFields({ name: "Autor", value: `<@${audit.executor.id}> (\`${audit.executor.id}\`) ${audit.executor.bot ? "🤖 (Bot)" : "👤 (Manual)"}`, inline: true });
    } else {
        embed.addFields({ name: "Autor", value: "Desconhecido / API Interna", inline: true });
    }

    await sendLog(client, embed);
}

async function logChannelDelete(client, channel) {
    const embed = new EmbedBuilder()
        .setTitle('🗑️ Canal/Categoria Deletado')
        .setColor('#e74c3c')
        .setDescription(`O canal **${channel.name}** (\`${channel.id}\`) foi deletado.`)
        .setTimestamp();

    const audit = await fetchAuditLog(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    if (audit) {
        embed.setAuthor({ name: audit.executor.tag, iconURL: audit.executor.displayAvatarURL() });
        embed.addFields({ name: "Autor", value: `<@${audit.executor.id}> (\`${audit.executor.id}\`) ${audit.executor.bot ? "🤖 (Bot)" : "👤 (Manual)"}`, inline: true });
    } else {
        embed.addFields({ name: "Autor", value: "Desconhecido / API Interna", inline: true });
    }

    await sendLog(client, embed);
}

async function logChannelUpdate(client, oldChannel, newChannel) {
    // Evita loop ou spam
    if (oldChannel.name === newChannel.name && oldChannel.position === newChannel.position && oldChannel.parentId === newChannel.parentId && oldChannel.topic === newChannel.topic && oldChannel.permissionOverwrites.cache.size === newChannel.permissionOverwrites.cache.size) return;

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Canal Atualizado')
        .setColor('#f1c40f')
        .setDescription(`O canal <#${newChannel.id}> (\`${newChannel.name}\`) sofreu alterações.`)
        .setTimestamp();

    let changes = [];
    if (oldChannel.name !== newChannel.name) changes.push(`**Nome:** \`${oldChannel.name}\` ➔ \`${newChannel.name}\``);
    if (oldChannel.position !== newChannel.position) changes.push(`**Posição (Ordem):** \`${oldChannel.position}\` ➔ \`${newChannel.position}\``);
    if (oldChannel.parentId !== newChannel.parentId) changes.push(`**Categoria Pai:** \`${oldChannel.parent?.name || 'Nenhuma'}\` ➔ \`${newChannel.parent?.name || 'Nenhuma'}\``);

    if (changes.length > 0) {
        embed.addFields({ name: "O que mudou", value: changes.join('\n') });
    } else {
        embed.addFields({ name: "O que mudou", value: "Permissões, Trancamentos ou Detalhes Menores." });
    }

    const audit = await fetchAuditLog(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id) || await fetchAuditLog(newChannel.guild, AuditLogEvent.ChannelOverwriteUpdate, newChannel.id);
    if (audit) {
        embed.setAuthor({ name: audit.executor.tag, iconURL: audit.executor.displayAvatarURL() });
        embed.addFields({ name: "Autor", value: `<@${audit.executor.id}> (\`${audit.executor.id}\`) ${audit.executor.bot ? "🤖 (Bot)" : "👤 (Manual)"}`, inline: false });
    } else {
        embed.addFields({ name: "Autor", value: "Desconhecido / API Interna", inline: false });
    }

    await sendLog(client, embed);
}

async function logThreadCreate(client, thread) {
    const embed = new EmbedBuilder()
        .setTitle('📝 Tópico/Post Criado')
        .setColor('#2ecc71')
        .setDescription(`Um novo tópico **${thread.name}** (<#${thread.id}>) foi criado em <#${thread.parentId}>.`)
        .setTimestamp();

    if (thread.ownerId) {
        embed.addFields({ name: "Autor do Post", value: `<@${thread.ownerId}>`, inline: true });
    }
    await sendLog(client, embed);
}

async function logThreadDelete(client, thread) {
    const embed = new EmbedBuilder()
        .setTitle('🗑️ Tópico/Post Deletado')
        .setColor('#e74c3c')
        .setDescription(`O tópico **${thread.name}** (\`${thread.id}\`) do canal <#${thread.parentId}> foi apagado.`)
        .setTimestamp();

    const audit = await fetchAuditLog(thread.guild, AuditLogEvent.ThreadDelete, thread.id);
    if (audit) {
        embed.setAuthor({ name: audit.executor.tag, iconURL: audit.executor.displayAvatarURL() });
        embed.addFields({ name: "Apagado por", value: `<@${audit.executor.id}> (\`${audit.executor.id}\`)`, inline: true });
    }
    await sendLog(client, embed);
}

async function logThreadUpdate(client, oldThread, newThread) {
    const changes = [];
    if (oldThread.name !== newThread.name) changes.push(`**Nome:** \`${oldThread.name}\` ➔ \`${newThread.name}\``);
    if (oldThread.locked !== newThread.locked) changes.push(`**Trancamento:** \`${oldThread.locked ? 'Trancado' : 'Aberto'}\` ➔ \`${newThread.locked ? 'Trancado' : 'Aberto'}\``);
    if (oldThread.archived !== newThread.archived) changes.push(`**Arquivamento:** \`${oldThread.archived ? 'Arquivado' : 'Ativo'}\` ➔ \`${newThread.archived ? 'Arquivado' : 'Ativo'}\``);

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Tópico/Post Atualizado')
        .setColor('#f1c40f')
        .setDescription(`O tópico <#${newThread.id}> (\`${newThread.name}\`) sofreu alterações.`)
        .addFields({ name: "Alterações", value: changes.join('\n') })
        .setTimestamp();

    const audit = await fetchAuditLog(newThread.guild, AuditLogEvent.ThreadUpdate, newThread.id);
    if (audit) {
        embed.setAuthor({ name: audit.executor.tag, iconURL: audit.executor.displayAvatarURL() });
        embed.addFields({ name: "Autor", value: `<@${audit.executor.id}> ${audit.executor.bot ? "🤖 (Auto)" : "👤 (Manual)"}`, inline: true });
    }
    await sendLog(client, embed);
}

async function logRoleUpdate(client, oldMember, newMember) {
    if (oldMember.roles.cache.size === newMember.roles.cache.size) return;

    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    const embed = new EmbedBuilder()
        .setTitle('🛡️ Atualização de Cargos')
        .setColor('#3498db')
        .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
        .setDescription(`Cargos alterados para o membro <@${newMember.id}> (\`${newMember.id}\`).`)
        .setTimestamp();

    if (addedRoles.size > 0) {
        embed.addFields({ name: "➕ Cargos Adicionados", value: addedRoles.map(r => `<@&${r.id}>`).join(', ') });
    }
    if (removedRoles.size > 0) {
        embed.addFields({ name: "➖ Cargos Removidos", value: removedRoles.map(r => `<@&${r.id}>`).join(', ') });
    }

    const audit = await fetchAuditLog(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
    if (audit) {
        embed.addFields({ name: "Autor da Mudança", value: `<@${audit.executor.id}> ${audit.executor.bot ? "🤖 (Bot)" : "👤 (Manual)"}` });
    }

    await sendLog(client, embed);
}

async function logMessageDelete(client, message) {
    if (message.partial) return;
    if (message.author?.bot) return;

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Mensagem Deletada')
        .setColor('#e74c3c')
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setDescription(`Uma mensagem de <@${message.author.id}> foi apagada no canal <#${message.channel.id}>.`)
        .addFields({ name: "Conteúdo Apagado", value: (message.content || 'Nenhum texto (Mídia/Embed)').substring(0, 1024) })
        .setTimestamp();

    await sendLog(client, embed);
}

async function logMessageEdit(client, oldMessage, newMessage) {
    if (oldMessage.partial || newMessage.partial) return;
    if (oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return; // Só loga se mudou o texto

    const embed = new EmbedBuilder()
        .setTitle('✏️ Mensagem Editada')
        .setColor('#f39c12')
        .setAuthor({ name: newMessage.author.tag, iconURL: newMessage.author.displayAvatarURL() })
        .setDescription(`Uma mensagem de <@${newMessage.author.id}> foi editada no canal <#${newMessage.channel.id}>. [Pular para mensagem](${newMessage.url})`)
        .addFields(
            { name: "Antes", value: (oldMessage.content || '*Vazio*').substring(0, 1024) },
            { name: "Depois", value: (newMessage.content || '*Vazio*').substring(0, 1024) }
        )
        .setTimestamp();

    await sendLog(client, embed);
}

async function logReactionEvent(client, reaction, user, isAdd) {
    if (user.bot) return;

    let emojiName = reaction.emoji.name;
    if (reaction.emoji.id) {
        emojiName = `<:${reaction.emoji.name}:${reaction.emoji.id}>`;
    }

    const embed = new EmbedBuilder()
        .setTitle(isAdd ? '😀 Reação Adicionada' : '😟 Reação Removida')
        .setColor(isAdd ? '#2ecc71' : '#e74c3c')
        .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
        .setDescription(`O usuário <@${user.id}> ${isAdd ? 'adicionou' : 'removeu'} a reação ${emojiName} em uma [mensagem](${reaction.message.url}) no canal <#${reaction.message.channel.id}>.`)
        .setTimestamp();

    await sendLog(client, embed);
}

module.exports = {
    logChannelCreate,
    logChannelDelete,
    logChannelUpdate,
    logThreadCreate,
    logThreadDelete,
    logThreadUpdate,
    logRoleUpdate,
    logMessageDelete,
    logMessageEdit,
    logReactionEvent
};
