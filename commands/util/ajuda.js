const { EmbedBuilder } = require('discord.js');
const Command = require('../../structures/Command');

module.exports = class ajuda extends Command {

	constructor(client) {
		super(client, {
			name: "ajuda",
			category: "util",
			aliases: ["ajuda", 'help', 'comandos','cmds'],
			UserPermission: null,
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
	 run({ message, args, client, server}) {
      		
    const embed = new EmbedBuilder() 
    .setColor('#bc42f4')
    .setTimestamp()
    .setThumbnail(this.client.user.displayAvatarURL())
    .setAuthor(`${message.guild.name} | Menu de Ajuda`, message.guild.iconURL({ dynamic: true }))	       
    .addFields(`<:7079_rimuru_slime_shocked:810735162286407742> Utilitário | (${this.getCommmandSize("util")})`, this.getCategory("util", server.prefix))
    .addFields(`<:3223_ComfyAmongus:810735118615314443> Desenvolvedor | (${this.getCommmandSize("dev")})`, this.getCategory("dev", server.prefix))
    .addFields(`<:7992_AmongUs_Investigate:810735122462670869> Moderação | (${this.getCommmandSize("moderation")})`, this.getCategory("moderation", server.prefix))
    .addFields(`<:PeepoPing:810735232918487091> Configuração do Servidor | (${this.getCommmandSize("config")})`, this.getCategory("config", server.prefix))
    .addFields(`**Convite do Bot**`, "[CLIQUE AQUI](https://discord.com/oauth2/authorize?client_id=INSERT_CLIENT_ID_HERE&scope=bot&permissions=8)")

     message.author.send(embed).then(() => {
	message.reply('**Verifique sua DM**')
}).catch(() => {
	message.reply('**Erro: Talvez sua DM esteja fechada, pois não consegui lhe enviar mensagem =c**')

})

	}
	
	getCategory(category, prefix) {
		return this.client.commands.filter(c => c.config.category === category).map(c => `\`${prefix}${c.config.name}\``).join(", ")
	}
	
	
	getCommmandSize(category) {
		return this.client.commands.filter(c => c.config.category === category).size
	}

}
