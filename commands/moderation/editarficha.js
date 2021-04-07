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
   
    let modRole = message.guild.roles.cache.get('779414091659345920')
   if(!message.member.roles.cache.has(modRole)) return error.noStaffRole(message)
   
   let char = await this.client.database.Char.find({})
   
   
   
 })
