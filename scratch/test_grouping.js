const fs = require('fs');
const data = require('../debug_ficha_raw.json');

function isTitle(line) {
    if (!line || line.trim() === '') return false;
    let trimmed = line.trim();
    if (trimmed.length > 80) return false;
    if (/^[\p{Emoji_Presentation}\p{Extended_Pictographic}★✡️🔴🟡🔵🟢🔱📓📋📖👾👺🪬🌍❌🔸✏️🎲⏳♥️♾️👁️‍🗨️🐉⏱️💀🜏•]/u.test(trimmed)) return true;
    if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.length > 5) return true;
    return false;
}

function splitTextIntoSkills(text) {
    if (!text) return [];
    const lines = text.split('\n');
    let rawBlocks = [];
    let currentBlock = [];
    let currentTitle = null;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let isStandalone = (i === 0 || lines[i-1].trim() === '') && isTitle(line);

        if (isStandalone && currentBlock.join('\n').trim().length > 0) {
            let textoBruto = currentBlock.join('\n').trim();
            if (currentTitle && textoBruto.startsWith(currentTitle)) {
                textoBruto = textoBruto.substring(currentTitle.length).trim();
            }
            rawBlocks.push({ titulo: currentTitle, texto: textoBruto });
            currentBlock = [line];
            currentTitle = line.trim();
        } else {
            currentBlock.push(line);
            if (currentBlock.length === 1 && isTitle(line)) {
                currentTitle = line.trim();
            }
        }
    }
    if (currentBlock.length > 0) {
        let textoBruto = currentBlock.join('\n').trim();
        if (currentTitle && textoBruto.startsWith(currentTitle)) {
            textoBruto = textoBruto.substring(currentTitle.length).trim();
        }
        rawBlocks.push({ titulo: currentTitle, texto: textoBruto });
    }

    // NEW GROUPING LOGIC:
    // Se o bloco tiver um texto muito curto (ex: só stats) e o próximo também, 
    // ou se for uma sequência de atributos, vamos agrupá-los em uma página só chamada "Status / Informações"
    
    let mergedBlocks = [];
    let buffer = [];
    
    for (let i = 0; i < rawBlocks.length; i++) {
        let b = rawBlocks[i];
        let totalChars = (b.titulo ? b.titulo.length : 0) + (b.texto ? b.texto.length : 0);
        
        // Se for um bloco pequeno (menos de 150 caracteres) e tem cara de stat/lista
        if (totalChars < 150) {
            buffer.push(b);
        } else {
            // Bloco grande. Primeiro esvazia o buffer se tiver algo.
            if (buffer.length > 0) {
                let mergedText = buffer.map(x => (x.titulo ? x.titulo + '\n' : '') + x.texto).join('\n\n');
                mergedBlocks.push({
                    titulo: buffer[0].titulo || 'Informações Gerais',
                    texto: mergedText
                });
                buffer = [];
            }
            mergedBlocks.push(b);
        }
    }
    
    // Esvazia resto do buffer
    if (buffer.length > 0) {
        let mergedText = buffer.map(x => (x.titulo ? x.titulo + '\n' : '') + x.texto).join('\n\n');
        mergedBlocks.push({
            titulo: buffer[0].titulo || 'Informações Gerais',
            texto: mergedText
        });
    }

    return mergedBlocks;
}

const pet = data.find(d => d.titulo === '👹 PET DIVINO 👹');
if (pet) {
    console.log("PET DIVINO PARSED:");
    const res = splitTextIntoSkills(pet.texto);
    res.forEach((r, i) => console.log(`[PAGINA ${i+1}] TITULO: ${r.titulo}\nTEXTO:\n${r.texto}\n------------------`));
} else {
    // If exact title not found, search it
    const pet2 = data.find(d => d.titulo.includes('PET'));
    if (pet2) {
        const res = splitTextIntoSkills(pet2.texto);
        res.forEach((r, i) => console.log(`[PAGINA ${i+1}] TITULO: ${r.titulo}\nTEXTO:\n${r.texto}\n------------------`));
    }
}
