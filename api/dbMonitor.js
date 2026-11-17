const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const mongoose = require('mongoose');
const dbModels = require('../mongoose.js');

const PAINEL_CHANNEL_ID = "1510784621904793740";
const MAX_STORAGE_MB = 512; // Cota padrão do MongoDB Atlas Free Tier (M0)
let isUpdating = false;

function generateProgressBar(current, max, length = 14) {
    const percentage = Math.min(Math.max((current / max) * 100, 0), 100);
    const filledChars = Math.round((percentage / 100) * length);
    const emptyChars = Math.max(0, length - filledChars);
    const filled = '█'.repeat(filledChars);
    const empty = '░'.repeat(emptyChars);
    return {
        bar: `[${filled}${empty}]`,
        percentage: percentage.toFixed(1)
    };
}

/**
 * Sanitiza campos sensíveis (senhas, tokens) antes de exibir o documento no Discord.
 */
function sanitizeDoc(doc) {
    if (!doc || typeof doc !== 'object') return doc;
    const clean = Array.isArray(doc) ? [...doc] : { ...doc };
    const sensitiveKeys = ['token', 'password', 'senha', 'secret', 'apikey', 'key', 'credentials'];

    for (const key of Object.keys(clean)) {
        if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
            clean[key] = '******** [OCULTO]';
        } else if (typeof clean[key] === 'object' && clean[key] !== null) {
            clean[key] = sanitizeDoc(clean[key]);
        }
    }
    return clean;
}

/**
 * Simplifica documentos grandes (textos longos, arrays extensos e Buffers) para exibição compacta.
 */
function cleanForPreview(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 3) return obj;
    if (obj._bsontype === 'ObjectID' || (obj.constructor && obj.constructor.name === 'ObjectId')) {
        return obj.toString();
    }
    if (obj.buffer && typeof obj.buffer === 'object') {
        try {
            return Buffer.from(Object.values(obj.buffer)).toString('hex');
        } catch {
            return '[Binary]';
        }
    }
    if (Array.isArray(obj)) {
        if (obj.length > 2) {
            const sliced = obj.slice(0, 2).map(item => cleanForPreview(item, depth + 1));
            sliced.push(`... (+${obj.length - 2} itens)`);
            return sliced;
        }
        return obj.map(item => cleanForPreview(item, depth + 1));
    }
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string' && v.length > 70) {
            res[k] = v.substring(0, 67) + '...';
        } else if (typeof v === 'object' && v !== null) {
            res[k] = cleanForPreview(v, depth + 1);
        } else {
            res[k] = v;
        }
    }
    return res;
}

/**
 * Formata um documento em JSON para exibição segura dentro de um campo de embed do Discord (limite rígido de 1024 caracteres).
 */
function formatJsonField(doc, maxLen = 920) {
    if (!doc) return '*Nenhum documento encontrado nesta coleção.*';
    const sanitized = sanitizeDoc(doc);
    const cleaned = cleanForPreview(sanitized);
    let str = JSON.stringify(cleaned, null, 2);
    if (str.length > maxLen) {
        str = str.substring(0, maxLen - 25) + '\n... [TRUNCADO]';
    }
    return `\`\`\`json\n${str}\n\`\`\``;
}

/**
 * Prepara o documento completo para exibição integral (sem truncar textos longos),
 * convertendo tipos BSON complexos (ObjectId, Buffer, Date) para representações legíveis.
 */
function prepareFullDoc(obj, seen = new WeakSet()) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (seen.has(obj)) return '[Circular]';
    seen.add(obj);

    if (obj._bsontype === 'ObjectID' || (obj.constructor && obj.constructor.name === 'ObjectId')) {
        return obj.toString();
    }
    if (obj instanceof Date) {
        return obj.toISOString();
    }
    if (Buffer.isBuffer(obj)) {
        return obj.toString('hex');
    }
    if (obj.buffer && typeof obj.buffer === 'object') {
        try {
            return Buffer.from(Object.values(obj.buffer)).toString('hex');
        } catch {
            return '[Binary]';
        }
    }
    if (Array.isArray(obj)) {
        return obj.map(item => prepareFullDoc(item, seen));
    }
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
        res[k] = prepareFullDoc(v, seen);
    }
    return res;
}

/**
 * Divide um texto em páginas seguras para exibição em Embeds do Discord,
 * respeitando quebras de linha e garantindo que cada página caiba confortavelmente dentro do limite.
 */
