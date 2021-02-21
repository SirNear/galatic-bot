const Util = require('./Util.js')
const { Client, Collection } = require('discord.js');
const config = require('../config.json)

module.exports = class MenuDocsClient extends Client {

    constructor(options = {}) {
     super({
       disableMentions: 'everyone'  
     })
     this.utils = new Util(this);
	    
     this.commands = new Collection();
	   
     this.aliases = new Collection();
	    
     this.utils = new Util(this);
	    
     this.owners = options.owners;
      
     this.events = new Collection()
        
    }
    
    validate(options) {
		if (typeof options !== 'object') throw new TypeError('Options deve ser um tipo de objeto');

		if (!options.token) throw new Error('Você precisa de um token para o bot');
		this.token = options.token;

		if (!options.prefix) throw new Error('Você precisa de um prefixo para o bot.');
		if (typeof options.prefix !== 'string') throw new TypeError('Prefix precisa ser um tipo de texto.');
		this.prefix = options.prefix;
    
    }
    
	async start(token = this.token) {
		this.utils.loadCommands();
		this.utils.loadEvents();
		super.login(config.token);
	}
    
}
