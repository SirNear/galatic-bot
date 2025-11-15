const { EmbedBuilder, ButtonStyle, ActionRowBuilder, ButtonBuilder, ComponentType } = require('discord.js');
const { LojaModel } = require('../mongoose.js');
const loja = require('../commands/rpg/loja.js');

async function handleLojaInteraction(interaction, client) {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;

    const temPermissao = interaction.member.roles.cache.has('731974690125643869') || interaction.member.roles.cache.has('1438672389918556310') || interaction.member.roles.cache.has('1409771551099715645');
    if (!temPermissao) {
        return interaction.reply({
            content: 'Você não tem permissão para interagir com a criação de lojas.',
            ephemeral: true,
        });
    }

    if (interaction.isButton()) {
        const [action] = interaction.customId.split('_');

        if (interaction.customId.startsWith('approve_loja_') || interaction.customId.startsWith('reject_loja_')) {
            const [, , lojaId, criadorId] = interaction.customId.split('_');
            const decisao = action;

            const temCargoAdmod = interaction.member.roles.cache.has('1438672389918556310') || interaction.member.roles.cache.has('1409771551099715645');
            if (!temCargoAdmod) {
                return interaction.reply({ content: '❌ Apenas AdMods podem aprovar ou rejeitar lojas.', ephemeral: true });
            }

            const lojaPen = await LojaModel.findById(lojaId);
            if (!lojaPen) {
                return interaction.update({ content: 'Esta solicitação de loja não é mais válida.', components: [] });
            }

            const criador = await interaction.guild.members.fetch(criadorId).catch(() => null);

            if (decisao === 'approve') {
                const canal = await client.channels.fetch(lojaPen.canalId);
                const embed = new EmbedBuilder()
                    .setTitle(lojaPen.nome)
                    .setDescription(lojaPen.descricao)
                    .setColor('#119446')
                    .setFooter({ text: `Loja criada por ${criador?.user.username || 'Usuário Desconhecido'}`, iconURL: criador?.user.displayAvatarURL() });

                const msgLoja = await canal.send({ embeds: [embed] });
                lojaPen.messageId = msgLoja.id;
                lojaPen.status = 'aprovada';
                await lojaPen.save();

                await interaction.update({ content: `✅ Loja aprovada e criada com sucesso em ${canal.toString()}`, components: [] });
                if (criador) await criador.send(`Sua loja **${lojaPen.nome}** em ${canal.toString()} foi aprovada por ${interaction.user.toString()} e criada com sucesso!`).catch(()=>{});

            } else { // reject
                await LojaModel.findByIdAndDelete(lojaId);
                await interaction.update({ content: '❌ Loja rejeitada.', components: [] });
                if (criador) await criador.send(`Sua loja **${lojaPen.nome}** foi rejeitada por ${interaction.user.toString()}. Por favor, entre em contato com um admod para mais informações.`).catch(()=>{});
            }
            return;
        }

        if (interaction.customId.startsWith('categoria_')) {
            const [, lojaId, nomeCat] = interaction.customId.split('_');

            const lojaDb = await LojaModel.findOne({ messageId: interaction.message.id });
            if (!lojaDb) return interaction.reply({ content: 'A loja foi excluida ou está desatualizada no banco de dados.', ephemeral: true });
        
            const categoria = lojaDb.categorias.find(cat => cat.nome.toLowerCase() === nomeCat.toLowerCase());
            if (!categoria) return interaction.reply({ content: 'Categoria não encontrada na loja.', ephemeral: true });
            
            const itensCat = categoria.itens;

            if(!itensCat || itensCat.length === 0) {
                return interaction.reply({ content: 'Nenhum item disponível nesta categoria.', ephemeral: true });
            }

            let pagAtual = 0;

            const gerarEmbedItem = async (indice) => {
                const item = itensCat[indice];
                const confMoeda = await client.database.MoedaConfig.findOne({ guildId: interaction.guild.id, nome: item.moeda.toLowerCase() });

                return new EmbedBuilder()
                    .setTitle(`${lojaDb.nome} - ${categoria.nome}`)
                    .setColor('#0099ff')
                    .setDescription(`**${item.nome}**\n\n${item.descricao}`)
                    .addFields({ name: 'Preço', value: `${item.preco} ${confMoeda?.emoji || ''} ${item.moeda}`, inline: true })
                    .setFooter({ text: `Item ${indice + 1} de ${itensCat.length}` });
            };

            const gerarBotoesItem = (indice) => {
                const item = itensCat[indice];
                const linhaAcao = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`prev_item_${lojaId}_${nomeCat}`)
                        .setLabel('◀️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(indice === 0),
                    new ButtonBuilder()
                        .setCustomId(`buy_item_${lojaId}_${item.nome}`)
                        .setLabel('🛒')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`next_item_${lojaId}_${nomeCat}`)
                        .setLabel('▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(indice >= itensCat.length - 1)
                );
                return linhaAcao;
            };

            const resposta = await interaction.reply({
                embeds: [await gerarEmbedItem(pagAtual)],
                components: [gerarBotoesItem(pagAtual)],
                ephemeral: true,
                fetchReply: true,
            });

            const coletor = resposta.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => i.user.id === interaction.user.id,
                time: 300000, // 5 minutos
            });

            coletor.on('collect', async i => {
                if (i.customId.startsWith('buy_item_')) {
                    coletor.stop();
                    const [, , , nomeItem] = i.customId.split('_');

                    let dadosUsu = await client.database.userData.findOne({ uid: i.user.id, uServer: i.guild.id });
                    if (!dadosUsu) {
                        dadosUsu = new client.database.userData({
                            uid: i.user.id,
                            uServer: i.guild.id,
                        });
                        await dadosUsu.save();
                    }

                    const itemComprar = itensCat.find(it => it.nome === nomeItem);
                    if (!itemComprar) {
                        await i.reply({ content: `Item não encontrado.`, ephemeral: true });
                        return;
                    }

                    const confMoeda = await client.database.MoedaConfig.findOne({ guildId: i.guild.id, nome: itemComprar.moeda.toLowerCase() });
                    const saldoUsu = dadosUsu.moeda.get(itemComprar.moeda.toLowerCase()) || 0;

                    if (saldoUsu < itemComprar.preco) {
                        await i.reply({ content: `❌ Você não tem ${itemComprar.preco} ${confMoeda?.emoji || ''} ${itemComprar.moeda} para comprar **${itemComprar.nome}**. Saldo atual: ${saldoUsu} ${confMoeda?.emoji || ''} ${itemComprar.moeda}`, ephemeral: true });
                        return;
                    }

                    const novoSaldo = saldoUsu - itemComprar.preco;
                    dadosUsu.moeda.set(itemComprar.moeda.toLowerCase(), novoSaldo);
                    await dadosUsu.save();

                    await i.reply({ content: `✅ Você comprou **${itemComprar.nome}** por ${itemComprar.preco} ${confMoeda?.emoji || ''} ${itemComprar.moeda}. Saldo restante: ${novoSaldo} ${confMoeda?.emoji || ''} ${itemComprar.moeda}`, ephemeral: true });
                    return;
                }

                await i.deferUpdate();

                if (i.customId.startsWith('prev_item_')) {
                    pagAtual--;
                } else if (i.customId.startsWith('next_item_')) {
                    pagAtual++;
                }

                await i.editReply({ embeds: [await gerarEmbedItem(pagAtual)], components: [gerarBotoesItem(pagAtual)] });
            });
        }
    }
}
       

module.exports = { handleLojaInteraction };