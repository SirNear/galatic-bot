const { Discord, ModalBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, TextInputStyle, TextInputBuilder, fetchRecommendedShardCount } = require('discord.js');
const Command = require('../../structures/Command.js');
const error = require('../../api/error.js')
const color = require('../../api/colors.json')


module.exports = class associar extends Command {
	constructor(client) {
		super(client, {
			name: "associar",
			category: "rpg",
			aliases: ['ass', 'ac'],
			UserPermission: [""],
			clientPermission: null,
			OnlyDevs: true,
			structure: '@membro jogador'
		})
	}
  
async run({ message, args, client, server}) {

	let member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
	let msgJogador = args.slice(1).join(' ');

	if (!message.member.roles.cache.has('731974690125643869') && message.guild.id == '731974689798488185' ) {  message.reply({content: `${error.noAdmod}`}) }
	if(!member || !msgJogador.trim()) return error.helpCmd(server, this.config, message);

	//? --------------- EMBED ZONE ---------------------

	let embedConfirma = new EmbedBuilder()
		.setColor(color.moderation)
		.setTitle('<a:Nowoted:1408666836538495017> | DESEJA REGISTRAR ESSE USUÁRIO?')
		.setDescription(`O membro mencionado(${member}) será atribuido ao jogador \`\`${msgJogador}\`\`. Isso signifca que todo seu registro atual de ficha, aparências e futuras modificações ou dados passarão à pertencer e serem associados a ele. **Deseja continuar?** `)
		.setFooter({text: 'Use os botões para confirmar ou cancelar a operação'})

	let embedRegistrado = new EmbedBuilder()
		.setColor(color.moderation)
		.setTitle('<a:CaughtIn4K:1408664555382509598> | USUÁRIO REGISTRADO! ')
		.setDescription(`Membro ${member} associado ao jogador \`\`${msgJogador}\`\` `)

	const botaoConfirma = new ActionRowBuilder() 
		.addComponents(
			new ButtonBuilder().setCustomId('confirma').setLabel('SIM').setStyle(ButtonStyle.Success),
			new ButtonBuilder().setCustomId('nega').setLabel('CANCELAR').setStyle(ButtonStyle.Danger),
		);

	//? --------------- EMBED ZONE ---------------------


	message.delete()
	const msgPadrao = await message.reply({embeds: [embedConfirma], components: [botaoConfirma], ephemeral: true})

	const coletorBotao = msgPadrao.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 }); //60s de espera

	coletorBotao.on('collect', async i => {
		if(i.customId == 'confirma') {
			msgPadrao.edit({embeds: [embedRegistrado], components: []})
			coletorBotao.stop('closed');
		}else { 
			msgPadrao.edit({content: '<a:cdfpatpat:1407135944456536186> | Tudo bem! Você pode registar mais tarde!', components: [], embeds: []})
			coletorBotao.stop('closed');
		}
	})

  }
}
