const { EmbedBuilder } = require('discord.js')
const color = require('../api/colors.json')

module.exports = class GuildCreate {

	constructor(client) {
		this.client = client
	}

	async run(guild) {
		const server = await this.client.database.Guilds.findById(guild.id);
		
		let embedNew = new EmbedBuilder()
		.setColor(color.green)
		.setTitle('<a:a:hypeneon:729338461454205059> | **Você me adicionou ao seu servidor! = )**')
		.setDescription(`Você me adicionou ao ${guild.name}, fico feliz por ter me escolhido! Em seu servidor, dê o comando **${server.prefix}painel ver** para configurar algumas coisas do servidor!`)
		.setThumbnail(guild.iconURL);
		
		let embedOld = new EmbedBuilder()
		.setColor(color.green)
		.setTitle('<a:a:hypeneon:729338461454205059> | **Você me adicionou ao seu servidor! = )**')
		.setDescription(`Você me adicionou ao ${guild.name}, fico feliz por voltar! Verifique as configurações anteriores em **${server.prefix}painel ver**.`)
		.setThumbnail(guild.icon);
	  
	  
	  if(!server) {
	      	  this.client.database.Guilds({
			  _id: guild.id,
		  }).save().then(msg => {
			  guild.ownerId.send(embedNew)
	          })
	  }else {
		  guild.ownerId.send(embedOld)
	  }
       }
}
