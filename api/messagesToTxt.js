const moment = require('moment');
const { zipImages } = require('./zipImages'); // Importa a função de compactar imagens
moment.locale("pt-br");

async function messagesToTxt(messages, filename = 'log.txt', consoleMessage = 'Gerando arquivo .txt') {
    if (!messages || messages.length === 0) {
        throw new Error("O array de mensagens não pode estar vazio.");
    }
    
    console.log(`[${consoleMessage}] Iniciando processo para ${messages.length} mensagens.`);

    const imageAttachments = [];
    let imageCounter = 1;

    // Formata cada mensagem com timestamp, autor e conteúdo.
    const formattedText = messages
        .map((msg, index) => {
            const timestamp = moment(msg.createdAt).format("DD/MM/YYYY HH:mm:ss");
            const author = msg.author.tag;
            let content = msg.content || '[Mensagem sem texto]';

            // Coleta anexos de imagem
            if (msg.attachments.size > 0) {
                msg.attachments.forEach(attachment => {
                    if (attachment.contentType?.startsWith('image/')) {
                        const fileExtension = attachment.name.split('.').pop() || 'png';
                        const newFilename = `${String(imageCounter++).padStart(3, '0')}-${attachment.name}`;
                        imageAttachments.push({
                            url: attachment.url,
                            filename: newFilename
                        });
                        content += `\n[Anexo: ${newFilename}]`;
                    }
                });
            }

            return `[${timestamp}] ${author}:\n${content}`;
        })
        .join("\n\n---\n\n"); // Separa cada mensagem para melhor legibilidade

    console.log(`[${consoleMessage}] Convertendo texto formatado para buffer...`);
    const txtBuffer = Buffer.from(formattedText, 'utf-8');
    console.log(`[${consoleMessage}] Processo de criação do .txt concluído para o arquivo "${filename}".`);

    let zipBuffer = null;
    if (imageAttachments.length > 0) {
        console.log(`[${consoleMessage}] Encontradas ${imageAttachments.length} imagens. Iniciando compactação...`);
        zipBuffer = await zipImages(imageAttachments, `ZIP para ${filename}`);
    }

    return { txtBuffer, zipBuffer };
}

module.exports = { messagesToTxt };