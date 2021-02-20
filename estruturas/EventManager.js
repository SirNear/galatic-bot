const { Collection } = require('discord.js')

module.exports = class EventManager {
  
  constructor (client) {
  
    this.client = client
    this.event = []
  
  }
  
  add (name, fun) {
  
    this.client.on(name, (..args) => this.handleEvent(name, args))
    this.events.push({ name, fun })

}

  handleEvent (name, args) {
  
		this.events.filter(a => a.name === name).forEach((e) => e.fun.run(...args))
    
	}

}
