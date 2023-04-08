const { EmbedBuilder } = require('discord.js')
const color = require('../api/colors.json')

module.exports = class GuildCreate {

	constructor(client) {
		this.client = client
	}

	async run(guild) {
		const server = await this.client.database.Guilds.findById(guild.id);
		let embed = new EmbedBuilder()
		.setCOlor(color.green)
		.setTitle('')
	  
	  
	  if(!server) {
	      	  this.client.database.Guilds({
			  _id: guild.id,
		  }).save().then(msg => {
			  

	          })
	  }//if !server
       }
}
