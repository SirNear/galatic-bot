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

module.exports = class mute extends Command {
    constructor(client) {
        super(client, {
            name: 'mute',
            category: 'moderation',
            aliases: ['silenciar', 'm'],
            description: 'Silencia um usuário temporariamente atribuindo o cargo de Mute configurado no /painel.',
            UserPermission: ['ModerateMembers'],
            clientPermission: null,
            OnlyDevs: false,
            slash: true
        });

        this.data = new SlashCommandBuilder()
            .setName('mute')
            .setDescription('Silencia um usuário temporariamente por desrespeito às regras.')
            .addUserOption(option =>
                option
                    .setName('usuario')
                    .setDescription('Membro que será silenciado.')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('tempo')
                    .setDescription('Duração do silenciamento (Ex: 10m, 1h, 2d).')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('motivo')
                    .setDescription('Motivo do silenciamento.')
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers);
    }

    async execute(interaction) {
        const server = await this.client.database.Guilds.findById(interaction.guild.id)
            || new this.client.database.Guilds({ _id: interaction.guild.id });

        if (!hasModPermission(interaction.member, server, this.client)) {
            return interaction.reply({ content: '❌ Você não tem permissão para silenciar membros.', flags: 64 });
        }

        const targetUser = interaction.options.getUser('usuario');
        const mutetime = interaction.options.getString('tempo').trim();
        const reason = interaction.options.getString('motivo').trim();
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: '❌ Usuário não encontrado neste servidor.', flags: 64 });
        }

        await interaction.deferReply();
        return this.applyMute({
            context: interaction,
            isInteraction: true,
            guild: interaction.guild,
            author: interaction.user,
            member,
            mutetime,
            reason,
            server
        });
    }

    async run({ message, args, server }) {
        if (!hasModPermission(message.member, server, this.client)) {
            return message.reply('❌ Você não tem permissão para silenciar membros.');
        }

        if (!args[0] || ['help', 'ajuda'].includes(args[0].toLowerCase())) {
            const embedH = new EmbedBuilder()
                .setTitle('🔇 | Ajuda: Comando Mute')
                .setDescription(`Utilize \`/mute usuario:@membro tempo:1h motivo:...\` ou \`${server?.prefix || 'g!'}mute <@usuario> <tempo> <motivo>\`.`)
                .setColor('#3498db');
            return message.reply({ embeds: [embedH] });
        }

        const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        if (!member) return message.reply('❌ Não encontrei esse usuário neste servidor.');

        const mutetime = args[1];
        const reason = args.slice(2).join(' ').trim();
        if (!mutetime || !reason) {
            return message.reply(`❌ Informe o tempo e o motivo! Ex: \`${server?.prefix || 'g!'}mute @usuario 30m Spam no chat\`.`);
        }

        return this.applyMute({
            context: message,
            isInteraction: false,
            guild: message.guild,
            author: message.author,
            member,
            mutetime,
            reason,
            server
        });
    }

    async applyMute({ context, isInteraction, guild, author, member, mutetime, reason, server }) {
        const respond = async (payload) => {
            if (isInteraction) return context.editReply(payload);
            return context.reply(payload);
        };

        const durationMs = ms(mutetime);
        if (!durationMs || durationMs < 5000) {
            return respond({ content: '❌ Tempo inválido! Use formatos como `10m`, `1h`, `2d`.' });
        }

        const punicoesChannelId = String(server?.cPunicoes || '').replace(/[<#>]/g, '').trim();
        const sChannel = guild.channels.cache.get(punicoesChannelId);
        if (!sChannel) {
            return respond({
                content: `❌ O canal de punições (${server?.cPunicoes || 'Não definido'}) não foi encontrado. Configure-o através do comando \`/painel\`.`
            });
        }

        const muteRoleId = String(server?.cargoMute || '').replace(/[<@&>]/g, '').trim();
        let muterole = guild.roles.cache.get(muteRoleId) || guild.roles.cache.find(r => r.name.toLowerCase() === 'mutado');

        if (!muterole) {
            muterole = await guild.roles.create({
                name: 'Mutado',
                color: '#3F0875',
                permissions: [],
                reason: 'Cargo de Mute criado automaticamente pelo comando /mute'
            });

            for (const channel of guild.channels.cache.values()) {
                if (channel.permissionOverwrites) {
                    await channel.permissionOverwrites.edit(muterole.id, {
                        SendMessages: false,
                        AddReactions: false,
                        Speak: false
                    }).catch(() => {});
                }
            }

            server.cargoMute = `<@&${muterole.id}>`;
            await server.save().catch(() => {});
        }

        const punish = new this.client.database.Punish({
            _id: new mongoose.Types.ObjectId().toString(),
            usuario: member.displayName,
            uid: member.user.id,
            motivo: reason,
            staff: author.username,
            staffid: author.id,
            servidor: guild.id,
            punicao: 'silenciamento',
            data: moment.utc().format('LLLL')
        });
        await punish.save();

        const dmEmbed = new EmbedBuilder()
            .setThumbnail(guild.iconURL())
            .setTitle(`🔇 | Punição: Mutado — ${guild.name}`)
            .setDescription(`Você foi silenciado temporariamente no servidor **${guild.name}**.`)
            .addFields(
                { name: '👮 Staff', value: `${author.username} (\`${author.id}\`)`, inline: true },
                { name: '⏱️ Tempo', value: `\`${mutetime}\``, inline: true },
                { name: '📑 Motivo', value: reason, inline: false }
            )
            .setColor(color.moderation || '#e74c3c')
            .setTimestamp();

        const muteEmbed = new EmbedBuilder()
            .setThumbnail(member.user.displayAvatarURL())
            .setTitle('🚫 | Punição: Mute')
            .setDescription('O usuário foi silenciado por desrespeitar as regras do servidor!')
            .addFields(
                { name: '👮 Staff', value: `${author} (\`${author.id}\`)`, inline: true },
                { name: '👤 Usuário', value: `${member} (\`${member.id}\`)`, inline: true },
                { name: '⏱️ Tempo', value: `\`${mutetime}\``, inline: true },
                { name: '📑 Motivo', value: reason, inline: false }
            )
            .setColor(color.moderation || '#e74c3c')
            .setTimestamp();

        const unmuteEmbed = new EmbedBuilder()
            .setThumbnail(member.user.displayAvatarURL())
            .setTitle('🔊 | Punição: Desmutado')
            .addFields(
                { name: '👤 Usuário', value: `${member} (\`${member.id}\`)`, inline: true },
                { name: '📑 Motivo', value: 'Término automático do tempo de mute', inline: true }
            )
            .setColor(color.green || '#2ecc71')
            .setTimestamp();

        await member.roles.add(muterole.id);
        await sChannel.send({ embeds: [muteEmbed] }).catch(() => {});
        await member.send({ embeds: [dmEmbed] }).catch(() => {});

        setTimeout(async () => {
            await member.roles.remove(muterole.id).catch(() => {});
            await sChannel.send({ embeds: [unmuteEmbed] }).catch(() => {});
        }, durationMs);

        return respond({ content: `🔇 <@${member.id}> foi silenciado por **${mutetime}**! (Registrado em ${sChannel}).` });
    }
};
