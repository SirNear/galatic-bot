const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Command = require('../../structures/Command');
const { buscarContextoLocal } = require('../../api/loreManager');
const { gerarRespostaComFallback } = require('../../api/IAUtils');

module.exports = class Ask extends Command {
  constructor(client) {
    super(client, {
      name: "Ask",
      description: "Consulta a lore do RPG usando IA",
      category: "rpg",
      slash: true,
    });

    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addStringOption(opt => opt.setName('pergunta').setDescription('O que deseja saber?').setRequired(true));
    }
  }

  async execute(interaction) {
    await interaction.deferReply();
    const pergunta = interaction.options.getString('pergunta');

    try {
      const contexto = buscarContextoLocal(pergunta);
      const { text, model } = await gerarRespostaComFallback(pergunta, contexto);

      const embed = new EmbedBuilder()
        .setTitle('📚 Consulta à Lore')
        .setDescription(text.substring(0, 4096))
        .setColor('#0099ff')
        .setFooter({ text: `Respondido por: ${model} | Baseado nos seus TXTs` });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply(`❌ Erro: ${err.message}`);
    }
  }
};