  const Event = require('./structures/Event.js')
  const path = require('path')
  const glob = promisify(require('glob'))
    
    module.exports = class Util {
    
    async loadEvent() {
     return glob(`${this.directory}events/*.js`).then(events => {
         for (const eventFile of events) {
            delete require.cache(eventFile);
             const {name} = path.parse(eventFile)
             const File = require(eventFile)
             if (!this.isClass(File)) throw new TypeError(`Evento ${name} não exporta nenhuma classe!`)
             const event = new File(this.client, name.toLowerCase())
             if (!event instaceof Event)) throw new TypeError(`Evento ${name} não está na pasta de eventos`)
             this.client.events.set(event.name, event)
             event.emitter[event.type](name, (..args) => event.run(..args))
             
         }
     }  
   }
  }
