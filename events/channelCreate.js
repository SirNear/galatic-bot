const { logChannelCreate } = require('../api/discordLogger');

module.exports = class ChannelCreate {
    constructor(client) {
        this.client = client;
    }
    async run(channel) {
        await logChannelCreate(this.client, channel);
    }
};
