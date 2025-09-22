const { ActivityType, ChannelType } = require('discord.js');

module.exports = class {
    constructor(client) {
        this.client = client;
    }

    async run() {
        // Carrega reaction roles do banco de dados
        await this.setupReactionRoles();

        this.client.owner = await this.client.users.fetch("395788326835322882");

        console.log([
            `Logado em ${this.client.user.tag}`,
            `${this.client.commands.size} comandos carregados!`,
        ].join('\n'));

        let status = [ 	
            {name: `Pó de café na pia`, type: ActivityType.Playing},
            {name: 'Me mencione para saber mais sobre mim!', type: ActivityType.Playing},
            {name: `${this.client.guilds.size} universos diferentes!`, type: ActivityType.Watching},
            {name: 'Observou bugs? Tem sugestões ou dúvidas? Envie uma DM ao meu criador: Near#7447', type: ActivityType.Playing},
            {name: 'Servidor de suporte em andamento.', type: ActivityType.Playing}
        ]
        
        setInterval(() => {
            let randomStatus = status[Math.floor(Math.random() * status.length)]
            this.client.user.setActivity(randomStatus, {type: randomStatus} )
        }, 10000)
    }

    // Novo método para configurar reaction roles
    async setupReactionRoles() {
        try {
            if (!this.client.database?.ReactionRoles) {
                console.log('⚠️ Sistema de reaction roles não inicializado.');
                return;
            }

            const rules = await this.client.database.ReactionRoles.find({}).exec();
            
            // Remove log de carregamento de rules
            if (rules?.length > 0) {
                for (const guild of this.client.guilds.cache.values()) {
                    for (const rule of rules) {
                        try {
                            const message = await findMessage(guild, rule.messageId);
                            if (!message) continue;

                            // Adiciona reação sem log
                            if (!message.reactions.cache.has(rule.emoji)) {
                                await message.react(rule.emoji);
                            }
                        } catch (err) {
                            console.error(`Erro ao configurar reaction role:`, err);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Erro ao carregar reaction roles:', err);
        }
    }
};

// Função auxiliar para encontrar mensagem
async function findMessage(guild, messageId) {
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
    for (const channel of textChannels.values()) {
        try {
            const msg = await channel.messages.fetch(messageId);
            if (msg) return msg;
        } catch (e) {}
    }
    return null;
}
