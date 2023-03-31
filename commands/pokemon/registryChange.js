
const { Discord, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const Command = require('../../structures/Command');
const color = require('../../api/colors.js')
const error = require('../../api/error.json')
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

	    const filterSim = i => i.customId === 'primary' && i.user.id === message.author.id;
	    const collectorSim = msgNoPoke.channel.createMessageComponentCollector({ filterSim, time: 15000 })

	    const filterNao = i => i.customId === 'secondary' && i.user.id === message.author.id;
	    const collectorNao = msgNoPoke.channel.createMessageComponentCollector({ filterNao, time: 15000 })

	    collectorSim.on('collect', (collected) => {
		    message.delete()
		    
		    const embedReg = new EmbedBuilder()
		    .setTitle('Registro de Pokémon')
		    .setDescription('Qual é o nome do pokémon?')
		    .setColor(color.purple)
		    
		    const pokeMsg = await message.channel.send({embeds: [embedReg]})
		    const collectorNome = await pokeMsg.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})
		    collectorNome.on("collect", (collected) => {
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
			    collectorDesc.on("collect", (collected) => {
				    nomeMsg.delete()
				    let regDesc = collected.content
				    embedReg.setDescription('Qual é o tipo do pokémon? Em inglês. Se for mais de um tipo, separe por uma "/"')
				    embedReg.addFields({name: '**Descrição**', value: regDesc})
				    
				    const descMsg = await message.channel.send({embeds: [embedReg]})
				    const collectorType = descMsg.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})
				    collectorType.on("collect", (collected) => {
					    descMsg.delete()
					    let regType = collected.content
					    embedReg.setDescription('Qual é a espécie do pokémon? Ex.: Lucario é da espécie pokémon aura.')
					    embedReg.addFields({name: '**Tipos:**', value: regType})
					    
					    const typeMsg = await message.channel.send({embeds: [embedReg]})
					    const collectorTitle = typeMsg.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})
					    collectorTitle.on('collect', (collected) => {
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
	    })
    
  }//if !pokeReg
  
  
  
  }
}
