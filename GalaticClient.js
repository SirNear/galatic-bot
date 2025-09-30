const Util = require('./structures/Util.js')
const { Client, Collection, Discord, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType, PermissionsBitField } = require("discord.js")
const { readdir } = require("fs")
const path = require('path');
const config = require('./config.json')
const EventManager = require('./structures/EventManager.js')

module.exports = class GalaticClient extends Client {
  constructor(options = {}) {
    super({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.MessageContent
        ],
        partials: [
            Partials.Message,
            Partials.Channel,
            Partials.Reaction
        ]
    });
    
    // Inicializa database primeiro
    this.database = require('./mongoose.js');
    
    // Depois as collections
    this.commands = new Collection();
    this.aliases = new Collection();
    this.slashCommands = new Collection();
    
    this.utils = new Util(this);
    this.owners = options.owners;
    this.events = new EventManager(this);
    this.activeCollector = false;
    this.fichaStates = new Map();
}

	reloadCommand(commandName) {
		const command = this.commands.get(commandName) || this.commands.get(this.aliases.get(commandName))
		if (!command) return false
		const dir = command.dir
		this.commands.delete(command.name)
		delete require.cache[require.resolve(`${dir}`)]
		try {
			const Command = require(`${dir}`)
			const cmd = new Command(this)
			cmd.dir = dir
			this.commands.set(cmd.name, cmd)
			return true
		} catch (e) {
			return e
		}
	}
	reloadEvent(eventName) {
		const event = this.events.events.includes(eventName)
		if (!event) return false

		const dir = `./events/${eventName}.js`
		const status = this.events.remove(eventName)
		if (!status) return status
		delete require.cache[require.resolve(`${dir}`)]
		try {
			const Event = require(`${dir}`)
			const event = new Event(this)
			this.events.add(eventName, event)
			return true
		} catch (e) {
			return e
		}
	}

    // Adiciona método para registrar slash commands no Discord
    async registerSlashCommands() {
        try {
            console.log('Iniciando registro de slash commands...');
            
            const commands = [];
            this.slashCommands.forEach(command => {
                if (command.data) {
                    const data = command.data.toJSON();
                    commands.push(data);
                    console.log(`📝 Preparando comando: ${data.name}`);
                }
            });

            const { REST, Routes } = require('discord.js');
            const rest = new REST({ version: '10' }).setToken(config.token);

            const data = await rest.put(
                Routes.applicationCommands(this.user.id),
                { body: commands }
            );

            console.log(`✅ ${data.length} slash commands registrados com sucesso!`);
        } catch (error) {
            console.error('Erro ao registrar slash commands:', error);
        }
    }

    	loadCommands(path) {
            readdir(`./commands/`, (err, files) => {
                if (err) console.error(err)
                let slashCount = 0;
                
                files.forEach(category => {
                    readdir(`./commands/${category}`, (err, commandFiles) => {
                        if (err) {
                            console.error(`Erro ao ler a categoria '${category}':`, err);
                            return;
                        }
                        
                        commandFiles.filter(file => file.endsWith('.js')).forEach(async cmdFile => {
                            try {
                                const command = new (require(`./commands/${category}/${cmdFile}`))(this)
                                command.dir = `./commands/${category}/${cmdFile}`
                                
                                // Registra comando normal
                                this.commands.set(command.config.name, command)
                                command.config.aliases?.forEach(a => this.aliases.set(a, command.config.name))

                                // Registra slash command
                                if (command.config.slash && command.data) {
                                    this.slashCommands.set(command.data.name, command);
                                    slashCount++;
                                    console.log(`[SLASH] ✅ Carregado: ${command.config.name}`);
                                }
                            } catch (error) {
                                console.error(`Erro ao carregar ${cmdFile}:`, error);
                            }
                        })
                    })
                })
            })
            return this
        }

    async login(token) {
        return super.login(token);
    }

    async channelQuest(guild, quest) {
        const categoriaQuestsId = '1408248861415309422';

        try {
            const categoria = await guild.channels.fetch(categoriaQuestsId);

            if (!categoria || categoria.type !== ChannelType.GuildCategory) {
                console.error(`A categoria de quests (ID: ${categoriaQuestsId}) não foi encontrada ou não é uma categoria.`);
                return null;
            }

            const permissionOverwrites = [
                {
                    id: guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: quest.mestre, 
                    allow: [
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.ManageChannels,
                        PermissionsBitField.Flags.ManageThreads,
                        PermissionsBitField.Flags.SendMessages,
                    ],
                },
                ...quest.participantes.map(participanteId => ({
                    id: participanteId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.SendMessagesInThreads],
                })),
            ];

            const forumChannel = await guild.channels.create({
                name: `forum-quest-${quest.nome.replace(/\s+/g, '-').toLowerCase().substring(0, 85)}`,
                type: ChannelType.GuildForum,
                parent: categoria.id,
                topic: `Fórum para a quest: ${quest.nome}. Mestre: <@${quest.mestre}>`,
                permissionOverwrites: permissionOverwrites,
            });

            console.log(`Fórum #${forumChannel.name} criado para a quest "${quest.nome}".`);

            const threadChatPrinc = await forumChannel.threads.create({
                name: `chat-principal`,
                message: {
                    content: `## Bem-vindos à Quest: ${quest.nome}!\n\nEste é o canal de chat principal para narrar.\n\n**Mestre:** <@${quest.mestre}>\n**Participantes:** ${quest.participantes.map(p => `<@${p}>`).join(', ')}`
                }
            });

            await forumChannel.threads.create({
                name: `Chat Off`,
                message: { 
                    content: `chat off relacionadas à quest.`
                }
            });

            console.log(`Post #${threadChatPrinc.name} criado no fórum ${forumChannel.name}.`);
            return forumChannel; // Retorna o canal do Fórum, não a thread
        } catch (error) {
            console.error("Erro ao criar canal da quest:", error);
            return null;
        }
    }
	
    async loadQuestCollectors() {
        console.log('Carregando coletores de quests...');
        const openQuests = await this.database.Quest.find({ status: 'aberta' });

        for (const quest of openQuests) {
            if (!quest.messageId || !quest.channelId) continue;

            try {
                const channel = await this.channels.fetch(quest.channelId);
                if (!channel) continue;

                const message = await channel.messages.fetch(quest.messageId);
                if (!message) continue;

                const duracaoColetor = quest.dataInicioTimestamp - Date.now();
                const MAX_TIMEOUT = 2147483647;

                if (duracaoColetor <= 0 || quest.participantes.length >= quest.maxPlayers) {
                    const originalButton = message.components[0].components[0];
                    const disabledButton = ButtonBuilder.from(originalButton)
                        .setDisabled(true).setLabel("Inscrições encerradas");
                    const disabledRow = new ActionRowBuilder().addComponents(disabledButton);
                    await message.edit({ components: [disabledRow] });
                    continue;
                }

                const collector = message.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: Math.min(duracaoColetor, MAX_TIMEOUT)
                });

                collector.on('collect', async i => {
                    await i.deferReply({ ephemeral: true });

                    const questAtual = await this.database.Quest.findById(quest._id);

                    if (questAtual.participantes.includes(i.user.id)) {
                        return i.editReply({ content: "<:peepoPANTIES:810735233342111754> | Você já está participando desta quest!" });
                    }

                    if (questAtual.participantes.length >= questAtual.maxPlayers) {
                        return i.editReply({ content: "<:festivepepe:810735233505951744> | Esta quest já atingiu o número máximo de participantes." });
                    }

                    questAtual.participantes.push(i.user.id);
                    await questAtual.save();

                    const newEmbed = EmbedBuilder.from(message.embeds[0])
                        .setFields(
                            { name: "Mestre", value: `<@${questAtual.mestre}>`, inline: true },
                            { name: "Vagas", value: `${questAtual.participantes.length} / ${questAtual.maxPlayers.toString()}`, inline: true },
                            { name: "Recompensa", value: questAtual.recompensa },
                            { name: "Regras", value: questAtual.regras.substring(0, 1024) },
                            { name: "Início", value: `<t:${Math.floor(questAtual.dataInicioTimestamp / 1000)}:F>` }
                        );

                    await message.edit({ embeds: [newEmbed] });
                    
                    // Adiciona permissão ao participante no fórum existente
                    if (questAtual.forumChannelId) {
                        try {
                            const forumChannel = await i.guild.channels.fetch(questAtual.forumChannelId);
                            if (forumChannel) {
                                await forumChannel.permissionOverwrites.edit(i.user.id, {
                                    ViewChannel: true,
                                    SendMessages: true,
                                    SendMessagesInThreads: true
                                });
                            }
                        } catch (permError) { console.error("Erro ao dar permissão no fórum para novo participante:", permError); }
                    }

                    await i.editReply({ content: `✅ Você foi adicionado à quest com sucesso! Verifique o fórum da quest em <#${questAtual.forumChannelId}>` });
                });

                collector.on('end', () => {
                    const originalButton = message.components[0].components[0];
                    const disabledButton = ButtonBuilder.from(originalButton)
                        .setDisabled(true).setLabel("Inscrições encerradas");
                    const disabledRow = new ActionRowBuilder().addComponents(disabledButton);
                    message.edit({ components: [disabledRow] }).catch(() => {});
                });

            } catch (error) {
                if (error.code === 10008 || error.code === 10003) { // Unknown Message or Unknown Channel
                    console.warn(`Mensagem ou canal da quest ${quest.nome} (ID: ${quest._id}) não encontrado. Talvez tenha sido deletada.`);
                } else {
                    console.error(`Erro ao recarregar coletor para a quest ${quest._id}:`, error);
                }
            }
        }
        console.log(`${openQuests.length} coletores de quests carregados.`);
    }
	
    async handleQuestApproval(interaction) {
        const approvalRoleId = '731974690125643869'; // ID do cargo que pode aprovar
        if (!interaction.member.roles.cache.has(approvalRoleId)) {
            return interaction.reply({ content: "❌ Você não tem permissão para aprovar ou rejeitar quests.", ephemeral: true });
        }

        const [action, type, questId] = interaction.customId.split('_');

        const pendingQuest = await this.database.PendingQuest.findById(questId);
        if (!pendingQuest) {
            await interaction.update({ content: "Esta solicitação de quest não foi encontrada ou já foi tratada.", embeds: [], components: [] });
            return;
        }

        const creator = await this.users.fetch(pendingQuest.creatorId).catch(() => null);

        if (action === 'approve') {
            await interaction.deferUpdate();

            await this.slashCommands.get('quest').createAndPostQuest(interaction, pendingQuest.toObject(), null);

            const approvedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor("Green")
                .setTitle(`✅ Quest Aprovada por ${interaction.user.tag}`)
                .setFields(interaction.message.embeds[0].fields); 

            await interaction.message.edit({ embeds: [approvedEmbed], components: [] });

            if (creator) {
                await creator.send(`🎉 Sua quest **"${pendingQuest.nome}"** foi aprovada e postada!`).catch(() => {});
            }

            await this.database.PendingQuest.findByIdAndDelete(questId);

        } else if (action === 'reject') {
            await interaction.deferUpdate();

            const rejectedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor("Red")
                .setTitle(`❌ Quest Rejeitada por ${interaction.user.tag}`)
                .setFields(interaction.message.embeds[0].fields);

            await interaction.message.edit({ embeds: [rejectedEmbed], components: [] });

            if (creator) {
                await creator.send(`😔 Sua quest **"${pendingQuest.nome}"** foi rejeitada pela moderação.`).catch(() => {});
            }

            await this.database.PendingQuest.findByIdAndDelete(questId);
        }
    }

		loadEvents(path) {
				readdir(path, (err, files) => {
					if (err) {
						console.error(err);
						return;
		      }

					files.forEach(em => {
						const event = new (require(`./events/${em}`))(this)
						this.events.add(em.split(".")[0], event)
					})
				})

				return this
			}

	
}
