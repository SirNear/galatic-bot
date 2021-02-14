const Discord = require('discord.js')
const moment = require('moment');
moment.locale("pt-BR");

module.exports.run = async (client, message, args) => {
  
  let arg = args[0]

const emojis = client.emojis.cache.find(emoji => emoji.toString() == arg) || client.emojis.cache.find(emoji => emoji.name == arg)

  if(!arg) return message.channel.send('***Digite o nome do emoji ou mencione-o***')
  
  
   if(!emojis) {
    
    const embed = new Discord.MessageEmbed()
    .setColor('RANDOM')
    .setTitle('❌ | ***Erro***')
    .setDescription('Eu tentei encontrar em todos os servidores em que estou, porém não encontrei este emoji. Desculpe a incoveniencia. :c')
    .setTimestamp();
    
    message.channel.send(embed)
    
  }

  
  
  
  const embeds = new Discord.MessageEmbed()
  .setColor('RANDOM')
  .setTitle(`${emojis} | ***${emojis.name}***`)
  .addField('<:notificacaopwp:566085275323727893> | **Menção**', `\`<:${emojis.identifier}>\``)
  .addField('<:Servidor:564589119334776862> | **Id do Emoji**', `\`${emojis.id}\``)
  .addField('<a:relogio:669706279861747713> | ***Criado em***', `${moment(emojis.createadAt).format('LLLL')}`)
  .addField('<:ajuda:569167017073180677> | ***Avistado em***', `\`${emojis.guild}\`` )
  .addField('<:Link:573931602636308500> | ***Link do emoji***', emojis.url)
  .setTimestamp();
  
   const embeda = new Discord.MessageEmbed()
  .setColor('RANDOM')
  .setTitle(`${emojis} | ***${emojis.name}***`)
  .addField('<:notificacaopwp:566085275323727893> | **Menção**', `\`<a:${emojis.identifier}>\``)
  .addField('<:Servidor:564589119334776862> | **Id do Emoji**', `\`${emojis.id}\``)
  .addField('<a:relogio:669706279861747713> | ***Criado em***', `${moment(emojis.createadAt).format('LLLL')}`)
  .addField('<:ajuda:569167017073180677> | ***Avistado em***', `\`${emojis.guild}\`` )
  .addField('<:Link:573931602636308500> | ***Link do emoji***', emojis.url)
  .setTimestamp();
  
  if(emojis.animated) return message.channel.send(embeda)
  
  message.channel.send(embeds)
  }  

exports.config = {
  name: 'emojiinfo',
  aliases: ['sobreemoji','ei'],
  category: 'util'
}