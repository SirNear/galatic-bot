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
    
    // Aguarda mais tempo para garantir que tudo carregou
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Registra os slash commands apenas uma vez
    if (!client.slashCommandsRegistered) {
        try {
            await client.registerSlashCommands();
            client.slashCommandsRegistered = true;
        } catch (err) {
            console.error('Erro ao registrar slash commands:', err);
        }
    }
});

// Login
client.login(config.token)
    .then(() => console.log("✅ Login realizado!"))
    .catch((err) => console.error(`❌ Erro ao iniciar:`, err));
