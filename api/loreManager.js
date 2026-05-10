const fs = require('fs');
const path = require('path');

const LORE_PATH = path.join(__dirname, '../lorePath'); 

function buscarContextoLocal(pergunta) {
    if (!fs.existsSync(LORE_PATH)) return "Nenhum arquivo de lore encontrado.";

    const arquivos = fs.readdirSync(LORE_PATH).filter(f => f.endsWith('.txt'));
    let contextoRelevante = "";
    
    // Busca simples por relevância de termos para não estourar a RAM
    const termos = pergunta.toLowerCase().split(' ');

    for (const arquivo of arquivos) {
        const conteudo = fs.readFileSync(path.join(LORE_PATH, arquivo), 'utf-8');
        // Se o arquivo contém palavras da pergunta, adicionamos ao contexto
        if (termos.some(termo => conteudo.toLowerCase().includes(termo))) {
            contextoRelevante += `--- Fragmento de ${arquivo} ---\n${conteudo.substring(0, 2000)}\n\n`;
        }
        if (contextoRelevante.length > 15000) break; // Limite para não exceder o prompt
    }

    return contextoRelevante || "Nenhum fragmento específico encontrado, use seu conhecimento geral do mundo.";
}

module.exports = { buscarContextoLocal };