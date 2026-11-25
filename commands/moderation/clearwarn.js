const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField
} = require('discord.js');
const Command = require('../../structures/Command');
const color = require('../../api/colors.json');

function hasModPermission(member, server, client) {
    if (!member) return false;
    if (client?.owners?.includes(member.id)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    if (member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return true;

    const staffRoleId = String(server?.staffRole || '').replace(/[<@&>]/g, '').trim();
    if (staffRoleId && member.roles.cache.has(staffRoleId)) return true;
    return false;
}

module.exports = class clearwarn extends Command {
    constructor(client) {
        super(client, {
            name: 'clearwarn',
            category: 'moderation',
            aliases: ['limparavisos', 'clearavisos', 'unwarn'],
            description: 'Remove todos os avisos (warns) anteriores de um usuário.',
            UserPermission: ['ManageMessages'],
            clientPermission: null,
            OnlyDevs: false,
            slash: true
        });

        this.data = new SlashCommandBuilder()
            .setName('clearwarn')
            .setDescription('Remove todos os avisos (warns) anteriores de um usuário.')
            .addUserOption(option =>
                option
                    .setName('usuario')
                    .setDescription('Membro cujos avisos serão limpos.')
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages);
    }

    async execute(interaction) {
        const server = await this.client.database.Guilds.findById(interaction.guild.id)
            || new this.client.database.Guilds({ _id: interaction.guild.id });

        if (!hasModPermission(interaction.member, server, this.client)) {
            return interaction.reply({ content: '❌ Você não possui o cargo da staff ou permissão para limpar avisos.', flags: 64 });
        }

        const targetUser = interaction.options.getUser('usuario');
        const wUser = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!wUser) {
            return interaction.reply({ content: '❌ Usuário não encontrado neste servidor.', flags: 64 });
        }

        await interaction.deferReply();
        return this.handleClearWarn({
            context: interaction,
            isInteraction: true,
            guild: interaction.guild,
            author: interaction.user,
            wUser,
            server
        });
    }

    async run({ message, args, server }) {
        if (!hasModPermission(message.member, server, this.client)) {
            return message.reply('❌ Você não possui o cargo da staff ou permissão para limpar avisos.');
        }

        const wUser = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        if (!wUser) return message.reply('❌ Mencione ou informe o ID do usuário cujos avisos deseja limpar.');

        return this.handleClearWarn({
            context: message,
            isInteraction: false,
            guild: message.guild,
            author: message.author,
            wUser,
            server
        });
    }

    async handleClearWarn({ context, isInteraction, guild, author, wUser, server }) {
        const respond = async (payload) => {
            if (isInteraction) return context.editReply(payload);
            return context.reply(payload);
        };

        if (wUser.id === author.id && !this.client.owners?.includes(author.id)) {
            return respond({ content: '❌ Você não pode limpar os seus próprios avisos!' });
        }

        const warns = await this.client.database.Punish.find({
            uid: wUser.id,
            servidor: guild.id,
            punicao: 'aviso'
        });

        if (!warns || warns.length === 0) {
            return respond({ content: `ℹ️ O usuário ${wUser} não possui nenhum aviso registrado neste servidor.` });
        }

        await this.client.database.Punish.deleteMany({
            uid: wUser.id,
            servidor: guild.id,
            punicao: 'aviso'
        });

        const embed = new EmbedBuilder()
            .setTitle('🧹 | Avisos Removidos — Galatic Bot')
            .setColor(color.green || '#2ecc71')
            .setDescription(`Todos os **${warns.length}** aviso(s) de ${wUser} foram removidos por ${author}.`)
            .setThumbnail('https://i.pinimg.com/originals/a1/1f/a3/a11fa3cdbfd567f934b6c0151c6a6d8b.gif')
            .setFooter({ text: 'Galatic Bot • Sistema de Punições' })
            .setTimestamp();

        const punicoesChannelId = String(server?.cPunicoes || '').replace(/[<#>]/g, '').trim();
        const punishChannel = guild.channels.cache.get(punicoesChannelId);
        if (punishChannel) {
            await punishChannel.send({ embeds: [embed] }).catch(() => {});
        }

        return respond({
            content: `✅ **Todos os ${warns.length} aviso(s) de ${wUser} foram retirados com sucesso!**`
        });
    }
};
