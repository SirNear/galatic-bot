const Command = require('../../structures/Command');
module.exports = class editarficha extends Command {

	constructor(client) {
		super(client, {
			name: "editarficha",
			category: "moderation",
			aliases: ["editf","efc"],
			UserPermission: null,
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
 async run({ message, args, client, server}) {
	 
    let personagem = args.slice(1).join(" ")
    let player = message.guild.member(message.mentions.users.first()) || message.guild.members.cache.get(args[0])
   
    let modRole = message.guild.roles.cache.get('779414091659345920')
   if(!message.member.roles.cache.has(modRole)) return error.noStaffRole(message)
   
   let char = await this.client.database.Char.find({_id: player.id, charName: personagem})
   
   if(!char) {
	   
	   	   
	   let embedA = new MessageEmbed()
	   .setTitle('**Digite o nome do avatar que está na ficha**')
	   .setDescription('Verfique a aba "aparência" e digite exatamente o que estiver escrito lá, respeitando ortografia.')
	   .setFooter('OBS.: Pode demorar até 15s para confirmar.')
		  
	   message.channel.send(embedA).then(msg => {
		   
                    const fWN2 = m => m.author.id === message.author.id 
                    const coletorWN2 = message.channel.awaitMessages(fWN2, {time:20000}).then(collected => {
			    
			    let avatar = collected.first()
			

	   
	   char = new this.client.database.Char({
		   _id: player.id,
		   charName: personagem,
		   aparencia: avatar,
		   
	   })
	   
	   char.save()
			    
	   let embed = new MessageEmbed()
	   .setTitle('<:pepeOK:810735233309474876> | **Ficha Aprovada**')
	   .addField('**Player**:', player, true)
	   .addField('**Nome do Personagem**:', personagem, true)
	   .addField('**Aparência**:', avatar, true)
	   .addField('**Yens**:' + ` ${char.yens}`)
	   .addField('**Nível do personagem:**' + ` ${char.nivel}`)
	   .addField('**Rank do personagem**:' + ` ${char.rank}`)
	   .setFooter(player.id)

	   message.channel.send(embed).then(msg => {
		player.send(embed)   
	   })
		   
	 })
	})	   
   }
   
   
 }
}
