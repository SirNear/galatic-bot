const Util = require('./Util.js')
const { Client, Collection } = require('discord.js');
const config = require('../config.json')

module.exports = class MenuDocsClient extends Client {

    constructor(options = {}) {
     super({
       disableMentions: 'everyone'  
     })
     this.validate(options);
	    
     this.utils = new Util(this);
	    
     this.commands = new Collection();
	   
     this.aliases = new Collection();
	    
     this.utils = new Util(this);
	    
     this.owners = options.owners;
      
     this.events = new Collection()
        
    }
	
    async(message) {
	    
	 let server = await client.database.Guilds.findById(message.guild.id)
	 if(!server) {
	     if (!server) {
              server = client.database.Guilds({
              _id: message.guild.id,
             })
     
             server.save()
           }   	 
		 
		 
		 
		 
	 }
	 
    
    validate(options) {
		if (typeof options !== 'object') throw new TypeError('Options deve ser um tipo de objeto');

		if (!options.token) throw new Error('Você precisa de um token para o bot');
		this.token = options.token;

		if (!options.prefix) throw new Error('Você precisa de um prefixo para o bot.');
		if (typeof options.prefix !== 'string') throw new TypeError('Prefix precisa ser um tipo de texto.');
		this.prefix = server.prefix;
    
    }
	    
    }
    
	async start(token = config.token) {
		this.utils.loadCommands();
		this.utils.loadEvents();
		super.login(token);
	}
    
}
