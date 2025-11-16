const Client = require('./GalaticClient')
const { GatewayIntentBits } = require('discord.js')
const config = require('./config')
const { connect } = require('./mongoose');
const Logger = require('./api/Logger');

const logger = new Logger(config.webhookURL);

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
    await connect();

    await client.loadEvents();
    await client.loadCommands();

    client.once('clientReady', async () => {
        console.log(`Bot logado como ${client.user.tag}!`);
        logger.defAva(client.user.displayAvatarURL());
        await client.registerSlashCommands();
        await client.loadQuestCollectors();
    });

    await client.login(config.token);
    
})();
