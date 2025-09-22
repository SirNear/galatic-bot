const Util = require('./structures/Util.js')
const { Client, Collection, Discord, GatewayIntentBits, Partials } = require("discord.js")
const { readdir } = require("fs")
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

    // Modifica o login para registrar os slash commands após conectar
    async login(token) {
        await super.login(token);
        
        // Registra handler de interações
        this.on('interactionCreate', async interaction => {
            try {
                if (interaction.isChatInputCommand()) {
                    const command = this.slashCommands.get(interaction.commandName);
                    if (!command) return;

                    await command.execute(interaction);
                }
            } catch (error) {
                console.error('Erro ao processar interação:', error);
                const errorMessage = 'Ocorreu um erro ao executar este comando!';
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            }
        });

        return this;
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
