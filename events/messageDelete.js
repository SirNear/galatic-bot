const { logMessageDelete } = require('../api/discordLogger');

module.exports = class MessageDelete {
    constructor(client) {
        this.client = client;
    }
    async run(message) {
        await logMessageDelete(this.client, message);
    }
};
