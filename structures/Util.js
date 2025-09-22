const path = require('path');
const { glob } = require('glob');
const Command = require('./Command.js');
const Event = require('./EventManager.js');
const { promisify } = require('util');

module.exports = class Util {

	constructor(client) {
		this.client = client;
	}

	isClass(input) {
		return typeof input === 'function' &&
        typeof input.prototype === 'object' &&
        input.toString().substring(0, 5) === 'class';
	}

	get directory() {
		return `${path.dirname(require.main.filename)}${path.sep}`;
	}

	trimArray(arr, maxLen = 10) {
		if (arr.length > maxLen) {
			const len = arr.length - maxLen;
			arr = arr.slice(0, maxLen);
			arr.push(`${len} more...`);
		}
		return arr;
	}

	formatBytes(bytes) {
		if (bytes === 0) return '0 Bytes';
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
	}

	removeDuplicates(arr) {
		return [...new Set(arr)];
	}

	capitalise(string) {
		return string.split(' ').map(str => str.slice(0, 1).toUpperCase() + str.slice(1)).join(' ');
	}

	async loadCommands() {
        const commandFiles = await glob(`${this.directory}commands/**/*.js`);
        let slashCount = 0;
        for (const commandFile of commandFiles) {
            delete require.cache[commandFile];
            const { name } = path.parse(commandFile);
            try {
                const File = require(path.resolve(commandFile));
                if (!this.isClass(File)) throw new TypeError(`Comando ${name} não exporta uma classe.`);
                
                const command = new File(this.client, name.toLowerCase());
                if (!(command instanceof Command)) throw new TypeError(`Comando ${name} não pertence a um comando.`);
                
                this.client.commands.set(command.config.name, command);
                command.config.aliases?.forEach(a => this.client.aliases.set(a, command.config.name));

                if (command.config.slash && command.data) {
                    this.client.slashCommands.set(command.data.name, command);
                    slashCount++;
                    console.log(`[SLASH] ✅ Carregado: ${command.config.name}`);
                }
            } catch (error) {
                console.error(`Erro ao carregar o comando ${name}:`, error);
            }
        }
        console.log(`Total de ${slashCount} slash commands carregados.`);
	}

	async loadEvents() {
		return glob(`${this.directory}events/**/*.js`).then(events => {
			for (const eventFile of events) {
				delete require.cache[eventFile];
				const { name } = path.parse(eventFile);
				const File = require(eventFile);
				if (!this.isClass(File)) throw new TypeError(`Evento ${name} não exporta uma classe!`);
				const event = new File(this.client, name);
				if (!(event instanceof Event)) throw new TypeError(`Evento ${name} não existe na pasta de eventos`);
				this.client.events.set(event.name, event);
				event.emitter[event.type](name, (...args) => event.run(...args));
			}
		});
	}

};