function paginateText(text, maxCharsPerPage = 1800) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return ['*Documento vazio ou sem conteúdo textual.*'];
    }
    if (text.length <= maxCharsPerPage) {
        return [text];
    }

    const lines = text.split('\n');
    const pages = [];
    let currentPage = '';

    for (const line of lines) {
        if (line.length > maxCharsPerPage) {
            if (currentPage.length > 0) {
                pages.push(currentPage);
                currentPage = '';
            }
            let remaining = line;
            while (remaining.length > maxCharsPerPage) {
                pages.push(remaining.substring(0, maxCharsPerPage));
                remaining = remaining.substring(maxCharsPerPage);
            }
            currentPage = remaining;
            continue;
        }

        const potential = currentPage.length === 0 ? line : `${currentPage}\n${line}`;
        if (potential.length > maxCharsPerPage) {
            pages.push(currentPage);
            currentPage = line;
        } else {
            currentPage = potential;
        }
    }

    if (currentPage.length > 0) {
        pages.push(currentPage);
    }

    return pages.length > 0 ? pages : [text];
}

/**
 * Coleta métricas completas do MongoDB (espaço, conexões, coleções e requisições).
 */
async function getDatabaseMetrics() {
    if (mongoose.connection.readyState !== 1) {
        return { connected: false, error: 'Banco de dados desconectado ou reconectando.' };
    }

    const db = mongoose.connection.db;
    const startPing = Date.now();
    await db.command({ ping: 1 }).catch(() => null);
    const pingMs = Date.now() - startPing;

    const stats = await db.stats().catch(() => ({}));
    const serverStatus = await db.command({ serverStatus: 1 }).catch(() => null);
    const rawCollections = await db.listCollections().toArray().catch(() => []);

    const collections = [];
    for (const collInfo of rawCollections) {
        try {
            const coll = db.collection(collInfo.name);
            const count = await coll.countDocuments().catch(() => 0);
            collections.push({
                name: collInfo.name,
                count
            });
        } catch {
            collections.push({ name: collInfo.name, count: 0 });
        }
    }

    // Ordena as coleções com mais documentos primeiro
    collections.sort((a, b) => b.count - a.count);

    const dataSizeMB = stats.dataSize ? stats.dataSize / (1024 * 1024) : 0;
    const storageSizeMB = stats.storageSize ? stats.storageSize / (1024 * 1024) : 0;
    const indexSizeMB = stats.indexSize ? stats.indexSize / (1024 * 1024) : 0;
    const totalSizeMB = storageSizeMB + indexSizeMB;

    return {
        connected: true,
        dbName: stats.db || 'Desconhecido',
        pingMs,
        collectionsCount: rawCollections.length,
        totalDocuments: stats.objects || 0,
        dataSizeMB: dataSizeMB.toFixed(2),
        storageSizeMB: storageSizeMB.toFixed(2),
        indexSizeMB: indexSizeMB.toFixed(2),
        totalSizeMB: totalSizeMB.toFixed(2),
        storageUsedMB: storageSizeMB,
        collections,
        opcounters: serverStatus ? serverStatus.opcounters : null,
        connections: serverStatus && serverStatus.connections ? serverStatus.connections.current : null
    };
}

/**
 * Garante que a mensagem do painel existe no canal e sincroniza seu conteúdo.
 */
