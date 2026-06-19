const { logThreadUpdate } = require('../api/discordLogger');

module.exports = class ThreadUpdate {
    constructor(client) {
        this.client = client;
    }
    async run(oldThread, newThread) {
        await logThreadUpdate(this.client, oldThread, newThread);
    }
};
