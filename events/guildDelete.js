const { EmbedBuilder } = require('discord.js')
const color = require('../api/colors.json')

module.exports = class GuildDelete {

	constructor(client) {
		this.client = client
	}

	async run(guild, client) {
    
		let embed = new EmbedBuilder()
		.setColor(color.green)
		.setTitle('<:GadgetLeave:821521172956053513> | **Você me tirou do seu servidor! = (**')
		.setDescription(`Você me expulsou do ${guild.name}, espero que eu não tenha feito nada de errado =( \n \n Entra em contato com o [suporte](https://discord.gg/EsAb4jDAvx) pra falar sobre sua insatisfação!`)
    .addFields({name: `**Se quiser me adicionar novamente**`, value: "[CLIQUE AQUI](https://discord.com/oauth2/authorize?client_id=634216294710771713&scope=bot&permissions=8)"})
		.setThumbnail(guild.icon);
    
    client.users.send(guild.ownerId, {embeds: [embed]})
	  
   }
}
