
const { Discord, ModalBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, TextInputStyle, TextInputBuilder } = require('discord.js');
const Command = require('../../structures/Command');
const color = require('../../api/colors.json')
const error = require('../../api/error.js')
const fetch = require('node-fetch')

module.exports = class registryChange extends Command {
	constructor(client) {
		super(client, {
			name: "registryChange",
			category: "pokemon",
			aliases: ['rc'],
			UserPermission: ["ADMINISTRATOR"],
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
async run({ message, args, client, server}) {
  
  let pokeReg = await this.client.database.pokeReg.findOne({ pokeName: args.slice(0).join(' ') })
  
  const msgCancel = 'Tudo bem! Se o pokémon surgir, ele será registrado automaticamente, mas você pode fazer manualmente quando quiser = )'
  
  if(!pokeReg) {
	  
	  const row = new ActionRowBuilder()
     		.addComponents(
       			new ButtonBuilder()
       			.setCustomId('primary')
		       .setLabel('SIM')
		       .setStyle(ButtonStyle.Success),
		       new ButtonBuilder()
		       .setCustomId('secondary')
		       .setLabel('NÃO')
		       .setStyle(ButtonStyle.Danger),
		);
	  
    
	    const msgNoPoke = await message.reply({ content: 'Esse pokémon não foi registrado, deseja registrar?', ephemeral: true, components: [row] });
	    
	    const collector = msgNoPoke.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000 });

	    collector.on('collect', async i => {
		    if (i.customId === 'primary') {
			    msgNoPoke.delete()

			    const embedReg = new EmbedBuilder()
			    .setTitle('Registro de Pokémon')
			    .setDescription('Qual é o nome do pokémon?')
			    .setColor(color.purple)

			    const pokeMsg = await message.channel.send({embeds: [embedReg]})
			    const collectorNome = await pokeMsg.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})
			    collectorNome.on("collect", async (collected) => {
				    let regName = collected.content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

				    let response = await fetch(`https://pokeapi.co/api/v2/pokemon/${regName}`)
				    let data = await response.json();
				    let regId = data.id

				    if(!regId) {
					    pokeMsg.delete()
					    message.reply({content: '**Esse pokémon não existe! Por favor, repita o comando.**'})
				    }

				    pokeMsg.delete()
				    embedReg.setDescription('Qual é a descrição do pokémon?')
				    embedReg.addFields({name: '**Nome**', value: regName})

				    const nomeMsg = await message.channel.send({embeds: [embedReg]})
				    const collectorDesc = await nomeMsg.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})
				    collectorDesc.on("collect", async (collected) => {
					    nomeMsg.delete()
					    let regDesc = collected.content
					    embedReg.setDescription('Qual é o tipo do pokémon? Em inglês. Se for mais de um tipo, separe por uma "/"')
					    embedReg.addFields({name: '**Descrição**', value: regDesc})

					    const descMsg = await message.channel.send({embeds: [embedReg]})
					    const collectorType = descMsg.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})
					    collectorType.on("collect", async (collected) => {
						    descMsg.delete()
						    let regType = collected.content
						    embedReg.setDescription('Qual é a espécie do pokémon? Ex.: Lucario é da espécie pokémon aura.')
						    embedReg.addFields({name: '**Tipos:**', value: regType})

						    const typeMsg = await message.channel.send({embeds: [embedReg]})
						    const collectorTitle = typeMsg.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})
						    collectorTitle.on('collect', async (collected) => {
							    typeMsg.delete()
							    let regTitle = collected.content
							    embedReg.setDescription('Registro concluido!')
							    embedReg.addFields({name: '**Espécie:**', value: regTitle})

							    message.channel.send({embeds: [embedReg]}).then(msg => {
								    this.client.database.pokeReg({
									    _id: regId,
									    pokeName: regName,
									    pokeDesc: regDesc,
									    pokeType: regType,
									    pokeTitle: regTitle
								    }).save().then(msg => {
									    console.log('Novo pokémon registrado:' + ` ${regName} / ${regType}`)
									    message.channel.send({embeds: [embedReg]})
								    })//then save database
							    })//then embed
						    })//collectorTitle
					    })//collectorType
				    })//collectorDesc
			    })//collectorNome
		    } else if (i.customId === 'secondary') {
			     message.channel.send(msgCancel)
		    }
	    })//Collector
	     
  }else {//if !pokeReg
	  let modalChange = new ModalBuilder()
	  .setCustomId('change')
	  .setTitle('Registro de pokémon')
	  
	  let textName = new TextInputBuilder()
	  .setCustomId('textName')
	  .setLabel('Nome')
	  .setStyle(TextInputStyle.Short)
	  .setPlaceholder(pokeReg.pokeName)
	  .setRequired(false)
	  .setMaxLength(1000)
	  .setValue(pokeReg.pokeName)
	  
	  let textDesc = new TextInputBuilder()
	  .setCustomId('textDesc')
	  .setLabel('Descricão')
	  .setStyle(TextInputStyle.Paragraph)
	  .setPlaceholder(pokeReg.pokeDesc)
	  .setRequired(false)
	  .setMaxLength(1000)
	  .setValue(pokeReg.pokeDesc)
	  
	  let textType = new TextInputBuilder()
	  .setCustomId('textType')
	  .setLabel('Tipos')
	  .setStyle(TextInputStyle.Paragraph)
	  .setPlaceholder(pokeReg.pokeType)
	  .setRequired(false)
	  .setMaxLength(1000)
	  .setValue(pokeReg.pokeType)
	  
	  let textTitle = new TextInputBuilder()
	  .setCustomId('textTitle')
	  .setLabel('Espécie')
	  .setStyle(TextInputStyle.Short)
	  .setPlaceholder(pokeReg.pokeTitle)
	  .setRequired(false)
	  .setMaxLength(1000)
	  .setValue(pokeReg.pokeTitle)
	  
	  const firstActionRow = new ActionRowBuilder().addComponents(textName);
	  const secondActionRow = new ActionRowBuilder().addComponents(textDesc);
	  const thirdActionRow = new ActionRowBuilder().addComponents(textType);
	  const fourthActionRow = new ActionRowBuilder().addComponents(textTitle);
	  
	  modalChange.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow)	  

	 const rowChange = new ActionRowBuilder()
	.addComponents(
		new ButtonBuilder()
		.setCustomId('start')
	       .setLabel('SIM')
	       .setStyle(ButtonStyle.Primary),
	       new ButtonBuilder()
	       .setCustomId('cancel')
	       .setLabel('CANCELAR')
	       .setStyle(ButtonStyle.Primary),
	  )
	  
	  let msgPoke = await message.channel.send({content: 'Digite as alterações e deixe em branco o que não for alterar, podemos começar?', components: [rowChange]})//, ephemeral: true, components: [rowChange]})
	  
	  const collectorOp = msgPoke.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000 });
	  
	  collectorOp.on('collect', async (interaction) => {
		  if(interaction.customId === 'start') {
			  await interaction.showModal(modalChange, {client: this.client, interaction: interaction,})

			  const filter = (interaction) => interaction.customId === 'change'
			  interaction.awaitModalSubmit({ filter, time: 150000 }).then(async (interaction) => {
					  if(interaction.customId === 'change') {
						  //pegando parametros das caixas de texto
						  let pName = interaction.fields.getTextInputValue('textName')
						  let pDesc = interaction.fields.getTextInputValue('textDesc')
						  let pType = interaction.fields.getTextInputValue('textType')
						  let pTitle = interaction.fields.getTextInputValue('textTitle')

						  //se não tiver os valores = n quer mudar

						  if(!pName) return pName = pokeReg.pokeName
						  if(!pDesc) return pDesc = pokeReg.pokeDesc
						  if(!pType) return pType = pokeReg.pokeType
						  if(!pTitle) return pTitle = pokeReg.pokeTitle

						  //salvando na db

						  pokeReg.pokeName = pName
						  pokeReg.pokeName = pDesc
						  pokeReg.pokeName = pType
						  pokeReg.pokeName = pTitle
						  pokeReg.save()

						  let embedSucess = new EmbedBuilder()
						  .setColor(color.green)
						  .setTitle('<:YaroCheck:810266633804709908> | **Mudança de Registro Concluída**')
						  .setDescription('Os novos valores são:')
						  .addFields(
							  {name: '<:membroCDS:713866588398288956:> | **Nome**', value: pokeReg.pokeName, inline: true},
							  {name: '<:7992_AmongUs_Investigate:810735122462670869> | **Descrição**', value: pokeReg.pokeDesc, inline: true},
							  {name: '<:passe:713845479691124867> | **Tipos**', value: pokeReg.pokeType, inline: true},
							  {name: '<:classes:713835963133985019> | **Espécie**', value: pokeReg.pokeTitle, inline: true},
							  );

						  await interaction.reply({embeds: [embedSucess]})
					  }//if interaction modalChange
			  }).catch(console.error);
		  } else if(interaction.customId === 'cancel') { message.channel.send(msgCancel) }
	  })//collectorOp
	  	
  }
  
  
  
  }
}
