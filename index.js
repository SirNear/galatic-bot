require('dotenv').config();
const Client = require('./GalaticClient')
const { GatewayIntentBits, WebhookClient, EmbedBuilder } = require('discord.js');
const config = require('./config')
const { connect, BotConfig } = require('./mongoose');
const Logger = require('./api/Logger');

const loggerUrl = process.env.WEBHOOK_URL || config.webhookURL;
const logger = new Logger(loggerUrl);

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

        // Usamos o evento 'ready' padrão do discord.js para centralizar a lógica de inicialização.
        client.once('ready', async () => {
            console.log(`Bot logado como ${client.user.tag}!`);

            // Carregar configuração de manutenção do banco de dados
            const configBot = await BotConfig.findById('global');
            if (configBot) {
                client.maintenance = configBot.maintenance;
                if (client.maintenance) console.log('[SYSTEM] Modo de manutenção ATIVO (carregado do banco).');
            }

            logger.defAva(client.user.displayAvatarURL());
            await client.registerSlashCommands();
            await client.loadQuestCollectors();

            // Carregar cron jobs e emitir evento clientReady (migrado de events/clientReady.js)
            // const lembreteVerso = require("./api/cron/lembreteVerso.js");
            // lembreteVerso(client);
            
            const atualizarUpgrades = require("./api/cron/atualizarUpgrades.js");
            atualizarUpgrades(client);
            
            const lembreteUpgrades = require("./api/cron/lembreteUpgrades.js");
            lembreteUpgrades(client);
            
            const duvidaUpgrades = require("./api/cron/duvidaUpgrades.js");
            duvidaUpgrades(client);
            
            const monitorIA = require("./api/cron/monitorIA.js");
            const { ensurePanelExists } = require("./api/aiUsageManager.js");
            ensurePanelExists(client).catch(console.error);
            monitorIA(client);
            
            const cronManager = require("./api/cron/cronManager.js");
            cronManager.setClient(client);
            cronManager.updateDashboard();
            
            const resumoSemanal = require("./api/cron/resumoSemanal.js");
            resumoSemanal(client);
            
            client.on('messageCreate', async (message) => {
                if (message.author.bot) return;
                try {
                    const db = await client.database.UpgradeDuvida.findOne({ channelId: message.channel.id });
                    if (db) {
                        const msgFormated = message.content.toLowerCase().replace(/\s/g, '');
                        if (message.author.id === db.admodId && msgFormated.includes('finalizar')) {
                            const parent = message.channel.parent;
                            await message.channel.delete().catch(() => {});
                            if (parent && parent.name.toLowerCase() === 'dúvidas de upgrades' && parent.children.cache.size <= 1) {
                                await parent.delete().catch(() => null);
                            }
                            await client.database.UpgradeDuvida.deleteOne({ _id: db._id });
                            return;
                        }
                        
                        db.expiresAt = Date.now() + (12 * 60 * 60 * 1000);
                        db.nextReminderAt = Date.now() + (2 * 60 * 60 * 1000);
                        await db.save();
                    }
                } catch (e) {}
            });
            
            const discordLogger = require('./api/discordLogger.js');
            client.on('channelCreate', async (channel) => { if (channel.guild) discordLogger.logChannelCreate(client, channel); });
            client.on('channelDelete', async (channel) => { if (channel.guild) discordLogger.logChannelDelete(client, channel); });
            client.on('channelUpdate', async (oldChannel, newChannel) => { if (newChannel.guild) discordLogger.logChannelUpdate(client, oldChannel, newChannel); });
            client.on('threadCreate', async (thread) => { if (thread.guild) discordLogger.logThreadCreate(client, thread); });
            client.on('threadDelete', async (thread) => { if (thread.guild) discordLogger.logThreadDelete(client, thread); });
            client.on('threadUpdate', async (oldThread, newThread) => { if (newThread.guild) discordLogger.logThreadUpdate(client, oldThread, newThread); });
            client.on('guildMemberUpdate', async (oldMember, newMember) => discordLogger.logRoleUpdate(client, oldMember, newMember));
            client.on('messageDelete', async (message) => { if (message.guild) discordLogger.logMessageDelete(client, message); });
            client.on('messageUpdate', async (oldMessage, newMessage) => { if (newMessage.guild) discordLogger.logMessageEdit(client, oldMessage, newMessage); });
            client.on('messageReactionAdd', async (reaction, user) => { if (reaction.message.guild) discordLogger.logReactionEvent(client, reaction, user, true); });
            client.on('messageReactionRemove', async (reaction, user) => { if (reaction.message.guild) discordLogger.logReactionEvent(client, reaction, user, false); });
            // CACHE DE SISTEMAS DO RPG
            try {
                console.log('[SISTEMAS] Sincronizando categorias do Discord...');
                const guild = await client.guilds.fetch("731974689798488185");
                const channels = await guild.channels.fetch();
                const systemChannels = channels.filter(c => c && c.parentId === '1142948073434267809');
                
                client.rpgSystemsCache = systemChannels.map(c => ({
                    nome: c.name,
                    tipo: c.type === 15 ? 'Fórum' : 'Texto',
                    descricao: c.topic ? c.topic.substring(0, 100) : ''
                }));
                console.log(`[SISTEMAS] ✅ Cache atualizado! ${client.rpgSystemsCache.length} sistemas carregados na RAM.`);
            } catch (e) {
                console.error('[SISTEMAS] Erro ao tentar cachear sistemas no startup:', e);
                client.rpgSystemsCache = [];
            }

            client.emit('clientReady');
        })

        const token = process.env.DISCORD_TOKEN || config.token;
        if (!token) {
            throw new Error("Token do Discord não encontrado. Verifique o arquivo .env ou config.js.");
        }
        await client.login(token.trim());
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
