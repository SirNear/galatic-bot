const {
    ModalBuilder,
    EmbedBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    AttachmentBuilder,
    ComponentType,
    Embed
} = require('discord.js');

async function handleEmbedEditInteraction(interaction, client) {
    const embDb = await client.database.EmbedModel.findOne({ messageId: interaction.message.id });
    let embMsg = interaction.message || await interaction.channel.messages.fetch(interaction.message.id);

    if (!embDb || embDb.createdBy !== interaction.user.id) {
        return interaction.reply({ content: '❌ Não foi possível encontrar os dados deste embed no banco de dados ou você não tem permissão para editá-lo.', ephemeral: true });
    }

    const embEdiMsg = new EmbedBuilder()
        .setTitle(embDb.titulo)
        .setDescription(embDb.descricao)
        .setColor(embDb.cor)
        .setFooter({ text: embDb.footer })
        .setTimestamp();

    let maxFields = 25 - (embDb.campos ? embDb.campos.length : 0);
    let maxCharacters = 6000 - (embMsg.embeds[0].fields ? embMsg.embeds[0].fields.reduce((acc, field) => acc + field.name.length + field.value.length, 0) : 0);

    const menEdi = new StringSelectMenuBuilder()
        .setCustomId('select_edit_embed')
        .setPlaceholder('Selecione o que deseja editar')
        .addOptions(
            { label: 'Título', value: 'titulo' },
            { label: 'Descrição', value: 'descricao' },
            { label: 'Cor', value: 'cor' },
            { label: 'Rodapé', value: 'footer' },
            { label: 'Imagem', value: 'imagem' },
            { label: 'Adicionar botão', value: 'add_botao' },
            { label: 'Adicionar menu de seleção', value: 'add_menu' }
        );

    if(maxCharacters > 0 && maxFields > 0) return menEdi.addOptions({ label: 'Adicionar campo', value: 'add_campo' });


    const btnExc = new ButtonBuilder()
        .setCustomId('btn_excluir_embed')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️');
    
    let ediMsgEmb = await interaction.reply({ embeds: [embEdiMsg], components: [new ActionRowBuilder().addComponents(menEdi), new ActionRowBuilder().addComponents(btnExc)], ephemeral: true, fetchReply: true });

    const filter = i => i.user.id === interaction.user.id;
    const colMen = ediMsgEmb.createMessageComponentCollector({ filter, componentType: ComponentType.StringSelect, time: 300000 });

    colMen.on('collect', async i => {
            if (i.values[0] === 'titulo') {
                const inpNovTit = new TextInputBuilder()
                    .setCustomId('input_new_title')
                    .setLabel('Novo Título')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(256);

                const modTit = new ModalBuilder()
                    .setCustomId('modal_edit_title')
                    .setTitle('Editar Título do Embed')
                    .addComponents(new ActionRowBuilder().addComponents(inpNovTit));

                await i.showModal(modTit);
                
                const subFor = await i.awaitModalSubmit({
                    time: 60000,
                    filter: (modalInt) => modalInt.user.id === interaction.user.id
                }).catch(() => null);

                if (subFor) {
                    const novTit = subFor.fields.getTextInputValue('input_new_title');
                    embDb.titulo = novTit;
                    await embDb.save();

                    await subFor.reply({ content: `✅ Título atualizado para: **${novTit}**`, ephemeral: true });

                    const embAtu = EmbedBuilder.from(embMsg.embeds[0]).setTitle(novTit);
                    await embMsg.edit({ embeds: [embAtu] });
                }
            }else if (i.values[0] === 'descricao') {
                const inpNovDesc = new TextInputBuilder()
                    .setCustomId('input_new_description')
                    .setLabel('Nova Descrição')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(4096);

                const modDesc = new ModalBuilder()
                    .setCustomId('modal_edit_description')
                    .setTitle('Editar Descrição do Embed')
                    .setLabel(embDb.descricao)
                    .addComponents(new ActionRowBuilder().addComponents(inpNovDesc));

                await i.showModal(modDesc);
                const subFor = await i.awaitModalSubmit({
                    time: 60000,
                    filter: (modalInt) => modalInt.user.id === interaction.user.id
                }).catch(() => null);

                if (subFor) {
                    const novDesc = subFor.fields.getTextInputValue('input_new_description');
                    embDb.descricao = novDesc;
                    await embDb.save();

                    await subFor.reply({ content: `✅ Descrição atualizada para: **${novDesc}**`, ephemeral: true });

                    const embAtu = EmbedBuilder.from(embMsg.embeds[0]).setDescription(novDesc);
                    await embMsg.edit({ embeds: [embAtu] });
                }
            }else if (i.values[0] === 'cor') {
                const inpNovCor = new TextInputBuilder()
                    .setCustomId('input_new_color')
                    .setLabel('Nova Cor (hexadecimal, ex: #FF0000)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(7);

                const modCor = new ModalBuilder()
                    .setCustomId('modal_edit_color')
                    .setTitle('Editar Cor do Embed')
                    .addComponents(new ActionRowBuilder().addComponents(inpNovCor));

                await i.showModal(modCor);
                const subFor = await i.awaitModalSubmit({
                    time: 60000,
                    filter: (modalInt) => modalInt.user.id === interaction.user.id
                }).catch(() => null);

                if (subFor) {
                    const novCor = subFor.fields.getTextInputValue('input_new_color');
                    embDb.cor = novCor;
                    await embDb.save();

                    await subFor.reply({ content: `✅ Cor atualizada para: **${novCor}**`, ephemeral: true });
                    const embAtu = EmbedBuilder.from(embMsg.embeds[0]).setColor(novCor);
                    await embMsg.edit({ embeds: [embAtu] });
                }
            }else if (i.values[0] === 'footer') {
                const inpNovFooter = new TextInputBuilder()
                    .setCustomId('input_new_footer')
                    .setLabel('Novo Rodapé')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(2048);

                const modFooter = new ModalBuilder()
                    .setCustomId('modal_edit_footer')
                    .setTitle('Editar Rodapé do Embed')
                    .addComponents(new ActionRowBuilder().addComponents(inpNovFooter));

                await i.showModal(modFooter);
                const subFor = await i.awaitModalSubmit({
                    time: 60000,
                    filter: (modalInt) => modalInt.user.id === interaction.user.id
                }).catch(() => null);

                if (subFor) {
                    const novFooter = subFor.fields.getTextInputValue('input_new_footer');
                    embDb.footer = novFooter;
                    await embDb.save();

                    await subFor.reply({ content: `✅ Rodapé atualizado para: **${novFooter}**`, ephemeral: true });
                    const embAtu = EmbedBuilder.from(embMsg.embeds[0]).setFooter({ text: novFooter });
                    await embMsg.edit({ embeds: [embAtu] });
                }
            }else if (i.values[0] === 'imagem') {
                i.reply({ content: 'Envie a imagem que deseja definir para o embed (como anexo ou URL) dentro de 2 minutos.', ephemeral: true });

                const filterImg = msg => msg.author.id === interaction.user.id && (msg.attachments.size > 0 || msg.content.match(/https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/i));
                const colImg = interaction.channel.createMessageCollector({ filter: filterImg, max: 1, time: 120000 });

                colImg.on('collect', async msg => {
                    const img = msg.attachments.size > 0 ? msg.attachments.first().url : msg.content.match(/https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/i)[0];

                    const logChaId = process.env.LOG_CHANNEL_ID; 
                    const channel = await client.channels.fetch(logChaId).catch(err => {
                        console.error(`[LOG IMAGEM EMBED] Erro ao buscar canal ${logChaId}:`, err);
                        return null;
                    });

                    let imgUrl = await channel.send({ content: img });

                    embDb.imagem = imgUrl.attachments.first().url;
                    await embDb.save();

                    await msg.reply({ content: `✅ Imagem atualizada`, ephemeral: true });
                    
            })
        }else if (i.values[0] === 'add_campo') {

            if (maxCharacters <= 0) {
                return i.reply({ content: '❌ O embed já atingiu o número máximo de caracteres nos campos (6000).', ephemeral: true });
                
            }else if (maxFields <= 0) {
                return i.reply({ content: '❌ O embed já atingiu o número máximo de campos (25).', ephemeral: true });
            }


            let inpNomeCampo = new TextInputBuilder()
                .setCustomId('input_field_name')
                .setLabel('Titulo do Campo')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(256);
            
            let inpValorCampo = new TextInputBuilder()
                .setCustomId('input_field_value')
                .setLabel('Descrição do Campo')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1024);

            let modCampo = new ModalBuilder()
                .setCustomId('modal_add_field')
                .setTitle('Adicionar Campo ao Embed')
                .addComponents(new ActionRowBuilder().addComponents(inpNomeCampo), new ActionRowBuilder().addComponents(inpValorCampo));

            await i.showModal(modCampo);
            const subFor = await i.awaitModalSubmit({
                time: 60000,
                filter: (modalInt) => modalInt.user.id === interaction.user.id
            }).catch(() => null);

            if (subFor) {
                const nomeCampo = subFor.fields.getTextInputValue('input_field_name');
                const valorCampo = subFor.fields.getTextInputValue('input_field_value');

                if (!embDb.campos) embDb.campos = [];
                embDb.campos.push({ name: nomeCampo, value: valorCampo, inline: false });
                await embDb.save();

                await subFor.reply({ content: `✅ Campo adicionado com sucesso! Você ainda tem ${maxFields - 1} campos disponíveis e ${maxCharacters - (nomeCampo.length + valorCampo.length)} caracteres disponíveis para o embed`, ephemeral: true });
                const embAtu = EmbedBuilder.from(embMsg.embeds[0]).addFields({ name: nomeCampo, value: valorCampo, inline: false });
                await embMsg.edit({ embeds: [embAtu] });
            }        
        }else if (i.values[0] === 'add_botao') {
            const inpName = new TextInputBuilder()
                .setCustomId('input_button_name')
                .setLabel('Nome do Botão')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(80);

            const inpEmoji = new TextInputBuilder()
                .setCustomId('input_button_emoji')
                .setLabel('Emoji do Botão (opcional)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(2);

            const inpColor = new TextInputBuilder()
                    .setCustomId('input_button_color')
                    .setLabel('Cor do Botão (verde, cinza, vermelho ou azul)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

            let modBotao = new ModalBuilder()
                .setCustomId('modal_add_button')
                .setTitle('Informações do Botão')
                .addComponents(new ActionRowBuilder().addComponents(inpName), new ActionRowBuilder().addComponents(inpEmoji), new ActionRowBuilder().addComponents(inpColor));

            await i.showModal(modBotao);
            const subFor = await i.awaitModalSubmit({
                time: 60000,
                filter: (modalInt) => modalInt.user.id === interaction.user.id
            }).catch(() => null);

            if (subFor) {
                const nomeBotao = subFor.fields.getTextInputValue('input_button_name');
                const emojiBotao = subFor.fields.getTextInputValue('input_button_emoji');
                const corTexto = subFor.fields.getTextInputValue('input_button_color');
                
                let corBotao;
                switch(corTexto.toLowerCase()) {
                    case 'verde': corBotao = ButtonStyle.Success; break;
                    case 'cinza': corBotao = ButtonStyle.Secondary; break;
                    case 'vermelho': corBotao = ButtonStyle.Danger; break;
                    case 'azul': corBotao = ButtonStyle.Primary; break;
                    default: corBotao = ButtonStyle.Primary;
                }

                // Cria um ID único para o botão
                const inpLabel = `btn_${embDb.messageId}_${nomeBotao.replace(/\s+/g, '_')}`;

                if (!embDb.botoes) embDb.botoes = [];
                embDb.botoes.push({ label: nomeBotao, emoji: emojiBotao, style: corBotao, customId: inpLabel });
                await embDb.save();

                const menuOptBtn = new StringSelectMenuBuilder()
                    .setCustomId(`menuSelect_${inpLabel}`)
                    .setPlaceholder(`Menu para o botão ${nomeBotao}`)
                    .addOptions(
                        { label: 'Enviar uma mensagem', value: `sendMsg_${inpLabel}` },
                        { label: 'Mostrar outro embed', value: `sendEmb_${inpLabel}` },
                        { label: 'Adicionar em canal', value: `addInChn_${inpLabel}` },
                        { label: 'Remover de canal', value: `removeInChn_${inpLabel}` },
                        { label: 'Adicionar Cargo', value: `addRole_${inpLabel}` },
                        { label: 'Remover Cargo', value: `removeRole_${inpLabel}` }
                    );

                await subFor.reply({ content: `✅ Botão adicionado com sucesso! Vamos configurar a ação dele agora...`, components: [new ActionRowBuilder().addComponents(menuOptBtn)], ephemeral: true });

                
            }
        }
    });
}
module.exports = { handleEmbedEditInteraction };