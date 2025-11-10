const JSZip = require('jszip');
const axios = require('axios');

async function zipImages(images, consoleMessage = 'Compactando imagens') {
    if (!images || images.length === 0) {
        throw new Error("O array de imagens não pode estar vazio.");
    }

    console.log(`[${consoleMessage}] Iniciando processo para ${images.length} imagens.`);

    const zip = new JSZip();

    // Usando Promise.all para baixar todas as imagens em paralelo
    await Promise.all(images.map(async (image, index) => {
        try {
            console.log(`[${consoleMessage}] Baixando imagem ${index + 1}/${images.length}: ${image.filename}`);
            const response = await axios.get(image.url, {
                responseType: 'arraybuffer' // Essencial para obter os dados da imagem como buffer
            });

            // Adiciona a imagem baixada ao zip
            zip.file(image.filename, response.data);
            console.log(`[${consoleMessage}] Imagem ${image.filename} adicionada ao ZIP.`);

        } catch (error) {
            console.error(`[${consoleMessage}] Falha ao baixar ou adicionar a imagem ${image.filename} da URL: ${image.url}`, error.message);

        }
    }));

    console.log(`[${consoleMessage}] Gerando o arquivo ZIP final...`);
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    console.log(`[${consoleMessage}] Processo de compactação concluído.`);

    return zipBuffer;
}

module.exports = { zipImages };