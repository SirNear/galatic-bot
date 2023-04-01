
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
		    let response = await fetch(`https://pokeapi.co/api/v2/pokemon/${args.slice(0).join(' ').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`)
		    let data = await response.json();
		    let regId = data.id
		    let regName = data.name
		    let regImg = data.sprites.front_default;
		    let regType = data.types.map(type => type.type.name).join(', ');
		    
		    if (i.customId === 'primary') {
			    msgNoPoke.delete()
			    
			    const embedReg = new EmbedBuilder()
			    .setTitle('Registro de Pokémon')
			    .setDescription('Qual é a descrição do pokémon?')
			    .addFields(
				  {name: '<:membroCDS:713866588398288956> | **Nome**', value: regName, inline: true},
				  {name: '<:passe:713845479691124867> | **Tipos**', value: regType, inline: true},
			    )
			    .setImage(regImg)
			    .setColor(color.purple)

			    const pokeMsg = await message.channel.send({embeds: [embedReg]})
			    this.client.activeCollector = true;
			    
			    const collectorDesc = await pokeMsg.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})

			    if(!regId) {
				    pokeMsg.delete()
				    message.reply({content: '**Esse pokémon não existe! Por favor, repita o comando.**'})
			    }
			    
			    collectorDesc.on("collect", async (collected) => {
				    pokeMsg.delete()
				    let regDesc = collected.content
				    embedReg.setDescription('Qual é a espécie do pokémon? Ex.: Lucario é da espécie pokémon aura.')
				    embedReg.addFields({name: '<:7992_AmongUs_Investigate:810735122462670869> | **Descrição**', value: regDesc})

				    const descMsg = await message.channel.send({embeds: [embedReg]})

				    const collectorTitle = descMsg.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})

				    collectorTitle.on('collect', async (collected) => {
					    descMsg.delete()
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
							    this.client.activeCollector = false;
						    })//then save database
					    })//then embed
				    })//collectorTitle
			    })//collectorDesc
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
	  .setMinLength(2)
	  .setValue(pokeReg.pokeName)
	  
	  let textDesc = new TextInputBuilder()
	  .setCustomId('textDesc')
	  .setLabel('Descricão')
	  .setStyle(TextInputStyle.Paragraph)
	  .setPlaceholder(pokeReg.pokeDesc)
	  .setRequired(false)
	  .setMaxLength(1000)
	  .setMinLength(2)
	  .setValue(pokeReg.pokeDesc)
	  
	  let textType = new TextInputBuilder()
	  .setCustomId('textType')
	  .setLabel('Tipos')
	  .setStyle(TextInputStyle.Paragraph)
	  .setPlaceholder(pokeReg.pokeType)
	  .setRequired(false)
	  .setMaxLength(1000)
	  .setMinLength(2)
	  .setValue(pokeReg.pokeType)
	  
	  let textTitle = new TextInputBuilder()
	  .setCustomId('textTitle')
	  .setLabel('Espécie')
	  .setStyle(TextInputStyle.Short)
	  .setPlaceholder(pokeReg.pokeTitle)
	  .setRequired(false)
	  .setMaxLength(1000)
	  .setMinLength(2)
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
	  
	  let msgPoke = await message.channel.send({content: 'Estará como padrão o valor pré-definido, altere apeans o que quiser e não deixe nada em branco. Podemos começar?', components: [rowChange]})//, ephemeral: true, components: [rowChange]})
	  
	  const collectorOp = msgPoke.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000 });
	  
	  collectorOp.on('collect', async (interaction) => {
		  msgPoke.delete()
		  if(interaction.customId === 'start') {
			  await interaction.showModal(modalChange, {client: this.client, interaction: interaction,})
			  const filter = (interaction) => interaction.customId === 'change'
			  interaction.awaitModalSubmit({ filter, time: 150000 }).then(async (i) => {
					  if(i.customId === 'change') {
						  //pegando parametros das caixas de texto
						  let pName = interaction.fields.getTextInputValue('textName')
						  let pDesc = interaction.fields.getTextInputValue('textDesc')
						  let pType = interaction.fields.getTextInputValue('textType')
						  let pTitle = interaction.fields.getTextInputValue('textTitle')

						  //salvando na db

						  pokeReg.pokeName = pName
						  pokeReg.pokeDes = pDesc
						  pokeReg.pokeType = pType
						  pokeReg.pokeTitle = pTitle
						  pokeReg.save()

						  let embedSucess = new EmbedBuilder()
						  .setColor(color.green)
						  .setTitle('<:YaroCheck:810266633804709908> | **Mudança de Registro Concluída**')
						  .setDescription('Os novos valores são:')
						  .addFields(
							  {name: '<:membroCDS:713866588398288956> | **Nome**', value: pokeReg.pokeName, inline: true},
							  {name: '<:7992_AmongUs_Investigate:810735122462670869> | **Descrição**', value: pokeReg.pokeDesc, inline: true},
							  {name: '<:passe:713845479691124867> | **Tipos**', value: pokeReg.pokeType, inline: true},
							  {name: '<:classes:713835963133985019> | **Espécie**', value: pokeReg.pokeTitle, inline: true},
							  );

						  await interaction.reply({embeds: [embedSucess]})
					  }//if interaction modalChange
			  })
		  } else if(interaction.customId === 'cancel') { message.channel.send(msgCancel) }
	  })//collectorOp
	  	
  }
  
  
  
  }
}
