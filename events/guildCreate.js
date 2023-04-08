const { EmbedBuilder } = require('discord.js')

module.exports = class {

	constructor(client) {
		this.client = client
	}
  
  async run(client, guild) {
    const server = await this.client.database.Guilds.findById(this.client.guild.id);
    
    if(!server) {
      console.log(this.client.guild.id + this.client.guild.name)
      //this.client.database.Guilds({
      //  _id: guild.name,
      //}).save().then(msg => {
      //})
    }
  }
}
