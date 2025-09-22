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
            const rules = await this.client.database.reactionRoles.find({});
            console.log(`🎭 Carregando ${rules.length} reaction roles...`);

            // Agrupa regras por mensagem para evitar múltiplos coletores
            const messageRules = new Map();
            for (const rule of rules) {
                if (!messageRules.has(rule.messageId)) {
                    messageRules.set(rule.messageId, []);
                }
                messageRules.get(rule.messageId).push(rule);
            }

            for (const [messageId, rulesForMessage] of messageRules) {
                for (const guild of this.client.guilds.cache.values()) {
                    try {
                        const message = await findMessage(guild, messageId);
                        if (!message) continue;

                        // Um único coletor por mensagem
                        const collector = message.createReactionCollector();

                        collector.on('collect', async (reaction, user) => {
                            if (user.bot) return;

                            // Encontra a regra para este emoji
                            const rule = rulesForMessage.find(r => r.emoji === reaction.emoji.toString());
                            if (!rule) return;

                            const role = message.guild.roles.cache.get(rule.roleId);
                            if (!role) return;

                            const member = await message.guild.members.fetch(user.id);
                            if (!member || member.roles.cache.has(role.id)) return;

                            try {
                                await member.roles.add(role);
                                console.log(`✅ Cargo ${role.name} adicionado para ${member.user.tag}`);
                            } catch (err) {
                                console.error(`Erro ao adicionar cargo ${role.name}:`, err);
                            }
                        });

                        collector.on('remove', async (reaction, user) => {
                            if (user.bot) return;

                            const rule = rulesForMessage.find(r => r.emoji === reaction.emoji.toString());
                            if (!rule) return;

                            const role = message.guild.roles.cache.get(rule.roleId);
                            if (!role) return;

                            const member = await message.guild.members.fetch(user.id);
                            if (!member || !member.roles.cache.has(role.id)) return;

                            try {
                                await member.roles.remove(role);
                                console.log(`🔄 Cargo ${role.name} removido de ${member.user.tag}`);
                            } catch (err) {
                                console.error(`Erro ao remover cargo ${role.name}:`, err);
                            }
                        });

                        // Adiciona todas as reações necessárias
                        for (const rule of rulesForMessage) {
                            if (!message.reactions.cache.has(rule.emoji)) {
                                await message.react(rule.emoji).catch(console.error);
                            }
                        }

                        console.log(`✅ Reaction roles configuradas para mensagem ${messageId}`);
                    } catch (err) {
                        console.error(`Erro ao configurar reaction roles para mensagem ${messageId}:`, err);
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
