const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const Command = require("../../structures/Command");
const color = require("../../api/colors.json");
const { extractTextFromAttachment } = require("../../api/documentParser");

// Sessões ativas de corte com timer de autoexclusão: Map<sessionId, SessionData>
const activeCuts = new Map();

/**
 * Divide o texto de forma inteligente sem cortar palavras ou perder caracteres.
 * O tamanho padrão é 1950 caracteres para garantir que usuários sem Nitro possam
 * copiar e colar diretamente em mensagens normais de RP (limite de 2000 do Discord).
 */
function splitTextForRP(text, maxLength = 1950) {
  const parts = [];
  if (!text || typeof text !== "string") return parts;

  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      parts.push(remaining);
      break;
    }

    const chunkWindow = remaining.substring(0, maxLength);

    // 1. Prioridade: quebra de parágrafo dupla (\n\n)
    let splitIndex = chunkWindow.lastIndexOf("\n\n");
    let splitAdvance = 2;

    // 2. Prioridade: quebra de linha simples (\n)
    if (splitIndex === -1 || splitIndex < Math.floor(maxLength * 0.35)) {
      const singleNl = chunkWindow.lastIndexOf("\n");
      if (singleNl >= Math.floor(maxLength * 0.35)) {
        splitIndex = singleNl;
        splitAdvance = 1;
      }
    }

    // 3. Prioridade: fim de sentença (. ! ? ...)
    if (splitIndex === -1 || splitIndex < Math.floor(maxLength * 0.35)) {
      const sentenceEnds = [
        chunkWindow.lastIndexOf(". "),
        chunkWindow.lastIndexOf("! "),
        chunkWindow.lastIndexOf("? "),
        chunkWindow.lastIndexOf("… "),
      ];
      const maxSentenceEnd = Math.max(...sentenceEnds);
      if (maxSentenceEnd >= Math.floor(maxLength * 0.3)) {
        splitIndex = maxSentenceEnd + 1; // inclui o ponto
        splitAdvance = 1; // pula o espaço
      }
    }

    // 4. Prioridade: pontuação secundária (; , :)
    if (splitIndex === -1 || splitIndex < Math.floor(maxLength * 0.3)) {
      const clauseEnds = [
        chunkWindow.lastIndexOf("; "),
        chunkWindow.lastIndexOf(": "),
        chunkWindow.lastIndexOf(", "),
      ];
      const maxClauseEnd = Math.max(...clauseEnds);
      if (maxClauseEnd >= Math.floor(maxLength * 0.25)) {
        splitIndex = maxClauseEnd + 1;
        splitAdvance = 1;
      }
    }

    // 5. Prioridade: espaço simples entre palavras
    if (splitIndex === -1 || splitIndex < Math.floor(maxLength * 0.25)) {
      const lastSpace = chunkWindow.lastIndexOf(" ");
      if (lastSpace >= Math.floor(maxLength * 0.2)) {
        splitIndex = lastSpace;
        splitAdvance = 1;
      }
    }

    // 6. Caso extremo: palavra gigante sem espaços
    if (splitIndex === -1) {
      splitIndex = maxLength;
      splitAdvance = 0;
    }

    const chunk = remaining.substring(0, splitIndex);
    if (chunk.length > 0) {
      parts.push(chunk);
    }

    remaining = remaining.substring(splitIndex + splitAdvance);
  }

  return parts;
}

/**
 * Apaga mensagens de forma segura usando bulkDelete e fallback sequencial.
 */
async function deleteMessagesSafely(channel, messages) {
  if (!channel || !Array.isArray(messages) || messages.length === 0) return;

  const validMsgs = messages.filter((m) => m && m.id && m.deletable !== false);
  if (validMsgs.length === 0) return;

  try {
    await channel.bulkDelete(validMsgs, true);
  } catch (_) {
    for (const msg of validMsgs) {
      try {
        await msg.delete().catch(() => {});
      } catch (_) {}
    }
  }
}

