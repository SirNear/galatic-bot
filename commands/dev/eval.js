const { MessageEmbed } = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')
const color = require('../../api/colors.json')
const { inspect } = require('util')


module.exports = class eval extends Command {

	constructor(client) {
		super(client, {
			name: "eval",
			category: "dev",
			aliases: ["e"],
			UserPermission: null,
			clientPermission: null,
			OnlyDevs: true
		})
	}
  
 async run({ message, args, client, server}) {
   
   try {
			const util = require("util")
			let evaled = await eval(args.join(" "))
			evaled = util.inspect(evaled, { depth: 1 })
			evaled = evaled.replace(new RegExp(`${this.client.token}`, "g"), undefined)

			if (evaled.length > 1800) evaled = `${evaled.slice(0, 1800)}...`
			message.channel.send(evaled, { code: "js" })
		} catch (err) {
			const errorMessage = err.stack.length > 1800 ? `${err.stack.slice(0, 1800)}...` : err.stack
			const embed = new MessageEmbed()
			embed.setColor('RANDOM')
			embed.setTitle(`**ERRO**`)
			embed.setDescription(`\`\`\`js\n${errorMessage}\`\`\``)

			message.channel.send(embed)
		}
  }
