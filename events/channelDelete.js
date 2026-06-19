const { logChannelDelete } = require('../api/discordLogger');

module.exports = class ChannelDelete {
    constructor(client) {
        this.client = client;
    }
    async run(channel) {
        await logChannelDelete(this.client, channel);
    }
};
