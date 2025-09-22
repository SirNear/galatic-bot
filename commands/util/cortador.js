const {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} = require("discord.js");
const Command = require("../../structures/Command");
const color = require("../../api/colors.json");
const fetch = require("node-fetch");

function splitText(text, maxLength = 1024) {
  const partes = [];
  let currentChunk = text;

  while (currentChunk.length > 0) {
    if (currentChunk.length <= maxLength) {
      partes.push(currentChunk);
      break;
    }

    let splitIndex = currentChunk.lastIndexOf(".", maxLength);
    if (splitIndex === -1)
      splitIndex = currentChunk.lastIndexOf("?", maxLength);
    if (splitIndex === -1)
      splitIndex = currentChunk.lastIndexOf("!", maxLength);
    if (splitIndex === -1)
      splitIndex = currentChunk.lastIndexOf(" ", maxLength);
    if (splitIndex === -1) splitIndex = maxLength;

    partes.push(currentChunk.substring(0, splitIndex + 1));
    currentChunk = currentChunk.substring(splitIndex + 1).trim();
  }

  return partes;
}

module.exports = class Cortador extends Command {
  constructor(client) {
    super(client, {
      name: "cortador",
      category: "util",
      aliases: ["cortar", "cut", "cortartexto", "cuttext", "ctxt"],
      UserPermission: [],
      clientPermission: null,
      OnlyDevs: false,
      slash: true,
      description:
        "Envia um texto longo como um arquivo .txt se exceder 4000 caracteres.",
      structure: "<texto ou anexo .txt>",
    });

    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addStringOption((option) =>
          option
            .setName("texto")
            .setDescription("O texto que você deseja processar.")
            .setRequired(true)
        );
    }
  }

  /**
   * @param {import('discord.js').CommandInteraction} interaction
   */
  async execute(interaction) {
    const texto = interaction.options.getString("texto");
    await this.backCorte(interaction, texto);
  }

  async backCorte(source, texto) {
    const MAX_DESCRIPTION_LENGTH = 4096;
    const MAX_TOTAL_TWO_CUTTER = 8000;
    const MAX_FIELDS = 25;
    const MAX_FIELD_LENGTH = 1024;

    // Se o texto couber em uma única descrição de embed
    if (texto.length <= MAX_DESCRIPTION_LENGTH)
      return message.reply({
        content:
          "✅ Seu texto não excede o limite de 4096 caracteres e não precisa ser cortado.",
      });

    /* #region  PARA TEXTOS MENORES QUE 8000 CARACTERES */
    if (texto.length < MAX_TOTAL_TWO_CUTTER) {
      /* #region  FORMATAÇÃO PARA EVITAR CORTE QUEBRADO */
      let splitIndex = texto.lastIndexOf(" ", MAX_DESCRIPTION_LENGTH);
      if (splitIndex === -1)
        splitIndex = texto.lastIndexOf("\n", MAX_DESCRIPTION_LENGTH);
      if (splitIndex === -1) splitIndex = MAX_DESCRIPTION_LENGTH;
      /* #endregion */

      const part1 = texto.substring(0, splitIndex);
      const part2 = texto.substring(splitIndex).trim();

      // Garante que a segunda parte não exceda o limite e não esteja vazia
      if (part2.length > 0 && part2.length <= MAX_DESCRIPTION_LENGTH) {
        const embed1 = new EmbedBuilder()
          .setColor(color.blue)
          .setTitle("PARTE 01/02")
          .setDescription(part1);

        const embed2 = new EmbedBuilder()
          .setColor(color.blue)
          .setTitle("PARTE 02/02")
          .setDescription(part2);

        await source.reply({ embeds: [embed1] });

        // Usa followUp para slash e channel.send para mensagens de prefixo
        if (source.followUp) {
          await source.followUp({ embeds: [embed2] });
        } else {
          await source.channel.send({ embeds: [embed2] });
        }
        return;
      }
    }
    /* #endregion */

    const partes = splitText(texto, MAX_FIELD_LENGTH);

    if (partes.length > MAX_FIELDS) {
      //se tiver mais q 25k de caracteres (1024*25), ele dá erro pq não dá pra adicionar mais campos
      return source.reply({
        content:
          "❌ O texto é longo demais para ser dividido em um único embed. O limite é de 25.600 caracteres.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(color.blue)
      .setTitle("TEXTO CORTADO")
      .setDescription(
        "Seu texto foi dividido nos campos abaixo para facilitar a cópia. No celular, clique e segure para copiar e, no computador, selecione e aperte `ctrl+C` (Windows) ou `Cmd+C` (Mac).` "
      );

    partes.forEach((chunk, index) =>
      embed.addFields({ name: `PARTE ${index + 1}`, value: chunk })
    );

    await source.reply({ embeds: [embed] });
  }


  async run({ message, args, server }) {
    let texto = args.join(" ");
    const attachment = message.attachments.first();

    // Se não houver texto nos argumentos, verifica se há um anexo
    if (!texto && attachment) {
      if (attachment.contentType?.startsWith("text/plain")) {
        try {
          const response = await fetch(attachment.url);
          if (!response.ok) {
            return message.reply(
              "Desculpe, não consegui baixar o conteúdo do arquivo anexado."
            );
          }
          texto = await response.text();
        } catch (error) {
          console.error("Erro ao processar anexo no comando cortador:", error);
          return message.reply("Ocorreu um erro ao tentar ler o arquivo.");
        }
      }
    }

    if (!texto) {
      return message.reply(
        `Uso correto: \`${server.prefix}${this.config.name} ${this.config.structure}\``
      );
    }

    await this.backCorte(message, texto);
  }
};