async function ensureDbPanelExists(client) {
    try {
        const channel = await client.channels.fetch(PAINEL_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        let panelConfig = null;
        if (dbModels.PanelConfig) {
            panelConfig = await dbModels.PanelConfig.findById('db_panel').catch(() => null);
        }

        let targetMessage = null;
        if (panelConfig && panelConfig.messageId) {
            targetMessage = await channel.messages.fetch(panelConfig.messageId).catch(() => null);
        }

        if (!targetMessage) {
            const recentMessages = await channel.messages.fetch({ limit: 15 }).catch(() => new Map());
            const duplicates = [];

            for (const msg of recentMessages.values()) {
                if (msg.author.id === client.user.id && msg.embeds.length > 0) {
                    const title = msg.embeds[0].title || '';
                    if (title.includes('Monitor do Banco de Dados')) {
                        if (!targetMessage) {
                            targetMessage = msg;
                        } else {
                            duplicates.push(msg);
                        }
                    }
                }
            }

            for (const dup of duplicates) {
                await dup.delete().catch(() => {});
            }
        }

        if (!targetMessage) {
            const initEmbed = new EmbedBuilder()
                .setTitle('⏳ Inicializando Monitor do Banco de Dados...')
                .setColor('#2b2d31');
            targetMessage = await channel.send({ embeds: [initEmbed] });

            if (dbModels.PanelConfig) {
                await dbModels.PanelConfig.findOneAndUpdate(
                    { _id: 'db_panel' },
                    { channelId: channel.id, messageId: targetMessage.id, updatedAt: new Date() },
                    { upsert: true }
                ).catch(() => {});
            }
        }

        await updateDbPanel(client);
    } catch (err) {
        console.error('[DB MONITOR] Erro fatal em ensureDbPanelExists:', err);
    }
}

/**
 * Atualiza o painel do banco de dados na mensagem persistente.
 */
async function updateDbPanel(client) {
    if (isUpdating) return;
    isUpdating = true;

    try {
        const channel = await client.channels.fetch(PAINEL_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        let panelConfig = null;
        if (dbModels.PanelConfig) {
            panelConfig = await dbModels.PanelConfig.findById('db_panel').catch(() => null);
        }

        if (!panelConfig || !panelConfig.messageId) return;
        const message = await channel.messages.fetch(panelConfig.messageId).catch(() => null);
        if (!message) return;

        const metrics = await getDatabaseMetrics();

        if (!metrics.connected) {
            const errEmbed = new EmbedBuilder()
                .setTitle('🗄️ Monitor do Banco de Dados (MongoDB)')
                .setColor('#e74c3c')
                .setDescription(`❌ **Falha de Conexão:** ${metrics.error}`)
                .setTimestamp();
            await message.edit({ embeds: [errEmbed], components: [] });
            return;
        }

        const prog = generateProgressBar(metrics.storageUsedMB, MAX_STORAGE_MB, 14);

        let opText = '*Estatísticas de requisições não disponíveis.*';
        if (metrics.opcounters) {
            const { query = 0, insert = 0, update = 0, delete: del = 0, command = 0 } = metrics.opcounters;
            opText = `🔍 **Queries:** \`${query.toLocaleString()}\`  •  📥 **Inserts:** \`${insert.toLocaleString()}\`\n` +
                     `✏️ **Updates:** \`${update.toLocaleString()}\`  •  🗑️ **Deletes:** \`${del.toLocaleString()}\`  •  ⚙️ **Comandos:** \`${command.toLocaleString()}\``;
        }

        const topCollectionsText = metrics.collections
            .slice(0, 8)
            .map(c => `• **${c.name}**: \`${c.count.toLocaleString()}\` docs`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🗄️ Monitor do Banco de Dados (MongoDB)')
            .setColor('#16a085')
            .setDescription(
                'Acompanhe em tempo real o uso de espaço, requisições e a estrutura das coleções de dados do Galatic Bot.\n' +
                'Utilize o menu abaixo para navegar e inspecionar documentos de qualquer coleção.'
            )
            .addFields(
                {
                    name: '📡 Status da Conexão',
                    value: `🟢 **Conectado**  •  Latência: **${metrics.pingMs}ms**  •  Database: \`${metrics.dbName}\``,
                    inline: false
                },
                {
                    name: '💾 Armazenamento & Cota (MongoDB Atlas)',
                    value: `\`\`\`${prog.bar} ${metrics.storageSizeMB} MB / ${MAX_STORAGE_MB} MB (${prog.percentage}%)\`\`\`\n` +
                           `📦 **Dados (Conteúdo):** \`${metrics.dataSizeMB} MB\`\n` +
                           `🗂️ **Índices de Busca:** \`${metrics.indexSizeMB} MB\`\n` +
                           `📊 **Alocação Total em Disco:** \`${metrics.totalSizeMB} MB\``,
                    inline: false
                },
                {
                    name: '⚡ Operações & Requisições Registradas',
                    value: opText,
                    inline: false
                },
                {
                    name: `📁 Coleções Ativas (${metrics.collectionsCount} coleções, ${metrics.totalDocuments.toLocaleString()} docs)`,
                    value: topCollectionsText || '*Nenhuma coleção encontrada.*',
                    inline: false
                }
            )
            .setFooter({ text: 'Galatic Bot • Painel de Monitoramento da Database' })
            .setTimestamp();

        const rows = [];
        if (metrics.collections.length > 0) {
            const options = metrics.collections.slice(0, 25).map(c => ({
                label: c.name.length > 25 ? c.name.substring(0, 25) : c.name,
                description: `${c.count.toLocaleString()} documento(s) cadastrado(s)`.substring(0, 50),
                value: c.name
            }));

            rows.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('db_select_collection')
                    .setPlaceholder('📂 Selecione uma coleção para inspecionar documentos')
                    .addOptions(options)
            ));

            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('db_refresh_panel')
                    .setLabel('Atualizar Dados')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            ));
        }

        await message.edit({ embeds: [embed], components: rows });
    } catch (err) {
        console.error('[DB MONITOR] Erro ao atualizar painel do banco:', err);
    } finally {
        isUpdating = false;
    }
}

