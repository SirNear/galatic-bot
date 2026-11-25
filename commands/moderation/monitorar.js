const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionsBitField,
    ComponentType
} = require('discord.js');
const Command = require('../../structures/Command');

/**
 * Verifica se o membro executor possui permissão de moderação (Cargo Staff do /painel, ManageMessages ou Admin).
 */
function hasStaffPermission(member, server, client) {
    if (!member) return false;
    if (client?.owners?.includes(member.id)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return true;

    const staffRoleId = String(server?.staffRole || '').replace(/[<@&>]/g, '').trim();
    if (staffRoleId && member.roles.cache.has(staffRoleId)) return true;

    return false;
}

module.exports = class monitorar extends Command {
    constructor(client) {
        super(client, {
            name: 'monitorar',
            category: 'moderation',
            aliases: ['monitor', 'monitoramento', 'acompanhar', 'mnt'],
            description: 'Ativa ou desativa o espelhamento de mensagens de um membro em um canal privado da staff.',
            UserPermission: ['ManageMessages'],
            clientPermission: null,
            OnlyDevs: false,
            slash: true
        });

        this.data = new SlashCommandBuilder()
            .setName('monitorar')
            .setDescription('Ativa ou desativa o monitoramento de mensagens de um membro suspeito.')
            .addUserOption(option =>
                option
                    .setName('usuario')
                    .setDescription('Membro que você deseja monitorar ou encerrar o monitoramento.')
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages);
    }

    async execute(interaction) {
        const server = await this.client.database.Guilds.findById(interaction.guild.id)
            || new this.client.database.Guilds({ _id: interaction.guild.id });

        if (!hasStaffPermission(interaction.member, server, this.client)) {
            return interaction.reply({
                content: '❌ Você não possui permissão ou o Cargo de Moderação configurado no `/painel` para usar este comando.',
                flags: 64
            });
        }

        const targetUser = interaction.options.getUser('usuario');
        const monitored = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!monitored) {
            return interaction.reply({ content: '❌ Membro não encontrado neste servidor.', flags: 64 });
        }

        return this.handleMonitorFlow({
            context: interaction,
            isInteraction: true,
            guild: interaction.guild,
            author: interaction.user,
            monitored,
            server
        });
    }

    async run({ message, args, server }) {
        if (!hasStaffPermission(message.member, server, this.client)) {
            return message.reply('❌ Você não possui permissão ou o Cargo de Moderação configurado no `/painel` para usar este comando.');
        }

        const monitored = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        if (!monitored) {
            const embedH = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('👁️ | Ajuda: Sistema de Monitoramento')
                .setDescription(
                    `Utilize \`/monitorar usuario:@membro\` (ou \`${server?.prefix || 'g!'}monitorar @membro\`) para ativar ou desativar o monitoramento de mensagens de um usuário.\n\n` +
                    `• O bot criará um canal privado na **Categoria de Monitoramento** configurada no \`/painel\`.\n` +
                    `• Para encerrar um monitoramento ativo, execute o comando novamente selecionando o mesmo usuário.`
                )
                .setTimestamp();
            return message.reply({ embeds: [embedH] });
        }

        return this.handleMonitorFlow({
            context: message,
            isInteraction: false,
            guild: message.guild,
            author: message.author,
            monitored,
            server
        });
    }

    async handleMonitorFlow({ context, isInteraction, guild, author, monitored, server }) {
        const replyMsg = async (payload) => {
            if (isInteraction) {
                if (context.deferred || context.replied) return context.editReply(payload);
                return context.reply({ ...payload, flags: 64, fetchReply: true });
            }
            return context.reply(payload);
        };

        let userDb = await this.client.database.userData.findOne({ uid: monitored.id, uServer: guild.id });
        if (!userDb) {
            userDb = await this.client.database.userData.create({
                _id: `${monitored.id}-${guild.id}`,
                uid: monitored.id,
                uName: monitored.user.username,
                uServer: guild.id,
                monitor: 'desativado'
            });
        }

        // Caso já esteja monitorado -> oferecer desativação com botões v14
        if (userDb.monitor === 'ativado') {
            const antiMonitor = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle('👁️ | Este usuário já está sendo monitorado')
                .setDescription(
                    `O membro ${monitored} (\`${monitored.user.tag}\`) já possui um monitoramento ativo${userDb.monitorChannelId ? ` em <#${userDb.monitorChannelId}>` : ''}.\n\n` +
                    `Deseja **encerrar** o monitoramento e excluir o canal espelhado?`
                )
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('monitor_stop_yes').setLabel('Sim, encerrar monitoramento').setEmoji('✅').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('monitor_stop_no').setLabel('Manter ativo').setEmoji('✖️').setStyle(ButtonStyle.Secondary)
            );

            const sent = await replyMsg({ embeds: [antiMonitor], components: [row] });
            const collector = sent.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => i.user.id === author.id,
                time: 60000,
                max: 1
            });

            collector.on('collect', async i => {
                if (i.customId === 'monitor_stop_yes') {
                    if (userDb.monitorChannelId) {
                        const oldChan = guild.channels.cache.get(userDb.monitorChannelId) || await guild.channels.fetch(userDb.monitorChannelId).catch(() => null);
                        if (oldChan) await oldChan.delete('Monitoramento encerrado').catch(() => {});
                    }
                    userDb.monitor = 'desativado';
                    userDb.monitorChannelId = null;
                    await userDb.save();

                    await i.update({
                        content: `✅ **O monitoramento de ${monitored} foi encerrado com sucesso!**`,
                        embeds: [],
                        components: []
                    });
                } else {
                    await i.update({
                        content: '👁️ **Ação cancelada. O monitoramento continuará ativo.**',
                        embeds: [],
                        components: []
                    });
                }
            });

            return;
        }

        // Ativar novo monitoramento
        const categoryId = String(server?.monitorCategory || '').replace(/[<#>]/g, '').trim();
        const category = guild.channels.cache.find(c => c.id === categoryId && c.type === ChannelType.GuildCategory);

        if (!category) {
            return replyMsg({
                content: '❌ **Categoria de Monitoramento não configurada ou não encontrada!** Configure-a através do comando `/painel` (botão **👁️ Cat. Monitoramento**) e tente novamente.'
            });
        }

        const overwrites = [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
                id: this.client.user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks]
            }
        ];

        const staffRoleId = String(server?.staffRole || '').replace(/[<@&>]/g, '').trim();
        const staffRole = staffRoleId ? guild.roles.cache.get(staffRoleId) : null;
        if (staffRole) {
            overwrites.push({
                id: staffRole.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]
            });
        }

        const safeChanName = `monitor-${monitored.user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '') || monitored.id}`.substring(0, 90);
        const channel = await guild.channels.create({
            name: safeChanName,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `Monitoramento de mensagens de ${monitored.user.tag} (${monitored.id})`,
            permissionOverwrites: overwrites
        });

        if (!staffRole) {
            await channel.send('⚠️ **Nota:** O Cargo de Moderação não está definido no `/painel`, portanto este canal está visível apenas para Administradores.');
        }

        userDb.monitor = 'ativado';
        userDb.monitorChannelId = channel.id;
        await userDb.save();

        return replyMsg({
            content: `✅ **Monitoramento para \`${monitored.displayName}\` ativado com sucesso!**\nCanal espelhado: ${channel}`
        });
    }
};
