module.exports = class {
    constructor(client) {
        this.client = client;
    }

    async run(reaction, user) {
        try {
            // Ignora reações de bots
            if (user.bot) return;

            // Garante que a reação está totalmente carregada
            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    console.error('Erro ao carregar reação:', error);
                    return;
                }
            }

            // Busca regra no banco de dados
            const rule = await this.client.database.reactionRoles.findOne({
                messageId: reaction.message.id,
                emoji: reaction.emoji.toString()
            });

            if (!rule) return;

            // Remove o cargo
            const guild = reaction.message.guild;
            const role = guild.roles.cache.get(rule.roleId);
            if (!role) return;

            const member = await guild.members.fetch(user.id);
            if (!member) return;

            await member.roles.remove(role);
            console.log(`🔄 Cargo ${role.name} removido de ${user.tag}`);

        } catch (err) {
            console.error('Erro ao processar remoção de reação:', err);
        }
    }
};