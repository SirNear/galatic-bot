const Command = require('../../structures/Command');

module.exports = class dormir extends Command {

	constructor(client) {
		super(client, {
			name: "dormir",
			category: "rpg",
			aliases: ["sleep", 'slp'],
			UserPermission: null,
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
	 run({ message, args, client, server}) {
     
     const embed = new MessageEmbed()
     .setTitle('💤 **Comando para Dormir**')
     .setDescription('Você irá colocar seu personagem em afk e ele irá ir dormir em algum canto seguro, assim recuperando 20 de estamina a cada hora e assim podendo estacar além do máximo. \n \n Após ultrapassar o máximo de estamina, ele irá ganhar 5 por hora dicional.')
     .addField()
     
     
     
     
   })
