const { logThreadDelete } = require('../api/discordLogger');

module.exports = class ThreadDelete {
    constructor(client) {
        this.client = client;
    }
    async run(thread) {
        await logThreadDelete(this.client, thread);
    }
};
