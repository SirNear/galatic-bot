const { logRoleUpdate } = require('../api/discordLogger');

module.exports = class GuildMemberUpdate {
    constructor(client) {
        this.client = client;
    }
    async run(oldMember, newMember) {
        await logRoleUpdate(this.client, oldMember, newMember);
    }
};
