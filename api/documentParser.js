const fetch = require('node-fetch');

let pdfLib = null;
try {
    pdfLib = require('pdf-parse');
} catch (_) {
    // pdf-parse protegido contra ausência em tempo de execução
}

/**
 * Extrai texto a partir de um buffer de PDF.
 * Compatível tanto com a versão 1 (função direta) quanto a versão 2 (classe PDFParse).
 */
async function parsePdfBuffer(buffer) {
    if (!pdfLib) {
        throw new Error('O pacote pdf-parse não está disponível no ambiente para leitura de PDFs.');
    }

    // Versão 1: pdfLib é uma função assíncrona
    if (typeof pdfLib === 'function') {
        const data = await pdfLib(buffer);
        return (data?.text || '').replace(/-- \d+ of \d+ --\n*/g, '').trim();
    }

    // Versão 2: pdfLib exporta a classe PDFParse
    if (pdfLib.PDFParse) {
        const parser = new pdfLib.PDFParse({ data: buffer });
        try {
            const result = await parser.getText();
            const rawText = typeof result === 'string' ? result : (result?.text || '');
            return rawText.replace(/-- \d+ of \d+ --\n*/g, '').trim();
        } finally {
            if (typeof parser.destroy === 'function') {
                await parser.destroy().catch(() => {});
            }
        }
    }

    throw new Error('Estrutura do parser PDF não reconhecida.');
}

/**
 * Extrai texto limpo de um anexo do Discord (.txt ou .pdf).
 * @param {import('discord.js').Attachment|{url: string, name?: string, contentType?: string}} attachment
 * @returns {Promise<{text: string, fileName: string, fileType: 'txt'|'pdf', size: number, buffer: Buffer}>}
 */
async function extractTextFromAttachment(attachment) {
    if (!attachment || (!attachment.url && !attachment.attachment)) {
        throw new Error('Nenhum anexo válido fornecido.');
    }

    const fileName = attachment.name || 'arquivo';
    const lowerName = fileName.toLowerCase();
    const contentType = (attachment.contentType || '').toLowerCase();

    const isPdf = lowerName.endsWith('.pdf') || contentType.includes('pdf');
    const isTxt = lowerName.endsWith('.txt') || lowerName.endsWith('.log') || lowerName.endsWith('.md') || contentType.startsWith('text/');

    if (!isPdf && !isTxt) {
        throw new Error(`Tipo de arquivo não suportado: "${fileName}". Por favor, envie um arquivo .txt ou .pdf.`);
    }

    let buffer;
    if (attachment.attachment instanceof Buffer) {
        buffer = attachment.attachment;
    } else if (typeof attachment.url === 'string' && attachment.url.startsWith('data:')) {
        const base64Data = attachment.url.split(',')[1] || '';
        buffer = Buffer.from(base64Data, 'base64');
    } else {
        const response = await fetch(attachment.url);
        if (!response.ok) {
            throw new Error(`Não foi possível baixar o anexo (HTTP ${response.status}).`);
        }
        buffer = await response.buffer();
    }
    if (buffer.length === 0) {
        throw new Error('O arquivo enviado está completamente vazio.');
    }

    let text = '';
    let fileType = 'txt';

    if (isPdf) {
        fileType = 'pdf';
        text = await parsePdfBuffer(buffer);
    } else {
        fileType = 'txt';
        text = buffer.toString('utf-8');
    }

    // Normaliza quebras de linha Windows/Mac para padrão Unix e remove caracteres nulos
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\0/g, '').trim();

    if (!text || text.length === 0) {
        throw new Error(`Não foi possível extrair nenhum texto legível do arquivo "${fileName}".`);
    }

    return {
        text,
        fileName,
        fileType,
        size: buffer.length,
        buffer,
    };
}

module.exports = {
    extractTextFromAttachment,
    parsePdfBuffer,
};
