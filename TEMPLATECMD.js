const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ModalBuilder,
} = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js');

module.exports = class NomeDoComando extends Command {
  constructor(client) {
    super(client, {
      name: "nomedocomando", 
      description: "Descrição do que o comando faz.", 
      category: "util", 
      aliases: ["alias1", "alias2"],
      UserPermission: [], 
      clientPermission: [], 
      OnlyDevs: false, 
      slash: true, 
    });

    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
    }
  }

  async execute(interaction) {
    // Lógica do comando de barra aqui
    await interaction.reply("Comando de barra executado!");
  }
};
