const Discord = require('discord.js')

module.exports.run = async (client, message, args) => {
  
  const Sembed = new Discord.MessageEmbed()
.setTitle('<:ajuda:569167017073180677>| Ajuda!')
.setDescription(`**${message.author} Verifique seu privado!** <a:fdagnbzidevxyxnhfdxrf:569065722270056478>`)
.setColor("RANDOM");
  
    const embed = new Discord.MessageEmbed() 
    .setColor('#bc42f4')
    .setTimestamp()
    .setThumbnail(client.user.displayAvatarURL)
    .addField('<:lolipolice:669705464447107073>***| Comandos de Moderação Geral***', `\`${client.commands.filter(c => c.config.category === 'util').map(c => c.config.name).join(", ")}\``)
    .addField('<a:moderacao:569064320156172299>***| Comandos da Staff***', `\`${client.commands.filter(c => c.config.category === 'moderation').map(c => c.config.name).join(", ")}\``)
    .addField('<:development:569066626578907158> ***| Development***', `\`${client.commands.filter(c => c.config.category === 'dev').map(c => c.config.name).join(", ")}\``)
    .addField('<a:money:590590683820064769> ***| Configurações***', `\`${client.commands.filter(c => c.config.category === 'config').map(c => c.config.name).join(", ")}\``);

  
      message.author.send(embed);
  
    message.channel.send(Sembed)

  
}

exports.config = {
    name: 'ajuda',
    aliases: ['help','commands','comandos'],
    category: 'util'
}
