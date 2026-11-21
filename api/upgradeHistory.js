const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const moment = require('moment');
moment.locale('pt-br');

function chunkText(text, maxLen = 950) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    if (raw.length <= maxLen) return [raw];
    const chunks = [];
    let rem = raw;
    while (rem.length > 0) {
        if (rem.length <= maxLen) {
            chunks.push(rem.trim());
            break;
        }
        let cut = rem.lastIndexOf('\n\n', maxLen);
        if (cut === -1 || cut < maxLen * 0.3) cut = rem.lastIndexOf('\n', maxLen);
        if (cut === -1 || cut < maxLen * 0.3) cut = rem.lastIndexOf('. ', maxLen);
        if (cut === -1 || cut < maxLen * 0.3) cut = rem.lastIndexOf(' ', maxLen);
        if (cut === -1 || cut < 1) cut = maxLen;
        else cut += 1;
        chunks.push(rem.substring(0, cut).trim());
        rem = rem.substring(cut).trim();
    }
    return chunks.length ? chunks : [raw];
}

function buildUpgradePages(upg, maxChunk = 950) {
    const descChunks = chunkText(upg.descricao || 'Sem descrição', maxChunk);
    const resumoChunks = chunkText(upg.resumo || 'Sem justificativa.', maxChunk);
    const totalPages = Math.max(1, descChunks.length, resumoChunks.length);
    const pages = [];
    for (let i = 0; i < totalPages; i++) {
        pages.push({
            pageIndex: i,
            totalPages,
            descricao: descChunks[i] || (i === 0 ? 'Sem descrição' : '*(Continuação da descrição na página anterior)*'),
            resumo: resumoChunks[i] || (i === 0 ? 'Sem justificativa.' : '*(Continuação da justificativa na página anterior)*'),
            descPart: descChunks.length > 1 ? ` (Parte ${i + 1}/${descChunks.length})` : '',
            resumoPart: resumoChunks.length > 1 ? ` (Parte ${i + 1}/${resumoChunks.length})` : ''
        });
    }
    return pages;
}

/**
 * Renderiza a interface efêmera do histórico de upgrades do jogador.
 */
