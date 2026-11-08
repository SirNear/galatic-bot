const PDFDocument = require('pdfkit');

/**
 * Limpa marcações de markdown e emojis customizados do Discord para exibição limpa no PDF.
 */
function cleanDiscordText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        // Emojis customizados do Discord <:nome:123456> -> :nome:
        .replace(/<a?:([a-zA-Z0-9_]+):\d+>/g, ':$1:')
        // Menções de canais <#123456>
        .replace(/<#\d+>/g, '#canal')
        // Menções de usuários <@!123456>
        .replace(/<@!?\d+>/g, '@usuario')
        // Menções de cargos <@&123456>
        .replace(/<@&\d+>/g, '@cargo')
        // Negrito e itálico combinados ***texto*** -> texto
        .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
        // Negrito **texto** -> texto
        .replace(/\*\*(.+?)\*\*/g, '$1')
        // Itálico *texto* ou _texto_ -> texto
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/(^|\s)_(.+?)_(\s|$)/g, '$1$2$3')
        // Sublinhado __texto__ -> texto
        .replace(/__(.+?)__/g, '$1')
        // Riscado ~~texto~~ -> texto
        .replace(/~~(.+?)~~/g, '$1')
        // Bloco de código ```texto``` -> texto
        .replace(/```[a-zA-Z]*\n?([\s\S]*?)```/g, '$1')
        // Código inline `texto` -> texto
        .replace(/`([^`]+)`/g, '$1');
}

/**
 * Converte o array de linhas do fileText em itens estruturados (mensagens, lores, texto).
 */
function parseFileTextLines(fileTextLines) {
    const flatLines = [];
    for (const entry of (fileTextLines || [])) {
        if (typeof entry === 'string') {
            const parts = entry.split('\n');
            for (const p of parts) flatLines.push(p);
        }
    }

    const items = [];
    let i = 0;

    while (i < flatLines.length) {
        const line = flatLines[i];
        const trimmed = line.trim();

        // Cabeçalho e legendas do arquivo TXT - ignorar
        if (
            (trimmed.startsWith('===') && (trimmed.includes('ARQUIVO') || trimmed.includes('CONTEÚDO') || trimmed.length > 30) && !trimmed.includes('[LORE:')) ||
            trimmed.startsWith('---') ||
            trimmed.startsWith('ARQUIVO DE REGISTRO') ||
            trimmed.startsWith('LEGENDA') ||
            trimmed.startsWith('INFORMAÇÕES') ||
            trimmed.startsWith('CONTEÚDO') ||
            trimmed.startsWith('- Categoria:') ||
            trimmed.startsWith('- Fórum/Canal:') ||
            trimmed.startsWith('- Título da Postagem:') ||
            trimmed.startsWith('- Intervalo de Mensagens:') ||
            trimmed.startsWith('- Filtro de Usuário:') ||
            trimmed.startsWith('- Total de Mensagens:') ||
            trimmed.startsWith('- Data de Geração:') ||
            trimmed.startsWith('- Modo:') ||
            trimmed === ''
        ) {
            i++;
            continue;
        }

        // Início de Lore
        if (trimmed.includes('[LORE:') && trimmed.includes('===')) {
            const loreTitle = trimmed.replace(/=+/g, '').replace('[LORE:', '').replace(']', '').trim();
            items.push({ type: 'lore_start', title: loreTitle });
            i++;
            continue;
        }

        // Fim de Lore
        if (trimmed.includes('[FIM DA LORE]')) {
            items.push({ type: 'lore_end' });
            i++;
            continue;
        }

        // Metadados da Lore
        if (trimmed.startsWith('Canal:') && trimmed.includes('Autor:') && trimmed.includes('Data:')) {
            items.push({ type: 'lore_meta', text: trimmed });
            i++;
            continue;
        }

        // Capítulo da Lore
        if (trimmed.startsWith('>> CAPÍTULO:')) {
            const chapName = trimmed.replace('>> CAPÍTULO:', '').trim();
            items.push({ type: 'lore_chapter', title: chapName });
            i++;
            continue;
        }

        // Mensagem normal: [data] [canal] autor:
        const msgMatch = trimmed.match(/^\[(.+?)\]\s*\[(.+?)\]\s*(.+):$/);
        if (msgMatch) {
            const [, time, channel, author] = msgMatch;
            i++;
            const contentLines = [];
            while (i < flatLines.length) {
                const nextLine = flatLines[i];
                const nextTrimmed = nextLine.trim();
                if (
                    nextTrimmed.startsWith('------------------------------------------------------------') ||
                    nextTrimmed.match(/^\[(.+?)\]\s*\[(.+?)\]\s*(.+):$/) ||
                    (nextTrimmed.includes('[LORE:') && nextTrimmed.includes('==='))
                ) {
                    if (nextTrimmed.startsWith('---')) i++;
                    break;
                }
                contentLines.push(nextLine);
                i++;
            }

            items.push({
                type: 'message',
                time: time.trim(),
                channel: channel.trim(),
                author: author.trim(),
                content: contentLines.join('\n').trim(),
            });
            continue;
        }

        // Texto livre (páginas de lore, descrições)
        if (trimmed.length > 0) {
            items.push({ type: 'text', text: trimmed });
        }
        i++;
    }

    return items;
}

/**
 * Garante que há espaço suficiente na página para um bloco de altura `neededHeight`.
 * Se não houver, adiciona uma nova página.
 */
function ensureSpace(doc, neededHeight) {
    if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
    }
}

/**
 * Gera um Buffer de PDF pesquisável e leve a partir dos dados de RP utilizando PDFKit.
 * Não requer Chromium, Puppeteer ou bibliotecas nativas do sistema operacional (como libglib).
 *
 * @param {Object} params
 * @param {string} params.titulo - Título do documento
 * @param {string} params.categoria - Nome da categoria
 * @param {string} params.canal - Nome do canal/fórum
 * @param {string} params.postTitle - Título do tópico
 * @param {string} params.mensagensRange - Intervalo de mensagens
 * @param {string} params.modo - Modo de geração
 * @param {string[]} params.fileTextLines - Array de linhas do arquivo TXT
 * @param {string|null} [params.resumo=null] - Resumo gerado por IA (opcional)
 * @returns {Promise<Buffer>} Buffer do PDF gerado
 */
async function generatePdf(params) {
    const {
        titulo = 'Registro de Roleplay',
        categoria = 'N/A',
        canal = 'N/A',
        postTitle = 'N/A',
        mensagensRange = 'Início a Fim',
        modo = 'Coleta de Conteúdo',
        fileTextLines = [],
        resumo = null,
    } = params;

    const dataGeracao = new Date().toLocaleString('pt-BR');

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 40, bottom: 45, left: 45, right: 45 },
            bufferPages: true,
            info: {
                Title: cleanDiscordText(titulo),
                Author: 'Galatic Bot',
                Subject: `Registro de RP — ${cleanDiscordText(categoria)}`,
                Keywords: 'Roleplay, RP, Discord, Galatic Bot',
                CreationDate: new Date(),
            },
        });

        const buffers = [];
        doc.on('data', b => buffers.push(b));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', err => reject(err));

        const printableWidth = doc.page.width - 90;
        const bannerY = 40;

        // ─── 1. CAPA / CABEÇALHO (BANNER PRINCIPAL) ───────────────────────────
        const bannerHeight = 135;
        doc.roundedRect(45, bannerY, printableWidth, bannerHeight, 6).fill('#16213e');

        // Badge pill
        doc.roundedRect(55, bannerY + 12, 160, 15, 7).fill('#24355a');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#93c5fd').text(
            'ARQUIVO DE REGISTRO DE RP',
            55,
            bannerY + 16,
            { width: 160, align: 'center' }
        );

        // Título e Subtítulo
        const cleanTitle = cleanDiscordText(titulo);
        doc.fontSize(15).font('Helvetica-Bold').fillColor('#ffffff').text(
            cleanTitle,
            55,
            bannerY + 34,
            { width: printableWidth - 20, lineBreak: false, ellipsis: true }
        );

        doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text(
            'Galatic Bot  •  Registros de Roleplay  •  Documento Pesquisável',
            55,
            bannerY + 54
        );

        // Grid de Metadados (3 colunas x 2 linhas)
        const gridY = bannerY + 70;
        const colW = (printableWidth - 20) / 3;
        const cardH = 26;

        const metadataCards = [
            { label: 'CATEGORIA', val: cleanDiscordText(categoria) },
            { label: 'CANAL / FÓRUM', val: cleanDiscordText(canal) },
            { label: 'TÓPICO', val: cleanDiscordText(postTitle) },
            { label: 'MODO', val: cleanDiscordText(modo) },
            { label: 'INTERVALO', val: cleanDiscordText(mensagensRange) },
            { label: 'GERAÇÃO', val: dataGeracao },
        ];

        metadataCards.forEach((m, idx) => {
            const col = idx % 3;
            const row = Math.floor(idx / 3);
            const cx = 55 + col * colW;
            const cy = gridY + row * (cardH + 4);

            doc.roundedRect(cx, cy, colW - 6, cardH, 3).fill('#1f2d4e');
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#94a3b8').text(
                m.label,
                cx + 6,
                cy + 4,
                { width: colW - 16, ellipsis: true }
            );
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#f8fafc').text(
                m.val,
                cx + 6,
                cy + 13,
                { width: colW - 16, ellipsis: true }
            );
        });

        doc.y = bannerY + bannerHeight + 16;

        // ─── 2. RESUMO GERADO POR IA (SE DISPONÍVEL) ─────────────────────────
        if (resumo && typeof resumo === 'string' && resumo.trim().length > 0) {
            const cleanSummary = cleanDiscordText(resumo);
            doc.font('Helvetica').fontSize(9);
            const sumTextHeight = doc.heightOfString(cleanSummary, { width: printableWidth - 24, lineGap: 2.5 });
            const boxPadding = 24;
            const totalSumHeight = sumTextHeight + boxPadding + 28;

            ensureSpace(doc, Math.min(totalSumHeight, 140));

            // Header da seção
            const secY = doc.y;
            doc.rect(45, secY, 4, 16).fill('#10b981');
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#065f46').text(
                'Resumo Gerado por IA',
                54,
                secY + 2
            );
            doc.y = secY + 22;

            const boxY = doc.y;
            // Se cabe na página inteira, desenha o fundo
            if (totalSumHeight < doc.page.height - doc.page.margins.bottom - doc.y) {
                doc.roundedRect(45, boxY, printableWidth, sumTextHeight + boxPadding, 4).fill('#f0fdf4');
                doc.roundedRect(45, boxY, printableWidth, sumTextHeight + boxPadding, 4).strokeColor('#86efac').lineWidth(0.5).stroke();
            }

            doc.fontSize(9).font('Helvetica').fillColor('#14532d').text(
                cleanSummary,
                55,
                boxY + 10,
                { width: printableWidth - 20, lineGap: 2.5 }
            );

            doc.moveDown(1);
        }

        // ─── 3. TRANSCRIÇÃO COMPLETA ──────────────────────────────────────────
        ensureSpace(doc, 40);
        const transHeaderY = doc.y;
        doc.rect(45, transHeaderY, 4, 16).fill('#3b82f6');
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a8a').text(
            'Transcrição Completa',
            54,
            transHeaderY + 2
        );
        doc.y = transHeaderY + 24;

        const items = parseFileTextLines(fileTextLines);

        if (items.length === 0) {
            doc.fontSize(9).font('Helvetica-Oblique').fillColor('#64748b').text(
                'Nenhuma mensagem gravada neste registro.',
                55,
                doc.y
            );
        }

        for (const item of items) {
            if (item.type === 'lore_start') {
                ensureSpace(doc, 36);
                const curY = doc.y;
                doc.roundedRect(45, curY, printableWidth, 26, 4).fill('#fef3c7');
                doc.roundedRect(45, curY, printableWidth, 26, 4).strokeColor('#f59e0b').lineWidth(0.8).stroke();
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#92400e').text(
                    `LORE: ${cleanDiscordText(item.title)}`,
                    55,
                    curY + 7,
                    { width: printableWidth - 20, ellipsis: true }
                );
                doc.y = curY + 32;
                continue;
            }

            if (item.type === 'lore_meta') {
                ensureSpace(doc, 18);
                doc.fontSize(8).font('Helvetica-Oblique').fillColor('#78350f').text(
                    cleanDiscordText(item.text),
                    55,
                    doc.y
                );
                doc.moveDown(0.3);
                continue;
            }

            if (item.type === 'lore_chapter') {
                ensureSpace(doc, 24);
                const curY = doc.y;
                doc.rect(55, curY, 2, 14).fill('#d97706');
                doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#b45309').text(
                    `Capítulo: ${cleanDiscordText(item.title)}`,
                    62,
                    curY + 1
                );
                doc.y = curY + 18;
                continue;
            }

            if (item.type === 'lore_end') {
                ensureSpace(doc, 15);
                doc.strokeColor('#fde68a').lineWidth(0.5).moveTo(45, doc.y).lineTo(doc.page.width - 45, doc.y).stroke();
                doc.moveDown(0.5);
                continue;
            }

            if (item.type === 'text') {
                const cleanTxt = cleanDiscordText(item.text);
                doc.font('Helvetica').fontSize(8.5);
                const tHeight = doc.heightOfString(cleanTxt, { width: printableWidth - 20, lineGap: 2 });
                ensureSpace(doc, Math.min(tHeight + 6, 80));
                doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text(
                    cleanTxt,
                    55,
                    doc.y,
                    { width: printableWidth - 20, lineGap: 2 }
                );
                doc.moveDown(0.4);
                continue;
            }

            if (item.type === 'message') {
                const cleanContent = cleanDiscordText(item.content);
                doc.font('Helvetica').fontSize(8.5);
                const contentH = doc.heightOfString(cleanContent, { width: printableWidth - 24, lineGap: 2 });
                const blockH = contentH + 30;

                // Se o bloco cabe em uma página única
                if (blockH < doc.page.height - 100) {
                    if (doc.y + blockH > doc.page.height - 50) {
                        doc.addPage();
                    }

                    const curY = doc.y;
                    // Fundo e barra lateral
                    doc.roundedRect(45, curY, printableWidth, blockH, 3).fill('#f8fafc');
                    doc.rect(45, curY, 3, blockH).fill('#cbd5e1');

                    // Metadados: Data/Hora e Canal
                    doc.fontSize(7).font('Helvetica').fillColor('#64748b').text(
                        `${item.time}  •  #${item.channel}`,
                        55,
                        curY + 5
                    );

                    // Autor
                    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text(
                        `${item.author}:`,
                        55,
                        curY + 15
                    );

                    // Conteúdo
                    doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text(
                        cleanContent,
                        55,
                        curY + 26,
                        { width: printableWidth - 24, lineGap: 2 }
                    );

                    doc.y = curY + blockH + 5;
                } else {
                    // Mensagem gigante (ultrapassa uma página inteira)
                    if (doc.y > doc.page.height - 100) {
                        doc.addPage();
                    }

                    const curY = doc.y;
                    doc.rect(45, curY, 3, 20).fill('#cbd5e1');
                    doc.fontSize(7).font('Helvetica').fillColor('#64748b').text(
                        `${item.time}  •  #${item.channel}`,
                        55,
                        curY + 2
                    );
                    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text(
                        `${item.author}:`,
                        55,
                        curY + 11
                    );
                    doc.y = curY + 24;

                    // O texto longo fluirá naturalmente quebrando páginas
                    doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text(
                        cleanContent,
                        55,
                        doc.y,
                        { width: printableWidth - 24, lineGap: 2 }
                    );

                    doc.moveDown(0.6);
                }
            }
        }

        // ─── 4. CABEÇALHOS CORRENTES E RODAPÉ (NUMERAÇÃO DE PÁGINAS) ──────────
        const range = doc.bufferedPageRange();
        for (let pageIdx = range.start; pageIdx < range.start + range.count; pageIdx++) {
            doc.switchToPage(pageIdx);

            // Cabeçalho superior a partir da página 2
            if (pageIdx > 0) {
                doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text(
                    `${cleanTitle}  •  ${cleanDiscordText(categoria)}`,
                    45,
                    20,
                    { width: printableWidth, align: 'left', ellipsis: true }
                );
                doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(45, 30).lineTo(doc.page.width - 45, 30).stroke();
            }

            // Linha divisória do rodapé
            doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(45, doc.page.height - 35).lineTo(doc.page.width - 45, doc.page.height - 35).stroke();

            // Texto do rodapé com numeração total
            doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8').text(
                `Página ${pageIdx + 1} de ${range.count}   •   Galatic Bot   •   ${dataGeracao}`,
                45,
                doc.page.height - 27,
                { width: printableWidth, align: 'center' }
            );
        }

        doc.end();
    });
}

// Helpers mantidos para compatibilidade retroativa
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function discordMdToHtml(text) {
    if (!text) return '';
    return escapeHtml(cleanDiscordText(text)).replace(/\n/g, '<br>');
}

function fileTextToHtmlBlocks(fileTextLines) {
    return cleanDiscordText((fileTextLines || []).join('\n'));
}

module.exports = {
    generatePdf,
    cleanDiscordText,
    parseFileTextLines,
    fileTextToHtmlBlocks,
    discordMdToHtml,
};
