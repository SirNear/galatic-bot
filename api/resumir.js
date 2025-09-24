const { GoogleGenerativeAI } = require("@google/generative-ai");

//isso aqui é 100% IA viu

// IMPORTANTE: É altamente recomendável guardar sua chave de API em um local seguro (como um arquivo .env) e não diretamente no código.
// Exemplo: const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const genAI = new GoogleGenerativeAI("AIzaSyDY2mBBvly7fAEmYJmvfvr0Ozd7mR2XKR0");

// Função para converter buffer de arquivo para o formato da API Gemini
function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  };
}

/* #region  RESUMIR TEXTO */
async function summarizeText(text) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Resuma a seguinte descrição de habilidade para um RPG de mesa. Mantenha os pontos-chave, mecânicas e efeitos importantes. O resumo deve ter no máximo 4000 caracteres e ser formatado para o Discord. Texto original: "${text}"`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}
/* #endregion */

/* #region  DESCREVER NOME E UNIVERSO DA APARÊNCIA */
async function describeImage(imageBuffer, mimeType) {
  // O modelo 'gemini-1.5-flash' é multimodal e ótimo para essa tarefa.
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt =
    "Identifique o personagem e o universo de origem desta imagem. Responda apenas no formato 'Nome do Personagem, Universo de Origem'. Por exemplo: 'Goku, Dragon Ball Z'. Se não souber, responda 'Desconhecido'.";

  const imagePart = fileToGenerativePart(imageBuffer, mimeType);

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  return response.text();
}
/* #endregion */

module.exports = { summarizeText, describeImage };