async function renderUpgradeHistory(interaction, client, { filter = 'all', docIndex = 0, upgIndex = 0, subPageIndex = 0, isUpdate = false } = {}) {
    const userId = interaction.user.id;

    if (!client.database || !client.database.UpgradeModel) {
        const payload = { content: '❌ Conexão com o banco de dados indisponível no momento.', embeds: [], components: [], flags: 64 };
        if (isUpdate && interaction.isButton()) return interaction.update(payload);
        return interaction.reply(payload);
    }

    // Busca todos os treinos do usuário ordenados do mais recente para o mais antigo
    const allDocs = await client.database.UpgradeModel.find({ userId }).sort({ createdAt: -1 }).lean().catch(() => []);

    const totalCount = allDocs.length;
    const pendentesDocs = allDocs.filter(d => d.status === 'pendente');
    const pontuadosDocs = allDocs.filter(d => d.status !== 'pendente');

    const pendentesCount = pendentesDocs.length;
    const pontuadosCount = pontuadosDocs.length;

    let filteredDocs = allDocs;
    if (filter === 'pendente') filteredDocs = pendentesDocs;
    if (filter === 'pontuado') filteredDocs = pontuadosDocs;

    const safeDocIndex = Math.max(0, Math.min(docIndex, Math.max(0, filteredDocs.length - 1)));

    // Caso não haja treinos para o filtro selecionado
    if (filteredDocs.length === 0) {
        let emptyDesc = 'Você ainda não possui nenhum treino ou upgrade registrado no sistema.';
        if (filter === 'pendente') {
            emptyDesc = 'Você não possui nenhum treino **pendente** na fila no momento!\nTodos os seus treinos já foram avaliados pela staff.';
        } else if (filter === 'pontuado') {
            emptyDesc = 'Você ainda não possui nenhum treino **pontuado/avaliado**.\nSeus treinos enviados ainda estão aguardando avaliação.';
        }

        const emptyEmbed = new EmbedBuilder()
            .setTitle('<a:rahhh:1502049620640006257> | MEU HISTÓRICO DE UPGRADES')
            .setColor('#2b2d31')
            .setDescription(emptyDesc)
            .addFields(
                { name: '📊 Resumo Geral', value: `⏳ **Pendentes:** \`${pendentesCount}\`  •  ✅ **Pontuados:** \`${pontuadosCount}\`  •  📋 **Total:** \`${totalCount}\`` }
            )
            .setFooter({ text: 'Central de Upgrades • Histórico Pessoal (Visível apenas para você)' });

        const filterRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('upgrade_hist_filter_pendente')
                .setLabel(`⏳ Pendentes (${pendentesCount})`)
                .setStyle(filter === 'pendente' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('upgrade_hist_filter_pontuado')
                .setLabel(`✅ Pontuados (${pontuadosCount})`)
                .setStyle(filter === 'pontuado' ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('upgrade_hist_filter_all')
                .setLabel(`📋 Todos (${totalCount})`)
                .setStyle(filter === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('upgrade_hist_close')
                .setLabel('Fechar')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        );

        const payload = { embeds: [emptyEmbed], components: [filterRow], flags: 64 };
        if (isUpdate) return interaction.update(payload);
        return interaction.reply(payload);
    }

    const currentDoc = filteredDocs[safeDocIndex];
    const totalUpgs = currentDoc.upgrades && currentDoc.upgrades.length > 0 ? currentDoc.upgrades.length : 1;
    const safeUpgIndex = Math.max(0, Math.min(upgIndex, totalUpgs - 1));

    const currentUpg = currentDoc.upgrades && currentDoc.upgrades[safeUpgIndex] ? currentDoc.upgrades[safeUpgIndex] : {
        nome: 'Sem nome',
        tipo: 'Não informado',
        categoria: 'Não informada',
        status: currentDoc.status,
        descricao: 'Sem descrição informada.',
        resumo: 'Sem justificativa informada.'
    };

    const createdAtDate = currentDoc.createdAt ? new Date(currentDoc.createdAt) : new Date();
    const timestampEnvio = Math.floor(createdAtDate.getTime() / 1000);

    const isDocPendente = currentDoc.status === 'pendente';
    const upgStatus = currentUpg.status || currentDoc.status || 'pendente';

    let badgeStatus = '⏳ **Aguardando Avaliação**';
    let embedColor = '#f39c12'; // Amarelo/Laranja para pendente

    if (upgStatus === 'aprovado') {
        badgeStatus = '🟢 **Aprovado**';
        embedColor = '#2ecc71';
    } else if (upgStatus === 'recusado') {
        badgeStatus = '🔴 **Recusado**';
        embedColor = '#e74c3c';
    } else if (!isDocPendente) {
        badgeStatus = '✅ **Avaliado**';
        embedColor = '#3498db';
    }

    const docStatusLabel = isDocPendente
        ? '⏳ `#pendente` (Na Fila de Avaliação)'
        : `✅ \`#avaliado\`${currentDoc.AdmodAvaliou ? ` por <@${currentDoc.AdmodAvaliou}>` : ''}`;

    const pages = buildUpgradePages(currentUpg, 900);
    const safeSubPage = Math.min(Math.max(0, subPageIndex), pages.length - 1);
    const currentPage = pages[safeSubPage];
    const pageIndication = pages.length > 1 ? ` • Pág. ${safeSubPage + 1}/${pages.length}` : '';

    const embed = new EmbedBuilder()
        .setTitle(`<a:rahhh:1502049620640006257> | Histórico: ${currentDoc.personagem || 'Personagem'}`)
        .setColor(embedColor)
        .setDescription(
            `📑 **Treino:** \`${safeDocIndex + 1}\` de \`${filteredDocs.length}\`  •  **Enviado em:** <t:${timestampEnvio}:f> (<t:${timestampEnvio}:R>)\n` +
            `**Status Geral do Treino:** ${docStatusLabel}\n` +
            `**Upgrade Atual:** \`${safeUpgIndex + 1}\` de \`${totalUpgs}\`${pageIndication}  •  **Status:** ${badgeStatus}\n`
        )
        .addFields(
            {
                name: '🏷️ Nome do Upgrade',
                value: `**${currentUpg.nome || 'Não informado'}**`,
                inline: true
            },
            {
                name: '📁 Tipo & Categoria',
                value: `${currentUpg.tipo || 'Desconhecido'} | ${currentUpg.categoria || 'Desconhecida'}`,
                inline: true
            },
            {
                name: `📜 Descrição da Habilidade / Atributo${currentPage.descPart}`,
                value: currentPage.descricao || 'Sem descrição.',
                inline: false
            },
            {
                name: `📖 Justificativa / Resumo Narrativo${currentPage.resumoPart}`,
                value: currentPage.resumo || 'Sem justificativa.',
                inline: false
            }
        )
        .setFooter({
            text: `Central de Upgrades • Treino ${safeDocIndex + 1}/${filteredDocs.length} • Upgrade ${safeUpgIndex + 1}/${totalUpgs} (Visível apenas para você)`
        })
        .setTimestamp(createdAtDate);

    if (currentUpg.motivo) {
        const isRecusado = upgStatus === 'recusado';
        embed.addFields({
            name: isRecusado ? '❌ Motivo da Recusa' : '💬 Parecer / Feedback do Avaliador',
            value: String(currentUpg.motivo).substring(0, 1000),
            inline: false
        });
    }

    const components = [];

    // Linha 1: Abas de Filtro
    const filterRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('upgrade_hist_filter_pendente')
            .setLabel(`⏳ Pendentes (${pendentesCount})`)
            .setStyle(filter === 'pendente' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('upgrade_hist_filter_pontuado')
            .setLabel(`✅ Pontuados (${pontuadosCount})`)
            .setStyle(filter === 'pontuado' ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('upgrade_hist_filter_all')
            .setLabel(`📋 Todos (${totalCount})`)
            .setStyle(filter === 'all' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
    components.push(filterRow);

    // Linha de Sub-página (se o upgrade atual tiver texto longo e páginas > 1)
    if (pages.length > 1) {
        const subPageRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`upgrade_hist_subpage_${filter}_${safeDocIndex}_${safeUpgIndex}_${safeSubPage - 1}`)
                .setLabel('📄 Pág. Ant.')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safeSubPage === 0),
            new ButtonBuilder()
                .setCustomId('upgrade_hist_subpage_noop')
                .setLabel(`Pág. ${safeSubPage + 1} de ${pages.length}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`upgrade_hist_subpage_${filter}_${safeDocIndex}_${safeUpgIndex}_${safeSubPage + 1}`)
                .setLabel('Próx. Pág. 📄')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safeSubPage >= pages.length - 1)
        );
        components.push(subPageRow);
    }

    // Linha de Navegação de Upgrades deste Treino (se houver mais de 1 upgrade)
    if (totalUpgs > 1) {
        const upgNavRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`upgrade_hist_upg_${filter}_${safeDocIndex}_${safeUpgIndex - 1}`)
                .setLabel('◀ Upgrade Anterior')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(safeUpgIndex === 0),
            new ButtonBuilder()
                .setCustomId('upgrade_hist_upg_noop')
                .setLabel(`Upgrade ${safeUpgIndex + 1} de ${totalUpgs}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`upgrade_hist_upg_${filter}_${safeDocIndex}_${safeUpgIndex + 1}`)
                .setLabel('Próximo Upgrade ▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(safeUpgIndex >= totalUpgs - 1)
        );
        components.push(upgNavRow);
    }

    // Linha de Navegação entre Treinos (se houver mais de 1 treino no filtro atual)
    if (filteredDocs.length > 1) {
        const docNavRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`upgrade_hist_doc_${filter}_${safeDocIndex - 1}_0`)
                .setLabel('⏮ Treino Mais Recente')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safeDocIndex <= 0),
            new ButtonBuilder()
                .setCustomId('upgrade_hist_doc_noop')
                .setLabel(`Treino ${safeDocIndex + 1} de ${filteredDocs.length}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`upgrade_hist_doc_${filter}_${safeDocIndex + 1}_0`)
                .setLabel('Treino Mais Antigo ⏭')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safeDocIndex >= filteredDocs.length - 1)
        );
        components.push(docNavRow);
    }

    // Select Menu rápido para pular direto para qualquer treino (apenas se houver espaço < 5 componentes)
    if (filteredDocs.length > 1 && components.length < 4) {
        const selectOptions = filteredDocs.slice(0, 25).map((doc, idx) => {
            const dt = doc.createdAt ? moment(doc.createdAt).format('DD/MM/YYYY') : 'Data desc.';
            const isPend = doc.status === 'pendente';
            const countUpgs = doc.upgrades ? doc.upgrades.length : 0;
            const pers = doc.personagem || 'Personagem';
            return {
                label: `${idx + 1}. ${pers}`.substring(0, 25),
                description: `${isPend ? '⏳ Pendente' : '✅ Avaliado'} • ${dt} • ${countUpgs} upgrade(s)`.substring(0, 50),
                value: `${idx}`,
                default: idx === safeDocIndex
            };
        });

        const selectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`upgrade_hist_select_${filter}`)
                .setPlaceholder('📂 Pular direto para outro treino do histórico')
                .addOptions(selectOptions)
        );
        components.push(selectRow);
    }

    // Linha Final: Botão Fechar (se couber nas 5 linhas de ActionRow)
    if (components.length < 5) {
        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('upgrade_hist_close')
                .setLabel('Fechar Histórico')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        );
        components.push(closeRow);
    }

    const payload = { embeds: [embed], components, flags: 64 };
    if (isUpdate) return interaction.update(payload);
    return interaction.reply(payload);
}

/**
 * Trata interações geradas pelos botões e menus do histórico de upgrades.
 */
async function handleUpgradeHistoryInteraction(interaction, client) {
    const customId = interaction.customId;

    if (customId === 'upgrade_hist_close') {
        return interaction.update({ content: '✅ Histórico de upgrades fechado.', embeds: [], components: [] }).catch(() => {});
    }

    if (customId === 'upgrade_hist_upg_noop' || customId === 'upgrade_hist_doc_noop' || customId === 'upgrade_hist_subpage_noop') {
        return;
    }

    // Navegação de sub-página de upgrade longo
    if (customId.startsWith('upgrade_hist_subpage_')) {
        const parts = customId.replace('upgrade_hist_subpage_', '').split('_');
        const filter = parts[0] || 'all';
        const docIndex = parseInt(parts[1], 10) || 0;
        const upgIndex = parseInt(parts[2], 10) || 0;
        const subPageIndex = parseInt(parts[3], 10) || 0;
        return renderUpgradeHistory(interaction, client, { filter, docIndex, upgIndex, subPageIndex, isUpdate: true });
    }

    // Abertura a partir do botão no comando /upgrade
    if (customId.startsWith('upgrade_hist_open_')) {
        const filter = customId.replace('upgrade_hist_open_', '') || 'all';
        return renderUpgradeHistory(interaction, client, { filter, docIndex: 0, upgIndex: 0, isUpdate: false });
    }

    // Alternância de abas de filtro
    if (customId.startsWith('upgrade_hist_filter_')) {
        const filter = customId.replace('upgrade_hist_filter_', '');
        return renderUpgradeHistory(interaction, client, { filter, docIndex: 0, upgIndex: 0, isUpdate: true });
    }

    // Navegação entre upgrades do treino
    if (customId.startsWith('upgrade_hist_upg_')) {
        const parts = customId.replace('upgrade_hist_upg_', '').split('_');
        const filter = parts[0] || 'all';
        const docIndex = parseInt(parts[1], 10) || 0;
        const upgIndex = parseInt(parts[2], 10) || 0;
        return renderUpgradeHistory(interaction, client, { filter, docIndex, upgIndex, isUpdate: true });
    }

    // Navegação entre treinos
    if (customId.startsWith('upgrade_hist_doc_')) {
        const parts = customId.replace('upgrade_hist_doc_', '').split('_');
        const filter = parts[0] || 'all';
        const docIndex = parseInt(parts[1], 10) || 0;
        const upgIndex = parseInt(parts[2], 10) || 0;
        return renderUpgradeHistory(interaction, client, { filter, docIndex, upgIndex, isUpdate: true });
    }

    // Seleção direta no dropdown
    if (customId.startsWith('upgrade_hist_select_')) {
        const filter = customId.replace('upgrade_hist_select_', '') || 'all';
        const docIndex = parseInt(interaction.values[0], 10) || 0;
        return renderUpgradeHistory(interaction, client, { filter, docIndex, upgIndex: 0, isUpdate: true });
    }
}

module.exports = {
    renderUpgradeHistory,
    handleUpgradeHistoryInteraction
};
