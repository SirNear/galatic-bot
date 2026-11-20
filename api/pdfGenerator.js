let PDFDocument = null;
try {
    PDFDocument = require('pdfkit');
} catch (_) {
    // pdfkit opcional em tempo de carregamento para prevenir MODULE_NOT_FOUND em ambientes de hospedagem
}

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
 * Sanitiza o texto para geração de PDF limpo em WinAnsiEncoding.
 */
function sanitizeForPdf(text) {
    if (!text || typeof text !== 'string') return '';
    return cleanDiscordText(text)
        .normalize('NFC')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/[\u2022\u25E6\u2023\u2043]/g, '*')
        .replace(/\u00A0/g, ' ')
        .replace(/\t/g, '    ');
}

/**
 * Escapa uma string para inclusão segura em streams PDF literais (...) com suporte a WinAnsiEncoding.
 * Caracteres acentuados da língua portuguesa (á, à, ã, â, é, ê, í, ó, ô, õ, ú, ç, etc.)
 * são codificados em octal (\ddd) para compatibilidade universal com fontes Type 1 em PDF 1.4.
 */
function escapePdfString(str) {
    if (!str) return '';
    const s = sanitizeForPdf(str);
    let out = '';
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        const code = s.charCodeAt(i);
        if (c === '(') out += '\\(';
        else if (c === ')') out += '\\)';
        else if (c === '\\') out += '\\\\';
        else if (c === '\r' || c === '\n') out += ' ';
        else if (code >= 32 && code <= 126) out += c;
        else if (code >= 160 && code <= 255) {
            out += '\\' + code.toString(8).padStart(3, '0');
        } else {
            out += ' ';
        }
    }
    return out;
}

/**
 * Quebra uma linha de texto em múltiplas linhas respeitando palavras completas (word-wrap).
 * Evita que textos longos fiquem cortados na borda da página ou comprimidos em linha única.
 */
