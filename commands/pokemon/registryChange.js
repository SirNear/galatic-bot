
const { Discord, ModalBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, TextInputStyle, TextInputBuilder, fetchRecommendedShardCount } = require('discord.js');
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
			OnlyDevs: false,
			structure: `\`nome do pokemon\``
		})
	}
  
async run({ message, args, client, server}) {
	let msgArg = args.slice(0).join(' '); //ARGUMENTO DIGITADO PELO USUARIO
	!msgArg.trim() ? error.helpCmd(server, this.config, message) : null;
		// SE O ARGUMENTO FOR VALIDO (UNICA PALAVRA OU NÃO VAZIO)

		const pokeReg = await this.client.database.pokeReg.findOne({ pokeName: msgArg}) // ACHAR DATABASE COM NOME DO POKEMON DIGITADO

		// DEFINIÇÕES DE DADOS DO POKÉMON VIA API
		let response = await fetch(`https://pokeapi.co/api/v2/pokemon/${msgArg.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`)
		if (!response.ok) return message.reply({ content: 'Esse pokemon não existe!', ephemeral: true });
		const data = await response.json();
		const regId = data.id // ID DO POKEMON
		const regName = data.name //NOME
		const regImg = data.sprites.front_default; // IMAGEM
		const regType = data.types.map(type => type.type.name).join(', '); // TIPAGEM
		let regDesc = '';

		if(!regName) { // SE O POKEMON DIGITADO NÃO EXISTIR
			pokeMsg.delete()
			message.reply({content: '**Esse pokémon não existe! Por favor, repita o comando.**'})
		}


	if(!pokeReg) { // SE O POKEMON NÃO ESTIVER REGISTRADO

		const registerConfirmationRow = new ActionRowBuilder() //BOTÕES DE CONFIRMAÇÃO DE REGISTRO
				.addComponents(
					new ButtonBuilder()
						.setCustomId('confirma')
						.setLabel('SIM')
						.setStyle(ButtonStyle.Success),
					new ButtonBuilder()
						.setCustomId('cancela')
						.setLabel('NÃO')
						.setStyle(ButtonStyle.Danger),
				);
		
		// MENSAGEM DE CONFIRMAÇÃO DE REGISTRO
	    const mensagemConfirmacao = await message.reply({ content: 'Esse pokémon não foi registrado, deseja registrar?', ephemeral: true, components: [registerConfirmationRow] });

		// COLETOR DE INTERAÇÕES PARA A MENSAGEM DE CONFIRMAÇÃO
	    const coletorConfirmacao = mensagemConfirmacao.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000 });

		//Coletor registro manual
	    coletorConfirmacao.on('collect', async i => {
		    if (i.customId === 'confirma') { // SE CLICAR NO BOTÃO "SIM" PARA REGISTRAR POKEMON
			    mensagemConfirmacao.delete()

			    const embedRegistro = new EmbedBuilder()
					.setTitle('Registro de Pokémon')
					.setDescription('Qual é a descrição do pokémon?')
					.addFields(
						{name: '<:membroCDS:713866588398288956> | **Nome**', value: regName, inline: true},
						{name: '<:passe:713845479691124867> | **Tipos**', value: regType, inline: true},
					)
					.setImage(regImg)
					.setColor(color.purple)

			    const mensagemRegistroDescricao = await message.reply({embeds: [embedRegistro], ephemeral: true})
			    this.client.activeCollector = true;

			    const coletorDescricao = await mensagemRegistro.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})

			    coletorDescricao.on("collect", async (collected) => { // COLETA DESCRIÇAÕ DO POKEMON
				    mensagemRegistro.delete()
					regDesc = collected.content // DESCRIÇÃO DO POKEMON VIRA O DIGITADO


					/*
					if(pokeReg) {
						const responseDesc =  await fetch(`https://pokeapi.co/api/v2/pokemon-species/${msgArg}`)
						const dataDesc = await responseDesc.json();
						regDesc = dataDesc.flavor_text_entries.find(
							entry => entry.language.name === 'pt'
							);

						if (!regDesc) {
							regDesc = dataDesc.flavor_text_entries.find(
								entry => entry.language.name === 'en'
							).flavor_text.replace(/\n|\f/g, ' ')

						}else { regDesc = regDesc.flavor_text.replace(/\n|\f/g, ' ') }
					}else { regDesc = collected.content }
					*/
					
				    embedRegistro.setDescription('Qual é a espécie do pokémon? Ex.: Lucario é da espécie pokémon aura.') // MENSAGEM DE ESPECIE DO POKEMON
				    embedRegistro.addFields( {name: '<:7992_AmongUs_Investigate:810735122462670869> | **Descrição**', value: regDesc} ) // DESCRIÇÃO DEFINIDA ADICIONADA

					// ENVIA MENSAGEM COM DESCRIÇÃO + PEDINDO TIPAGEM
				    const mensagemDescricao = await message.channel.send({embeds: [embedRegistro]})

					// CRIA COLETOR DE TIPO
				    const coletorEspecie = mensagemDescricao.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 120000, max: 1})

				    coletorEspecie.on('collect', async (collected) => {
					    mensagemDescricao.delete()
					    let regEspecie = collected.content

						// EMBED REGISTRO COMPLETO
					    embedRegistro.setDescription('Registro concluido!')
					    embedRegistro.addFields({name: '**Espécie:**', value: regEspecie})

					    message.channel.send({embeds: [embedRegistro]}).then(msg => { // EMBED COMPLETO

						    this.client.database.pokeReg({ // CRIAR REGISTRO POKEMON
							    _id: regId,
							    pokeName: regName, // NOME DO POKEMON
							    pokeType: regType, // tipagem pokemon
							    pokeTitle: regEspecie // especie pokemon
						    }).save().then(msg => {
							    console.log('Novo pokémon registrado:' + ` ${regName} / ${regType}`)
							    message.channel.send({embeds: [embedReg]})
							    this.client.activeCollector = false;

						    })//then save database
					    })//then embed
				    })//coletorEspecie
			    })//coletorDescricao
		    } else if (i.customId === 'secondary') {
				mensagemRegistro.delete()
			    message.reply({content: `Tudo bem! Se o pokémon surgir naturalmente, ele será registrado automaticamente, mas você pode fazer manualmente quando quiser = )`})
		    }
	    })//coletorCConfirmacao

  }else {//else do if !pokeReg - SE POKEMON EXISTIR - EDIÇÃO

	let formularioRegisto = new ModalBuilder()
		.setCustomId('esqueletoFormularioRegistro')
		.setTitle('Registro de pokémon')
	  
	let campoNome = new TextInputBuilder()
		.setCustomId('campoNome')
		.setLabel('Nome')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder(pokeReg.pokeName) // CAIXA DE TEXTO
		.setRequired(false) 
		.setMaxLength(1000) //CARACTERES MAXIMOS
		.setMinLength(2) // CARACTERES MINIMOS
		.setValue(pokeReg.pokeName) // PRÉ-TEXTO CAIXA DE TEXTO

	let campoTipo = new TextInputBuilder()
		.setCustomId('campoTipo')
		.setLabel('Tipos')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder(pokeReg.pokeType)
		.setRequired(false)
		.setMaxLength(1000)
		.setMinLength(2)
		.setValue(pokeReg.pokeType)
	if (pokeReg.pokeTitle === '') { pokeReg.pokeTitle = 'Sem titulo definido' }

	let campoEspecie = new TextInputBuilder()
		.setCustomId('campoEspecie')
		.setLabel('Espécie')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder(pokeReg.pokeTitle)
		.setRequired(false)
		.setMaxLength(1000)
		.setMinLength(2)
		.setValue(pokeReg.pokeTitle)
	  
	const actionRowNome = new ActionRowBuilder().addComponents(campoNome);
	const actionRowTipo = new ActionRowBuilder().addComponents(campoTipo);
	const actionRowEspecie = new ActionRowBuilder().addComponents(campoEspecie);

	formularioRegisto.addComponents(actionRowNome, actionRowTipo, actionRowEspecie)

	const botoesConfirmacao = new ActionRowBuilder()
		.addComponents(
			new ButtonBuilder()
				.setCustomId('confirma')
				.setLabel('SIM')
				.setStyle(ButtonStyle.Primary),
	       	new ButtonBuilder()
				.setCustomId('cancela')
				.setLabel('CANCELAR')
				.setStyle(ButtonStyle.Primary),
	  	)

	  let mensagemConfirmacaoRegistrado = await message.channel.send({content: 'Este pokémon já foi encontrado! Seus dados estão como padrão o valor pré-definido, altere apenas o que quiser e não deixe nada em branco. Podemos começar?', ephemeral: true, components: [botoesConfirmacao]})//, ephemeral: true, components: [rowChange]})

	  const collectorOp = mensagemConfirmacaoRegistrado.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000 });

	  collectorOp.on('collect', async (interaction) => {
		  mensagemConfirmacaoRegistrado.delete()

		  if (interaction.customId === 'confirma') {
			  await interaction.showModal(formularioRegisto, {client: this.client, interaction: interaction,})

			  const filter = (interaction) => interaction.customId === 'confirma'

			  interaction.awaitModalSubmit({ filter, time: 150000 }).then(async (interaction) => {
					  if (interaction.customId === 'confirma') {

						  //pegando parametros das caixas de texto
						  let pName = await interaction.fields.getTextInputValue('campoNome')
						  let pDesc = await interaction.fields.getTextInputValue('campoDesc')
						  let pType = await interaction.fields.getTextInputValue('campoTipo')
						  let pTitle = await interaction.fields.getTextInputValue('campoEspecie')

						  //salvando na db

						  pokeReg.pokeName = pName
						  pokeReg.pokeDesc = pDesc
						  pokeReg.pokeType = pType
						  pokeReg.pokeTitle = pTitle
						  pokeReg.save().then(() => { 
							console.log(`POKEMON SYSTEM | Registro de ${pokeReg.pokeName} atualizado com sucesso!`)
						  })

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
		  } else if(interaction.customId === 'cancelar') { message.reply({content: 'A mudança de registro foi cancelada.', ephemeral: true}) }
	  })//collectorOp

	collectorOp.on('end', (collected, reason) => {
  		if (reason === 'time' && collected.size === 0) {
    		console.log('Usuário não interagiu a tempo.');
			message.reply({content: 'Você não interagiu a tempo. O registro foi cancelado.', ephemeral: true})
  		}
	});
	  	
  }
  
  
  
  }
}
