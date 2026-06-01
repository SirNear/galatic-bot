/**
 * Parser Inteligente para extração de Fichas de RPG de textos sujos (logs de chat)
 */

function extrairFicha(blocos, mapeamentoSistemas = {}) {
    if (!blocos || blocos.length === 0) return null;

    const ficha = {
        nome: "Desconhecido",
        dados_basicos: {},
        status: {},
        habilidades: [],
        anotacoes: "",
        sistemas: {}
    };

    for (const bloco of blocos) {
        let txtLimpo = (bloco.texto || '').replace(/\[\d{2}\/\d{2}\/\d{4}.*?\].*?:/g, '');
        const linhas = txtLimpo.split('\n');
        
        let targetSystem = mapeamentoSistemas[bloco.titulo] || bloco.titulo;
        let isGeral = targetSystem.toLowerCase().includes('geral') || targetSystem.toLowerCase().includes('ficha');
        
        // Se for só 1 bloco, tratamos como Geral
        if (blocos.length === 1) isGeral = true;

        let currentSystemText = '';

        for (let i = 0; i < linhas.length; i++) {
            let linhaOriginal = linhas[i];
            let linhaTrimmed = linhaOriginal.trim();
            
            // Para as chaves de status, removemos emojis do INÍCIO da linha apenas para a verificação,
            // mas preservamos a linha original para salvar no texto.
            let linhaParaRegex = linhaTrimmed.replace(/^[^a-zA-Z0-9À-ú\[\]]+/, '').trim();

            const match = linhaParaRegex.match(/^([^:]{1,30}):\s*(.*)$/);

            if (match && isGeral) {
                let chave = match[1].replace(/\*/g, '').trim(); 
                let valor = match[2].trim();
                const chaveLow = chave.toLowerCase();

                if (chaveLow === 'nome' || chaveLow === 'ΝϴᎷᎬ') {
                    ficha.nome = valor || "Desconhecido";
                } else if (['hp', 'mana', 'força', 'velocidade', 'resistência', 'reação', 'tier'].includes(chaveLow) || chaveLow.includes('haki')) {
                    ficha.status[chave] = valor;
                } else {
                    ficha.dados_basicos[chave] = valor;
                }
            } else {
                // Adicionamos a linha ORIGINAL (com emojis e espaços)
                currentSystemText += linhaOriginal + '\n';
            }
        }

        if (isGeral) {
            ficha.anotacoes += currentSystemText;
        } else {
            // Adiciona no sistema correspondente sem destruir a formatação
            if (!ficha.sistemas[targetSystem]) ficha.sistemas[targetSystem] = '';
            // Se já tiver texto, não precisa adicionar quebra extra a menos que queira, 
            // mas aqui preservamos o texto original.
            ficha.sistemas[targetSystem] += currentSystemText;
        }
    }

    return ficha;
}

module.exports = {
    extrairFicha
};
