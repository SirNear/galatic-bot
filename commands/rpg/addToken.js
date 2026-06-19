const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const Command = require('../../structures/Command');
const colJson = require('../../api/colors.json');

module.exports = class AddToken extends Command {
    constructor(client) {
        super(client, {
            name: "addtoken",
            description: "Adiciona tokens (Aparência ou Verso) a um jogador.",
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
                .addIntegerOption(opt => opt.setName('quantidade').setDescription('A quantidade a ser adicionada.').setRequired(true))
                .addStringOption(opt => 
                    opt.setName('tipo')
                    .setDescription('Tipo de token')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Aparência', value: 'aparencia' },
                        { name: 'Verso', value: 'verso' }
                    )
                );
        }
    }

    async run({ message, args, client }) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !message.member.roles.cache.has('731974690125643869')) {
            return message.reply('❌ Sem permissão.');
        }

        const memMen = message.mentions.users.first();
        const quaTok = parseInt(args[1]);
        const tipo = args[2]?.toLowerCase();

        if (!memMen || isNaN(quaTok) || !['aparencia', 'verso'].includes(tipo)) {
            return message.reply('Uso correto: `!addtoken @usuario quantidade <aparencia|verso>`');
        }

        const useDat = await client.database.userData.findOne({ uid: memMen.id, uServer: message.guild.id });
        if (!useDat) return message.reply('Usuário não registrado.');

        if (tipo === 'aparencia') {
            useDat.tokenAp += quaTok;
        } else {
            useDat.tokenVerso += quaTok;
        }
        await useDat.save();

        message.reply(`✅ Adicionado ${quaTok} tokens de ${tipo} para ${memMen.tag}. Saldo: Aparência (${useDat.tokenAp}) | Verso (${useDat.tokenVerso})`);
    }

    async execute(interaction) {
        const rolAdm = '731974690125643869';
        const isAdm = interaction.member.roles.cache.has(rolAdm) || interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!isAdm) {
            return interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', ephemeral: true });
        }

        const tarUse = interaction.options.getUser('jogador');
        const quaTok = interaction.options.getInteger('quantidade');
        const tipo = interaction.options.getString('tipo');

        const useDat = await this.client.database.userData.findOne({ uid: tarUse.id, uServer: interaction.guild.id });

        if (!useDat) {
            return interaction.reply({ content: `❌ O usuário ${tarUse} não possui registro no sistema.`, ephemeral: true });
        }

        if (tipo === 'aparencia') {
            useDat.tokenAp += quaTok;
        } else {
            useDat.tokenVerso += quaTok;
        }
        
        await useDat.save();

        const tipoNome = tipo === 'aparencia' ? 'Aparência' : 'Verso';
        const novoSaldo = tipo === 'aparencia' ? useDat.tokenAp : useDat.tokenVerso;

        const embRes = new EmbedBuilder()
            .setColor(colJson.green)
            .setTitle('✅ Tokens Adicionados')
            .setDescription(`Foram adicionados **${quaTok}** tokens de ${tipoNome} para ${tarUse}.`)
            .addFields({ name: 'Novo Saldo', value: `${novoSaldo}` })
            .setFooter({ text: `Adicionado por ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embRes] });

        await tarUse.send({ embeds: [embRes] }).catch(() => null);
    }
}