const Discord = require("discord.js");
const fs = require("fs");

module.exports.run = async (client, message, args) => {

    let server = await client.database.Guilds.findById(message.guild.id)


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

exports.config = {
  name: "prefix",
  aliases: ['setpreifx', 'prefixo'],
  category: 'moderation'
}