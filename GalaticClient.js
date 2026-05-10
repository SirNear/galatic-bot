const Util = require('./structures/Util.js')
const { Client, Collection, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType, PermissionsBitField, RESTJSONErrorCodes, AttachmentBuilder } = require("discord.js")
const path = require('path');
const config = require('./config.json')
const EventManager = require('./structures/EventManager.js')
require('dotenv').config();


module.exports = class GalaticClient extends Client {
  constructor(options = {}) {
    super({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages
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
    this.owners = options.owners || [];
    this.events = new EventManager(this);
    this.activeCollector = false;
    this.maintenance = false;
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

		const finalEventName = eventName === 'ready' ? 'clientReady' : eventName;
		const dir = `./events/${finalEventName}.js`
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

    async sendLog(message, type = 'log') {
        if (!this.isReady()) return;
        if (!config.logChannelId) return;

        try {
            const channel = await this.channels.fetch(config.logChannelId);
            if (!channel || !channel.isTextBased()) {
                console.log(`[LOG SYSTEM] Canal de log (ID: ${config.logChannelId}) inválido ou não encontrado.`);
                return;
            }

            const colors = { log: '#0099ff', error: '#ff0000', warn: '#ffa500' };
            const titles = { log: '📝 LOG', error: '❌ ERRO', warn: '⚠️ AVISO' };

            if (typeof message !== 'string') {
                message = require('util').inspect(message, { depth: null });
            }

            const embed = new EmbedBuilder()
                .setColor(colors[type] || colors.log)
                .setTitle(titles[type] || titles.log)
                .setTimestamp();

            if (message.length > 4000) { 
                const attachment = new AttachmentBuilder(Buffer.from(message, 'utf-8'), { name: 'log.txt' });
                embed.setDescription('A mensagem de log era muito longa e foi enviada como anexo.');
                await channel.send({ embeds: [embed], files: [attachment] });
            } else {
                embed.setDescription('```' + message.substring(0, 4080) + '```'); 
                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.log(`[LOG SYSTEM] Falha ao enviar log para o canal: ${error}`);
        }
    }

    async registerSlashCommands() {
        try {
            console.log('Iniciando registro de slash commands...');
            
            const commands = [];
            this.slashCommands.forEach(command => {
                if (command.data) {
                    const data = command.data.toJSON();
                    commands.push(data);                    
                }
            });

            const { REST, Routes } = require('discord.js');
            const rest = new REST({ version: '10' }).setToken(this.token);

            const data = await rest.put(
                Routes.applicationCommands(this.user.id),
                { body: commands }
            );

            console.log(`✅ ${data.length} slash commands registrados com sucesso!`);
        } catch (error) {
            console.error('Erro ao registrar slash commands:', error);
        }
    }

    async loadCommands(path) {
        const { readdir, stat } = require('fs/promises');
        const commandPath = path || './commands/';
        let slashCount = 0;

        try {
            const categories = await readdir(commandPath);

            for (const category of categories) {
                const categoryPath = `./commands/${category}`;
                if (!(await stat(categoryPath)).isDirectory()) continue;

                const commandFiles = await readdir(categoryPath);

                for (const cmdFile of commandFiles.filter(file => file.endsWith('.js'))) {
                    try {
                        const CommandClass = require(`./commands/${category}/${cmdFile}`);
                        if (typeof CommandClass !== 'function') continue;
                        const command = new CommandClass(this);
                        command.dir = `./commands/${category}/${cmdFile}`;

                        // Registra comando normal
                        this.commands.set(command.config.name, command);
                        command.config.aliases?.forEach(a => this.aliases.set(a, command.config.name));

                        // Registra slash command
                        if (command.config.slash && command.data) {
                            this.slashCommands.set(command.data.name, command);
                            slashCount++;
                        }
                    } catch (error) {
                        console.error(`Erro ao carregar ${cmdFile}:`, error);
                    }
                }
            }
            console.log(`[SLASH] ✅ ${slashCount} slash commands carregados.`);
        } catch (err) {
            console.error("Erro ao carregar comandos:", err);
        }
        return this;
    }

    async loadEvents(eventsPath = './events/') {
        const { readdir } = require('fs/promises');
        try {
            const eventFiles = await readdir(eventsPath);
            let count = 0;
            for (const file of eventFiles.filter(f => f.endsWith('.js') && !f.includes('Interaction'))) {
                try {
                    let eventName = file.split('.')[0];
                    // Ignora handlers de 'ready' ou 'clientReady' para evitar duplicidade com o handler principal no index.js
                    if (eventName === 'ready' || eventName === 'clientReady') {
                        console.log(`[EVENTS] Ignorando o carregamento do evento '${file}' para evitar conflitos.`);
                        continue;
                    }

                    const eventClass = require(`.${path.sep}events${path.sep}${file}`);
                    if (typeof eventClass !== 'function') {
                        console.warn(`[EVENTS] Ignorando ${file}: exportação inválida (não é uma classe).`);
                        continue;
                    }
                    const event = new eventClass(this);
                    this.events.add(eventName, event);
                    count++;
                } catch (error) {
                    console.error(`Erro ao carregar o evento ${file}:`, error);
                }
            }
            console.log(`[EVENTS] ✅ ${count} eventos carregados.`);
        } catch (err) {
            console.error("Erro ao carregar eventos:", err);
        }
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
                    await i.deferReply({ flags: 64 });

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
                if (error.code === 10008 || error.code === 10003 || error.code === 50001) { // Unknown Message, Unknown Channel or Missing Access
                    console.warn(`Mensagem ou canal da quest ${quest.nome} (ID: ${quest._id}) não encontrado ou sem acesso (${error.code}).`);
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
            return interaction.reply({ content: "❌ Você não tem permissão para aprovar ou rejeitar quests.", flags: 64 });
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

	
}
