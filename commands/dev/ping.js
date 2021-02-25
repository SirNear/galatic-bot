const Discord = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')

module.exports = class ping extends Command {
	constructor(client) {
		super(client, {
			name: "ping",
			category: "dev",
			aliases: [''],
			UserPermission: null,
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
async run({ message, args, client, server}) {

  const msg = await message.channel.send('**Calculando..**') 
  
  const embed = new Discord.MessageEmbed() 
    .setAuthor('Ping? Pong!')
    .setDescription(`Ping: \`\`${Math.round(client.ws.ping)}\`\`ms! \n Latência da API: \`\`${msg.createdTimestamp - message.createdTimestamp}\`\`ms! `)
    .setColor('36393e');
  
      msg.edit(embed)
  }
}