/**
 * Renderiza a visão geral de uma coleção com métricas estruturais e amostra formatada.
 */
async function renderCollectionOverview(interaction, collName) {
    const db = mongoose.connection.db;
    if (!db) {
        return interaction.editReply({ content: '❌ Conexão com o banco de dados indisponível no momento.', embeds: [], components: [] });
    }

    const coll = db.collection(collName);
    const count = await coll.countDocuments().catch(() => 0);
    const sampleDoc = await coll.findOne({}, { sort: { _id: -1 } }).catch(() => null)
        || await coll.findOne({}, { sort: { $natural: -1 } }).catch(() => null);
    const indexes = await coll.indexes().catch(() => []);

    let indexNames = indexes.map(idx => `\`${idx.name}\``).join(', ') || 'Nenhum';
    if (indexNames.length > 900) {
        indexNames = indexNames.substring(0, 890) + '... [TRUNCADO]';
    }

    const sampleJsonField = formatJsonField(sampleDoc, 900);

    const embedColl = new EmbedBuilder()
        .setTitle(`📂 Coleção: \`${collName}\``)
        .setColor('#3498db')
        .setDescription(`Detalhes estruturais e amostra do registro mais recente no MongoDB.`)
        .addFields(
            { name: '📄 Total de Documentos', value: `\`${count.toLocaleString()}\``, inline: true },
            { name: '🔍 Índices Criados', value: indexNames, inline: true },
            { name: '📋 Amostra do Último Documento Cadastrado', value: sampleJsonField, inline: false }
        )
        .setFooter({ text: 'Galatic Bot • Inspeção de Coleção (Visível apenas para você)' })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`db_page_${collName}_0_0`)
            .setLabel('Ver Mais (Texto Completo)')
            .setStyle(ButtonStyle.Success)
            .setEmoji('📖')
            .setDisabled(!sampleDoc || count === 0),
        new ButtonBuilder()
            .setCustomId(`db_sample_refresh_${collName}`)
            .setLabel('Recarregar Amostra')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄')
    );

    return interaction.editReply({ embeds: [embedColl], components: [row] });
}

/**
 * Renderiza uma página de visualização completa do documento com suporte a paginação de texto e navegação entre registros.
 */
