
const { Discord, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')

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
	      message.reply({content: 'a'})
	    })
    
  }//if pokeReg
  
  
  
  }
}
