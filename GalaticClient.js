const Util = require('./structures/Util.js')
const { Client, Collection, Discord } = require("discord.js")
const { readdir } = require("fs")
const config = require('./config.json')
const EventManager = require('./structures/EventManager.js')
const client = new Discord.Client();

module.exports = class GalaticClient extends Client {

    constructor(options = {}) {
     super(options)
	    
     client.database = require('./mongoose.js')
  
     this.utils = new Util(this);
	    
     this.commands = new Collection();
	   
     this.aliases = new Collection();
	    
     this.utils = new Util(this);
	    
     this.owners = options.owners;
      
     this.events = new EventManager(this)
        
    }

	login(token) {
		return super.login(token)
	}
	
	
	loadCommands(path) {
		readdir(`${__dirname}/commands/`, (err, files) => {
			if (err) console.error(err)
			files.forEach(category => {
				readdir(`${__dirname}/commands/${category}`, (err, cmd) => {
					cmd.forEach(async cmd => {
						const command = new (require(`${__dirname}/commands/${category}/${cmd}`))(this)
						command.dir = `${__dirname}/commands/${category}/${cmd}`
						this.commands.set(command.config.name, command)
						command.config.aliases.forEach(a => this.aliases.set(a, command.config.name))
						let c = await this.database.Bots.findById(command.config.name)
						if (!c) {
							c = new this.database.Bots({
								_id: command.config.name
							})
							c.save()
						}
					})
				})
			})
		})

		return this
	}
	loadEvents(path) {
		readdir(path, (err, files) => {
			if (err) console.error(err)

			files.forEach(em => {
				const event = new (require(`../${path}/${em}`))(this)
				this.events.add(em.split(".")[0], event)
			})
		})

		return this
	}
    
}
