const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Ficha } = require('../../mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ficha')
        .setDescription('Mostra a ficha de um personagem salva no banco.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('O dono da ficha (opcional)'))
        .addChannelOption(option => 
            option.setName('canal')
                .setDescription('O canal da ficha (opcional, busca pelo canal atual se vazio)')),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('usuario');
        const targetChannel = interaction.options.getChannel('canal') || interaction.channel;

        let query = {};
        if (targetUser) query.userId = targetUser.id;
        else query.channelId = targetChannel.id;

        const ficha = await Ficha.findOne(query);

        if (!ficha) {
            return interaction.reply({ content: '❌ Nenhuma ficha encontrada para este canal/usuário. Use `/scanficha` no canal do personagem primeiro.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`📜 Ficha: ${ficha.nome}`)
            .setDescription(`**Raça:** ${ficha.raca}\n**Idade:** ${ficha.idade}`)
            .setColor(0x2b2d31)
            .addFields(
                { name: '⚔️ Atributos', value: `
**Força:** ${ficha.atributos.forca}
**Velocidade:** ${ficha.atributos.velocidade}
**Resistência:** ${ficha.atributos.resistencia}
**Mana:** ${ficha.atributos.mana}
                ` }
            );

        if (ficha.imagem) embed.setThumbnail(ficha.imagem);

        // Adicionar Habilidades (Lógica segura para não estourar o limite do Discord)
        let charsCount = 0;
        const maxChars = 5000; // Margem de segurança

        if (ficha.habilidades.length > 0) {
            embed.addFields({ name: '⠀', value: '━━━ **HABILIDADES & PODERES** ━━━' });
            
            for (const skill of ficha.habilidades) {
                // Se for muito grande, corta
                const desc = skill.descricao.length > 300 ? skill.descricao.substring(0, 300) + '...' : skill.descricao;
                
                // Verifica se vai estourar o embed
                if (charsCount + desc.length > maxChars || embed.data.fields.length >= 24) {
                    embed.addFields({ name: '⚠️ Outras Habilidades', value: `+ ${ficha.habilidades.length - embed.data.fields.length} habilidades ocultas (limite do Discord).` });
                    break;
                }

                embed.addFields({ name: `🔹 ${skill.nome}`, value: desc });
                charsCount += desc.length;
            }
        }

        await interaction.reply({ embeds: [embed] });
    }
};