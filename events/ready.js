const lembreteVerso = require("../api/cron/lembreteVerso.js");

module.exports = class Ready {
  constructor(client) {
    this.client = client;
  }

  async run() {
    console.log(`Bot ${this.client.user.tag} está online!`);
    const guilds = this.client.guilds.cache;
    
    guilds.forEach(guild => { 
      if(!guild.id === "731974689798488185" || "930871020557062162") return guild.leave() 
    });

    await this.client.registerSlashCommands();
    await this.client.loadQuestCollectors();

    const GUILD_ID = "731974689798488185";
    this.client.setupUnarchiveLoop(GUILD_ID);

    lembreteVerso(this.client);
  }
};