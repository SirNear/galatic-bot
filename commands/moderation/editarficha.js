const Command = require('../../structures/Command');
const Discord = require('discord.js')
const error = require('../../api/error.js')


module.exports = class editarficha extends Command {

	constructor(client) {
		super(client, {
			name: "editarficha",
			category: "moderation",
			aliases: ["editf","efc"],
			UserPermission: null,
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
 async run({ message, args, client, server}) { //92

	message.channel.send('em desenvolvimento')
   
   
 } // 19
}
