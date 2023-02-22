/* const Discord = require('discord.js')
const Command = require('../../structures/Command');
const error = require('../../api/error.js')

module.exports = class ficha extends Command {
	constructor(client) {
		super(client, {
			name: "ficha",
			category: "rpg",
			aliases: ['f'],
			UserPermission: [""],
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
	async run({ message, args, client, server, dataPlayer}){
	  if (message.guild.id == '931441522950434906') {
	    var dataPlayer = await this.client.database.Ficha.findById(message.author.id)

	    if(!dataPlayer)  {

		    this.client.database.Ficha({
			    _id: message.author.id,
		    }).save()

		    let auth = message.guild.members.cache.get(message.author)
		    let category = message.guild.channels.cache.find(c => c.id == '932760951650942996' && c.type == "category");

		    message.guild.channels.create(`${auth.displayName}`).then(channel => {

			    channel.setParent(category.id)

			    channel.updateOverwrite(message.guild.roles.everyone.id, {
				VIEW_CHANNEL: false
			    })

			    message.channel.send(`<:blackcheck:757662908548382740> | **Verifique o canal ${channel} para cadastrar a ficha**`).then(msg => {

				    let embed = new Discord.MessageEmbed()
				    .setColor('RANDOM')
				    .setTitle('<:aboutme:820342728931672085> | **CRIAÇÃO DE FICHA**')
				    .setDescription('**Nome do personagem** \n envie o nome do personagem no chat')
				    
				    channel.send(embed).then(msg => {
					    
					    const filtroNome = m => m.author.id === message.author.id 
             				    const collectorNome = msg.channel.awaitMessages(filtroNome, {idle:20000}).then(collected => {
						    let charName = collected.first()
						    dataPlayer.nome = charName
						    dataPlayer.save()
						    
						    embed.setDescription(`<:membroCDS:713866588398288956> | **Nome do personagem** \n ${dataPlayer.nome} \n \n **Qual a idade do seu personagem?** \n Envie apenas números.`)
						    msg.edit(embed).then(msg => {
							    let filtroIdade = m => m.author.id === message.author.id
							    const collectorIdade = msg.channel.awaitMessages(filtroIdade, {idle:20000}).then(collected => {
								    let charAge = collected.first()
							    })
						    })
					    }) // collectorNome
				    })

			    }) //msg
		    })
	    }
    	}
}
*/
