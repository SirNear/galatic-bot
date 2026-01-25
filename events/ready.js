const lembreteVerso = require("../api/cron/lembreteVerso.js");

module.exports = class Ready {
  constructor(client) {
    this.client = client;
  }

  async run() {
    console.log(`Bot ${this.client.user.tag} está online!`);
    await this.client.registerSlashCommands();
    await this.client.loadQuestCollectors();

    const GUILD_ID = "731974689798488185";
    this.client.setupUnarchiveLoop(GUILD_ID);

    lembreteVerso(this.client);
  }
};