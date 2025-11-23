const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const Command = require('../../structures/Command');
const color = require('../../api/colors.json');

module.exports = class Moeda extends Command {
    constructor(client) {
        super(client, {
            name: "moeda",
            description: "Gerencia as moedas do servidor.",
            category: "rpg",
            slash: true,
        });

        if (this.config.slash) {
            this.data = new SlashCommandBuilder()
                .setName(this.config.name)
                .setDescription(this.config.description)
                .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
                .addSubcommand(sub =>
                    sub.setName('criar')
                        .setDescription('Cria uma nova moeda no servidor.')
                        .addStringOption(opt => opt.setName('nome').setDescription('O nome da nova moeda.').setRequired(true))
                        .addStringOption(opt => opt.setName('emoji').setDescription('O emoji que representará a moeda.').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('deletar')
                        .setDescription('Deleta uma moeda existente.')
                        .addStringOption(opt => opt.setName('nome').setDescription('O nome da moeda a ser deletada.').setRequired(true).setAutocomplete(true))
                )
                .addSubcommand(sub =>
                    sub.setName('dar')
                        .setDescription('Concede uma quantidade de moeda a um jogador.')
                        .addUserOption(opt => opt.setName('jogador').setDescription('O jogador que receberá as moedas.').setRequired(true))
                        .addStringOption(opt => opt.setName('moeda').setDescription('O nome da moeda.').setRequired(true).setAutocomplete(true))
                        .addIntegerOption(opt => opt.setName('quantidade').setDescription('A quantidade a ser concedida.').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('remover')
                        .setDescription('Remove uma quantidade de moeda de um jogador.')
                        .addUserOption(opt => opt.setName('jogador').setDescription('O jogador de quem remover as moedas.').setRequired(true))
                        .addStringOption(opt => opt.setName('moeda').setDescription('O nome da moeda.').setRequired(true).setAutocomplete(true))
                        .addIntegerOption(opt => opt.setName('quantidade').setDescription('A quantidade a ser removida.').setRequired(true))
                );
        }
    }

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const admodRoleId = '731974690125643869';
        const isAdmod = interaction.member.roles.cache.has(admodRoleId);

        switch (sub) {
            case 'criar': {
                const nome = interaction.options.getString('nome').toLowerCase();
                const emoji = interaction.options.getString('emoji');

                const moeExi = await this.client.database.MoedaConfig.findOne({ guildId: interaction.guild.id, nome: nome });
                if (moeExi) return interaction.reply({ content: `❌ A moeda "${nome}" já existe.`, ephemeral: true });

                await this.client.database.MoedaConfig.create({
                    guildId: interaction.guild.id,
                    nome: nome,
                    emoji: emoji,
                    creatorId: interaction.user.id
                });

                await this.client.database.userData.updateMany(
                    { uServer: interaction.guild.id },
                    { $set: { [`moeda.${nome}`]: 0 } }
                );

                await interaction.reply({ content: `✅ A moeda ${emoji} **${nome}** foi criada por ${interaction.user} e adicionada a todos os jogadores com saldo 0.` });
                return console.log(`SISTEMA DE MOEDAS | Moeda "${nome}" criada por ${interaction.user.tag} (${interaction.user.id})`);
            }

            case 'deletar': {
                const nome = interaction.options.getString('nome').toLowerCase();
                const moeda = await this.client.database.MoedaConfig.findOne({ guildId: interaction.guild.id, nome: nome });

                if (!moeda) return interaction.reply({ content: `❌ A moeda "${nome}" não foi encontrada.`, ephemeral: true });

                const temPer = isAdmod || moeda.creatorId === interaction.user.id;
                if (!temPer) return interaction.reply({ content: `❌ Você não tem permissão para deletar a moeda "${nome}". Apenas AdMods ou o criador (<@${moeda.creatorId}>) podem.`, ephemeral: true });

                await this.client.database.MoedaConfig.deleteOne({ _id: moeda._id });

                await this.client.database.userData.updateMany(
                    { uServer: interaction.guild.id },
                    { $unset: { [`moeda.${nome}`]: "" } }
                );

                await interaction.reply({ content: `✅ A moeda **${nome}** foi deletada do sistema e da carteira de todos os jogadores.` });
                return console.log(`SISTEMA DE MOEDAS | Moeda "${nome}" deletada por ${interaction.user.tag} (${interaction.user.id})`);
            }

            case 'dar':
            case 'remover': {
                const targetUser = interaction.options.getUser('jogador');
                const nomeMoeda = interaction.options.getString('moeda').toLowerCase();
                let quantidade = interaction.options.getInteger('quantidade');

                if (sub === 'remover') quantidade *= -1;

                const moeCon = await this.client.database.MoedaConfig.findOne({ guildId: interaction.guild.id, nome: nomeMoeda });
                if (!moeCon) return interaction.reply({ content: `❌ A moeda "${nomeMoeda}" não existe.`, ephemeral: true });

                const temPer = isAdmod || moeCon.creatorId === interaction.user.id;
                if (!temPer) return interaction.reply({ content: `❌ Você não tem permissão para gerenciar a moeda "${nomeMoeda}". Apenas AdMods ou o criador (<@${moeCon.creatorId}>) podem.`, ephemeral: true });

                const jogDb = await this.client.database.userData.findOne({ uid: targetUser.id, uServer: interaction.guild.id });
                if (!jogDb) return interaction.reply({ content: `❌ O jogador ${targetUser} não está registrado no sistema.`, ephemeral: true });

                const path = `moeda.${nomeMoeda}`;
                await this.client.database.userData.updateOne(
                    { _id: jogDb._id },
                    { $inc: { [path]: quantidade } }
                );

                const novSal = (jogDb.moeda.get(nomeMoeda) || 0) + quantidade;

                const acaTex = sub === 'dar' ? 'recebeu' : 'teve removido';
                const embed = new EmbedBuilder()
                    .setColor(sub === 'dar' ? color.green : color.red)
                    .setDescription(`${targetUser} ${actionText} **${Math.abs(quantidade)}** ${moedaConfig.emoji} ${nomeMoeda}.`)
                    .setFooter({ text: `Novo saldo: ${novoSaldo}` });

                return interaction.reply({ embeds: [embed] });
            }
        }

    }

    async autocomplete(interaction) {
        try {
            const focVal = interaction.options.getFocused();
            const moedas = await this.client.database.MoedaConfig.find({ guildId: interaction.guild.id });
            const escolhas = moedas.map(m => m.nome);
            const filtrado = escolhas.filter(esc => esc.startsWith(focVal));
            await interaction.respond(
                filtrado.slice(0, 25).map(esc => ({ name: esc, value: esc })),
            );
        } catch (err) {
            console.error("Erro no autocomplete de moeda:", err);
        }
    }
};