async function renderDocumentPage(interaction, collName, docOffset = 0, page = 0) {
    const db = mongoose.connection.db;
    if (!db) {
        return interaction.editReply({ content: '❌ Conexão com o banco de dados indisponível no momento.', embeds: [], components: [] });
    }

    const coll = db.collection(collName);
    const count = await coll.countDocuments().catch(() => 0);
    if (count === 0) {
        return interaction.editReply({ content: `⚠️ A coleção \`${collName}\` está vazia.`, embeds: [], components: [] });
    }

    const safeDocOffset = Math.max(0, Math.min(docOffset, count - 1));

    let docs = await coll.find({}).sort({ _id: -1 }).skip(safeDocOffset).limit(1).toArray().catch(() => []);
    if (!docs || docs.length === 0) {
        docs = await coll.find({}).sort({ $natural: -1 }).skip(safeDocOffset).limit(1).toArray().catch(() => []);
    }
    const doc = docs[0] || null;

    if (!doc) {
        return interaction.editReply({ content: `⚠️ Não foi possível obter o documento #${safeDocOffset + 1} da coleção \`${collName}\`.`, embeds: [], components: [] });
    }

    const sanitized = sanitizeDoc(doc);
    const prepared = prepareFullDoc(sanitized);

    let fullJson = JSON.stringify(prepared, null, 2);
    // Substitui sequências literais \n por quebras de linha reais para leitura fluida de histórias e textos
    fullJson = fullJson.replace(/\\n/g, '\n');

    const totalChars = fullJson.length;
    const totalLines = fullJson.split('\n').length;

    const pages = paginateText(fullJson, 1800);
    const totalPages = pages.length;
    const safePage = Math.max(0, Math.min(page, totalPages - 1));

    // Previne que blocos de código triplos dentro do texto quebrem a formatação do Discord
    const safePageContent = pages[safePage].replace(/```/g, '`\u200B`\u200B`');

    const embed = new EmbedBuilder()
        .setTitle(`📖 Amostra Completa: \`${collName}\``)
        .setColor('#2ecc71')
        .setDescription(`\`\`\`json\n${safePageContent}\n\`\`\``)
        .addFields({
            name: '📑 Detalhes da Leitura',
            value: `📄 **Documento:** \`${safeDocOffset + 1}\` de \`${count.toLocaleString()}\`  •  🔢 **Página:** \`${safePage + 1}\` de \`${totalPages}\`\n` +
                   `📏 **Tamanho Total:** \`${totalChars.toLocaleString()}\` caracteres (${totalLines.toLocaleString()} linhas)`,
            inline: false
        })
        .setFooter({ text: `Galatic Bot • Documento ${safeDocOffset + 1}/${count} • Página ${safePage + 1}/${totalPages}` })
        .setTimestamp();

    const components = [];

    // Linha 1: Paginação do Texto do Documento
    const pageNavRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`db_page_${collName}_${safeDocOffset}_0`)
            .setLabel('⏮')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage === 0),
        new ButtonBuilder()
            .setCustomId(`db_page_${collName}_${safeDocOffset}_${safePage - 1}`)
            .setLabel('◀ Anterior')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(safePage === 0),
        new ButtonBuilder()
            .setCustomId(`db_page_${collName}_${safeDocOffset}_${safePage + 1}`)
            .setLabel('Próxima ▶')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(safePage >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId(`db_page_${collName}_${safeDocOffset}_${totalPages - 1}`)
            .setLabel('⏭')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(safePage >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId(`db_sample_refresh_${collName}`)
            .setLabel('🔙 Voltar')
            .setStyle(ButtonStyle.Danger)
    );
    components.push(pageNavRow);

    // Linha 2: Navegação entre Documentos da Coleção
    if (count > 1) {
        const docNavRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`db_doc_${collName}_${safeDocOffset + 1}_0`)
                .setLabel('⬅️ Mais Antigo')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safeDocOffset >= count - 1),
            new ButtonBuilder()
                .setCustomId(`db_doc_noop_${safeDocOffset}`)
                .setLabel(`Doc ${safeDocOffset + 1} de ${count}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`db_doc_${collName}_${safeDocOffset - 1}_0`)
                .setLabel('Mais Recente ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(safeDocOffset <= 0)
        );
        components.push(docNavRow);
    }

    return interaction.editReply({ embeds: [embed], components });
}

/**
 * Trata interações geradas pelo painel do banco de dados (select menus e botões).
 */
async function handleDbInteraction(interaction) {
    const customId = interaction.customId;

    if (customId === 'db_refresh_panel') {
        await interaction.deferReply({ ephemeral: true });
        await updateDbPanel(interaction.client);
        return interaction.editReply({ content: '✅ Painel do Banco de Dados sincronizado com sucesso!' });
    }

    if (customId === 'db_select_collection' || customId.startsWith('db_sample_refresh_')) {
        if (interaction.isButton()) {
            await interaction.deferUpdate().catch(() => {});
        } else {
            await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }

        const collName = customId === 'db_select_collection'
            ? interaction.values[0]
            : customId.replace('db_sample_refresh_', '');

        return renderCollectionOverview(interaction, collName);
    }

    if (customId.startsWith('db_page_') || customId.startsWith('db_doc_')) {
        if (interaction.isButton()) {
            await interaction.deferUpdate().catch(() => {});
        } else {
            await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }

        const rest = customId.replace(/^db_(page|doc)_/, '');
        const lastUnderscore = rest.lastIndexOf('_');
        const page = parseInt(rest.substring(lastUnderscore + 1), 10) || 0;
        const beforeLast = rest.substring(0, lastUnderscore);
        const secondLastUnderscore = beforeLast.lastIndexOf('_');
        const docOffset = parseInt(beforeLast.substring(secondLastUnderscore + 1), 10) || 0;
        const collName = beforeLast.substring(0, secondLastUnderscore);

        return renderDocumentPage(interaction, collName, docOffset, page);
    }

    if (customId.startsWith('db_doc_noop')) {
        return;
    }
}

module.exports = {
    ensureDbPanelExists,
    updateDbPanel,
    handleDbInteraction,
    getDatabaseMetrics,
    formatJsonField,
    cleanForPreview,
    prepareFullDoc,
    paginateText,
    renderCollectionOverview,
    renderDocumentPage
};
