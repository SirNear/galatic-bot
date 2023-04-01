const { EmbedBuilder, Discord } = require('discord.js')
const fetch = require('node-fetch');
const axios = require('axios');
const { handlePokemonType } = require('../api/typeTranslate.js');
const { tiposPokemon } = require('../api/tiposPokemon.js');
const { handleTypeIdentifier } = require('../api/typeIdentifier.js');

module.exports = class MessageReceive {
	constructor(client) {
		this.client = client
	}

	async run(message, client, translate, interaction) {
		
		
		if (message.channel.type === "dm") return
		if (message.author.bot) return //se for msg de bot
		
		const server = await this.client.database.Guilds.findById(message.guild.id) //database
		
		if (message.content.replace(/!/g, "") === message.guild.members.me.toString().replace(/!/g, "")) { //menção do bot
			message.channel.send(` **Hey ${message.author}, Tudo bom? Meu nome é Galatic, sou o Deus deste universo, para me pedir algo, utilize meu prefix que é** \`\`${server.prefix}\`\`**, Caso queira saber mais comandos meus, basta usar o comando \`\`${server.prefix}ajuda\`\`, espero que se divirta comigo!**`) 
		}
		
		//Pokemon
		
		const chance = 0.2
		const random = Math.random()
		
		if(this.activeCollector === true) {
			return
		} else {
			//if(random < chance) {

				//identificando as palavras-chave para definir os tipos encontrados
				const mensagem = message.content.toLowerCase();
				const tiposEncontrados = [];
				for (let tipo in tiposPokemon) {
				  if (tiposPokemon[tipo].some(palavraChave => mensagem.includes(palavraChave))) {
				    tiposEncontrados.push(tipo);
				  }
				}

				//aleatorizando o tipo a ser enviado
				let tipoPokemon;
				let tipo;
				if (tiposEncontrados.length > 0) {
				  const randomIndex = Math.floor(Math.random() * tiposEncontrados.length);
				  tipoPokemon = tiposEncontrados[randomIndex];	
				  tipo = handleTypeIdentifier(tipoPokemon)
				} else {
				  tipo = 1
				}

				const response = await fetch(`https://pokeapi.co/api/v2/type/${tipo}`);
				const data = await response.json();

				const pokemonArray = data.pokemon;
				const randomIndex = Math.floor(Math.random() * pokemonArray.length);
				const pokemonUrl = pokemonArray[randomIndex].pokemon.url;

				const pokemonResponse = await fetch(pokemonUrl);
				const pokemonData = await pokemonResponse.json();
				let pokemonName = pokemonData.name;
				let pokemonImage = pokemonData.sprites.front_default;
				let pokemonType = pokemonData.types.map(type => type.type.name).join(', ');

				const embed = new EmbedBuilder()
				.setTitle(`**Um** ` + pokemonName + ` **selvagem apareceu!**`)
				.setDescription('Digite `g!capturar` para tentar pega-lo!')
				.setImage(pokemonImage)
				.setFooter({ text: `Tipo(s): ${handlePokemonType(pokemonType)}`});

				const pokeMsg = await message.channel.send({ embeds: [embed] })

				//registrando pokemon
				let pokemonReg = await this.client.database.pokeReg.findById(pokemonData.id);
				if(!pokemonReg) {
					this.client.database.pokeReg({
						_id: pokemonData.id,
						pokeName: pokemonName,
						pokeType: handlePokemonType(pokemonType)
					}).save().then(msg => {
						console.log('Novo pokémon registrado:' + ` ${pokemonName} / ${handlePokemonType(pokemonType)}`)
					})//then save
				}//if sem registro

				const collector = await pokeMsg.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})
				collector.on('collect', (collected) => {
					if(collected.content === 'g!capturar') {

						console.log('deu certo bro')
						message.reply({content: 'testando'})

					}//if g!capturar
				})//collector

			//}//if
		}//else
		
		//pokemon

		 if (!server) { //Se a guilda não tiver salva
		      this.client.database.Guilds({
			  _id: message.guild.id
		      }).save().then(msg =>{
			  console.log('Deu certo bro')
		      })
		    }
		
		let userDb = await this.client.database.userData.findById(message.author.id)

		
		 if(!userDb) {//se o usuário não estiver salvo
		      this.client.database.userData({
			 _id: message.author.id,
			  uid: message.author.id,
			  uName: message.author.username,
			 uServer: message.guild.id,
		     }).save()
		 }

	          if(userDb.monitor == 'ativado') {// se o monitoramento do usuario estiver ativo
		          if(!message.guild.channels.cache.get(`${userDb.monitorChannelId}`)) {//se não tiver canal de monitoramento
				  userDb.monitor = 'desativado'
				  userDb.save()

		 	  }else { //se tiver canal de monitoramento
				  let embedMonitor = new EmbedBuilder()
				      .setTitle(`<:nani:572425789178642472> | **Nova mensagem de ${message.author.username}** | <:nani:572425789178642472>`)
				      .setDescription(message.content)
				      .addFields({name: `**Canal:**`, value: message.channel})
				      .setTimestamp()

				  message.guild.channels.cache.get(`${userDb.monitorChannelId}`).send({embeds: [embedMonitor]})

			}//else
		  }//if se monitorar
 
		if (!message.content.startsWith(server.prefix)) return; //se não começar com o prefixo
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
        
		       }//if bt
    		} catch (err) {
			message.channel.send(`**ERRO:**\`${err}\``)
			console.error(err.stack)	
		}//error try
		
		
	    }
      }
