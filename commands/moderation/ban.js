const Discord = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')
const color = require('../../api/colors.json')

module.exports = class ajuda extends Command {

	constructor(client) {
		super(client, {
			name: "ban",
			category: "moderation",
			aliases: ["banir"],
			UserPermission: ['BAN_MEMBERS'],
			clientPermission: ["BAN_MEMBERS", "EMBED_LINKS"],
			OnlyDevs: false
		})
	}
  
	 run({ message, args, client, server}) {
     
     
     
     
     
     
   }
  
  
  getCategory(category, prefix) {
		return this.client.commands.filter(c => c.config.category === category).map(c => `\`${prefix}${c.config.name}\``).join(", ")
	}
	
	
	getCommmandSize(category) {
		return this.client.commands.filter(c => c.config.category === category).size
	}
  
}
