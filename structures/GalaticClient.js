const Util = require('./Util.js')
const { Client, Collection } = require("discord.js")
const { readdir } = require("fs")
const config = require('../config.json')
const EventManager = require('./EventManager.js')

module.exports = class GalaticClient extends Client {

    constructor(options = {}) {
     super(options)
	    
     this.database = require('../mongoose.js')
  
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
		readdir(`../commands/`, (err, files) => {
			if (err) console.error(err)
			files.forEach(category => {
				readdir(`../commands/${category}`, (err, cmd) => {
					cmd.forEach(async cmd => {
						const command = new (require(`..}/commands/${category}/${cmd}`))(this)
						command.dir = `../commands/${category}/${cmd}`
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
