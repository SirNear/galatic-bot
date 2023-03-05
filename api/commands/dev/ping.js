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

	let ping = `Ping: \`${Math.round(this.client.ws.ping)}\`ms! | API: \`${Date.now() - message.createdTimestamp}\`ms`
	
	message.channel.send('Pong!').then(msg => {
		msg.edit(`**Latência:** \`${ping}\``)
		
	})
  }
}
