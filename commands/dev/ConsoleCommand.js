const { MessageEmbed } = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')
const color = require('../../api/colors.json')
const { inspect } = require('util')


module.exports = class ConsoleCommand extends Command {

	constructor(client) {
		super(client, {
			name: "console",
			category: "dev",
			aliases: ["logs",'cmd'],
			UserPermission: null,
			clientPermission: null,
			OnlyDevs: true
		})
	}
  
 async run({ message, args, client, server}) {
	 
	function log() {
	console.stdlog = console.log.bind(console);
	console.logs = [];
	console.log = function(){
	   console.logs.push(Array.from(arguments));
	   console.stdlog.apply(console, arguments);
		}			
	}
		 

	message.channel.send(log)
	 
	
 }
}
  
