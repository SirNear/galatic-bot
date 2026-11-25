const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField
} = require('discord.js');
const Command = require('../../structures/Command');

function hasKickPermission(member, server, client) {
    if (!member) return false;
    if (client?.owners?.includes(member.id)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.KickMembers)) return true;

    const staffRoleId = String(server?.staffRole || '').replace(/[<@&>]/g, '').trim();
    if (staffRoleId && member.roles.cache.has(staffRoleId)) return true;
    return false;
}

module.exports = class kick extends Command {
    constructor(client) {
        super(client, {
            name: 'kick',
            category: 'moderation',
            aliases: ['kickar', 'chutar', 'k'],
            description: 'Expulsa um usuário do servidor e registra no canal de punições.',
            UserPermission: ['KickMembers'],
            clientPermission: null,
            OnlyDevs: false,
            slash: true
        });

        this.data = new SlashCommandBuilder()
            .setName('kick')
            .setDescription('Expulsa um usuário do servidor e envia DM com o motivo.')
            .addUserOption(option =>
                option
                    .setName('usuario')
                    .setDescription('Membro que será expulso.')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('motivo')
                    .setDescription('Motivo da expulsão.')
                    .setRequired(false)
            )
            .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers);
    }

    async execute(interaction) {
        const server = await this.client.database.Guilds.findById(interaction.guild.id)
            || new this.client.database.Guilds({ _id: interaction.guild.id });

        if (!hasKickPermission(interaction.member, server, this.client)) {
            return interaction.reply({ content: '❌ Você não tem permissão para expulsar membros.', flags: 64 });
        }

        const targetUser = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('motivo')?.trim() || 'Sem motivo informado';
        const infrator = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!infrator) {
            return interaction.reply({ content: '❌ Membro não encontrado neste servidor.', flags: 64 });
        }

        await interaction.deferReply();
        return this.applyKick({
            context: interaction,
            isInteraction: true,
            guild: interaction.guild,
            author: interaction.user,
            authorMember: interaction.member,
            infrator,
            reason,
            server
        });
    }

    async run({ message, args, server }) {
        if (!hasKickPermission(message.member, server, this.client)) {
            return message.reply('❌ Você não tem permissão para expulsar membros.');
        }

        const infrator = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        if (!infrator) {
            return message.reply(`❌ Mencione ou informe o ID do usuário. Uso: \`${server?.prefix || 'g!'}kick @usuario [motivo]\` ou \`/kick\`.`);
        }

        const reason = args.slice(1).join(' ').trim() || 'Sem motivo informado';

        return this.applyKick({
            context: message,
            isInteraction: false,
            guild: message.guild,
            author: message.author,
            authorMember: message.member,
            infrator,
            reason,
            server
        });
    }

    async applyKick({ context, isInteraction, guild, author, authorMember, infrator, reason, server }) {
        const respond = async (payload) => {
            if (isInteraction) return context.editReply(payload);
            return context.reply(payload);
        };

        if (infrator.id === author.id) {
            return respond({ content: '❌ Você não pode expulsar a si mesmo.' });
        }

        if (authorMember.roles.highest.rawPosition <= infrator.roles.highest.rawPosition && guild.ownerId !== author.id) {
            return respond({ content: '❌ Você não pode expulsar um membro com cargo igual ou superior ao seu.' });
        }

        if (!infrator.kickable) {
            return respond({ content: '❌ Não consigo expulsar este usuário (meu cargo é inferior ao dele ou ele é o dono do servidor).' });
        }

        const embedDm = new EmbedBuilder()
            .setTitle('🥾 | Punição: Expulsão (Kick) — Galatic Bot')
            .setColor('#e67e22')
            .setThumbnail('https://i.pinimg.com/originals/a1/1f/a3/a11fa3cdbfd567f934b6c0151c6a6d8b.gif')
            .setDescription(`Você foi **expulso** do servidor **${guild.name}**.\n\n**Staff:** ${author.tag}\n**Motivo:** ${reason}`)
            .setFooter({ text: 'Galatic Bot • Punições' })
            .setTimestamp();

        const embedLog = new EmbedBuilder()
            .setTitle('🥾 | Punição: Kick — Galatic Bot')
            .setColor('#e67e22')
            .setThumbnail(infrator.user.displayAvatarURL())
            .addFields(
                { name: '👤 Usuário Punido', value: `${infrator.user.tag} (\`${infrator.id}\`)`, inline: true },
                { name: '👮 Staff', value: `${author.tag} (\`${author.id}\`)`, inline: true },
                { name: '📑 Motivo', value: reason, inline: false }
            )
            .setFooter({ text: 'Galatic Bot • Punições' })
            .setTimestamp();

        await infrator.send({ embeds: [embedDm] }).catch(() => {});
        await infrator.kick(reason);

        const punicoesChannelId = String(server?.cPunicoes || '').replace(/[<#>]/g, '').trim();
        const punishChannel = guild.channels.cache.get(punicoesChannelId);
        if (punishChannel) {
            await punishChannel.send({ embeds: [embedLog] }).catch(() => {});
        }

        return respond({ content: `✅ **${infrator.user.tag}** foi expulso do servidor com sucesso!` });
    }
};
