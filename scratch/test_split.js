const fs = require('fs');
const data = require('../debug_ficha_raw.json');

function isTitle(line) {
    if (!line || line.trim() === '') return false;
    let trimmed = line.trim();
    if (trimmed.length > 80) return false;

    // A linha deve começar com um Emoji ou algum símbolo forte de título (excluindo hifens comuns de lista)
    const startsWithSymbol = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}★✡️🔴🟡🔵🟢🔱📓📋📖👾👺🪬🌍❌🔸✏️🎲⏳♥️♾️👁️‍🗨️🐉⏱️💀🜏•]/.test(trimmed);
    
    if (startsWithSymbol) return true;

    // Ou ser toda em maiúsculo (com pelo menos algumas letras)
    const isUpper = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.length > 5;
    if (isUpper) return true;

    return false;
}

function splitText(text) {
    const lines = text.split('\n');
    let blocks = [];
    let currentBlock = [];
    let currentTitle = "Visão Geral";

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Lookahead to see if this is a standalone title (next line is empty or it's a tight list)
        // Usually, titles are separated by \n\n or are at the start.
        let isStandalone = (i === 0 || lines[i-1].trim() === '') && isTitle(line);

        if (isStandalone && currentBlock.join('\n').trim().length > 0) {
            // Found a new title, push the old block
            blocks.push({
                titulo: currentTitle,
                texto: currentBlock.join('\n').trim()
            });
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
        blocks.push({
            titulo: currentTitle,
            texto: currentBlock.join('\n').trim()
        });
    }

    return blocks;
}

const haki = data.find(d => d.titulo === 'HAKI');
console.log(splitText(haki.texto));

const itens = data.find(d => d.titulo === '🔱 ITENS, EQUIPAMENTOS  E PETS 🔱');
console.log(splitText(itens.texto));
