const { Discord, ModalBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, TextInputStyle, TextInputBuilder, fetchRecommendedShardCount } = require('discord.js');
const Command = require('../../structures/Command.js');
const error = require('../../api/error.js')
const color = require('../../api/colors.json')


module.exports = class associar extends Command {
	constructor(client) {
		super(client, {
			name: "associar",
			category: "rpg",
			aliases: ['ass', 'ac', 'registrar'],
			UserPermission: [""],
			clientPermission: null,
			OnlyDevs: false,
			structure: 'membro jogador'
		})
	}
  
async run({ message, args, client, server}) {

	if (!message.member.roles.cache.has('731974690125643869') && message.guild.id == '731974689798488185' ) {  message.reply({content: `${error.noAdmod}`}) }

	let msgArg = args.slice(0).join(' '); //ARGUMENTO DIGITADO PELO USUARIO
	!msgArg.trim() ? error.helpCmd(server, this.config, message) : null;



  }
}
