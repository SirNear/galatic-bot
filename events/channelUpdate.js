const { logChannelUpdate } = require('../api/discordLogger');

module.exports = class ChannelUpdate {
    constructor(client) {
        this.client = client;
    }
    async run(oldChannel, newChannel) {
        await logChannelUpdate(this.client, oldChannel, newChannel);
    }
};
