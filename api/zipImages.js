const JSZip = require('jszip');
const axios = require('axios');

async function zipImages(images, consoleMessage = 'Compactando imagens') {
    if (!images || images.length === 0) {
        throw new Error("O array de imagens não pode estar vazio.");
    }

    const zip = new JSZip();

    // Usando Promise.all para baixar todas as imagens em paralelo
    await Promise.all(images.map(async (image, index) => {
        try {
            const response = await axios.get(image.url, {
                responseType: 'arraybuffer' // Essencial para obter os dados da imagem como buffer
            });

            // Adiciona a imagem baixada ao zip
            zip.file(image.filename, response.data);

        } catch (error) {
            console.error(`[${consoleMessage}] Falha ao baixar ou adicionar a imagem ${image.filename} da URL: ${image.url}`, error.message);

        }
    }));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    return zipBuffer;
}

module.exports = { zipImages };