const Client = require('./GalaticClient')
const { GatewayIntentBits, WebhookClient, EmbedBuilder } = require('discord.js')
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
    ],
    owners: config.owners
});

(async () => {
    try {
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
    } catch (erro) {
        // Captura o erro da conexão com o banco de dados ou outras falhas na inicialização
        await lidarErroFatal(erro, 'Inicialização do Bot');
        // Encerra o processo após logar o erro fatal
        process.exit(1);
    }
})();

const webhookFatal = config.webhookURL ? new WebhookClient({ url: config.webhookURL }) : null;
const devIds = config.owners.map(id => `<@${id}>`).join(' ');

const lidarErroFatal = async (erro, origem) => {
    console.error(`[ERRO FATAL] Origem: ${origem}`, erro);

    if (!webhookFatal) return;

    const embErr = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(`🚨 ERRO FATAL - BOT DESLIGADO 🚨`)
        .setDescription(`**O bot encontrou um erro fatal e foi encerrado.**\n\n**Origem:** \`${origem}\`\n\`\`\`js\n${erro.stack || erro}\n\`\`\``)
        .setTimestamp();

    try {
        await webhookFatal.send({
            content: `TODO - CONSERTAR BUG ${devIds}`,
            username: 'Galatic Bot - CRASH',
            avatarURL: 'https://i.imgur.com/b425tQ1.png',
            embeds: [embErr],
        });
    } catch (e) {
        console.error('Falha ao enviar o log de erro fatal para o webhook.', e);
    }
};

process.on('unhandledRejection', (razao, promessa) => lidarErroFatal(razao, 'unhandledRejection'));
process.on('uncaughtException', (erro, origem) => lidarErroFatal(erro, origem));
