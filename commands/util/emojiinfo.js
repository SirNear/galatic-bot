const { EmbedBuilder } = require('discord.js');
const Command = require('../../structures/Command');
const moment = require('moment')
moment.locale("pt-BR");


module.exports = class emojiinfo extends Command {

	constructor(client) {
		super(client, {
			name: "emojiinfo",
			category: "util",
			aliases: ["infoemoji", 'ei'],
			UserPermission: null,
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
	 run({ message, args, client, server}) {
      let arg = args[0]

      const emojis = this.client.emojis.cache.find(emoji => emoji.toString() == arg) || this.client.emojis.cache.find(emoji => emoji.name == arg)

        if(!arg) return message.channel.send('***Digite o nome do emoji ou mencione-o***')


         if(!emojis) {

          const embed = new EmbedBuilder()
          .setColor('RANDOM')
          .setTitle('❌ | ***Erro***')
          .setDescription('Eu tentei encontrar em todos os servidores em que estou, porém não encontrei este emoji. Desculpe a incoveniencia. :c')
          .setTimestamp();

          message.channel.send(embed)

        }




        const embeds = new EmbedBuilder()
        .setColor('RANDOM')
        .setTitle(`${emojis} | ***${emojis.name}***`)
        .addFields(
		{name: '<:notificacaopwp:566085275323727893> | **Menção**', value: `\`<:${emojis.identifier}>\``},
        	{name: '<:Servidor:564589119334776862> | **Id do Emoji**', value: `\`${emojis.id}\``},
		{name: '<a:relogio:669706279861747713> | ***Criado em***', value: `${moment(emojis.createadAt).format('LLLL')}`},
		{name: '<:ajuda:569167017073180677> | ***Avistado em***', value: `\`${emojis.guild}\`` },
		{name: '<:Link:573931602636308500> | ***Link do emoji***', value: emojis.url}
		)
        .setTimestamp();

         const embeda = new EmbedBuilder()
        .setColor('RANDOM')
        .setTitle(`${emojis} | ***${emojis.name}***`)
        .addFields(
		{name: '<:notificacaopwp:566085275323727893> | **Menção**', value: `\`<a:${emojis.identifier}>\``},
		{name: '<:Servidor:564589119334776862> | **Id do Emoji**', value: `\`${emojis.id}\``},
		{name: '<a:relogio:669706279861747713> | ***Criado em***', value: `${moment(emojis.createadAt).format('LLLL')}`},
		{name: '<:ajuda:569167017073180677> | ***Avistado em***', value: `\`${emojis.guild}\`` },
		{name: '<:Link:573931602636308500> | ***Link do emoji***', value: emojis.url}
		)
        .setTimestamp();

        if(emojis.animated) return message.channel.send(embeda)

        message.channel.send(embeds)
     
     
     
   }
}
