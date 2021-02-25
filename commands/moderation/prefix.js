const Discord = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')

module.exports = class {nome do cmd} extends Command {
	constructor(client) {
		super(client, {
			name: "",
			category: "",
			aliases: [''],
			UserPermission: [""],
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
async run({ message, args, client, server}) {
  
  
  if(!message.member.hasPermission("ADMINISTRATOR")) return message.reply("**Sem permissão! Permissão necessária:** `ADMINISTRADOR`");
  if(!args[0] || args[0 == "help"]) return message.reply(`**Use: \`${server.prefix}prefix <novo prefixo>**\``);

  
  server.prefix = args[0]
  server.save()

  let sEmbed = new Discord.MessageEmbed()
  .setColor("#FF9900")
  .setTitle("**Prefixo alterado com sucesso!**")
  .setDescription(`Alterado para ${args[0]}`);

  message.channel.send(sEmbed);



  }
}
