const { Discord, ModalBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, TextInputStyle, TextInputBuilder, fetchRecommendedShardCount } = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')
const color = require('../../api/colors.json')
const contador = require('../../api/contador.js')
const logs = require('../../api/logs.js')

module.exports = class reactionRole extends Command {
	constructor(client) {
		super(client, {
			name: "reactionRole",
			category: "config",
			aliases: ['rr','rrole','reactionrole','addreactionrole', 'addrr'],
			UserPermission: ["ADMINISTRATOR"],
			clientPermission: null,
			OnlyDevs: false,
			structure: '',
            options: [
                {
                    name: 'add',
                    description: 'Atribui reações à uma mensagem e concede cargos à quem interage com a reação',
                    type: 1, // 1 = SUB_COMMAND
                    options: [
                        { name: 'message_id', description: 'O ID da mensagem', type: 3, required: true }, // 3 = STRING
                        { name: 'role', description: 'O cargo a ser atribuído.', type: 8, required: true }, // 8 = ROLE
                        { name: 'emoji', description: 'O emoji para a reação.', type: 3, required: true },
                    ],
                },
                {
                    name: 'remove',
                    description: 'Remove uma regra de cargo por reação.',
                    type: 1, // 1 = SUB_COMMAND
                    options: [
                        { name: 'message_id', description: 'O ID da mensagem', type: 3, required: true },
                        { name: 'emoji', description: 'O emoji a ser removido.', type: 3, required: true },
                    ],
                }
            ]
		})
	}


    async run({ message, args, client, server, interaction}) {
        const context = interaction || message;
        const guild = context.guild;

        let subcommand, messageId, role, emoji;

        if (interaction) {
            subcommand = interaction.options.getSubcommand();
            messageId = interaction.options.getString('message_id');
            emoji = interaction.options.getString('emoji');
            if (subcommand === 'add') {
                role = interaction.options.getRole('role');
            }
        } else { // Lógica para comandos de prefixo
            subcommand = args[0]?.toLowerCase();
            messageId = args[1];
            if (subcommand === 'add') {
                role = message.mentions.roles.first() || guild.roles.cache.get(args[2]);
                emoji = args[3];
            } else { // remove
                emoji = args[2];
            }
        }

        if (!['add', 'remove'].includes(subcommand)) {
            const usageEmbed = new EmbedBuilder()
                .setColor(color.red)
                .setTitle('Uso Incorreto do Comando')
                .setDescription(`Por favor, especifique se deseja \`add\` ou \`remove\` uma regra.\n\n**Exemplos:**\n\`${server.prefix}rr add <ID da mensagem> <@cargo> <emoji>\`\n\`${server.prefix}rr remove <ID da mensagem> <emoji>\``);
            return context.reply({ embeds: [usageEmbed], ephemeral: true });
        }

        // Executa a lógica do subcomando
        switch (subcommand) {
            case 'add':
                await this.add(context, { guild, messageId, role, emoji });
                break;
            case 'remove':
                await this.remove(context, { guild, messageId, emoji });
                break;
        }


    }
}
