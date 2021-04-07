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
     .addField('Você deseja colocar seu personagem para dormir? \n \n ✅ Confirma? \n ❌ Não.')
     
     message.chanel.send(embed).then(msg => {
	     msg.react('✅')
	     msg.react('❌')
	     
	     
	     let filtro1 = (reaction, usuario) => reaction.emoji.name === "WHITE HEAVY CHECK MARK" && usuario.id === message.author.id;
            const coletor1 = msg.createReactionCollector(filtro1, {max: 1, time: 360000});
	     
	     let filtro2 = (reaction, usuario) => reaction.emoji.name === "CROSS MARK" && usuario.id === message.author.id;
            const coletor2 = msg.createReactionCollector(filtro2, {max: 1, time: 360000});
	     
	     coletor1.on("collect", em =>{
		message.channel.send('')     
		     
	     })
	     
     })
     
     
     
     
   })
