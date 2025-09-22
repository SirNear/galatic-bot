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

(async () => {
    // Carrega eventos primeiro
    client.loadEvents('./events');
    // Carrega os comandos e espera a conclusão
    await client.loadCommands();

    // Evento ready mais robusto
    client.on('ready', async () => {
        console.log(`🤖 Bot online como ${client.user.tag}`);
        
        // Registra os slash commands apenas uma vez, após o bot estar pronto
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
    await client.login(config.token);
})();
