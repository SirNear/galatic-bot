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
      // Configurações do Comando prefixo
      name: "nomedocomando", 
      description: "Descrição do que o comando faz.", // Descrição para o comando de barra
      category: "util", 
      aliases: ["alias1", "alias2"],
      UserPermission: [], 
      clientPermission: [], 
      OnlyDevs: false, 
      slash: true, // Habilita o comando de barra
    });

    // Configuração do Comando de Barra (Slash Command)
    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
    }
  }

  // Execução para comandos de prefixo (ex: !comando) - EVITAR USAR SE FOR APENAS COMANDO DE BARRA
  async run({ message, args, client, server }) {
    // Lógica do comando de prefixo aqui
    await message.reply("Comando de prefixo executado!");
  }

  // Execução para comandos de barra (ex: /comando)
  async execute(interaction) {
    // Lógica do comando de barra aqui
    await interaction.reply("Comando de barra executado!");
  }
};
