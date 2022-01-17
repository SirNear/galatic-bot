const Discord = require('discord.js');
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
  
async run({ message, args, client, server}) {
  if(message.guild.id == '931441522950434906') {
    let dataPlayer = await this.client.database.Ficha.findById(message.author.id)
    
    if(!dataPlayer)  {
	    
	    this.client.database.Ficha({
		    _id: message.author.id,
	    }).save()
	    
	    message.channel.send('<:blackcheck:757662908548382740> | **Verifique a sua DM para cadastrar a ficha**').then(msg => {
	    
		    let dmMessage = Discord.MessageEmbed()
		    .setColor('RANDOM')
		    .setTitle('<:aboutme:820342728931672085> | **CRIAÇÃO DE FICHA**')
		    .setDescription('**Nome do personagem** \n envie o nome do personagem no chat')
		    
		    msg.author.send(dmMessage).then(msg1 => {
			    const filtroName = m => m.author.id === msg1.author.id
              		    const collectorNome = msg1.channel.awaitMessages(filtroNome, { idle: 10000}).then(collected => {
				    let charName = collected.first()
				    dataPlayer.nome = charName
				    dataPlayer.save()
				    
				    dmMessage.setDescription(`<:membroCDS:713866588398288956> | **Nome do personagem** \n ${charName} \n \n **Quantos anos seu personagem tem?** \n envie no chat`)
				    msg1.edit(dmMessage).then(msg2 => {
					    const filtroIdade = m => m.author.id === msg2.author.id
					    const collectorIdade = msg2.channel.awaitMessages(filtroIdade, {idle: 10000}).then(collected => {
						    let charAge = collected.first(Number)
						    dataPlayer.idade = charAge
						    dataPlayer.save
						    
				   	            dmMessage.setDescription(`<:membroCDS:713866588398288956> | **Nome do personagem** \n ${charName} \n \n <:medalha:713868705481752578> | **Idade de ${charName}** \n ${charAge} \n \n **Onde ele mora?** \n <:emoji_azul:850198594882371594> | Kanto \n <:emoji_branco:850197858761441361> | Johto \n <:emoji_ciano:850197799248068618> | Hoenn \n <:emoji_preto:850198674679660544> | Sinnoh \n <:emoji_rosa:850198716223717398> | Unova \n <:emoji_roxo:850198774970187816> | Kalos`)
						    msg2.edit(dmMessage).then(msg3 => {
							    msg3.react('850198594882371594')
							    msg3.react('850197858761441361')
							    msg3.react('850197799248068618')
							    msg3.react('850198674679660544')
							    msg3.react('850198716223717398')
							    msg3.react('850198774970187816')
							    
							    let filtroKanto = (reaction, usuario) => reaction.emoji.id === '850198594882371594' && usuario.id === msg3.author.id;
           					            const coletorKanto = msg3.createReactionCollector(filtroKanto, {max: 1, time: 360000});
							    
							    let filtroJohto = (reaction, usuario) => reaction.emoji.id === '850197858761441361' && usuario.id === msg3.author.id;
							    const coletorJohto = msg3.createReactionCollector(filtroJohto, {max: 1, time: 360000})
							    
							    
							    let filtroHoenn = (reaction, usuario) => reaction.emoji.id === '850197799248068618' && usuario.id === msg3.author.id;
							    const coletorHoenn = msg3.createReactionCollector(filtroHoenn, {max: 1, time: 360000})
							    
							    let filtroSinnoh = (reaction, usuario) => reaction.emoji.id === '850198674679660544' && usuario.id === msg3.author.id
							    const coletorSinnoh = msg3.createReactionCollector(filtroSinnoh, {max: 1, time: 360000})
							    
							    let filtroUnova = (reaction, usuario) => reaction.emoji.id === '850198716223717398' && usuario.id === msg3.author.id
							    const coletorUnova = msg3.createReactionCollector(filtroUnova, {max: 1, time: 360000})
							    
							    let filtroKalos = (reaction, usuario) => reaction.emoji.id === '850198774970187816' && usuario.id === msg3.author.id
							    const coletorKalos = msg3.createReactionCollector(filtroKalos, {max: 1, time: 360000})
							    
							    coletorKanto.on("collect", em => {
								    dataPlayer.moradia = 'Kanto'
								    dataPlayer.save()
								    
				   	           	            dmMessage.setDescription(`<:membroCDS:713866588398288956> | **Nome do personagem** \n ${charName} \n \n <:medalha:713868705481752578> | **Idade de ${charName}** \n ${charAge} \n \n <:passe:713845479691124867> | **Onde ele mora?** \n Kanto \n \n **Qual a aparência do personagem?** \n Envie apenas o nome do personagem`)
								    msg3.edit(dmMessage).then(msg4 => {
									    filtroAparencia = m => m.author.id === msg4.author.id
									    const coletorAparencia = msg4.channel.awaitMessages(filtroAparencia, {idle: 10000}).then(collected => {
										    let charAvatar = colleted.first()
										    
										    dataPlayer.aparencia = charAvatar
					                                            dmMessage.setDescription(`<:membroCDS:713866588398288956> | **Nome do personagem** \n ${charName} \n \n <:medalha:713868705481752578> | **Idade de ${charName}** \n ${charAge} \n \n <:passe:713845479691124867> |**Onde ele mora?** \n Kanto \n \n <:background:820342540091654155> | **Qual a aparência do personagem?** \n ${charAvatar}`)
										    dmMessage.setFooter('Confirmar ficha? Se cancelar terá que dar o comando novamente.')
										    msg4.edit(dmMessage).then(msg5 => {
											    msg.react('757662908548382740')
											    msg.react('816811156512440331')
											    
											    let filtroConfirm = (reaction, usuario) => reaction.emoji.id === '757662908548382740' && usuario.id === msg5.author.id
											    const coletorConfirm = msg5.createReactionCollector(filtroConfirm, {max: 1, time:  360000})
											    
											    let filtroCancel = (reaction, usuario) => reaction.emoji.id === '816811156512440331' && usuario.id === msg5.author.id
											    const coletorCancel = msg5.createReactionCollector(filtroCancel, {max: 1, time: 360000})
											    
											    coletorConfirm.on("collect", em => {
												    let registryChannel = msg.guild.channels.cache.get('931595990438379560')
												    registryChannel.send(dmMessage)
											    })
											    
											    coletorCancel.on("collect", em => {
												    dataPlayer.delete()
												    
												    msg5.send('**Ficha cancelada. Digite o comando novamente no servidor para fazer novamente.**')
											    })
										    })

									    })
								    })
    
							    })
							    
						    })

					    })
				    
				    })
				    
				    
	     		    })
			     
		    
		    })
    
	    })
      
    }
    
  
  
  }


  }
}
