const Util = require('./Utils.js')
const { Client, Collection } = require('discord.js');

module.exports = class MenuDocsClient extends Client {

    constructor(options = {}) {
     super({
       disableMentions: 'everyone'  
     })
     this.utils = new Util(this);
      
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
		this.utils.loadEvents();
		super.login(token);
	}
    
}
