const fs = require('fs');

function test() {
    let blocks = [
        { titulo: "[PASSIVA 1]", texto: "" },
        { titulo: "O LIVRO DE SILENT HILL", texto: "Aquele que porta o livro de Silent Hill tende a estar findado e se tornará um com a entidade de medo líder absoluto do Reino invertido... (imagine um texto longo aqui com mais de 150 chars)".repeat(2) },
        { titulo: "⚠️ EM PROGRESSÃO ⚠️", texto: "" }
    ];

    let mergedBlocks = [];
    let buffer = [];
    
    for (let i = 0; i < blocks.length; i++) {
        let b = blocks[i];
        let totalChars = (b.titulo ? b.titulo.length : 0) + (b.texto ? b.texto.length : 0);
        
        if (totalChars < 150) {
            buffer.push(b);
        } else {
            if (buffer.length === 1) {
                if (buffer[0].texto === '') {
                    b.titulo = buffer[0].titulo + (b.titulo ? ' - ' + b.titulo : '');
                } else {
                    mergedBlocks.push(buffer[0]);
                }
            } else if (buffer.length > 1) {
                let mergedText = buffer.map(x => (x.titulo ? x.titulo + '\n' : '') + x.texto).join('\n\n');
                mergedBlocks.push({
                    titulo: buffer[0].titulo || 'Informações Gerais',
                    texto: mergedText
                });
            }
            buffer = [];
            mergedBlocks.push(b);
        }
    }
    
    if (buffer.length === 1) {
        mergedBlocks.push(buffer[0]);
    } else if (buffer.length > 1) {
        let mergedText = buffer.map(x => (x.titulo ? x.titulo + '\n' : '') + x.texto).join('\n\n');
        mergedBlocks.push({
            titulo: buffer[0].titulo || 'Informações Gerais',
            texto: mergedText
        });
    }

    console.log(JSON.stringify(mergedBlocks, null, 2));
}
test();
