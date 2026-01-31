module.exports = class ClientReady {
  constructor(client) {
    this.client = client;
  }

  async run() {
    console.log(`Bot ${this.client.user.tag} está online!`);

    const { BotConfig } = require('../mongoose');
    const config = await BotConfig.findById('global');
    if (config) {
        this.client.maintenance = config.maintenance;
        if (this.client.maintenance) console.log('[SYSTEM] Modo de manutenção ATIVO.');
    }

    await this.client.registerSlashCommands();
    await this.client.loadQuestCollectors();

    const GUILD_ID = "731974689798488185";
    this.client.setupUnarchiveLoop(GUILD_ID);
  }
};