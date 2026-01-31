const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const Command = require('../../structures/Command');
const colJson = require('../../api/colors.json');

module.exports = class AddToken extends Command {
    constructor(client) {
        super(client, {
            name: "addtoken",
            description: "Adiciona tokens de aparência a um jogador.",
            category: "rpg",
            aliases: ["givetoken", "at"],
            UserPermission: [],
            clientPermission: [],
            OnlyDevs: false,
            slash: true,
        });

        if (this.config.slash) {
            this.data = new SlashCommandBuilder()
                .setName(this.config.name)
                .setDescription(this.config.description)
                .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
                .addUserOption(opt => opt.setName('jogador').setDescription('O jogador que receberá os tokens.').setRequired(true))
                .addIntegerOption(opt => opt.setName('quantidade').setDescription('A quantidade a ser adicionada.').setRequired(true));
        }
    }

    async run({ message, args, client }) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !message.member.roles.cache.has('731974690125643869')) {
            return message.reply('❌ Sem permissão.');
        }

        const memMen = message.mentions.users.first();
        const quaTok = parseInt(args[1]);

        if (!memMen || isNaN(quaTok)) {
            return message.reply('Uso correto: `!addtoken @usuario quantidade`');
        }

        const useDat = await client.database.userData.findOne({ uid: memMen.id, uServer: message.guild.id });
        if (!useDat) return message.reply('Usuário não registrado.');

        useDat.tokenAp += quaTok;
        await useDat.save();

        message.reply(`✅ Adicionado ${quaTok} tokens para ${memMen.tag}. Total: ${useDat.tokenAp}`);
    }

    async execute(interaction) {
        const rolAdm = '731974690125643869';
        const isAdm = interaction.member.roles.cache.has(rolAdm) || interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!isAdm) {
            return interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', ephemeral: true });
        }

        const tarUse = interaction.options.getUser('jogador');
        const quaTok = interaction.options.getInteger('quantidade');

        const useDat = await this.client.database.userData.findOne({ uid: tarUse.id, uServer: interaction.guild.id });

        if (!useDat) {
            return interaction.reply({ content: `❌ O usuário ${tarUse} não possui registro no sistema.`, ephemeral: true });
        }

        useDat.tokenAp += quaTok;
        await useDat.save();

        const embRes = new EmbedBuilder()
            .setColor(colJson.green)
            .setTitle('✅ Tokens Adicionados')
            .setDescription(`Foram adicionados **${quaTok}** tokens de aparência para ${tarUse}.`)
            .addFields({ name: 'Novo Saldo', value: `${useDat.tokenAp}` })
            .setFooter({ text: `Adicionado por ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embRes] });

        await tarUse.send({ embeds: [embRes] }).catch(() => null);
    }
}