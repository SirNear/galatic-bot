const {
  EmbedBuilder,
  ChannelType,
  SlashCommandBuilder,
} = require("discord.js");
const Command = require("../../structures/Command");
const color = require("../../api/colors.json");
const error = require("../../api/error.js");

module.exports = class reactionRole extends Command {
  constructor(client) {
    super(client, {
      name: "reactionrole", // Importante: nome em minúsculo e sem caracteres especiais
      category: "config",
      aliases: ["rr", "rrole", "reactionrole", "addreactionrole", "addrr"],
      UserPermission: ["Administrator"],
      clientPermission: null,
      OnlyDevs: false,
      slash: true,
      description: "Gerencia reações que concedem cargos",
    });

    /* #region  CONFIGURAÇÃO SLASH */
    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name) // Usa o mesmo nome do construtor
        .setDescription(this.config.description)
        .addSubcommand((subcommand) =>
          subcommand
            .setName("adicionar")
            .setDescription("Adiciona uma reação que concederá um cargo")
            .addStringOption((option) =>
              option
                .setName("message_id")
                .setDescription("ID da mensagem do painel")
                .setRequired(true)
            )
            .addRoleOption((option) =>
              option
                .setName("role")
                .setDescription("Cargo a ser atribuído")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("emoji")
                .setDescription("Emoji para a reação")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remover")
            .setDescription("Remove uma reação")
            .addStringOption((option) =>
              option
                .setName("message_id")
                .setDescription("ID da mensagem do painel")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("emoji")
                .setDescription("Emoji da regra a ser removida")
                .setRequired(true)
            )
        );
    }
    /* #endregion */
  }

  /* #region  COMANDO PADRÃO */
  async run({ message, args, client, server }) {
    if (!args[0]) {
      const usageEmbed = new EmbedBuilder()
        .setColor(color.red)
        .setTitle("Uso Incorreto do Comando")
        .setDescription(
          `Por favor, especifique se deseja \`adicionar\` ou \`remover\` uma reação por cargo.\n\n**Exemplos:**\n\`${server.prefix}rr adicionar <ID da mensagem> <@cargo> <emoji>\`\n\`${server.prefix}rr remover <ID da mensagem> <emoji>\``
        );
      return message.reply({ embeds: [usageEmbed] });
    }

    const subcommand = args[0].toLowerCase();
    const messageId = args[1];

    if (subcommand === "adicionar") {
      const role =
        message.mentions.roles.first() ||
        message.guild.roles.cache.get(args[2]);
      const emoji = args[3];
      await this.funcaoAdicionar(message, messageId, role, emoji);
    } else if (subcommand === "remover") {
      const emoji = args[2];
      await this.funcaoRemover(message, messageId, emoji);
    }
  }
  /* #endregion */

  /* #region  SLASH COMMAND */
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const messageId = interaction.options.getString("message_id");
    const emoji = interaction.options.getString("emoji");

    if (subcommand === "adicionar") {
      const role = interaction.options.getRole("role");
      await this.funcaoAdicionar(interaction, messageId, role, emoji);
    } else if (subcommand === "remover") {
      await this.funcaoRemover(interaction, messageId, emoji);
    }
  }
  /* #endregion */

  /* #region  FUNÇÕES BACK-END */
  async funcaoAdicionar(context, messageId, role, emoji) {
    if (!messageId || !role || !emoji) {
      return error.msg(context, "Todos os argumentos são necessários.");
    }

    try {
      const targetMessage = await findMessage(context.guild, messageId);
      if (!targetMessage) {
        return error.msg(context, "Mensagem não encontrada.");
      }

      await this.client.database.reactionRoles.findOneAndUpdate(
        { messageId, emoji },
        { guildId: context.guild.id, roleId: role.id },
        { upsert: true }
      );

      await targetMessage.react(emoji);

      const successEmbed = new EmbedBuilder()
        .setColor(color.green)
        .setTitle("✅ Cargo por reação adicionado!")
        .setDescription(`Reagir com ${emoji} dará o cargo **${role.name}**`);

      await context.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (err) {
      console.error("Erro ao adicionar Reaction Role:", err);
      return error.msg(context, `Erro ao salvar a reação: \`${err}\` `);
    }
  }

  async funcaoRemover(context, messageId, emoji) {
    try {
      const deleted = await this.client.database.reactionRoles.findOneAndDelete(
        {
          messageId,
          emoji,
        }
      );

      if (!deleted) {
        return error.msg(context, `Nenhuma regra encontrada para ${emoji}`);
      }

      const targetMessage = await findMessage(context.guild, messageId);
      if (targetMessage) {
        const reaction = targetMessage.reactions.cache.get(emoji);
        if (reaction?.me) await reaction.remove();
      }

      const successEmbed = new EmbedBuilder()
        .setColor(color.orange)
        .setTitle("🗑️ Regra Removida!")
        .setDescription(`Regra do emoji ${emoji} removida.`);

      await context.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (err) {
      console.error("Erro ao remover Reaction Role:", err);
      return error.msg(context, "Erro ao remover a regra.");
    }
  }
  /* #endregion */
};

// Função para encontrar mensagem
async function findMessage(guild, messageId) {
  const textChannels = guild.channels.cache.filter(
    (c) => c.type === ChannelType.GuildText
  );
  for (const channel of textChannels.values()) {
    try {
      const msg = await channel.messages.fetch(messageId);
      if (msg) return msg;
    } catch (e) {}
  }
  return null;
}
