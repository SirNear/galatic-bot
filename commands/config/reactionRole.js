const { EmbedBuilder, ChannelType } = require('discord.js');
const Command = require('../../structures/Command');
const ReactionRole = require('../../models/ReactionRole'); // Adapte o caminho para o seu modelo
const color = require('../../api/colors.json');
const error = require('../../api/error.js'); // Usando seu handler de erro

module.exports = class reactionRole extends Command {
    constructor(client) {
        super(client, {
            name: "reactionRole",
            category: "config",
            aliases: ['rr', 'rrole', 'reactionrole', 'addreactionrole', 'addrr'],
            UserPermission: ["Administrator"], // Corrigido para "Administrator"
            clientPermission: null,
            OnlyDevs: false,
            options: [
                {
                    name: 'adicionar',
                    description: 'Adiciona à uma mensagem uma reação que concederá um cargo ao reagir.',
                    type: 1, // 1 = SUB_COMMAND
                    options: [
                        { name: 'message_id', description: 'O ID da mensagem do painel.', type: 3, required: true }, // 3 = STRING
                        { name: 'role', description: 'O cargo a ser atribuído.', type: 8, required: true }, // 8 = ROLE
                        { name: 'emoji', description: 'O emoji para a reação.', type: 3, required: true },
                    ],
                },
                {
                    name: 'remover',
                    description: 'Remove uma reação.',
                    type: 1, // 1 = SUB_COMMAND
                    options: [
                        { name: 'message_id', description: 'O ID da mensagem do painel.', type: 3, required: true },
                        { name: 'emoji', description: 'O emoji da regra a ser removida.', type: 3, required: true },
                    ],
                }
            ]
        });
    }

    // O método run será o ponto de entrada para ambos os tipos de comando
    async run({ message, args, client, server, interaction }) {
        // Se for uma interação (slash command), usamos 'interaction'. Senão, 'message'.
        const context = interaction || message;
        const guild = context.guild;

        // Lógica para determinar o subcomando e os argumentos
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
            if (subcommand === 'adicionar') {
                role = message.mentions.roles.first() || guild.roles.cache.get(args[2]);
                emoji = args[3];
            } else { // remove
                emoji = args[2];
            }
        }

        // Validação de subcomando
        if (!['adicionar', 'remover'].includes(subcommand)) {
            const usageEmbed = new EmbedBuilder()
                .setColor(color.red)
                .setTitle('Uso Incorreto do Comando')
                .setDescription(`Por favor, especifique se deseja \`adicionar\` ou \`remover\` uma reação por cargo.\n\n**Exemplos:**\n\`${server.prefix}rr adicionar <ID da mensagem> <@cargo> <emoji>\`\n\`${server.prefix}rr remover <ID da mensagem> <emoji>\``);
            return context.reply({ embeds: [usageEmbed], ephemeral: true });
        }

        // Executa a lógica do subcomando
        switch (subcommand) {
            case 'adicionar':
                await this.adicionar(context, { guild, messageId, role, emoji });
                break;
            case 'remover':
                await this.removr(context, { guild, messageId, emoji });
                break;
        }
    }

    // Função para adicionar uma regra
    async add(context, { guild, messageId, role, emoji }) {
        if (!messageId || !role || !emoji) {
            return error.msg(context, 'Todos os argumentos são necessários para adicionar uma regra (`message_id`, `role`, `emoji`).');
        }

        try {
            const targetMessage = await findMessage(guild, messageId);
            if (!targetMessage) {
                return error.msg(context, 'Mensagem não encontrada. Verifique o ID e se estou no canal correto.');
            }

            // Salva ou atualiza no banco de dados
            await ReactionRole.findOneAndUpdate(
                { messageId, emoji },
                { guildId: guild.id, roleId: role.id },
                { upsert: true } // Cria se não existir, atualiza se existir
            );

            await targetMessage.react(emoji);

            const successEmbed = new EmbedBuilder()
                .setColor(color.green)
                .setTitle('✅ Regra Adicionada com Sucesso!')
                .setDescription(`Reagir com ${emoji} na [mensagem](${targetMessage.url}) agora dará o cargo **${role.name}**.`);

            await context.reply({ embeds: [successEmbed], ephemeral: true });

        } catch (err) {
            console.error("Erro ao adicionar Reaction Role:", err);
            return error.msg(context, 'Ocorreu um erro. Verifique se o emoji é válido e se tenho permissão para reagir.');
        }
    }

    // Função para remover uma regra
    async remove(context, { guild, messageId, emoji }) {
        if (!messageId || !emoji) {
            return error.msg(context, 'Argumentos `message_id` e `emoji` são necessários para remover uma regra.');
        }
        
        try {
            const deletedRule = await ReactionRole.findOneAndDelete({ messageId, emoji });

            if (!deletedRule) {
                return error.msg(context, `Nenhuma regra encontrada para o emoji ${emoji} na mensagem especificada.`);
            }

            // Opcional: remover a reação do bot na mensagem original
            const targetMessage = await findMessage(guild, messageId);
            if (targetMessage) {
                const botReaction = targetMessage.reactions.cache.get(emoji);
                if (botReaction && botReaction.me) {
                    await botReaction.remove();
                }
            }
            
            const successEmbed = new EmbedBuilder()
                .setColor(color.orange)
                .setTitle('🗑️ Regra Removida com Sucesso!')
                .setDescription(`A regra para o emoji ${emoji} na mensagem \`${messageId}\` foi removida.`);

            await context.reply({ embeds: [successEmbed], ephemeral: true });

        } catch (err) {
            console.error("Erro ao remover Reaction Role:", err);
            return error.msg(context, 'Ocorreu um erro ao tentar remover a regra do banco de dados.');
        }
    }
}

// Função auxiliar para encontrar a mensagem em qualquer canal de texto
async function findMessage(guild, messageId) {
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    for (const channel of textChannels.values()) {
        try {
            const msg = await channel.messages.fetch(messageId);
            if (msg) return msg;
        } catch (e) {}
    }
    return null;
}