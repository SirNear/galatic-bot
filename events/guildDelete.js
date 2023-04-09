const { EmbedBuilder } = require('discord.js')
const color = require('../api/colors.json')

module.exports = class GuildDelete {

	constructor(client) {
		this.client = client
	}

	async run(guild, client) {
		
		const server = await this.client.database.Guilds.findById(guild.id)
		
		const canal = this.client.channels.cache.get('1094070734151766026')
		
		let embedRemove = new EmbedBuilder()
		.setColor(color.red)
		.setTitle('**SAI DE UM SERVIDOR**')
		.addFields(
			{name: '**Servidor:**', value: guild.name},
			{name: '**ID**', value: guild.id},
			{name: '**Dono**', value: guild.ownerId},
		)
		
		canal.send({ embeds: [embedRemove] })
		
		if(server.banned === true) {
			if(server.tryAdd === true) return
			
			let embedBan = new EmbedBuilder()
			.setColor(color.red)
			.setTitle('<:errorYaro:816811156512440331> | **Seu servidor acaba de ser banido**')
			.setDescription(`Um dos meus administradores acabou de expulsar-me do seu servidor ${guild.name}. Entre em contato com o [suporte](https://discord.gg/EsAb4jDAvx) para saber mais.`)
			.addFields({name: '**Motivo do Banimento**', value: server.banReason, inline: true})
			
			this.client.users.send(guild.ownerId, {embeds: [embedBan]})
			
		}else {
    
			let embed = new EmbedBuilder()
			.setColor(color.green)
			.setTitle('<:GadgetLeave:821521172956053513> | **Você me tirou do seu servidor! = (**')
			.setDescription(`Você me expulsou do ${guild.name}, espero que eu não tenha feito nada de errado =( \n \n Entra em contato com o [suporte](https://discord.gg/EsAb4jDAvx) pra falar sobre sua insatisfação!`)
			 .addFields({name: `**Se quiser me adicionar novamente**`, value: "[CLIQUE AQUI](https://discord.com/oauth2/authorize?client_id=634216294710771713&scope=bot&permissions=8)"})
			.setThumbnail(guild.icon);

			this.client.users.send(guild.ownerId, {embeds: [embed]})
			
		}
	  
   }
}
