const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ChannelType,
  MessageFlags, // Importar MessageFlags
} = require("discord.js");
const Command = require("../../structures/Command");
const error = require("../../api/error.js");
const moment = require("moment");
moment.locale("pt-br"); // Define o local para português do Brasil
const { resumirRP } = require("../../api/resumir.js");


module.exports = class rpresumo extends Command {
  constructor(client) {
    super(client, {
      name: "rpresumo", 
      description: "Resume uma série de textos de um rp em um só texto", 
      category: "rpg", 
      aliases: ["rpr", "resumirrp", "rpbackup"],
      UserPermission: [], 
      clientPermission: [], 
      OnlyDevs: false, 
      slash: true,
    });

    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addChannelOption((option) =>
          option
            .setName("canal")
            .setDescription("O canal do qual você deseja extrair as mensagens.")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread)
        );
    }
  }

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }); // Corrigido aviso de depreciação

    const channel = interaction.options.getChannel("canal");

    try {
      await interaction.editReply({ content: `🤖 Coletando mensagens do canal <#${channel.id}>... Isso pode levar um tempo.` });

      let allMessages = [];
      let lastId;

      while (true) {
        const options = { limit: 100 };
        if (lastId) {
          options.before = lastId;
        }

        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) {
          break;
        }

        messages.forEach(msg => allMessages.push(msg));
        lastId = messages.last().id;
      }

      if (allMessages.length === 0) {
        return interaction.editReply({ content: "Não encontrei nenhuma mensagem nesse canal." });
      }

      // Inverte o array para que as mensagens fiquem em ordem cronológica (da mais antiga para a mais nova)
      const orderedMessages = allMessages.reverse();

      const formattedText = orderedMessages
        .map(msg => `[${moment(msg.createdAt).format("DD/MM/YYYY HH:mm:ss")}] ${msg.author.tag}: ${msg.content}`)
        .join("\n\n---\n\n");

      const buffer = Buffer.from(formattedText, "utf-8");
      const attachment = new AttachmentBuilder(buffer, { name: `resumo-${channel.name}.txt` });

      await interaction.editReply({ content: `🤖 Mensagens coletadas! Agora, estou resumindo as ultimas 100 mensagens do RP...` });

      const resumoGerado = await resumirRP(formattedText);

      const embedResumo = new EmbedBuilder()
        .setColor("Blue")
        .setTitle(`📝 Resumo do RP em #${channel.name}`)
        .setDescription(resumoGerado.substring(0, 4096))
        .setFooter({ text: "O arquivo .txt com o resumo completo está anexado." });

      await interaction.editReply({ content: "✅ Resumo gerado com sucesso!", embeds: [embedResumo], files: [attachment] });

    } catch (err) {
      console.error("Erro ao executar /rpresumo:", err);
      await interaction.editReply({ content: "❌ Ocorreu um erro ao tentar buscar as mensagens. Verifique se eu tenho permissão para ver o canal." }).catch(() => {});
    }
  }
};
