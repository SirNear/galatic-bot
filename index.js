const Client = require('./GalaticClient')
const { GatewayIntentBits } = require('discord.js')
const config = require('./config')
const { connect } = require('./mongoose');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ]
});

// Guarda as funções originais do console
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
};

// Sobrescreve as funções do console
console.log = (...args) => {
    originalConsole.log(...args);
    client.sendLog(args.join(' '), 'log').catch(() => {});
};
console.error = (...args) => {
    originalConsole.error(...args);
    client.sendLog(args.join(' '), 'error').catch(() => {});
};
console.warn = (...args) => {
    originalConsole.warn(...args);
    client.sendLog(args.join(' '), 'warn').catch(() => {});
};

(async () => {
    await connect();

    client.loadEvents('./events');
    await client.loadCommands();

    client.once('ready', async () => {
        console.log(`Bot logado como ${client.user.tag}!`);
        await client.registerSlashCommands();
        await client.loadQuestCollectors();
    });

    // 4. Fazer login no Discord
    await client.login(config.token);
})();