module.exports = class Cortador extends Command {
  constructor(client) {
    super(client, {
      name: "cortador",
      category: "util",
      aliases: ["cortar", "cut", "cortartexto", "cuttext", "ctxt"],
      UserPermission: [],
      clientPermission: ["SendMessages", "ManageMessages"],
      OnlyDevs: false,
      slash: true,
      description:
        "Corta textos longos ou arquivos (.txt/.pdf) para que usuários sem Nitro possam copiar e colar no RP.",
      structure: "<texto ou anexo .txt / .pdf> [tempo_minutos]",
    });

    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addAttachmentOption((option) =>
          option
            .setName("arquivo")
            .setDescription("Anexe um arquivo .txt ou .pdf com o texto para cortar.")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("texto")
            .setDescription("Texto que você deseja cortar (caso não anexe um arquivo).")
            .setRequired(false)
        )
        .addIntegerOption((option) =>
          option
            .setName("tamanho_corte")
            .setDescription("Tamanho máximo de cada parte (padrão: 1950 caracteres para contas sem Nitro).")
            .setRequired(false)
            .setMinValue(500)
            .setMaxValue(1990)
        )
        .addIntegerOption((option) =>
          option
            .setName("tempo_apagar")
            .setDescription("Tempo em minutos para apagar as mensagens do chat (padrão: 5 minutos).")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(30)
        );
    }
  }

  /**
   * Execução do Slash Command
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const attachment = interaction.options.getAttachment("arquivo");
    const textoArg = interaction.options.getString("texto");
    const tamanhoCorte = interaction.options.getInteger("tamanho_corte") || 1950;
    const tempoMinutos = interaction.options.getInteger("tempo_apagar") || 5;

    if (!attachment && (!textoArg || textoArg.trim().length === 0)) {
      return interaction.reply({
        content:
          "❌ Você precisa fornecer um texto na opção `texto` ou anexar um arquivo `.txt` / `.pdf` na opção `arquivo`!",
        flags: 64,
      });
    }

    await interaction.deferReply({ flags: 64 });

    let textoFinal = "";
    let origem = "texto digitado";

    if (attachment) {
      try {
        const parsed = await extractTextFromAttachment(attachment);
        textoFinal = parsed.text;
        origem = `arquivo **${parsed.fileName}** (${parsed.fileType.toUpperCase()})`;
      } catch (err) {
        return interaction.editReply({
          content: `❌ Erro ao ler o arquivo anexado: ${err.message}`,
        });
      }
    } else {
      textoFinal = textoArg.trim();
    }

    if (!textoFinal || textoFinal.length === 0) {
      return interaction.editReply({
        content: "❌ O texto fornecido está vazio ou não possui caracteres legíveis.",
      });
    }

    // Se o texto já cabe em uma única mensagem comum sem Nitro (2000 chars)
    if (textoFinal.length <= tamanhoCorte) {
      return interaction.editReply({
        content: `✅ Seu texto tem apenas **${textoFinal.length}** caracteres e cabe perfeitamente em uma única mensagem normal do Discord (limite de 2.000 caracteres)! Não precisa ser cortado.`,
      });
    }

    await this.processAndSendCuts({
      channel: interaction.channel,
      user: interaction.user,
      text: textoFinal,
      origem,
      maxChunk: tamanhoCorte,
      tempoMinutos,
      interaction,
    });
  }

  /**
   * Execução do comando com prefixo tradicional (!cortador)
   */
  async run({ message, args }) {
    let texto = args.join(" ").trim();
    let tempoMinutos = 5;

    // Verifica se o último argumento é um número indicando os minutos para apagar
    if (args.length > 1 && /^\d+$/.test(args[args.length - 1])) {
      const parsedTime = parseInt(args[args.length - 1], 10);
      if (parsedTime >= 1 && parsedTime <= 30) {
        tempoMinutos = parsedTime;
        texto = args.slice(0, -1).join(" ").trim();
      }
    }

    const attachment = message.attachments.first();
    let origem = "texto digitado";

    if (attachment) {
      try {
        const parsed = await extractTextFromAttachment(attachment);
        texto = parsed.text;
        origem = `arquivo **${parsed.fileName}** (${parsed.fileType.toUpperCase()})`;
      } catch (err) {
        return message.reply(`❌ Erro ao ler o arquivo: ${err.message}`);
      }
    }

    if (!texto || texto.length === 0) {
      return message.reply(
        "❌ Envie um texto longo ou anexe um arquivo `.txt` ou `.pdf` para cortar!"
      );
    }

    const maxChunk = 1950;
    if (texto.length <= maxChunk) {
      return message.reply(
        `✅ Seu texto tem apenas **${texto.length}** caracteres e cabe em uma mensagem normal sem Nitro!`
      );
    }

    await this.processAndSendCuts({
      channel: message.channel,
      user: message.author,
      text: texto,
      origem,
      maxChunk,
      tempoMinutos,
      triggerMessage: message,
    });
  }

  /**
   * Divide o texto em partes saudáveis para colar no RP e envia no canal com contador de autoexclusão.
   */
  async processAndSendCuts({
    channel,
    user,
    text,
    origem,
    maxChunk,
    tempoMinutos,
    interaction = null,
    triggerMessage = null,
  }) {
    const parts = splitTextForRP(text, maxChunk);

    if (parts.length === 0) {
      const errTxt = "❌ Não foi possível dividir o texto fornecido.";
      if (interaction) return interaction.editReply({ content: errTxt });
      return channel.send({ content: errTxt });
    }

    if (parts.length > 30) {
      const warnTxt = `⚠️ O texto é extremamente longo (${text.length} caracteres = ${parts.length} partes). O limite máximo de partes por comando é 30 para evitar flood no canal.`;
      if (interaction) return interaction.editReply({ content: warnTxt });
      return channel.send({ content: warnTxt });
    }

    const sessionId = `${user.id}_${Date.now()}`;
    const deleteMs = tempoMinutos * 60 * 1000;
    const deleteUnix = Math.floor((Date.now() + deleteMs) / 1000);

    const controlEmbed = new EmbedBuilder()
      .setColor(color.blue || "#3498db")
      .setTitle("✂️ Cortador de Texto — RP Sem Nitro")
      .setDescription(
        `Origem: ${origem}\n` +
        `📊 **Total de Caracteres:** \`${text.length.toLocaleString("pt-BR")}\`\n` +
        `📦 **Partes Geradas:** \`${parts.length}\` *(máx. ${maxChunk} caracteres por parte)*\n\n` +
        `⏱️ **Contador de Autoexclusão:**\n` +
        `As mensagens abaixo serão apagadas **<t:${deleteUnix}:R>** (<t:${deleteUnix}:T>) para manter o canal limpo.\n\n` +
        `💡 **Dica de Cópia (Celular/PC):**\n` +
        `As mensagens abaixo contêm **apenas o texto puro** de cada corte. No celular, dê um toque longo sobre a mensagem da parte desejada e selecione **Copiar Texto** para colar diretamente no seu RP!`
      )
      .setFooter({
        text: `Solicitado por ${user.username} • Expira em ${tempoMinutos} minuto(s)`,
        iconURL: user.displayAvatarURL(),
      })
      .setTimestamp();

    const deleteButtonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`cortador_delete_${sessionId}`)
        .setLabel("Apagar Tudo Agora (Já Copiei)")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Danger)
    );

    const sentMessages = [];

    // Envia o painel de controle principal
    const panelMsg = await channel.send({
      embeds: [controlEmbed],
      components: [deleteButtonRow],
    });
    sentMessages.push(panelMsg);

    // Envia cada parte no chat de forma sequencial e limpa
    for (let idx = 0; idx < parts.length; idx++) {
      const chunkText = parts[idx];

      // Mensagem pequena indicando a parte
      const headerMsg = await channel.send({
        content: `✂️ **Parte ${idx + 1} de ${parts.length}** \`(${chunkText.length} caracteres)\`:`,
      });
      sentMessages.push(headerMsg);

      // Mensagem com o texto puro (perfeito para cópia sem cabeçalhos intrusivos)
      const chunkMsg = await channel.send({
        content: chunkText,
        allowedMentions: { parse: [] }, // Evita menções acidentais no RP
      });
      sentMessages.push(chunkMsg);
    }

    if (interaction) {
      await interaction.editReply({
        content: `✅ Texto cortado em **${parts.length} partes** e enviado no chat! Todas as mensagens serão apagadas automaticamente **<t:${deleteUnix}:R>**.`,
      });
    }

    // Se o usuário usou comando por prefixo e enviou anexo, podemos apagar o comando original se tiver permissão
    if (triggerMessage && triggerMessage.deletable) {
      triggerMessage.delete().catch(() => {});
    }

    // Timer de autoexclusão no chat
    const timeoutId = setTimeout(async () => {
      activeCuts.delete(sessionId);
      await deleteMessagesSafely(channel, sentMessages);
    }, deleteMs);

    activeCuts.set(sessionId, {
      userId: user.id,
      channel,
      sentMessages,
      timeoutId,
    });

    // Coletor do botão "Apagar Agora"
    const collector = panelMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: deleteMs,
    });

    collector.on("collect", async (i) => {
      if (i.customId === `cortador_delete_${sessionId}`) {
        const isAuthor = i.user.id === user.id;
        const isStaff = i.memberPermissions?.has("ManageMessages");

        if (!isAuthor && !isStaff) {
          return i.reply({
            content: "❌ Apenas quem solicitou o corte ou moderadores podem apagar estas mensagens antecipadamente.",
            flags: 64,
          });
        }

        clearTimeout(timeoutId);
        activeCuts.delete(sessionId);
        collector.stop();

        await i.reply({
          content: "🗑️ Apagando todas as mensagens do cortador...",
          flags: 64,
        });

        await deleteMessagesSafely(channel, sentMessages);
      }
    });
  }
};

/**
 * Handler global para cliques de botões do cortador (caso o coletor da mensagem tenha expirado)
 */
module.exports.handleCortadorInteraction = async function (interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith("cortador_delete_")) {
    return false;
  }

  const sessionId = interaction.customId.replace("cortador_delete_", "");
  const session = activeCuts.get(sessionId);

  if (!session) {
    return interaction.reply({
      content: "ℹ️ As mensagens deste corte já foram apagadas ou expiraram.",
      flags: 64,
    });
  }

  const isAuthor = interaction.user.id === session.userId;
  const isStaff = interaction.memberPermissions?.has("ManageMessages");

  if (!isAuthor && !isStaff) {
    return interaction.reply({
      content: "❌ Apenas quem solicitou o corte ou a moderação pode apagar estas mensagens.",
      flags: 64,
    });
  }

  clearTimeout(session.timeoutId);
  activeCuts.delete(sessionId);

  await interaction.reply({
    content: "🗑️ Apagando mensagens do cortador...",
    flags: 64,
  });

  await deleteMessagesSafely(session.channel, session.sentMessages);
  return true;
};
