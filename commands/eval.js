const Discord = require("discord.js");
const config = require("../config.json");

exports.run = async (bot, message, args, color, prefix) => {
        if (!config.owners.some(owner => message.author.id === owner)) return message.reply("sem permissão")
    try {
        let codein = args.join(" ");
        let code = eval(codein);

        if (typeof code !== 'string')
            code = require('util').inspect(code, { depth: 0 });
        let embed = new Discord.MessageEmbed()
        .setColor('#2EFE64')   
        .addField('📥 Entrada:', `\`\`\`js\n${codein}\`\`\``)
        .addField(':outbox_tray: Saida:', `\`\`\`js\n${code}\n\`\`\``)
        message.channel.send(embed)
    } catch(e) {
        message.channel.send(`\`\`\`js\n${e}\n\`\`\``);
    }
}

exports.config = {
    name: 'eval',
    aliases: [],
    category: 'dev'
}