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

            for (const guild of this.client.guilds.cache.values()) {
                for (const rule of rules) {
                    try {
                        const message = await findMessage(guild, rule.messageId);
                        if (!message) continue;

                        // Remove collectors antigos se existirem
                        const existingCollector = message.client.collectors?.get(message.id);
                        if (existingCollector) {
                            existingCollector.stop();
                        }

                        // Cria novo collector
                        const filter = (reaction, user) => !user.bot;
                        const collector = message.createReactionCollector({ filter });

                        collector.on('collect', async (reaction, user) => {
                            try {
                                // Encontra a regra para este emoji
                                const matchingRule = await this.client.database.reactionRoles.findOne({
                                    messageId: message.id,
                                    emoji: reaction.emoji.toString()
                                });

                                if (!matchingRule) return;

                                const role = message.guild.roles.cache.get(matchingRule.roleId);
                                if (!role) return;

                                const member = await message.guild.members.fetch(user.id);
                                if (!member) return;

                                await member.roles.add(role);
                                console.log(`✅ Cargo ${role.name} adicionado para ${user.tag}`);
                            } catch (err) {
                                console.error('Erro ao adicionar cargo:', err);
                            }
                        });

                        collector.on('remove', async (reaction, user) => {
                            try {
                                const matchingRule = await this.client.database.reactionRoles.findOne({
                                    messageId: message.id,
                                    emoji: reaction.emoji.toString()
                                });

                                if (!matchingRule) return;

                                const role = message.guild.roles.cache.get(matchingRule.roleId);
                                if (!role) return;

                                const member = await message.guild.members.fetch(user.id);
                                if (!member) return;

                                await member.roles.remove(role);
                                console.log(`🔄 Cargo ${role.name} removido de ${user.tag}`);
                            } catch (err) {
                                console.error('Erro ao remover cargo:', err);
                            }
                        });

                        // Armazena o collector para referência futura
                        if (!message.client.collectors) {
                            message.client.collectors = new Map();
                        }
                        message.client.collectors.set(message.id, collector);

                        // Adiciona reação inicial se necessário
                        if (!message.reactions.cache.has(rule.emoji)) {
                            await message.react(rule.emoji);
                        }

                        console.log(`✅ Reaction role configurada: ${rule.emoji} -> ${rule.roleId}`);
                    } catch (err) {
                        console.error(`Erro ao configurar reaction role:`, err);
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
