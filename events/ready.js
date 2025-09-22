const { ActivityType } = require('discord.js');

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
            // Busca todas as regras de reaction roles no banco
            const rules = await this.client.database.reactionRoles.find({});
            console.log(`🎭 Carregando ${rules.length} reaction roles...`);
    
            for (const rule of rules) {
                const { messageId, emoji, roleId } = rule;
    
                // Para cada guild que o bot está
                for (const guild of this.client.guilds.cache.values()) {
                    try {
                        // Tenta encontrar a mensagem
                        const message = await findMessage(guild, messageId);
                        if (!message) continue;
    
                        // Configura os coletores de reação
                        const collector = message.createReactionCollector();
    
                        collector.on('collect', async (reaction, user) => {
                            if (user.bot) return;
                            if (reaction.emoji.toString() !== emoji) return;
    
                            const member = await message.guild.members.fetch(user.id);
                            const role = message.guild.roles.cache.get(roleId);
    
                            if (!role) return;
                            if (member.roles.cache.has(role.id)) return;
    
                            await member.roles.add(role).catch(console.error);
                        });
    
                        collector.on('remove', async (reaction, user) => {
                            if (user.bot) return;
                            if (reaction.emoji.toString() !== emoji) return;
    
                            const member = await message.guild.members.fetch(user.id);
                            const role = message.guild.roles.cache.get(roleId);
    
                            if (!role) return;
                            if (!member.roles.cache.has(role.id)) return;
    
                            await member.roles.remove(role).catch(console.error);
                        });
    
                        // Adiciona a reação se não existir
                        const existing = message.reactions.cache.get(emoji);
                        if (!existing) {
                            await message.react(emoji).catch(console.error);
                        }
    
                        console.log(`✅ Reaction role reativada: ${emoji} -> ${role?.name || roleId}`);
                    } catch (err) {
                        console.error(`Erro ao configurar reaction role ${emoji}:`, err);
                    }
                }
            }
        } catch (err) {
            console.error('Erro ao carregar reaction roles:', err);
        }
    }
};

// Função auxiliar para encontrar mensagem (igual à do reactionRole.js)
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
