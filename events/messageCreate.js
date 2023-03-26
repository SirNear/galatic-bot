const { EmbedBuilder, Discord } = require('discord.js')
const fetch = require('node-fetch');
const axios = require('axios');

module.exports = class MessageReceive {
	constructor(client) {
		this.client = client
	}

	async run(message, client, translate, interaction) {
		
		
		if (message.channel.type === "dm") return
		if (message.author.bot) return //se for msg de bot
		
		//Pokemon
		
		const chance = 0.2
		const random = Math.random()
		
		if(random < chance) {
		
			function handlePokemonType(type) {
			  switch (type) {
			    case 'fire':
			      return 'fogo';
			      break;
			    case 'water':
			      return 'água';
			      break;
			    case 'grass':
			      return 'grama';
			      break;
			    case 'electric':
			      return 'elétrico';
			      break;
			    case 'rock':
			      return 'pedra';
			      break;
			    case 'ground':
			      return 'terra';
			      break;
			    case 'psychic':
			      return 'psíquico';
			      break;
			    case 'ice':
			      return 'gelo';
			      break;
			    case 'fighting':
			      return 'lutador';
			      break;
			    case 'ghost':
			      return 'fantasma';
			      break;
			    case 'poison':
			      return 'veneno';
			      break;
			    case 'flying':
			      return 'voador';
			      break;
			    case 'bug':
			      return 'inseto';
			      break;
			    case 'dark':
			      return 'sombrio';
			      break;
			    case 'steel':
			      return 'aço';
			      break;
			    case 'dragon':
			      return 'dragão';
			      break;
			    case 'fairy':
			      return 'fada';
			      break;
			    default:
			      return type;
			      break;
			  }
			}



			const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1000');
			const data = await response.json();
			const randomIndex = Math.floor(Math.random() * data.results.length);
			const pokemonUrl = data.results[randomIndex].url;
			const pokemonResponse = await fetch(pokemonUrl);
			const pokemonData = await pokemonResponse.json();
			const pokemonName = pokemonData.name;
			const pokemonImage = pokemonData.sprites.front_default;
			const pokemonType = pokemonData.types.map(type => type.type.name).join(', ');


			const embed = new EmbedBuilder()
			.setTitle(`**Um** ${pokemonName} **selvagem apareceu!**`)
			.setDescription('Digite `g!capturar` para tentar pega-lo!')
			.setImage(pokemonImage)
			.setFooter({ text: `Tipo(s): ${handlePokemonType(pokemonType)}`});

			const pokeMsg = await message.channel.send({ embeds: [embed] })

			const collector = await pokeMsg.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})
			collector.on('collect', (collected) => {
				if(collected.content === 'g!capturar') {
					console.log('deu certo bro')
					message.reply({content: 'testando'})
					
				}//if g!capturar
			})//collector

		}else{ return }
		
		//pokemon

        const server = await this.client.database.Guilds.findById(message.guild.id)
	 if (!server) {
      this.client.database.Guilds({
          _id: message.guild.id
      }).save().then(msg =>{
          console.log('Deu certo bro')
      })
    }
		
	let userDb = await this.client.database.userData.findById(message.author.id)

		
         if(!userDb) {
              this.client.database.userData({
                 _id: message.author.id,
                  uid: message.author.id,
                  uName: message.author.username,
                 uServer: message.guild.id,
             }).save()

         }
         
  
     if(userDb.monitor == 'ativado') {

        if(!message.guild.channels.cache.get(`${userDb.monitorChannelId}`)) {
         userDb.monitor = 'desativado'
         userDb.save()
		

    }else {


      let embedMonitor = new Discord.MessageEmbed()
      .setTitle(`<:nani:572425789178642472> | **Nova mensagem de ${message.author.username}** | <:nani:572425789178642472>`)
      .setDescription(message.content)
      .addField(`**Canal:**`, message.channel)
      .setTimestamp()


       message.guild.channels.cache.get(`${userDb.monitorChannelId}`).send(embedMonitor)

    }       
   }
     
 
		
	if (message.content.replace(/!/g, "") === message.guild.members.me.toString().replace(/!/g, "")) {
		message.channel.send(` **Hey ${message.author}, Tudo bom? Meu nome é Galatic, sou o Deus deste universo, para me pedir algo, utilize meu prefix que é** \`\`${server.prefix}\`\`**, Caso queira saber mais comandos meus, basta usar o comando \`\`${server.prefix}ajuda\`\`, espero que se divirta comigo!**`) 
	}
     
   
	if (!message.content.startsWith(server.prefix)) return
		const args = message.content.slice(server.prefix.length).trim().split(/ +/g)
		const command = args.shift().toLowerCase()
		const comando = this.client.commands.get(command) || this.client.commands.get(this.client.aliases.get(command))
    
    try {
      new Promise((res, rej) => {
		message.channel.sendTyping()
		res(comando.run({ message, args, server }))
	})
	    
	          const bt = message.guild.members.cache.get(this.client.user.id)

          	   if(!bt.permissions.has("ADMINISTRATOR")) {
			   
      
              		  let dono = message.guild.owner
      
           	         const embed = new EmbedBuilder()
             		   .setColor('RANDOM')
               		   .setTitle('<:error_2:676239899065843722> | Sem Permissão | <:error_2:676239899065843722>')
                	   .setDescription(`Olá ${dono.user}, estou no seu servidor ${message.guild.name} porém meu cargo está sem a permissão \`ADMINISTRADOR\` e preciso dela para funcionar.`)
      
                	 dono.send(embed)
        
		  }
    		} catch (err) {
				
			
		message.channel.send(`**ERRO:**\`${err}\``)
		console.error(err.stack)
				
		}
		
		// Pokemon
		

		
		
	    }
      }
