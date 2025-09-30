const path = require('path');
const { glob } = require('glob');
const Command = require('./Command.js');
const Event = require('./EventManager.js');

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
		const commands = await glob(`${this.directory}commands/**/*.js`);
		for (const commandFile of commands) {
			delete require.cache[commandFile];
			const { name } = path.parse(commandFile);
			const File = require(path.resolve(commandFile));
			if (!this.isClass(File)) throw new TypeError(`Comando ${name} não exporta uma classe.`);
			const command = new File(this.client);
			if (!(command instanceof Command)) throw new TypeError(`Comando ${name} não herda da classe Command.`);
			
			// Adiciona à coleção de comandos de prefixo
			this.client.commands.set(command.name, command);

			// Se o comando for um slash command, adiciona à coleção de slash commands
			if (command.config.slash) {
				this.client.slashCommands.set(command.data.name, command);
			}

			if (command.config.aliases.length) {
				for (const alias of command.config.aliases) {
					this.client.aliases.set(alias, command.name);
				}
			}
		}
	}

	async loadEvents() {
		const events = await glob(`${this.directory}events/**/*.js`);
		for (const eventFile of events) {
			delete require.cache[eventFile];
			const { name } = path.parse(eventFile);
			const File = require(path.resolve(eventFile));
			if (!this.isClass(File)) throw new TypeError(`Evento ${name} não exporta uma classe!`);
			const event = new File(this.client, name);
			if (!(event instanceof Event)) throw new TypeError(`Evento ${name} não existe na pasta de eventos`);
			this.client.events.set(event.name, event);
			this.client.on(name, (...args) => event.run(...args));
		}
	}

};
