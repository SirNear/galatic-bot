const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    ComponentType
} = require('discord.js');
const Command = require('../../structures/Command');
const color = require('../../api/colors.json');

module.exports = class ban extends Command {
    constructor(client) {
        super(client, {
            name: 'ban',
            category: 'moderation',
            aliases: ['banir'],
            description: 'Bane permanentemente um usuário do servidor com registro no canal de punições.',
            UserPermission: ['BanMembers'],
            clientPermission: ['BanMembers'],
            OnlyDevs: false,
            slash: true
        });

        this.data = new SlashCommandBuilder()
            .setName('ban')
            .setDescription('Bane permanentemente um usuário do servidor com registro de punição.')
            .addUserOption(option =>
                option
                    .setName('usuario')
                    .setDescription('Membro que será banido.')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('motivo')
                    .setDescription('Motivo do banimento.')
                    .setRequired(false)
            )
            .addBooleanOption(option =>
                option
                    .setName('forcar')
                    .setDescription('Executar banimento imediatamente sem pedir confirmação?')
                    .setRequired(false)
            )
            .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers);
    }

    async execute(interaction) {
        if (!interaction.member?.permissions?.has(PermissionsBitField.Flags.BanMembers) && !this.client.owners?.includes(interaction.user.id)) {
            return interaction.reply({ content: '❌ Você não possui a permissão `Banir Membros`.', flags: 64 });
        }

        const server = await this.client.database.Guilds.findById(interaction.guild.id)
            || new this.client.database.Guilds({ _id: interaction.guild.id });

        const targetUser = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('motivo')?.trim() || 'Sem motivo informado';
        const force = interaction.options.getBoolean('forcar') || false;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: '❌ Membro não encontrado neste servidor.', flags: 64 });
        }

        await interaction.deferReply();
        return this.handleBanFlow({
            context: interaction,
            isInteraction: true,
            guild: interaction.guild,
            author: interaction.user,
            authorMember: interaction.member,
            member,
            reason,
            force,
            server
        });
    }

    async run({ message, args, server }) {
        if (!message.member?.permissions?.has(PermissionsBitField.Flags.BanMembers) && !this.client.owners?.includes(message.author.id)) {
            return message.reply('❌ Você não possui a permissão `Banir Membros`.');
        }

        if (!args[0] || ['help', 'ajuda'].includes(args[0].toLowerCase())) {
            const embedH = new EmbedBuilder()
                .setTitle('🔨 | Ajuda: Comando Ban')
                .setDescription(`Utilize \`/ban usuario:@membro motivo:...\` ou \`${server?.prefix || 'g!'}ban <@usuario> <motivo>\`.`)
                .setFooter({ text: 'Adicione "force" ao final do motivo para banir sem confirmação.' })
                .setColor(color.moderation || '#e74c3c');
            return message.reply({ embeds: [embedH] });
        }

        const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        if (!member) return message.reply('❌ Não encontrei esse usuário neste servidor.');

        let rawReason = args.slice(1).join(' ').trim() || 'Sem motivo informado';
        const force = rawReason.toLowerCase().includes('force');
        if (force) {
            rawReason = rawReason.replace(/force/gi, '').trim() || 'Sem motivo informado';
        }

        return this.handleBanFlow({
            context: message,
            isInteraction: false,
            guild: message.guild,
            author: message.author,
            authorMember: message.member,
            member,
            reason: rawReason,
            force,
            server
        });
    }

    async handleBanFlow({ context, isInteraction, guild, author, authorMember, member, reason, force, server }) {
        const respond = async (payload) => {
            if (isInteraction) return context.editReply(payload);
            return context.reply(payload);
        };

        if (member.id === author.id) {
            return respond({ content: '❌ Você não pode banir a si mesmo.' });
        }

        if (authorMember.roles.highest.rawPosition <= member.roles.highest.rawPosition && guild.ownerId !== author.id) {
            return respond({ content: '❌ Seu cargo é igual ou inferior ao do membro que você tentou banir.' });
        }

        if (!member.bannable) {
            return respond({ content: '❌ Não posso banir este usuário (meu cargo é inferior ao dele).' });
        }

        const punicoesChannelId = String(server?.cPunicoes || '').replace(/[<#>]/g, '').trim();
        const sChannel = guild.channels.cache.get(punicoesChannelId);
        if (!sChannel) {
            return respond({
                content: `❌ O canal de punições (${server?.cPunicoes || 'Não definido'}) não foi encontrado. Configure-o através do comando \`/painel\`.`
            });
        }

        const dmEmbed = new EmbedBuilder()
            .setThumbnail(member.user.displayAvatarURL())
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
            .setTitle('🔨 | Punição: Banimento')
            .setDescription(`Você foi banido do servidor **${guild.name}** por desrespeitar as regras!`)
            .addFields(
                { name: '👮 Staff', value: `${author.username} (\`${author.id}\`)`, inline: true },
                { name: '📑 Motivo', value: reason, inline: false }
            )
            .setColor(color.moderation || '#e74c3c')
            .setTimestamp();

        const banEmbed = new EmbedBuilder()
            .setThumbnail(member.user.displayAvatarURL())
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
            .setTitle('🔨 | Punição: Banimento')
            .setDescription('O usuário foi punido permanentemente por desrespeitar as regras do servidor!')
            .addFields(
                { name: '👮 Staff', value: `${author.username} (\`${author.id}\`)`, inline: true },
                { name: '👤 Usuário', value: `${member} (\`${member.id}\`)`, inline: true },
                { name: '📑 Motivo', value: reason, inline: false }
            )
            .setColor(color.moderation || '#e74c3c')
            .setTimestamp();

        const sucessoEmbed = new EmbedBuilder()
            .setTitle('🔨 Ban | Sucesso!')
            .setDescription(`O membro ${member} (\`${member.user.tag}\`) foi banido com sucesso do servidor por ${author}.`)
            .setColor(color.moderation || '#2ecc71')
            .setTimestamp();

        const executeBan = async () => {
            await member.send({ embeds: [dmEmbed] }).catch(() => {});
            await member.ban({ deleteMessageSeconds: 7 * 86400, reason });
            await sChannel.send({ embeds: [banEmbed] }).catch(() => {});
        };

        if (force) {
            await executeBan();
            return respond({ embeds: [sucessoEmbed], components: [] });
        }

        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ | Confirmação de Banimento')
            .setDescription(`Deseja banir permanentemente **${member.user.tag}** (${member}) do servidor?\n\n**Motivo:** ${reason}`)
            .setColor(color.moderation || '#e67e22');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ban_confirm_yes').setLabel('Confirmar Banimento').setEmoji('🔨').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('ban_confirm_no').setLabel('Cancelar').setEmoji('✖️').setStyle(ButtonStyle.Secondary)
        );

        const sent = await respond({ embeds: [confirmEmbed], components: [row] });
        const collector = sent.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === author.id,
            time: 60000,
            max: 1
        });

        collector.on('collect', async i => {
            if (i.customId === 'ban_confirm_yes') {
                await executeBan();
                await i.update({ embeds: [sucessoEmbed], components: [] });
            } else {
                await i.update({ content: '❌ Banimento cancelado.', embeds: [], components: [] });
            }
        });
    }
};
