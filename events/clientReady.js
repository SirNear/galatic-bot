const lembreteVerso = require("../api/cron/lembreteVerso.js");

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

    this.client.emit('clientReady');

    const GUILD_ID = "731974689798488185";
    this.client.setupUnarchiveLoop(GUILD_ID);

    lembreteVerso(this.client);
  }
};