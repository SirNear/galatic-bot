const { logThreadCreate } = require('../api/discordLogger');

module.exports = class ThreadCreate {
    constructor(client) {
        this.client = client;
    }
    async run(thread) {
        await logThreadCreate(this.client, thread);
    }
};
