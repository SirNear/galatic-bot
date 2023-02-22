const Util = require('./structures/Util.js')
const { Client, Collection, Discord } = require("discord.js")
const { readdir } = require("fs")
const config = require('./config.json')
const EventManager = require('./structures/EventManager.js')

module.exports = class GalaticClient extends Client {

    constructor(options = {}) {
     super(options)
	    
     this.database = require('./mongoose.js')
  
     this.utils = new Util(this);
	    
     this.commands = new Collection();
	   
     this.aliases = new Collection();
	    
     this.utils = new Util(this);
	    
     this.owners = options.owners;
      
     this.events = new EventManager(this)
        
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

	login(token) {
		return super.login(token)
	}
	
	
	loadCommands(path) {
	  readdirSync(`./commands/`).forEach((category) => {
	    readdirSync(`./commands/${category}`).forEach((file) => {
	      try {
		const command = new (require(`./commands/${category}/${file}`))(this);
		command.dir = `./commands/${category}/${file}`;
		this.commands.set(command.config.name, command);
		command.config.aliases.forEach((alias) =>
		  this.aliases.set(alias, command.config.name)
		);
		let c = await this.database.Bots.findById(command.config.name);
		if (!c) {
		  c = new this.database.Bots({
		    _id: command.config.name,
		  });
		  c.save();
		}
	      } catch (err) {
		console.error(
		  `Error loading command ${file}: ${err.stack || err}`
		);
	      }
	    });
	  });
	  return this;
	}
	loadEvents(path) {
		readdir(path, (err, files) => {
			if (err) console.error(err)

			files.forEach(em => {
				const event = new (require(`./events/${em}`))(this)
				this.events.add(em.split(".")[0], event)
			})
		})

		return this
	}
    
}
