const Util = require('./structures/Util.js')
const { Client, Collection, Discord, GatewayIntentBits, Partials } = require("discord.js")
const { readdir } = require("fs")
const config = require('./config.json')
const EventManager = require('./structures/EventManager.js')

module.exports = class GalaticClient extends Client {
  constructor(options = {}) {
    super({
      options,
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildEmojisAndStickers, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.DirectMessages]
    });
	    
     this.database = require('./mongoose.js')
  
     this.utils = new Util(this);
	    
     this.commands = new Collection();
	   
     this.aliases = new Collection();
	    
     this.utils = new Util(this);
	    
     this.owners = options.owners;
      
     this.events = new EventManager(this);
	  
     this.activeCollector = false;

     // Adiciona collection para slash commands
     this.slashCommands = new Collection();
	  
        
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
        const { REST, Routes } = require('discord.js');
        const rest = new REST({ version: '10' }).setToken(config.token);

        try {
            console.log('Iniciando registro de slash commands...');

            const commands = [];
            this.slashCommands.forEach(command => {
                commands.push(command.data.toJSON());
            });

            // Registra globalmente em vez de em um servidor específico
            const data = await rest.put(
                Routes.applicationCommands(this.user.id),
                { body: commands },
            );

            console.log(`✅ ${data.length} slash commands registrados com sucesso!`);
        } catch (error) {
            console.error('Erro ao registrar slash commands:', error);
            // Log mais detalhado do erro
            if (error.code === 50001) {
                console.log('\n⚠️ O bot precisa das seguintes permissões:');
                console.log('1. applications.commands - Scope OAuth2');
                console.log('2. Administrator ou Manage Server - Permissões do bot\n');
                console.log('Reconvide o bot usando este link:');
                console.log(`https://discord.com/api/oauth2/authorize?client_id=${this.user.id}&permissions=8&scope=bot%20applications.commands`);
            }
        }
    }

    // Modifica o login para registrar os slash commands após conectar
    async login(token) {
        await super.login(token);
        
        // Registra handler de interações
        this.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;

            const command = this.slashCommands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                const errorMessage = 'Ocorreu um erro ao executar este comando!';
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            }
        });

        // Registra os slash commands quando o bot estiver pronto
        this.once('ready', () => {
            this.registerSlashCommands();
        });

        return this;
    }
	
	
	loadCommands(path) {
    readdir(`./commands/`, (err, files) => {
        if (err) console.error(err)
        let normalCommands = 0;
        let slashCommands = 0;
        
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
                        command.config.aliases.forEach(a => this.aliases.set(a, command.config.name))
                        normalCommands++;

                        // Registra slash command se existir
                        if (command.config.slash && command.data) {
                            this.slashCommands.set(command.config.name.toLowerCase(), command);
                            slashCommands++;
                        }
                    } catch (error) {
                        console.error(`Erro ao carregar ${cmdFile}:`, error);
                    }
                })
            })
        })

        // Log resumido ao final
        setTimeout(() => {
            console.log(`✅ Carregados ${normalCommands} comandos normais e ${slashCommands} slash commands`);
        }, 1000);
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
