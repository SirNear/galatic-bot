const { EmbedBuilder } = require('discord.js')

module.exports = class GuildCreate {

	constructor(client) {
		super()
		this.events = 'guildCreate'
	}
  
  async run(client, guild) {
    const server = await this.client.database.Guilds.findById(guild.id);
    
    if(!server) {
      console.log(guild.id + guild.name)
      //this.client.database.Guilds({
      //  _id: guild.name,
      //}).save().then(msg => {
      //})
    }
  }
}
