const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('../config.json');
const { registerUsage } = require('./aiUsageManager');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || config.token);

async function gerarRespostaComFallback(prompt, contexto) {
    // Ordem de fallback conforme solicitado
    const modelos = ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"];
    const fullPrompt = `Contexto do RPG:\n${contexto}\n\nPergunta do Usuário: ${prompt}`;

    for (const nomeModelo of modelos) {
        try {
            const model = genAI.getGenerativeModel({ model: nomeModelo });
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            
            if (response.usageMetadata) {
                await registerUsage(response.usageMetadata).catch(console.error);
            }
            
            return { text: response.text(), model: nomeModelo };
        } catch (error) {
            console.error(`Falha no modelo ${nomeModelo}:`, error.message);
            continue;
        }
    }
    throw new Error("Todos os modelos de IA falharam em responder.");
}

module.exports = { gerarRespostaComFallback };