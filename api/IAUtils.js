const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config.json');
const { registerUsage, sendLogIA } = require('./aiUsageManager');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || config.token);

async function gerarRespostaComFallback(prompt, contexto, options = {}) {
    // Priorizando modelos Flash para evitar 429 Limit: 0 na Free Tier
    const modelos = ["gemini-1.5-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
    const fullPrompt = `Contexto do RPG:\n${contexto}\n\nPergunta do Usuário: ${prompt}`;

    for (const nomeModelo of modelos) {
        try {
            const model = genAI.getGenerativeModel({ model: nomeModelo });
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            
            if (response.usageMetadata) {
                await registerUsage(response.usageMetadata).catch(console.error);
                
                if (options.client && options.userId) {
                    sendLogIA(options.client, {
                        userId: options.userId,
                        action: "Extração e Categorização de Ficha",
                        prompt: prompt,
                        response: response.text(),
                        model: nomeModelo
                    });
                }
            }
            
            return { text: response.text(), model: nomeModelo };
        } catch (error) {
            console.error(`Falha no modelo ${nomeModelo}:`, error.message);
            continue;
        }
    }
    throw new Error("Todos os modelos de IA falharam em responder.");
}

async function extrairSkillsPorIA(textoBruto, sistemaNome, interactionData = null) {
    if (!textoBruto || textoBruto.trim().length < 10) return [];
    
    const contexto = `Você é um Analista de Dados de RPG focado em fatiamento de texto.
O usuário enviou um texto contendo várias habilidades, itens, armas ou tópicos.
Sua tarefa é atuar como um "Separador Inteligente" (Smart Splitter):
1. Leia o texto e identifique onde termina um tópico/habilidade e começa outro.
2. Fatie o texto em pedaços, preservando 100% da formatação original (emojis, quebras de linha).
3. Atribua um 'titulo' para cada pedaço fatiado.
4. O conteúdo bruto fatiado deve ir para 'texto_bruto'.

Retorne EXCLUSIVAMENTE um JSON array no formato:
[
    {
        "titulo": "Nome da Seção",
        "texto_bruto": "Texto bruto exato..."
    }
]`;

    const prompt = `Fatie este texto do fórum '${sistemaNome}':\n\n${textoBruto}`;
    
    try {
        const resposta = await gerarRespostaComFallback(prompt, contexto, interactionData);
        let textoLimpo = resposta.text.trim();
        if (textoLimpo.startsWith('\`\`\`json')) {
            textoLimpo = textoLimpo.substring(7);
        } else if (textoLimpo.startsWith('\`\`\`')) {
            textoLimpo = textoLimpo.substring(3);
        }
        if (textoLimpo.endsWith('\`\`\`')) {
            textoLimpo = textoLimpo.slice(0, -3);
        }
        
        return JSON.parse(textoLimpo.trim());
    } catch (e) {
        console.error(`Erro ao fatiar tópicos do sistema ${sistemaNome}:`, e.message);
        // Fallback: Retorna tudo junto se der erro
        return [{
            titulo: sistemaNome,
            texto_bruto: textoBruto
        }];
    }
}

module.exports = { gerarRespostaComFallback, extrairSkillsPorIA };