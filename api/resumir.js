const { GoogleGenerativeAI } = require("@google/generative-ai");

// IMPORTANTE: É altamente recomendável guardar sua chave de API em um local seguro (como um arquivo .env) e não diretamente no código.
// Exemplo: const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const genAI = new GoogleGenerativeAI("AIzaSyDY2mBBvly7fAEmYJmvfvr0Ozd7mR2XKR0");

async function summarizeText(text) {
  // O modelo "gemini-pro" pode estar obsoleto ou indisponível em algumas regiões.
  // "gemini-1.5-flash-latest" é uma alternativa moderna, rápida e eficiente.
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

  const prompt = `Resuma a seguinte descrição de habilidade para um RPG de mesa. Mantenha os pontos-chave, mecânicas e efeitos importantes. O resumo deve ter no máximo 4000 caracteres e ser formatado para o Discord. Texto original: "${text}"`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

module.exports = { summarizeText };
