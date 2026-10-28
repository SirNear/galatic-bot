const puppeteer = require('puppeteer');

/**
 * Escapa HTML para prevenir injeção em templates.
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Converte markdown básico do Discord para HTML legível.
 */
function discordMdToHtml(text) {
    if (!text) return '';
    return escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

/**
 * Gera o HTML completo do documento de resumo.
 */
function buildHtml(options) {
    const {
        titulo,
        categoria,
        canal,
        postTitle,
        dataGeracao,
        mensagensRange,
        modo,
        conteudo,     // texto bruto (transcrito) formatado em HTML
        resumo        // texto do resumo (opcional)
    } = options;

    const resumoHtml = resumo
        ? `
        <div class="section-header">📄 Resumo Gerado por IA</div>
        <div class="summary-box">${discordMdToHtml(resumo)}</div>
        `
        : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(titulo)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Fira+Code:wght@400;500&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', 'Segoe UI', sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a2e;
    background: #ffffff;
    padding: 0;
  }

  .cover {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%);
    color: white;
    min-height: 220px;
    padding: 40px 50px 30px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .cover .badge {
    display: inline-block;
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 20px;
    padding: 4px 14px;
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 16px;
    width: fit-content;
  }

  .cover h1 {
    font-size: 26pt;
    font-weight: 700;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
  }

  .cover .subtitle {
    font-size: 11pt;
    opacity: 0.75;
    margin-bottom: 24px;
  }

  .cover .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
  }

  .cover .meta-item {
    background: rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 10px 14px;
  }

  .cover .meta-item .label {
    font-size: 8pt;
    opacity: 0.6;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 3px;
  }

  .cover .meta-item .value {
    font-size: 10pt;
    font-weight: 600;
  }

  .body-content {
    padding: 30px 50px 50px;
  }

  .section-header {
    font-size: 13pt;
    font-weight: 700;
    color: #0f3460;
    border-left: 4px solid #e94560;
    padding-left: 12px;
    margin: 28px 0 16px;
  }

  .summary-box {
    background: linear-gradient(135deg, #f0f4ff, #e8f0fe);
    border: 1px solid #c5d5f8;
    border-radius: 10px;
    padding: 20px 24px;
    font-size: 11pt;
    line-height: 1.8;
    color: #1e1e3a;
    margin-bottom: 8px;
  }

  .transcript-block {
    margin-bottom: 6px;
    padding: 8px 12px;
    border-radius: 6px;
    background: #f8f9fc;
    border-left: 3px solid #dee2f0;
  }

  .transcript-block.lore {
    background: #fff8e7;
    border-left: 3px solid #f5a623;
  }

  .transcript-block .meta {
    font-size: 8pt;
    color: #888;
    margin-bottom: 3px;
  }

  .transcript-block .author {
    font-weight: 700;
    color: #0f3460;
    font-size: 10pt;
  }

  .transcript-block .msg-content {
    font-size: 10pt;
    color: #333;
    margin-top: 2px;
  }

  .lore-title {
    font-size: 11pt;
    font-weight: 700;
    color: #b8560a;
    margin: 16px 0 6px;
    padding: 8px 14px;
    background: linear-gradient(90deg, #fff3e0, transparent);
    border-left: 4px solid #f5a623;
    border-radius: 0 6px 6px 0;
  }

  .chapter-title {
    font-size: 10pt;
    font-weight: 600;
    color: #555;
    margin: 10px 0 4px 16px;
    font-style: italic;
  }

  .page-content {
    font-size: 10pt;
    color: #333;
    padding: 6px 16px;
    border-left: 2px solid #eee;
    margin: 2px 0 2px 16px;
    line-height: 1.7;
  }

  code {
    font-family: 'Fira Code', monospace;
    background: #eef0f5;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 9pt;
  }

  .footer {
    margin-top: 40px;
    padding-top: 14px;
    border-top: 1px solid #eee;
    text-align: center;
    font-size: 8.5pt;
    color: #aaa;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cover { page-break-after: avoid; }
  }
</style>
</head>
<body>

<div class="cover">
  <div class="badge">📜 Arquivo de RP</div>
  <h1>${escapeHtml(titulo)}</h1>
  <div class="subtitle">Galatic Bot &mdash; Registros de Roleplay</div>
  <div class="meta-grid">
    <div class="meta-item">
      <div class="label">Categoria</div>
      <div class="value">${escapeHtml(categoria)}</div>
    </div>
    <div class="meta-item">
      <div class="label">Fórum / Canal</div>
      <div class="value">${escapeHtml(canal)}</div>
    </div>
    <div class="meta-item">
      <div class="label">Tópico</div>
      <div class="value">${escapeHtml(postTitle)}</div>
    </div>
    <div class="meta-item">
      <div class="label">Modo</div>
      <div class="value">${escapeHtml(modo)}</div>
    </div>
    <div class="meta-item">
      <div class="label">Intervalo</div>
      <div class="value">${escapeHtml(mensagensRange)}</div>
    </div>
    <div class="meta-item">
      <div class="label">Data de Geração</div>
      <div class="value">${escapeHtml(dataGeracao)}</div>
    </div>
  </div>
</div>

<div class="body-content">
  ${resumoHtml}
  <div class="section-header">📝 Transcrição Completa</div>
  ${conteudo}
  <div class="footer">
    Gerado automaticamente por Galatic Bot &bull; ${escapeHtml(dataGeracao)}
  </div>
</div>

</body>
</html>`;
}

/**
 * Converte o array de linhas do fileText (formato TXT) para blocos HTML estruturados.
 * Faz parse linha-a-linha para identificar metadados, lores e mensagens.
 */
function fileTextToHtmlBlocks(fileTextLines) {
    const blocks = [];
    let i = 0;

    while (i < fileTextLines.length) {
        const line = fileTextLines[i];

        // Cabeçalho e separadores — ignora
        if (
            line.startsWith('===') ||
            line.startsWith('---') ||
            line.startsWith('ARQUIVO DE REGISTRO') ||
            line.startsWith('LEGENDA') ||
            line.startsWith('INFORMAÇÕES') ||
            line.startsWith('CONTEÚDO') ||
            line.trim() === ''
        ) {
            i++;
            continue;
        }

        // Linha de metadata (- Categoria: ...)
        if (line.startsWith('- ')) {
            i++;
            continue;
        }

        // Início de LORE
        if (line.includes('[LORE:') && line.includes('===')) {
            const loreTitle = line.replace(/=+/g, '').replace('[LORE:', '').replace(']', '').trim();
            blocks.push(`<div class="lore-title">📖 Lore: ${escapeHtml(loreTitle)}</div>`);
            i++;
            continue;
        }

        // Fim de LORE
        if (line.includes('[FIM DA LORE]')) {
            i++;
            continue;
        }

        // Capítulo
        if (line.startsWith('>> CAPÍTULO:')) {
            const chapName = line.replace('>> CAPÍTULO:', '').trim();
            blocks.push(`<div class="chapter-title">📑 ${escapeHtml(chapName)}</div>`);
            i++;
            continue;
        }

        // Linha separadora de mensagem
        if (line.startsWith('--')) {
            i++;
            continue;
        }

        // Linha de mensagem: [data] [canal] autor:
        const msgMatch = line.match(/^\[(.+?)\]\s*\[(.+?)\]\s*(.+):$/);
        if (msgMatch) {
            const [, time, channel, author] = msgMatch;
            // Próxima linha é o conteúdo
            const content = fileTextLines[i + 1] || '';
            blocks.push(`
<div class="transcript-block">
  <div class="meta">${escapeHtml(time)} &bull; #${escapeHtml(channel)}</div>
  <div class="author">${escapeHtml(author)}</div>
  <div class="msg-content">${discordMdToHtml(content)}</div>
</div>`);
            i += 2;
            continue;
        }

        // Conteúdo de página de Lore (texto livre)
        if (line.trim().length > 0) {
            blocks.push(`<div class="page-content">${discordMdToHtml(line)}</div>`);
        }

        i++;
    }

    return blocks.join('\n');
}

/**
 * Gera um Buffer de PDF a partir dos dados do RP.
 *
 * @param {Object} params
 * @param {string} params.titulo - Título do documento
 * @param {string} params.categoria - Nome da categoria
 * @param {string} params.canal - Nome do canal/fórum
 * @param {string} params.postTitle - Título do tópico
 * @param {string} params.mensagensRange - Intervalo de mensagens
 * @param {string} params.modo - Modo de geração
 * @param {string[]} params.fileTextLines - Array de linhas do arquivo TXT
 * @param {string|null} params.resumo - Resumo gerado por IA (opcional)
 * @returns {Promise<Buffer>} Buffer do PDF gerado
 */
async function generatePdf(params) {
    const {
        titulo,
        categoria,
        canal,
        postTitle,
        mensagensRange,
        modo,
        fileTextLines,
        resumo = null,
    } = params;

    const dataGeracao = new Date().toLocaleString('pt-BR');
    const conteudoHtml = fileTextToHtmlBlocks(fileTextLines);

    const html = buildHtml({
        titulo,
        categoria,
        canal,
        postTitle,
        dataGeracao,
        mensagensRange,
        modo,
        conteudo: conteudoHtml,
        resumo,
    });

    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
            displayHeaderFooter: false,
        });

        return Buffer.from(pdfBuffer);
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

module.exports = { generatePdf, fileTextToHtmlBlocks, discordMdToHtml };
