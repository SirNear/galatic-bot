const Discord = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')
const color = require('../../api/colors.json')
const { ButtonBuilder, ActionRowBuilder, EmbedBuilder, ButtonStyle, MessageCollector } = require('discord.js');


module.exports = class painel extends Command {

	constructor(client) {
		super(client, {
			name: "painel",
			category: "config",
			aliases: [],
			UserPermission: ['ADMINISTRATOR'],
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
	 run({ message, args, client, server}) {
		 
		 
		 let guildicon = message.guild.iconURL()
		if(!guildicon) guildicon = this.client.user.avatarURL()
     
     switch(args[0]) {
        case "ver":
        
            const embedv = new EmbedBuilder()
            .setColor(color.green)
            .setTitle('<:Servidor:564589119334776862> | ***Configurações do Servidor***')
	    .setDescription('Selecione o que deseja modificar')
            .addFields(
		    {name: '<:clipe:573934199862722562> | ***Prefix do Bot:***', value: server.prefix},
		    {name: '<:berror:563100784711958528> | ***Canal de Punições:***', value: server.cPunicoes},
		    {name: '<:muted:572627076948164608> | **Cargo de Mute**', value: server.cargoMute},
		    {name: '<a:latencia:562893011021987852> | **Sistema de Mute Automático**', value: server.warnTag},
		    {name: '<:lolipolice:669705464447107073> | **Cargo de Moderação**', value: server.staffRole},
		    {name: '<:MotivosparaViver:572157111471964200> | **Categoria para Monitoramentos**', value: '<#' + server.monitorCategory + '>'}
	    )
            .setThumbnail(guildicon)
            .setTimestamp();
		     
		    const row = new ActionRowBuilder()
		      .addComponents(
		    new ButtonBuilder()
		      .setCustomId('1')
		      .setLabel('CANAL DE PUNIÇÕES')
		      .setStyle(ButtonStyle.Primary), //verificar links
		     new ButtonBuilder()
			.setCustomId("2")
			.setLabel("PREFIX")
			.setStyle(ButtonStyle.Primary),
		     new ButtonBuilder()
			.setCustomId("3")
			.setLabel("CARGO DE MUTE")
			.setStyle(ButtonStyle.Primary),
		     new ButtonBuilder()
			.setCustomId("4")
			.setLabel("SISTEMA DE MUTE AUTOMATICO")
			.setStyle(ButtonStyle.Primary),
		     )
		    
		    const row12 = new ActionRowBuilder()
		    .addComponents(
		     new ButtonBuilder()
			.setCustomId("5")
			.setLabel("CARGO DE MODERAÇÃO")
			.setStyle(ButtonStyle.Primary),
		     new ButtonBuilder()
			.setCustomId("6")
			.setLabel("CATEGORIA DE MONITORAMENTOS")
			.setStyle(ButtonStyle.Primary),
			    )
		    
		    message.channel.send({ embeds: [embedv], components: [row, row12]}).then((msg) => {
			    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000 });
	
			    collector.on("collect", async i => {
				switch(i.customId) {
					case "1":
						let msgPuni = await message.channel.send({content: '***Mencione o novo canal de punições***'})
						const collectorMsg = await msgPuni.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})
						collectorMsg.on('collect', (collected) => {
	
							let nc = message.mentions.channels.first() || message.guild.channels.cache.get(args.slice(0).join)
							let cf1 = collected.content

							nc = cf1
							server.cPunicoes = nc
							if(!nc) nc = '``padrão``.';
							server.save()
							message.channel.send({content: `**Canal de punições alterado para \`${nc}\`**`})
						})
							
					break;
					case "2":
						let msgPrefix = await message.channel.send({content: '***Digite o novo prefix do servidor***'})
						const collector2 = await msgPrefix.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})

						collector2.on("collect", (collected) => {
							let newPrefix = collected.content
							server.prefix = newPrefix
							if(!newPrefix) newPrefix = 'g!'
							server.save()
							message.channel.send({ content: `**Prefixo do bot alterado para \`${newPrefix}\`**`})
						})//collector2	
					break;
					case "3":
						let msgMutero = await message.channel.send({content: '**Mencione o novo cargo de mute**'})
						const collector3 = await msgMutero.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})
						collector3.on('collect', (collected) => {
							let novoCargo = message.mentions.roles.first() || message.guild.roles.cache.get(args.slice(0).join(" "))
							let cargo = collected.content
							novoCargo = cargo
							server.cargoMute = novoCargo
							if(!novoCargo) novoCargo = '``padrão``'
							server.save()
							message.channel.send(`**Cargo de mute alterado para ${novoCargo}`)
						})//collector3
					break;
					case "4":
						const helpAutoMute = new EmbedBuilder()
						    .setTitle('<:notificacaopwp:566085275323727893> | **Configuração do Sistema de Auto Silenciamento** | <:notificacaopwp:566085275323727893>>')
						    .setColor(color.green)
						
						if(server.warnTag.includes === 'Desativado') {
							helpAutoMute.setDescription(`O sistema de Auto Silenciamento acontece aplicando um mute automático após um número x de warns/avisos, sendo configuravél para ativar ou desativar e também o número de avisos necessários. \n \n <:dnd:572210462993940482> | Status Desativado. \n \n Reaja com "<:StatusOn:572210002039668818>" para **Ativar** o sistema.`)
							const row2 = new ActionRowBuilder()
							.addComponents(
							  new ButtonBuilder()
								.setCustomId("41")
								.setLabel("<:StatusOn:572210002039668818>")
								.setStyle(ButtonStyle.Primary),
								)
							
							message.channel.send({ embeds: [helpAutoMute], components: [row2] }).then((msg2) => {
								const collectoram = msg.createMessageComponentCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1});
								collectoram.on("collect", async i => {
									msg2.delete()
									server.warnTag = 'Ativado'
									server.save()
									message.channel.send(`**O sistema de auto Silenciamento foi ativado com o máximo de \`${server.warnNumber} warns\`. Reaja com "<a:a:moderacao:569064320156172299>" para alterar este valor.`).then(ms => {
										const row3 = new ActionRowBuilder()
										.addComponents(
											new ButtonBuilder()
											.setCustomId("411")
											.setLabel("<a:a:moderacao:569064320156172299>")
											.setStyle(ButtonStyle.Primary),
											)
										message.channel.send({ content:'**Envie o novo número de warns máximos(Apenas números)**', components: [row3] }).then((m) => {
											const filterwarnumber = (interaction) => interaction.user.id === message.author.id;
											const collectorwn = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000, max: 1 });
											
											collectorwn.on("collect", (interaction) => {
												const fWN = m => m.author.id === message.author.id 
												const coletorWN = message.channel.awaitMessages(fWN, {time:20000}).then(collected => {
													let numberFirst = collected.content
													if(!numberFirst) return message.channel.send('Alterado para padrão.')
													
													server.warnNumber = numberFirst
													server.save()
													
													message.channel.send({content: `**Número máximo de warns alterado para \`${numberFirst}\`**`})
												})//coletorWN
											})//collectorwn
										})//m
									})//ms
								})//colletoram
							})//msg2 helpAutoMute

						}else {//if warnTag desativado
							helpAutoMute.setDescription(`O sistema de Auto Silenciamento acontece aplicando um mute automático após um número x de warns/avisos, sendo configuravél para ativar ou desativar e também o número de avisos necessários. \n \n <:StatusOn:572210002039668818> | Status Ativado. \n Número Máximo de warns atual: \`${server.warnNumber}\` \n \n Reaja com "<a:negativo:563096795907883010>" para **desativar** o sistema. \n Reaja com "<a:moderacao:569064320156172299>" para **Editar** o número de avisos para mutar. `)
							const row4 = new ActionRowBuilder()
							.addComponents(
							        new ButtonBuilder()
								.setCustomId("421")
								.setLabel("<a:negativo:563096795907883010>")
								.setStyle(ButtonStyle.Primary),
								new ButtonBuilder()
								.setCustomId("422")
								.setLabel("<a:moderacao:569064320156172299>")
								.setStyle(ButtonStyle.Primary),
							)
							
							message.channel.send({ embeds: [helpAutoMute], components: [row4] }).then((m) => {
								const collectoramon = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000 });
								
								collectoramon.on("collect", async i => {
									switch(i.customId) {
										case "421":
											m.delete()
											server.warnTag = 'Desativado'
											server.save()
											message.channel.send({content: '**Sistema de auto Silenciamento desativado.**'})
										break;
										case "422":
											message.channel.send('**Envie o novo número de warns máximos(Apenas números)**').then(async msg422 => {
												const coletorWN2 = await msg422.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1}).then(collected => {
													let numberFirst2 = collected.content
													if(!numberFirst2) return message.channel.send('Alterado para padrão.')

													server.warnNumber = numberFirst2
													server.save()
													message.channel.send({content: `**Número máximo de warns alterado para \`${numberFirst2}\`**`})
												})//colletorWN2
											})//m warnnumberedit
									}//switch automuteon
								})//collectoramon
							})//m do embed warnTag ativado

						}//else do if warnTag ativado
						//fim case "4"
					break;
					case "5":
						const embedInit = new EmbedBuilder()
							.setTitle('**Cargo de Moderação**')
							.setDescription(`Aquele que possuir este cargo terá permissões em vários comandos exclusivos e configurações automáticas do bot. \n \n **Cargo Atual:** ${server.staffRole} \n \n Reaja com "<:lolipolice:669705464447107073>" para alterar. `)
								
						const row5 = new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
							.setCustomId("51")
							.setLabel("<:lolipolice:669705464447107073>")
							.setSytle(ButtonStyle.Primary),
							)
						
						message.channel.send({ embeds: [embedInit], components: [row5] }).then((m) => {
							const collectorcm = msg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000 });
							collectorcm.on("collect", async i => {
								m.delete()
								message.channel.send({content: '**Mencione o novo cargo de Moderação**'}).then(async msg2 => {
									const coletorstaffRole = await msg2.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1}).then(collected => {
										let newStaffRole = collected.content
										let staffRoleFind = message.mentions.roles.first() || message.guild.roles.cache.get(args.slice(0).join(" "));
										
										staffRoleFind = newStaffRole
										server.staffRole = staffRoleFind
										server.save()
										msg2.delete()
										message.channel.send({content: `**Cargo de moderação alterado para ${staffRoleFind} com sucesso!**`})
									})//coletorstaffrole
								})//msg2 cargomod
							})//collectorcm
						})//m cargo mod edit
					break;
					case "6":
							let embedHelpC = new EmbedBuilder()
							.setTitle('**Categoria de Monitoramento**')
							.setDescription(`Definirá a categoria onde serão criados os canais de Monitoramento. Digite \`${server.prefix}monitor\` para saber mais.`)
						const row6 = new ActionRowBuilder()
						.addComponents(
						 	new ButtonBuilder()
							.setCustomId("61")
							.setLabel("ALTERAR")
							.setStyle(ButtonStyle.Primary),
								)

						let m6 = await message.channel.send({ embeds: [embedHelpC], components: [row6] })
							const collectormc =  await m6.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000 });
							collectormc.on("collect", async i => {
								m6.delete()
								 let m6 = await message.channel.send({content: '**Digite o nome ou ID da nova categoria. Inclua espaçamentos, acentos, pontuações e outros caracteres especiais. \n \n AVISO: Pode demorar até 15s para confirmação**'})
								const coletornewCategory = await m6.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})
								coletornewCategory.on('collect', async (collected) => {
										 let colectF = collected.content
										 let newCategory = message.guild.channels.cache.find(c => c.name == "Text Channels" && c.type == "category")  || message.guild.channels.cache.find(c => c.id == args[0] && c.type == "category")
										 newCategory = colectF
										 if(!newCategory) {
											 message.channel.send({content: '**Categoria não existente, verifique a ortografia e tente novamente.**'})
											 
											 server.monitorCategory = newCategory
											 server.save()
											 message.channel.send({content: `**Categoria de Monitoramento alterada para ${message.guild.channels.cache.find(c => c.id == server.monitorCategory && c.type == "category").name}**`})
										 }//if !newCategory
									 })//coletornewCategory
								 })//msg2 monitoramento categoria
					break;
				}//switch
			    })//collector
			    	break;
        			default: 
					const embedd = new EmbedBuilder()
					    .setTitle('<:engrenagem:564590880707837991> | ***Painel do Servidor***')
					    .setDescription(`<:dnd:572210462993940482> | Utilize \`${server.prefix}painel ver\` para editar o painel.`)
					    .addFields({name: '**Padrões**', value: 'Os canais são definidos por padrões. \n ⠀\n **Exemplo:** `#avisos`, `#sugestões`, e assim por diante. \n Você pode editar isso através do painel. \n ⠀ \n Caso apareça a mensagem "***Canal de `xxxxx` alterado para `padrão`.***", é porque o canal foi definido com o padrão a cima.'})
					    .setThumbnail(guildicon)
					    .setTimestamp();

				        message.channel.send({ embeds: [embedd] });
     }//switch
	 }
  
  
  getCategory(category, prefix) {
		return this.client.commands.filter(c => c.config.category === category).map(c => `\`${prefix}${c.config.name}\``).join(", ")
	}
	
	
	getCommmandSize(category) {
		return this.client.commands.filter(c => c.config.category === category).size
	}
  
}
