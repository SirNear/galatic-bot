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
    client.loadEvents('./events');
    await client.loadCommands();

    client.on('ready', async () => {
        if (!client.slashCommandsRegistered) {
            try {
                await client.registerSlashCommands();
                client.slashCommandsRegistered = true;
                await client.loadQuestCollectors();
            } catch (err) {
                console.error('Erro ao registrar slash commands:', err);
            }
        }
    });

    await client.login(config.token);
})();
