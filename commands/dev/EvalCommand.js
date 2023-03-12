const { EmbedBuilder } = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')
const color = require('../../api/colors.json')
const { inspect } = require('util')


module.exports = class EvalCommand extends Command {

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
        let codein = args.join(" ");
        let code = eval(codein);

        if (typeof code !== 'string')
            code = require('util').inspect(code, { depth: 0 });
        let embed = new EmbedBuilder()
        .setColor('#2EFE64')   
        .addField('📥 Entrada:', `\`\`\`js\n${codein}\`\`\``)
        .addField(':outbox_tray: Saida:', `\`\`\`js\n${code}\n\`\`\``)
        message.channel.send(embed)
    } catch(e) {
        message.channel.send(`\`\`\`js\n${e}\n\`\`\``);
    }
}
}
