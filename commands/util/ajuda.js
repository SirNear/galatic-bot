const { MessageEmbed } = require('discord.js');
const Command = require('../../Structures/Command');

module.exports = class extends Command {

	constructor(...args) {
		super(...args, {
			aliases: ['help','comandos','cmds'],
			description: 'Ver todos os comandos do bot',
			category: 'util',
			usage: '[command]'
		});
	}
  
	async run(message, [command]) {
  
    const server = await client.database.Guilds.findById(message.guild.id)
    
    const embed = new Discord.MessageEmbed() 
    .setColor('#bc42f4')
    .setTimestamp()
    .setThumbnail(client.user.displayAvatarURL)
    .setAuthor(`${message.guild.name} | Menu de Ajuda`, message.guild.iconURL({ dynamic: true }))
    
    if (command) {
			const cmd = this.client.commands.get(command) || this.client.commands.get(this.client.aliases.get(command));

			if (!cmd) return message.channel.send(`Nome de Comando Inválido. \`${command}\``);

			embed.setAuthor(`${this.client.utils.capitalise(cmd.name)} Comando de Ajuda`, this.client.user.displayAvatarURL());
			embed.setDescription([
				`**❯ Encurtamentos:** ${cmd.aliases.length ? cmd.aliases.map(alias => `\`${alias}\``).join(' ') : 'Sem encurtamentos'}`,
				`**❯ Descrição:** ${cmd.description}`,
				`**❯ Categoria:** ${cmd.category}`,
				`**❯ Uso:** ${cmd.usage}`
			]);

			return message.channel.send(embed);
		}else {
			embed.setDescription([
				`Estes são os coamndos para ${message.guild.name}`,
				`O prefixo do bot é ${server.prefix}`,
				`Parametros: \`<>\` é restrito & \`[]\` é opcional`
			]);
			let categories;
			if (!this.client.owners.includes(message.author.id)) {
				categories = this.client.utils.removeDuplicates(this.client.commands.filter(cmd => cmd.category !== 'Owner').map(cmd => cmd.category));
			} else {
				categories = this.client.utils.removeDuplicates(this.client.commands.map(cmd => cmd.category));
			}

			for (const category of categories) {
				embed.addField(`**${this.client.utils.capitalise(category)}**`, this.client.commands.filter(cmd =>
					cmd.category === category).map(cmd => `\`${cmd.name}\``).join(' '));
			}
			return message.author.send(embed);
      message.channel.send('**Verifique sua DM**')
		}
	}


})
  
  
  }
