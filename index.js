const Client = require('./GalaticClient')
const { GatewayIntentBits } = require('discord.js')
const config = require('./config')

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ]
});

// Carrega comandos e eventos
client.loadCommands('./commands')
client.loadEvents('./events')

// Evento ready mais robusto
client.on('ready', async () => {
    console.log(`🤖 Bot online como ${client.user.tag}`);
    
    // Aguarda um pouco para garantir que tudo carregou
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Registra os slash commands
    try {
        await client.registerSlashCommands();
    } catch (err) {
        console.error('Erro ao registrar slash commands:', err);
    }
});

// Login
client.login(config.token)
    .then(() => console.log("✅ Login realizado!"))
    .catch((err) => console.error(`❌ Erro ao iniciar:`, err));
