const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField
} = require('discord.js');
const Command = require('../../structures/Command');

module.exports = class prefix extends Command {
    constructor(client) {
        super(client, {
            name: 'prefix',
            category: 'moderation',
            aliases: ['prefixo', 'setprefix'],
            description: 'Altera o prefixo de comandos legados do bot no servidor atual.',
            UserPermission: ['Administrator'],
            clientPermission: null,
            OnlyDevs: false,
            slash: true
        });

        this.data = new SlashCommandBuilder()
            .setName('prefix')
            .setDescription('Altera o prefixo de comandos legados do bot no servidor atual.')
            .addStringOption(option =>
                option
                    .setName('novo_prefixo')
                    .setDescription('Novo prefixo do bot (Ex: g!, !, ?)')
                    .setMinLength(1)
                    .setMaxLength(10)
                    .setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);
    }

    async execute(interaction) {
        if (!interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator) && !this.client.owners?.includes(interaction.user.id)) {
            return interaction.reply({ content: '❌ **Sem permissão!** Permissão necessária: `Administrador`.', flags: 64 });
        }

        const novoPrefixo = interaction.options.getString('novo_prefixo').trim();
        let server = await this.client.database.Guilds.findById(interaction.guild.id);
        if (!server) {
            server = new this.client.database.Guilds({ _id: interaction.guild.id });
        }

        server.prefix = novoPrefixo;
        await server.save();

        const embed = new EmbedBuilder()
            .setColor('#FF9900')
            .setTitle('📌 Prefixo Alterado com Sucesso!')
            .setDescription(`O prefixo do bot neste servidor foi alterado para \`${novoPrefixo}\`.`)
            .setFooter({ text: `Alterado por ${interaction.user.tag}` })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    async run({ message, args, server }) {
        if (!message.member?.permissions?.has(PermissionsBitField.Flags.Administrator) && !this.client.owners?.includes(message.author.id)) {
            return message.reply('❌ **Sem permissão!** Permissão necessária: `Administrador`.');
        }

        if (!args[0] || args[0].toLowerCase() === 'help') {
            return message.reply(`ℹ️ **Uso:** \`${server?.prefix || 'g!'}prefix <novo_prefixo>\` ou \`/prefix\`.`);
        }

        const novoPrefixo = args[0].trim();
        server.prefix = novoPrefixo;
        await server.save();

        const embed = new EmbedBuilder()
            .setColor('#FF9900')
            .setTitle('📌 Prefixo Alterado com Sucesso!')
            .setDescription(`O prefixo do bot neste servidor foi alterado para \`${novoPrefixo}\`.`)
            .setFooter({ text: `Alterado por ${message.author.tag}` })
            .setTimestamp();

        return message.channel.send({ embeds: [embed] });
    }
};