function wrapLine(line, maxChars = 80) {
    if (!line || typeof line !== 'string') return [''];
    if (line.length <= maxChars) return [line];

    const words = line.split(' ');
    const lines = [];
    let current = '';

    for (const word of words) {
        if (!word) {
            if (current.length < maxChars) current += ' ';
            continue;
        }
        if (!current) {
            if (word.length <= maxChars) {
                current = word;
            } else {
                for (let i = 0; i < word.length; i += maxChars) {
                    const chunk = word.slice(i, i + maxChars);
                    if (i + maxChars < word.length) lines.push(chunk);
                    else current = chunk;
                }
            }
        } else if ((current + ' ' + word).length <= maxChars) {
            current += ' ' + word;
        } else {
            lines.push(current);
            if (word.length <= maxChars) {
                current = word;
            } else {
                for (let i = 0; i < word.length; i += maxChars) {
                    const chunk = word.slice(i, i + maxChars);
                    if (i + maxChars < word.length) lines.push(chunk);
                    else current = chunk;
                }
            }
        }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
}

/**
 * Gerador nativo de PDF em JavaScript puro (zero dependências, sem binários nativos ou Chromium).
 * Utiliza fontes padrão PDF 1.4 com WinAnsiEncoding para suporte total aos acentos da língua portuguesa,
 * quebra automática de linha (word-wrap) sem cortar textos, paginação dinâmica e cabeçalhos/rodapés estruturados.
 */
function generateNativeFallbackPdf(params) {
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
    const cleanDocTitle = sanitizeForPdf(titulo);

    const allContentLines = [];

    // ─── 1. RESUMO NARRATIVO (SE HOUVER) ─────────────────────────────────
    if (resumo && typeof resumo === 'string' && resumo.trim().length > 0) {
        allContentLines.push({ type: 'section_header', text: '======================================================================' });
        allContentLines.push({ type: 'section_header', text: '   RESUMO GERADO POR IA' });
        allContentLines.push({ type: 'section_header', text: '======================================================================' });
        allContentLines.push({ type: 'text', text: '' });

        const rParagraphs = resumo.split(/\r?\n/);
        for (const p of rParagraphs) {
            const wrapped = wrapLine(p, 80);
            for (const wl of wrapped) {
                allContentLines.push({ type: 'summary', text: wl });
            }
        }
        allContentLines.push({ type: 'text', text: '' });
        allContentLines.push({ type: 'section_header', text: '======================================================================' });
        allContentLines.push({ type: 'section_header', text: '   TRANSCRIÇÃO COMPLETA DAS MENSAGENS' });
        allContentLines.push({ type: 'section_header', text: '======================================================================' });
        allContentLines.push({ type: 'text', text: '' });
    }

    // ─── 2. LINHAS DE MENSAGENS E LORES ──────────────────────────────────
    let isSkippingHeader = true;

    for (const entry of (fileTextLines || [])) {
        if (typeof entry === 'string') {
            const lines = entry.split(/\r?\n/);
            for (const l of lines) {
                const trimmed = l.trim();

                // Ignora cabeçalhos duplicados do arquivo TXT original
                if (isSkippingHeader) {
                    if (
                        trimmed.startsWith('ARQUIVO DE REGISTRO') ||
                        trimmed.startsWith('LEGENDA:') ||
                        trimmed.startsWith('INFORMAÇÕES') ||
                        trimmed.startsWith('- Categoria:') ||
                        trimmed.startsWith('- Fórum/Canal:') ||
                        trimmed.startsWith('- Título da Postagem:') ||
                        trimmed.startsWith('- Intervalo de Mensagens:') ||
                        trimmed.startsWith('- Filtro de Usuário:') ||
                        trimmed.startsWith('- Total de Mensagens') ||
                        trimmed.startsWith('- Data de Geração:') ||
                        trimmed.startsWith('- Modo:') ||
                        trimmed === 'CONTEÚDO' ||
                        (trimmed.startsWith('===') && !trimmed.includes('[LORE:')) ||
                        trimmed.startsWith('---')
                    ) {
                        continue;
                    }
                    if (trimmed.length > 0) {
                        isSkippingHeader = false;
                    } else {
                        continue;
                    }
                }

                // Identifica seções especiais
                if (trimmed.includes('[LORE:') && trimmed.includes('===')) {
                    allContentLines.push({ type: 'lore_start', text: trimmed.slice(0, 80) });
                } else if (trimmed.includes('[FIM DA LORE]')) {
                    allContentLines.push({ type: 'lore_end', text: trimmed.slice(0, 80) });
                } else if (trimmed.startsWith('>> CAPÍTULO:')) {
                    allContentLines.push({ type: 'lore_chapter', text: trimmed.slice(0, 80) });
                } else if (trimmed.startsWith('Canal:') && trimmed.includes('Autor:') && trimmed.includes('Data:')) {
                    allContentLines.push({ type: 'lore_meta', text: trimmed.slice(0, 80) });
                } else if (trimmed.startsWith('------------------------------------------------------------') || trimmed.startsWith('======')) {
                    allContentLines.push({ type: 'divider', text: '-'.repeat(70) });
                } else if (trimmed.match(/^\[.+?\]\s*\[.+?\]\s*.+?:$/)) {
                    allContentLines.push({ type: 'msg_header', text: trimmed });
                } else if (trimmed.length === 0) {
                    allContentLines.push({ type: 'text', text: '' });
                } else {
                    const wrapped = wrapLine(l, 80);
                    for (const wl of wrapped) {
                        allContentLines.push({ type: 'text', text: wl });
                    }
                }
            }
        }
    }

    if (allContentLines.length === 0) {
        allContentLines.push({ type: 'text', text: '(Nenhuma mensagem gravada neste registro)' });
    }

    // ─── 3. PAGINAÇÃO INTELIGENTE ────────────────────────────────────────
    const PAGE1_MAX_LINES = 45;
    const PAGEX_MAX_LINES = 50;

    const pages = [];
    let curPageLines = [];
    let curMax = PAGE1_MAX_LINES;

    for (let i = 0; i < allContentLines.length; i++) {
        const item = allContentLines[i];

        // Evita cabeçalhos órfãos na última linha da página
        if (curPageLines.length === curMax - 1 && (item.type === 'msg_header' || item.type === 'section_header' || item.type === 'lore_start' || item.type === 'lore_chapter')) {
            pages.push(curPageLines);
            curPageLines = [];
            curMax = PAGEX_MAX_LINES;
        } else if (curPageLines.length >= curMax) {
            pages.push(curPageLines);
            curPageLines = [];
            curMax = PAGEX_MAX_LINES;
        }

        curPageLines.push(item);
    }
    if (curPageLines.length > 0) pages.push(curPageLines);

    const totalPages = pages.length;
    const pageObjNums = [];
    const contentObjNums = [];
    let curObj = 5;

    for (let p = 0; p < totalPages; p++) {
        curObj++;
        pageObjNums.push(curObj);
        curObj++;
        contentObjNums.push(curObj);
    }

    const catalogObj = '<< /Type /Catalog /Pages 2 0 R >>';
    const pagesKids = pageObjNums.map(n => n + ' 0 R').join(' ');
    const pagesObj = '<< /Type /Pages /Kids [' + pagesKids + '] /Count ' + totalPages + ' >>';
    const fontRegular = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    const fontBold = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    const fontItalic = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>';

    const fullObjects = [catalogObj, pagesObj, fontRegular, fontBold, fontItalic];

    for (let p = 0; p < totalPages; p++) {
        const pageItems = pages[p];
        const streamLines = [];

        // Linha divisória do rodapé
        streamLines.push('0.8 0.85 0.9 RG 0.5 w 45 42 m 550 42 l S');

        // Rodapé permanente em Y = 30
        streamLines.push('BT');
        streamLines.push('/F1 7.5 Tf');
        streamLines.push('0.4 0.45 0.5 rg');
        streamLines.push('45 30 Td');
        streamLines.push('(' + escapePdfString('Página ' + (p + 1) + ' de ' + totalPages + '   •   Galatic Bot   •   ' + dataGeracao) + ') Tj');
        streamLines.push('ET');

        // Bloco principal de texto
        streamLines.push('BT');
        streamLines.push('13.5 TL');

        if (p === 0) {
            // Cabeçalho da Primeira Página
            streamLines.push('45 805 Td');
            streamLines.push('/F2 13 Tf');
            streamLines.push('0.1 0.15 0.25 rg');
            streamLines.push('(' + escapePdfString(cleanDocTitle.slice(0, 70)) + ') Tj');
            streamLines.push('T*');

            streamLines.push('/F1 8 Tf');
            streamLines.push('0.3 0.35 0.4 rg');
            const meta1 = 'Categoria: ' + categoria + ' | Canal: ' + canal + (postTitle && postTitle !== 'N/A' ? ' (' + postTitle + ')' : '');
            streamLines.push('(' + escapePdfString(meta1.slice(0, 95)) + ') Tj');
            streamLines.push('T*');
            const meta2 = 'Modo: ' + modo + ' | Intervalo: ' + mensagensRange + ' | Gerado em: ' + dataGeracao;
            streamLines.push('(' + escapePdfString(meta2.slice(0, 95)) + ') Tj');
            streamLines.push('T*');

            streamLines.push('0.7 0.75 0.8 RG 0.5 w');
            streamLines.push('(' + escapePdfString('-'.repeat(75)) + ') Tj');
            streamLines.push('T*');
        } else {
            // Cabeçalho das Páginas Seguintes
            streamLines.push('45 810 Td');
            streamLines.push('/F3 8 Tf');
            streamLines.push('0.4 0.45 0.5 rg');
            streamLines.push('(' + escapePdfString('Galatic Bot — ' + cleanDocTitle.slice(0, 50) + '  [Página ' + (p + 1) + '/' + totalPages + ']') + ') Tj');
            streamLines.push('T*');
            streamLines.push('/F1 8 Tf');
            streamLines.push('(' + escapePdfString('-'.repeat(75)) + ') Tj');
            streamLines.push('T*');
        }

        // Renderização dos itens da página
        for (const item of pageItems) {
            if (item.type === 'section_header' || item.type === 'lore_start') {
                streamLines.push('/F2 9.5 Tf');
                streamLines.push('0.05 0.2 0.35 rg');
            } else if (item.type === 'summary') {
                streamLines.push('/F1 9 Tf');
                streamLines.push('0.05 0.35 0.15 rg');
            } else if (item.type === 'msg_header') {
                streamLines.push('/F2 9 Tf');
                streamLines.push('0.1 0.15 0.3 rg');
            } else if (item.type === 'lore_chapter') {
                streamLines.push('/F2 9 Tf');
                streamLines.push('0.7 0.35 0.05 rg');
            } else if (item.type === 'lore_meta') {
                streamLines.push('/F3 8 Tf');
                streamLines.push('0.45 0.3 0.1 rg');
            } else if (item.type === 'divider' || item.type === 'lore_end') {
                streamLines.push('/F1 8.5 Tf');
                streamLines.push('0.65 0.7 0.75 rg');
            } else {
                streamLines.push('/F1 9 Tf');
                streamLines.push('0.15 0.2 0.25 rg');
            }

            streamLines.push('(' + escapePdfString(item.text) + ') Tj');
            streamLines.push('T*');
        }

        streamLines.push('ET');

        const streamContent = streamLines.join('\n');
        const streamLen = Buffer.byteLength(streamContent);

        const pageContent = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents ' + contentObjNums[p] + ' 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> >>';
        const streamObj = '<< /Length ' + streamLen + ' >>\nstream\n' + streamContent + '\nendstream';

        fullObjects.push(pageContent);
        fullObjects.push(streamObj);
    }

    let output = '%PDF-1.4\n';
    const offsets = [0];

    for (let i = 0; i < fullObjects.length; i++) {
        offsets.push(Buffer.byteLength(output));
        output += (i + 1) + ' 0 obj\n' + fullObjects[i] + '\nendobj\n';
    }

    const xrefOffset = Buffer.byteLength(output);
    output += 'xref\n0 ' + (fullObjects.length + 1) + '\n';
    output += '0000000000 65535 f \n';
    for (let i = 1; i <= fullObjects.length; i++) {
        output += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    output += 'trailer\n<< /Size ' + (fullObjects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
    return Buffer.from(output, 'latin1');
}

/**
 * Renderizador de PDF via PDFKit (layout visual rico com caixas e badges coloridos).
 */
async function generatePdfKit(params) {
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

/**
 * Gera um Buffer de PDF pesquisável e leve a partir dos dados de RP utilizando PDFKit (se disponível)
 * ou o gerador nativo puro em JavaScript (fallback leve e resiliente para ambientes como Discloud).
 *
 * @param {Object} params
 * @returns {Promise<Buffer>} Buffer do PDF gerado
 */
async function generatePdf(params) {
    if (!PDFDocument) {
        try {
            PDFDocument = require('pdfkit');
        } catch (_) {}
    }

    if (!PDFDocument) {
        return generateNativeFallbackPdf(params);
    }

    try {
        return await generatePdfKit(params);
    } catch (err) {
        console.warn('[PDF] Falha na renderização via PDFKit. Usando fallback nativo com word-wrap:', err.message);
        return generateNativeFallbackPdf(params);
    }
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

// Limite saudável por arquivo para o Google NotebookLM (~400.000 caracteres / ~70.000 palavras por parte)
// Mantém máxima precisão de indexação/citação no NotebookLM e baixo uso de RAM na geração do PDF.
const NOTEBOOKLM_MAX_CHARS = 400000;

/**
 * Divide automaticamente um array de linhas de texto em partes saudáveis para o NotebookLM,
 * priorizando quebras entre mensagens/seções para nunca cortar uma fala ao meio.
 *
 * @param {string[]} fileTextLines - Array de linhas formatadas
 * @param {string} [contextLabel='Registro de RP'] - Identificador da categoria/canal para o cabeçalho de cada parte
 * @param {number} [maxChars=NOTEBOOKLM_MAX_CHARS] - Limite máximo de caracteres por parte
 * @returns {string[][]} Array de partes (cada parte é um array de linhas)
 */
function splitLinesForNotebookLM(fileTextLines, contextLabel = 'Registro de RP', maxChars = NOTEBOOKLM_MAX_CHARS) {
    if (!Array.isArray(fileTextLines) || fileTextLines.length === 0) return [[]];

    let totalChars = 0;
    for (const line of fileTextLines) {
        totalChars += (line ? line.length : 0) + 1;
    }

    if (totalChars <= maxChars) {
        return [fileTextLines];
    }

    const rawParts = [];
    let currentPart = [];
    let currentLen = 0;

    for (let i = 0; i < fileTextLines.length; i++) {
        const line = fileTextLines[i] ?? '';
        const lineLen = line.length + 1;

        if (currentLen + lineLen > maxChars && currentPart.length > 0) {
            rawParts.push(currentPart);
            currentPart = [];
            currentLen = 0;
        }

        currentPart.push(line);
        currentLen += lineLen;

        // Se já atingiu >= 88% do limite e encontramos um separador de mensagem/seção, quebramos de forma limpa
        const isSeparator = line.startsWith('--------------------') || line.startsWith('====================');
        if (isSeparator && currentLen >= maxChars * 0.88) {
            rawParts.push(currentPart);
            currentPart = [];
            currentLen = 0;
        }
    }

    if (currentPart.length > 0) {
        rawParts.push(currentPart);
    }

    if (rawParts.length <= 1) {
        return [fileTextLines];
    }

    const totalParts = rawParts.length;
    return rawParts.map((partLines, idx) => {
        const partHeader = [
            `======================================================================`,
            `   VOLUME ${idx + 1} DE ${totalParts} — DIVISÃO AUTOMÁTICA PARA NOTEBOOKLM`,
            `   Contexto: ${contextLabel}`,
            `======================================================================\n`,
        ];
        return [...partHeader, ...partLines];
    });
}

module.exports = {
    generatePdf,
    generateNativeFallbackPdf,
    cleanDiscordText,
    parseFileTextLines,
    fileTextToHtmlBlocks,
    discordMdToHtml,
    splitLinesForNotebookLM,
    NOTEBOOKLM_MAX_CHARS,
};
