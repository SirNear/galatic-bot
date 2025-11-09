const { EmbedBuilder, Discord, ChannelType, PermissionsBitField } = require("discord.js");
const fetch = require("node-fetch");
const axios = require("axios");
const { handlePokemonType } = require("../api/typeTranslate.js");
const { tiposPokemon } = require("../api/tiposPokemon.js");
const { handleTypeIdentifier } = require("../api/typeIdentifier.js");
const { iniciarContador, pararContador } = require("../api/contador.js");

const registeringUsers = new Set();

module.exports = class MessageReceive {
  constructor(client) {
    this.client = client;
  }

  async run(message, client, translate, interaction) {
    if (message.channel.type === ChannelType.DM) return;
    if (message.author.bot) return; //se for msg de bot

    let server = await this.client.database.Guilds.findById(message.guild.id); //CARREGAMENTO DATABASE

    if (!server) {
      //Se a guilda não tiver salva
      await this.client.database
        .Guilds({
          _id: message.guild.id,
        })
        .save()
        .then((msg) => {
          console.log(`Servidor ${message.guild.name} armazenado na database!`);
        });
    }

    if (
      message.content.replace(/!/g, "") ===
      message.guild.members.me.toString().replace(/!/g, "")
    ) {
      //menção do bot
      if (!server) {
        server.prefix == "g!";
      }
      message.channel.send(
        ` **Hey ${message.author}, Tudo bom? Meu nome é Galatic, sou o Deus deste universo, para me pedir algo, utilize meu prefix que é** \`\`${server.prefix}\`\`**, Caso queira saber mais comandos meus, basta usar o comando \`\`${server.prefix}ajuda\`\`, espero que se divirta comigo!**`
      );
    }

    /* #region  POKEMONM */
    /*	
	if(message.author.id == '540725346241216534') {
			const chance = 0.2
			const random = Math.random()
			
			if(this.client.activeCollector === true) {
				return
			} else {
				if(random < chance) {

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
							pokeType: handlePokemonType(pokemonType),
							pokeTitle: ''
						}).save().then(msg => {
							console.log('Novo pokémon registrado:' + ` ${pokemonName} / ${handlePokemonType(pokemonType)}`)
						})//then save
					}//if sem registro

					// g!capturar codigo

					//const collector = await pokeMsg.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})
					/*
					collector.on('collect', (collected) => {
						if(collected.content === 'g!capturar') {

							console.log('deu certo bro')
							message.reply({content: 'testando'})

						}//if g!capturar
					})//collector
					

				}//if
			}//else
		
	}
		//*pokemon 
		*/
    /* #endregion */

    // Busca o usuário para verificar se ele já existe.
    let userDb = await this.client.database.userData.findOne({ uid: message.author.id, uServer: message.guild.id });

    // Se o usuário não existe, cria o registro e inicia o processo de associação.
    if (!userDb) {
        // Previne múltiplas tentativas de registro simultâneas para o mesmo usuário.
        if (registeringUsers.has(message.author.id)) return;

        try {
            registeringUsers.add(message.author.id);

            // Cria o novo usuário no banco de dados.
            userDb = await this.client.database.userData.create({
                uid: message.author.id,
                uServer: message.guild.id,
                uName: message.author.username,
                monitor: "desativado",
                jogador: "nrpg" // Define como "não registrado"
            });

            // Inicia o processo de registro via DM apenas para o servidor específico.
            if (message.guild.id === "731974689798488185") {
                const embedRegistroPlayer = new EmbedBuilder()
                    .setColor("#13d510")
                    .setTitle("<a:pingugun:1408888581929439402> | QUEM É VOCÊ?")
                    .setDescription(`Olá, ${message.author.username}! Notei que é sua primeira vez por aqui (ou pelo menos para mim). Para que eu possa te ajudar melhor com as funcionalidades de RPG, poderia me dizer qual o seu nome de jogador?`)
                    .setThumbnail(message.author.avatarURL())
                    .setFooter({ text: "Envie apenas seu primeiro nome aqui mesmo. Não envie nada além disso!" })
                    .setTimestamp();

                const dmChannel = await message.author.createDM().catch(() => null);
                if (!dmChannel) return;

                const msgDm = await dmChannel.send({ embeds: [embedRegistroPlayer] }).catch(() => null);
                if (!msgDm) return;

                const collector = dmChannel.createMessageCollector({
                    filter: (m) => m.author.id === message.author.id,
                    max: 1,
                    time: 600000, // 10 minutos
                });

                collector.on('collect', async (collectedMessage) => {
                    const jogador = collectedMessage.content.trim().split(/\s+/)[0];

                    await this.client.database.userData.updateOne(
                        { uid: message.author.id, uServer: message.guild.id },
                        { $set: { jogador: jogador } }
                    );

                    console.log(`RPG - SISTEMA DE REGISTRO | usuário ${message.author.username} associado ao jogador ${jogador}`);
                    await msgDm.reply({ content: `<a:Where_Staffs:1408891552738054306> | Prontinho! Você foi associado ao jogador **${jogador}**. Se desejar alterar, use o comando \`/associar\` no servidor.` }).catch(console.error);
                });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        dmChannel.send("Tempo esgotado. O registro foi cancelado. Envie uma mensagem no servidor novamente para tentar de novo.").catch(() => {});
                    }
                });
            }
        } catch (error) {
            console.error("Erro no processo de registro de novo usuário:", error);
        } finally {
            registeringUsers.delete(message.author.id);
        }
    } else {
        // Se o usuário já existe, apenas atualiza o nome de usuário se necessário.
        if (userDb.uName !== message.author.username) {
            userDb.uName = message.author.username;
            await userDb.save();
        }

        // Lógica de monitoramento para usuários existentes.
        if (userDb.monitor === "ativado" && userDb.uServer === message.guild.id) {
            const monitorChannel = message.guild.channels.cache.get(userDb.monitorChannelId);
            if (monitorChannel) {
                let embedMonitor = new EmbedBuilder()
                    .setTitle(`<:nani:572425789178642472> | **Nova mensagem de ${message.author.username}**`)
                    .setDescription(message.content || "*Mensagem sem texto (possivelmente um anexo)*")
                    .addFields({ name: `**Canal:**`, value: `${message.channel}` })
                    .setTimestamp();
                monitorChannel.send({ embeds: [embedMonitor] });
            } else {
                // Desativa o monitor se o canal não for encontrado.
                userDb.monitor = "desativado";
                await userDb.save();
            }
        }
    }

    let prefix = server ? server.prefix : "g!";

    if (!message.content.startsWith(prefix)) return; //se não começar com o prefixo
    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();
    let comando = this.client.commands.get(command);
    if (!comando) comando = this.client.commands.get(this.client.aliases.get(command));

    try {
      if (comando) {
        new Promise((res, rej) => {
          message.channel.sendTyping();
          res(comando.run({ message, args, server }));
        });
      } else {
        message.channel.send(
          `**Erro:** O comando \`${command}\` não foi encontrado. Acesse \`\`${server.prefix}help\`\` para ver a lista de comandos disponíveis.`
        );
      }
      const bt = message.guild.members.cache.get(this.client.user.id);

      if (!bt.permissions.has("ADMINISTRATOR")) {
        let dono = message.guild.owner;

        const embed = new EmbedBuilder()
          .setColor("RANDOM")
          .setTitle(
            "<:error_2:676239899065843722> | Sem Permissão | <:error_2:676239899065843722>"
          )
          .setDescription(
            `Olá ${dono.user}, estou no seu servidor ${message.guild.name} porém meu cargo está sem a permissão \`ADMINISTRADOR\` e preciso dela para funcionar.`
          );

        dono.send(embed);
      } //if bt
    } catch (err) {
        if(!message.guild.members.me.permissions.has(PermissionsBitField.Flags.Administrator) && message.guild.id === '930871020557062162') return
        message.channel.send(`**ERRO:**\`${err}\``);
        console.error(err.stack);
    } //error try
  }
};
