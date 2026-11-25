const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField
} = require('discord.js');
const Command = require('../../structures/Command');
const color = require('../../api/colors.json');
const mongoose = require('mongoose');
const moment = require('moment');
const ms = require('ms');
moment.locale('pt-br');

function hasModPermission(member, server, client) {
    if (!member) return false;
    if (client?.owners?.includes(member.id)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return true;

    const staffRoleId = String(server?.staffRole || '').replace(/[<@&>]/g, '').trim();
    if (staffRoleId && member.roles.cache.has(staffRoleId)) return true;
    return false;
}

module.exports = class warn extends Command {
    constructor(client) {
        super(client, {
            name: 'warn',
            category: 'moderation',
            aliases: ['aviso', 'avisar', 'w'],
            description: 'Aplica um aviso oficial a um membro com notificação via DM e suporte a mute automático.',
            UserPermission: ['ModerateMembers'],
            clientPermission: null,
            OnlyDevs: false,
            slash: true
        });

        this.data = new SlashCommandBuilder()
            .setName('warn')
            .setDescription('Aplica um aviso oficial a um membro com notificação via DM.')
            .addUserOption(option =>
                option
                    .setName('usuario')
                    .setDescription('Membro que receberá o aviso.')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('motivo')
                    .setDescription('Motivo detalhado do aviso.')
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers);
    }

    async execute(interaction) {
        const server = await this.client.database.Guilds.findById(interaction.guild.id)
            || new this.client.database.Guilds({ _id: interaction.guild.id });

        if (!hasModPermission(interaction.member, server, this.client)) {
            return interaction.reply({ content: '❌ Você não tem permissão para aplicar avisos.', flags: 64 });
        }

        const targetUser = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('motivo').trim();
        const wUser = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!wUser) {
            return interaction.reply({ content: '❌ Membro não encontrado neste servidor.', flags: 64 });
        }

        await interaction.deferReply();
        return this.applyWarn({
            context: interaction,
            isInteraction: true,
            guild: interaction.guild,
            channel: interaction.channel,
            author: interaction.user,
            authorMember: interaction.member,
            wUser,
            reason,
            server
        });
    }

    async run({ message, args, server }) {
        if (!hasModPermission(message.member, server, this.client)) {
            return message.reply('❌ Você não tem permissão para aplicar avisos.');
        }

        if (!args[0] || ['help', 'ajuda'].includes(args[0].toLowerCase())) {
            const embedH = new EmbedBuilder()
                .setTitle('⚠️ | Ajuda: Comando Warn')
                .setDescription(`Utilize \`/warn usuario:@membro motivo:...\` ou \`${server?.prefix || 'g!'}warn @usuario <motivo>\`.`)
                .setColor('#FFFF00');
            return message.reply({ embeds: [embedH] });
        }

        const wUser = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        if (!wUser) return message.reply('❌ Usuário não encontrado no servidor.');

        const reason = args.slice(1).join(' ').trim();
        if (!reason) return message.reply('❌ Você precisa informar um motivo para o aviso.');

        return this.applyWarn({
            context: message,
            isInteraction: false,
            guild: message.guild,
            channel: message.channel,
            author: message.author,
            authorMember: message.member,
            wUser,
            reason,
            server
        });
    }

    async applyWarn({ context, isInteraction, guild, channel, author, authorMember, wUser, reason, server }) {
        const respond = async (payload) => {
            if (isInteraction) return context.editReply(payload);
            return context.reply(payload);
        };

        if (wUser.id === author.id) {
            return respond({ content: '❌ Você não pode aplicar um aviso em si mesmo.' });
        }

        const punicoesChannelId = String(server?.cPunicoes || '').replace(/[<#>]/g, '').trim();
        const warnChannel = guild.channels.cache.get(punicoesChannelId);
        if (!warnChannel) {
            return respond({
                content: `❌ O canal de punições (${server?.cPunicoes || 'Não definido'}) não foi encontrado. Configure um canal válido através do comando \`/painel\`.`
            });
        }

        const previousWarns = await this.client.database.Punish.countDocuments({
            uid: wUser.id,
            servidor: guild.id,
            punicao: 'aviso'
        });
        const currentWarnCount = previousWarns + 1;

        const newWarn = new this.client.database.Punish({
            _id: new mongoose.Types.ObjectId().toString(),
            usuario: wUser.displayName,
            uid: wUser.id,
            motivo: reason,
            staff: author.username,
            staffid: author.id,
            servidor: guild.id,
            punicao: 'aviso',
            warnNumber: String(currentWarnCount),
            data: moment.utc().format('LLLL')
        });
        await newWarn.save();

        const warnEmbed = new EmbedBuilder()
            .setTitle(`⚠️ | Punição: Aviso — ${guild.name}`)
            .setColor(color.moderation || '#e67e22')
            .setThumbnail(wUser.user.displayAvatarURL())
            .addFields(
                { name: '👤 Usuário Avisado', value: `${wUser} (\`${wUser.id}\`)`, inline: true },
                { name: '👮 Aplicado por', value: `${author} (\`${author.id}\`)`, inline: true },
                { name: '📍 Canal', value: `${channel}`, inline: true },
                { name: '🔢 Total de Avisos', value: `\`${currentWarnCount}\` aviso(s)`, inline: true },
                { name: '📑 Motivo', value: reason, inline: false }
            )
            .setFooter({ text: `ID do Usuário: ${wUser.id}` })
            .setTimestamp();

        await warnChannel.send({ embeds: [warnEmbed] }).catch(() => {});
        await wUser.send({ embeds: [warnEmbed] }).catch(() => {});

        let autoMuteNotice = '';

        // Verifica Sistema de Mute Automático configurado no /painel
        const maxWarns = parseInt(server?.warnNumber || '3', 10) || 3;
        if (server?.warnTag === 'Ativado' && currentWarnCount >= maxWarns) {
            const autoMutePunish = new this.client.database.Punish({
                _id: new mongoose.Types.ObjectId().toString(),
                usuario: wUser.displayName,
                uid: wUser.id,
                motivo: `Excedeu o limite de ${maxWarns} avisos`,
                staff: 'AutoMute (Galatic Bot)',
                staffid: this.client.user.id,
                servidor: guild.id,
                punicao: 'silenciamento',
                data: moment.utc().format('LLLL')
            });
            await autoMutePunish.save();

            const muteRoleId = String(server?.cargoMute || '').replace(/[<@&>]/g, '').trim();
            let muterole = guild.roles.cache.get(muteRoleId) || guild.roles.cache.find(r => r.name.toLowerCase() === 'mutado');

            if (!muterole) {
                muterole = await guild.roles.create({
                    name: 'Mutado',
                    color: '#070a0f',
                    permissions: [],
                    reason: 'Auto-Mute por limite de warns'
                }).catch(() => null);
            }

            if (muterole) {
                await wUser.roles.add(muterole.id).catch(() => {});
                autoMuteNotice = `\n🔇 **Mute Automático:** ${wUser} atingiu \`${currentWarnCount}/${maxWarns}\` avisos e foi silenciado automaticamente por **2 horas**!`;

                setTimeout(async () => {
                    await wUser.roles.remove(muterole.id).catch(() => {});
                }, ms('2h'));
            }
        }

        return respond({
            content: `✅ **${wUser} foi avisado com sucesso!** (Aviso \`#${currentWarnCount}\` registrado em ${warnChannel}).${autoMuteNotice}`
        });
    }
};
