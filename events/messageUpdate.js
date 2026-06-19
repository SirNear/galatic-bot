  
module.exports = class MessageUpdate {
	constructor(client) {
		this.client = client
	}

	async run(oldMessage, newMessage) {
		if (oldMessage.content === newMessage.content) return
		this.client.emit("message", newMessage)
        
        const { logMessageEdit } = require('../api/discordLogger');
        await logMessageEdit(this.client, oldMessage, newMessage);
	}
}
