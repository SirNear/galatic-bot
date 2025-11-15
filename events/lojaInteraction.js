const { EmbedBuilder, ButtonStyle, ActionRowBuilder, ButtonBuilder, ComponentType } = require('discord.js');
const { LojaModel } = require('../mongoose.js');
const loja = require('../commands/rpg/loja.js');

async function handleLojaInteraction(interaction, client) {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;

    const hasPermission = interaction.member.roles.cache.has('731974690125643869') || interaction.member.roles.cache.has('1438672389918556310') || interaction.member.roles.cache.has('1409771551099715645');
    if (!hasPermission) {
        return interaction.reply({
            content: 'Você não tem permissão para interagir com a criação de lojas.',
            ephemeral: true
        });
    }

    if (interaction.isButton()) {
        const [action] = interaction.customId.split('_');

        if (interaction.customId.startsWith('approve_loja_') || interaction.customId.startsWith('reject_loja_')) {
            const parts = interaction.customId.split('_');
            const decision = parts[0];
            const lojaId = parts[2];
            const creatorId = parts[3];

            const hasAdmodRole = interaction.member.roles.cache.has('1438672389918556310') || interaction.member.roles.cache.has('1409771551099715645');
            if (!hasAdmodRole) {
                return interaction.reply({ content: '❌ Apenas AdMods podem aprovar ou rejeitar lojas.', ephemeral: true });
            }

            const lojaPendente = await LojaModel.findById(lojaId);
            if (!lojaPendente) {
                return interaction.update({ content: 'Esta solicitação de loja não é mais válida.', components: [] });
            }

            const creator = await interaction.guild.members.fetch(creatorId).catch(() => null);

            if (decision === 'approve') {
                const canal = await client.channels.fetch(lojaPendente.canalId);
                const embed = new EmbedBuilder()
                    .setTitle(lojaPendente.nome)
                    .setDescription(lojaPendente.descricao)
                    .setColor('#119446')
                    .setFooter({ text: `Loja criada por ${creator?.user.username || 'Usuário Desconhecido'}`, iconURL: creator?.user.displayAvatarURL() });

                const lojaMessage = await canal.send({ embeds: [embed] });
                lojaPendente.messageId = lojaMessage.id;
                lojaPendente.status = 'aprovada';
                await lojaPendente.save();

                await interaction.update({ content: `✅ Loja aprovada e criada com sucesso em ${canal.toString()}`, components: [] });
                if (creator) await creator.send(`Sua loja **${lojaPendente.nome}** em ${canal.toString()} foi aprovada por ${interaction.user.toString()} e criada com sucesso!`).catch(()=>{});

            } else { // reject
                await LojaModel.findByIdAndDelete(lojaId);
                await interaction.update({ content: '❌ Loja rejeitada.', components: [] });
                if (creator) await creator.send(`Sua loja **${lojaPendente.nome}** foi rejeitada por ${interaction.user.toString()}. Por favor, entre em contato com um admod para mais informações.`).catch(()=>{});
            }
            return;
        }

        if (interaction.customId.startsWith('categoria_')) {
            const categoriaNome = interaction.customId.split('_')[2];
            const lojaId = interaction.customId.split('_')[1];

            const lojaDBCat = await LojaModel.findOne({ messageId: interaction.message.id });
            if (!lojaDBCat) return interaction.reply({ content: 'A loja foi excluida ou está desatualizada no banco de dados.', ephemeral: true });
        
            const categoria = lojaDBCat.categorias.find(cat => cat.nome.toLowerCase() === categoriaNome.toLowerCase());
            if (!categoria) return interaction.reply({ content: 'Categoria não encontrada na loja.', ephemeral: true });
            
            const itensCategoria = categoria.itens;

            if(!itensCategoria || itensCategoria.length === 0) {
                return interaction.reply({ content: 'Nenhum item disponível nesta categoria.', ephemeral: true });
            }

            let currentPage = 0;

            const generateItemEmbed = async (index) => {
                const item = itensCategoria[index];
                const moedaConfig = await client.database.MoedaConfig.findOne({ guildId: interaction.guild.id, nome: item.moeda.toLowerCase() });

                return new EmbedBuilder()
                    .setTitle(`${lojaDBCat.nome} - ${categoria.nome}`)
                    .setColor('#0099ff')
                    .setDescription(`**${item.nome}**\n\n${item.descricao}`)
                    .addFields({ name: 'Preço', value: `${item.preco} ${moedaConfig?.emoji || ''} ${item.moeda}`, inline: true })
                    .setFooter({ text: `Item ${index + 1} de ${itensCategoria.length}` });
            };

            const generateItemButtons = (index) => {
                const item = itensCategoria[index];
                const acaoLinha = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`prev_item_${lojaId}_${categoriaNome}`)
                        .setLabel('◀️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(index === 0),
                    new ButtonBuilder()
                        .setCustomId(`buy_item_${lojaId}_${item.nome}`)
                        .setLabel('🛒')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`next_item_${lojaId}_${categoriaNome}`)
                        .setLabel('▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(index >= itensCategoria.length - 1)
                );
                return acaoLinha;
            };

            const reply = await interaction.reply({
                embeds: [await generateItemEmbed(currentPage)],
                components: [generateItemButtons(currentPage)],
                ephemeral: true,
                fetchReply: true
            });

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => i.user.id === interaction.user.id,
                time: 300000 // 5 minutos
            });

            collector.on('collect', async i => {
                await i.deferUpdate();

                if (i.customId.startsWith('prev_item_')) {
                    currentPage--;
                } else if (i.customId.startsWith('next_item_')) {
                    currentPage++;
                } else if (i.customId.startsWith('buy_item_')) {
                    const itemName = i.customId.split('_')[3];

                    let dadosUsu = await client.database.userData.findOne({ uid: interaction.user.id, uServer: interaction.guild.id });
                    if (!dadosUsu) {
                        dadosUsu = new client.database.userData({
                            uid: interaction.user.id,
                            uServer: interaction.guild.id
                        })
                        await dadosUsu.save();
                    }

                    const itemToBuy = itensCategoria.find(it => it.nome === itemName);
                    if (!itemToBuy) {
                        await i.followUp({ content: `Item não encontrado.`, ephemeral: true });
                        collector.stop();
                        return;
                    }else {
                        const moedaConfig = await client.database.MoedaConfig.findOne({ guildId: interaction.guild.id, nome: itemToBuy.moeda.toLowerCase() });
                        const saldoUsu = dadosUsu.moeda.get(itemToBuy.moeda.toLowerCase()) || 0;

                        if (saldoUsu < itemToBuy.preco) {
                            await i.followUp({ content: `❌ Você não tem ${itemToBuy.preco} ${moedaConfig?.emoji || ''} ${itemToBuy.moeda} para comprar **${itemToBuy.nome}**. Saldo atual: ${saldoUsu} ${moedaConfig?.emoji || ''} ${itemToBuy.moeda}`, ephemeral: true });
                            collector.stop();
                            return;
                        }

                        dadosUsu.moeda.set(itemToBuy.moeda.toLowerCase(), saldoUsu - itemToBuy.preco);
                        await dadosUsu.save();

                        await i.followUp({ content: `✅ Você comprou **${itemToBuy.nome}** por ${itemToBuy.preco} ${moedaConfig?.emoji || ''} ${itemToBuy.moeda}. Saldo restante: ${saldoUsu - itemToBuy.preco} ${moedaConfig?.emoji || ''} ${itemToBuy.moeda}`, ephemeral: true });
                    }
                    collector.stop();
                    return;
                }

                await i.editReply({ embeds: [await generateItemEmbed(currentPage)], components: [generateItemButtons(currentPage)] });
            });
        }
    }
}
       

module.exports = { handleLojaInteraction };