const { EmbedBuilder } = require('discord.js')
const color = require('../api/colors.json')

module.exports = class GuildCreate {

	constructor(client) {
		this.client = client
	}

	async run(guild, client) {
		const server = await this.client.database.Guilds.findById(guild.id);
		
		let embedNew = new EmbedBuilder()
		.setColor(color.green)
		.setTitle('<a:hypeneon:729338461454205059> | **Você me adicionou ao seu servidor! = )**')
		.setDescription(`Você me adicionou ao ${guild.name}, fico feliz por ter me escolhido! Em seu servidor, dê o comando **${server.prefix}painel ver** para configurar algumas coisas do servidor!`)
		.setThumbnail(guild.icon);
		
		let embedOld = new EmbedBuilder()
		.setColor(color.green)
		.setTitle('<a:hypeneon:729338461454205059> | **Você me adicionou ao seu servidor! = )**')
		.setDescription(`Você me adicionou ao ${guild.name}, fico feliz por voltar! Verifique as configurações anteriores em **${server.prefix}painel ver**.`)
		.setThumbnail(guild.icon);
		
		const leave = guild.leave()
		
		let embedCreated = new EmbedBuilder()
		.setColor(color.green)
		.setTitle('**NOVO SERVIDOR**')
		.addFields(
			{name: '**Servidor:**', value: guild.name},
			{name: '**ID**', value: guild.id},
			{name: '**Dono**', value: guild.ownerID},
			{name: '**Sair do Servidor**', value: `[CLIQUE](${leave})`}
		)
		
		const canal = client.channels.cache.get('1094070734151766026')
		canal.send({ embeds: [embedCreated] })
	  
	  
	  if(!server) {
	      	  this.client.database.Guilds({
			  _id: guild.id,
		  }).save().then(msg => {
			  this.client.users.send(guild.ownerId, {embeds: [embedNew]})
	          })
	  }else {
		  this.client.users.send(guild.ownerId, {embeds: [embedOld]})
	  }
       }
}
