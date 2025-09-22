const { EmbedBuilder } = require('discord.js');

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

            // Aguarda conexão com o banco
            if (!this.client.database?.ReactionRoles) {
                console.error('Database ReactionRoles não está disponível');
                return;
            }

            // Busca regra no banco de dados
            const rule = await this.client.database.ReactionRoles.findOne({
                messageId: reaction.message.id,
                emoji: reaction.emoji.toString()
            }).exec(); // Importante: use .exec()

            if (!rule) return;

            // Adiciona o cargo
            const guild = reaction.message.guild;
            const role = guild.roles.cache.get(rule.roleId);
            if (!role) {
                console.error(`Cargo ${rule.roleId} não encontrado`);
                return;
            }

            const member = await guild.members.fetch(user.id);
            if (!member) return;

            await member.roles.add(role);
            console.log(`✅ Cargo ${role.name} adicionado para ${user.tag}`);

        } catch (err) {
            console.error('Erro ao processar reação:', err);
        }
    }
};