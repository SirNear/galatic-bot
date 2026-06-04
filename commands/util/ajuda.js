const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const Command = require('../../structures/Command');
const colors = require('../../api/colors.json');

module.exports = class ajuda extends Command {

	constructor(client) {
		super(client, {
			name: "ajuda",
			category: "util",
			aliases: ["ajuda", 'help', 'comandos', 'cmds'],
			slash: true,
			description: "Mostra o menu de ajuda com todos os comandos.",
			UserPermission: null,
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
	async run({ message, args, server, interaction }) {
		const isSlash = !!interaction;
		const author = isSlash ? interaction.user : message.author;
		const guild = isSlash ? interaction.guild : message.guild;
		const prefix = server?.prefix || "g!";
		const query = isSlash ? interaction.options?.getString('comando') : (args && args.length > 0 ? args[0] : null);

		// Se o usuário procurou um comando específico (g!help <comando>)
		if (query) {
			const cmdName = query.toLowerCase();
			const cmd = this.client.commands.get(cmdName) || this.client.commands.get(this.client.aliases.get(cmdName));
			
			if (!cmd) {
				const errorMsg = `❌ **Comando não encontrado.** Use \`${prefix}ajuda\` para ver a lista de categorias e comandos disponíveis.`;
				return isSlash ? interaction.reply({ content: errorMsg, ephemeral: true }) : message.reply(errorMsg);
			}

			const config = cmd.config;
			const cmdEmbed = new EmbedBuilder()
				.setColor(colors.moderation)
				.setTitle(`📖 Tutorial / Info: ${config.name}`)
				.addFields(
					{ name: 'Categoria', value: `\`${config.category}\``, inline: true },
					{ name: 'Descrição', value: config.description || "Nenhuma descrição detalhada ou tutorial fornecido para este comando.", inline: false }
				);

			if (config.aliases && config.aliases.length > 0) {
				cmdEmbed.addFields({ name: 'Sinônimos (Aliases)', value: config.aliases.map(a => `\`${a}\``).join(', '), inline: false });
			}
			if (config.structure) {
				cmdEmbed.addFields({ name: 'Uso / Estrutura', value: `\`${prefix}${config.name} ${config.structure}\``, inline: false });
			} else {
				cmdEmbed.addFields({ name: 'Uso Básico', value: `\`${prefix}${config.name}\``, inline: false });
			}

			return isSlash ? interaction.reply({ embeds: [cmdEmbed] }) : message.reply({ embeds: [cmdEmbed] });
		}

		// --- MENU PRINCIPAL (HOME) ---
		const homeEmbed = new EmbedBuilder()
			.setColor(colors.moderation)
			.setAuthor({ name: `${guild.name} | Menu de Ajuda`, iconURL: guild.iconURL({ dynamic: true }) })
			.setThumbnail(this.client.user.displayAvatarURL())
			.setDescription(`Olá **${author.username}**! 👋\n\nSou o Galatic, o bot do servidor! Aqui você pode explorar todos os meus comandos separados por categoria.\n\nUse o **menu suspenso abaixo** para selecionar uma categoria. Caso queira saber os detalhes ou ver um tutorial de um comando específico, pesquise com \`${prefix}ajuda [nome do comando]\`.\n\n`)
			.setFooter({ text: `Solicitado por ${author.username}`, iconURL: author.displayAvatarURL({ dynamic: true }) })
			.setTimestamp();

		// Botão de Convite
		const inviteBtn = new ButtonBuilder()
			.setLabel('Convite do Bot')
			.setStyle(ButtonStyle.Link)
			.setURL('https://discord.com/oauth2/authorize?client_id=634216294710771713&scope=bot&permissions=8');
		
		const btnRow = new ActionRowBuilder().addComponents(inviteBtn);

		// Opções de Categoria
		const categorias = [
			{ label: 'Utilitário', value: 'util', emoji: '⚙️', description: `Comandos gerais do dia-a-dia. (${this.getCommmandSize("util")})` },
			{ label: 'Moderação', value: 'moderation', emoji: '🛡️', description: `Ferramentas de admin/moderação. (${this.getCommmandSize("moderation")})` },
			{ label: 'Configuração', value: 'config', emoji: '🔧', description: `Ajustes do servidor. (${this.getCommmandSize("config")})` },
			{ label: 'Pokémon', value: 'pokemon', emoji: '🐾', description: `Sistemas Pokémon. (${this.getCommmandSize("pokemon")})` },
			{ label: 'RPG', value: 'rpg', emoji: '⚔️', description: `Sistema de fichas e RPG. (${this.getCommmandSize("rpg")})` },
			{ label: 'Desenvolvedor', value: 'dev', emoji: '💻', description: `Restrito aos criadores do bot. (${this.getCommmandSize("dev")})` }
		];

		const categoryMenu = new StringSelectMenuBuilder()
			.setCustomId('help_category')
			.setPlaceholder('Selecione uma categoria para explorar...')
			.addOptions(categorias.filter(cat => this.getCommmandSize(cat.value) > 0));

		const menuRow = new ActionRowBuilder().addComponents(categoryMenu);

		const replyData = { embeds: [homeEmbed], components: [menuRow, btnRow] };
		const replyMsg = isSlash ? await interaction.reply({ ...replyData, fetchReply: true }) : await message.reply(replyData);

		// Coletor para interações (Menus de Seleção)
		const collector = replyMsg.createMessageComponentCollector({
			filter: (i) => i.user.id === author.id,
			time: 120000, // 2 minutos de interatividade
			componentType: ComponentType.StringSelect
		});

		collector.on('collect', async (i) => {
			if (i.customId === 'help_category') {
				const selectedCategory = i.values[0];
				
				const categoryMap = {
					util: { nome: 'Utilitário', emoji: '⚙️' },
					moderation: { nome: 'Moderação', emoji: '🛡️' },
					config: { nome: 'Configuração', emoji: '🔧' },
					pokemon: { nome: 'Pokémon', emoji: '🐾' },
					rpg: { nome: 'RPG', emoji: '⚔️' },
					dev: { nome: 'Desenvolvedor', emoji: '💻' }
				};

				const catInfo = categoryMap[selectedCategory] || { nome: selectedCategory, emoji: '📁' };
				const cmds = this.client.commands.filter(c => c.config.category === selectedCategory);
				
				const cmdListText = cmds.map(c => `\`${prefix}${c.config.name}\``).join(', ');

				const categoryEmbed = new EmbedBuilder()
					.setColor(colors.moderation)
					.setTitle(`${catInfo.emoji} Categoria: ${catInfo.nome}`)
					.setDescription(`**Comandos disponíveis:**\n${cmdListText}\n\nPara ver informações, permissões e o tutorial de uso de um comando em específico, **selecione-o no novo menu abaixo!**`)
					.setFooter({ text: `Solicitado por ${author.username}`, iconURL: author.displayAvatarURL({ dynamic: true }) })
					.setTimestamp();

				// Novo Menu Exclusivo dos Comandos desta categoria (máx 25 itens)
				const cmdOptions = cmds.map(c => {
					let desc = c.config.description || "Saiba mais sobre este comando.";
					if (desc.length > 95) desc = desc.substring(0, 95) + "...";
					return {
						label: `/${c.config.name}`,
						value: `cmd_${c.config.name}`,
						description: desc
					};
				}).slice(0, 25);

				const commandsMenu = new StringSelectMenuBuilder()
					.setCustomId('help_commands')
					.setPlaceholder('Selecione um comando para ver detalhes...')
					.addOptions(cmdOptions);
					
				const cmdRow = new ActionRowBuilder().addComponents(commandsMenu);

				// Mantemos o menu da categoria para facilitar a navegação reversa
				await i.update({ embeds: [categoryEmbed], components: [menuRow, cmdRow, btnRow] });

			} else if (i.customId === 'help_commands') {
				const cmdName = i.values[0].replace('cmd_', '');
				const cmd = this.client.commands.get(cmdName);
				if (!cmd) return i.reply({ content: "Falha ao carregar informações do comando.", ephemeral: true });

				const config = cmd.config;
				const cmdEmbed = new EmbedBuilder()
					.setColor(colors.moderation)
					.setTitle(`📖 Tutorial / Info: ${config.name}`)
					.addFields(
						{ name: 'Categoria', value: `\`${config.category}\``, inline: true },
						{ name: 'Descrição / Tutorial', value: config.description || "Nenhuma descrição detalhada fornecida para este comando.", inline: false }
					);

				if (config.aliases && config.aliases.length > 0) {
					cmdEmbed.addFields({ name: 'Sinônimos (Aliases)', value: config.aliases.map(a => `\`${a}\``).join(', '), inline: false });
				}
				if (config.structure) {
					cmdEmbed.addFields({ name: 'Uso / Estrutura', value: `\`${prefix}${config.name} ${config.structure}\``, inline: false });
				} else {
					cmdEmbed.addFields({ name: 'Uso Básico', value: `\`${prefix}${config.name}\``, inline: false });
				}

				// Mantemos os botões atuais para que ele possa continuar mudando os comandos na tela de informações.
				await i.update({ embeds: [cmdEmbed] });
			}
		});

		collector.on('end', () => {
			// Ao fim de 2 minutos, desabilita os menus interativos
			const disabledMenuCategory = new StringSelectMenuBuilder(categoryMenu.data).setDisabled(true);
			const rowMenu = new ActionRowBuilder().addComponents(disabledMenuCategory);
			
			const componentsToKeep = [rowMenu, btnRow];
			replyMsg.edit({ components: componentsToKeep }).catch(() => {});
		});
	}
	
	getCommmandSize(category) {
		return this.client.commands.filter(c => c.config.category === category).size;
	}
}
