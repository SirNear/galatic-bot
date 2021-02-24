const { MessageEmbed } = require('discord.js');
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
  
	async run({message, args, client, database}, t) {
  
    const server = await database.Guilds.findById(message.guild.id)
    
    const embed = new Discord.MessageEmbed() 
    .setColor('#bc42f4')
    .setTimestamp()
    .setThumbnail(client.user.displayAvatarURL)
    .setAuthor(`${message.guild.name} | Menu de Ajuda`, message.guild.iconURL({ dynamic: true }))	       
    .addField(`${t("commands:help.util")}`, this.getCategory("util", server.prefix))

     message.author.send(embed).then(() => {
	message.reply('**Verifique sua DM**')
}).catch(( => {
	message.reply('**Erro: Talvez sua DM esteja fechada, pois não consegui lhe enviar mensagem =c**')

})


	getCategory(category, prefix) {
		return this.client.commands.filter(c => c.config.category === category).map(c => `\`${server.prefix}${c.config.name}\``).join(", ")
	}

  
  }
