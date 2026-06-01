const lembreteVerso = require("../api/cron/lembreteVerso.js");
const monitorIA = require("../api/cron/monitorIA.js");
const { ensurePanelExists } = require("../api/aiUsageManager.js");

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

    // CACHE DE SISTEMAS DO RPG
    try {
        console.log('[SISTEMAS] Sincronizando categorias do Discord...');
        const guild = await this.client.guilds.fetch(GUILD_ID);
        // Categoria de Sistemas = 1142948073434267809
        const channels = await guild.channels.fetch();
        const systemChannels = channels.filter(c => c && c.parentId === '1142948073434267809');
        
        this.client.rpgSystemsCache = systemChannels.map(c => ({
            nome: c.name,
            tipo: c.type === 15 ? 'Fórum' : 'Texto',
            descricao: c.topic ? c.topic.substring(0, 100) : ''
        }));
        console.log(`[SISTEMAS] ✅ Cache atualizado! ${this.client.rpgSystemsCache.length} sistemas carregados na RAM.`);
    } catch (e) {
        console.error('[SISTEMAS] Erro ao tentar cachear sistemas no startup:', e);
        this.client.rpgSystemsCache = [];
    }

    lembreteVerso(this.client);
    
    // Inicia e atualiza o painel da Inteligência Artificial
    await ensurePanelExists(this.client);
    monitorIA(this.client);
  }
};