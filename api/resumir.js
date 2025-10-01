const { GoogleGenerativeAI } = require("@google/generative-ai");

//isso aqui é 100% IA viu

const genAI = new GoogleGenerativeAI("AIzaSyDnhSuH5QHC9HTJ31ew-gYq0MnGn--ZgMU");

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
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
  // Alterado para gemini-pro para maior disponibilidade em tarefas de texto
  const prompt = `Resuma a seguinte descrição de habilidade para um RPG de mesa. Mantenha os pontos-chave, mecânicas e efeitos importantes. O resumo deve ter no máximo 4000 caracteres e ser formatado para o Discord. Texto original: "${text}"`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}
/* #endregion */

/* #region  DESCREVER NOME E UNIVERSO DA APARÊNCIA */
async function describeImage(imageBuffer, mimeType) {
  // O modelo 'gemini-1.5-flash' é multimodal e ótimo para essa tarefa.
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

  const prompt =
    "Identifique o personagem e o universo de origem desta imagem. Responda apenas no formato 'Nome do Personagem, Universo de Origem'. Por exemplo: 'Goku, Dragon Ball Z'. Se não souber, responda 'Desconhecido'.";

  const imagePart = fileToGenerativePart(imageBuffer, mimeType);

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  return response.text();
}
/* #endregion */

async function resumirRP(text) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Resuma as seguintes mensagens de um RP para um RPG textual. Mantenha os pontos-chave, mecânicas e efeitos importantes, como também especificando personagens. O resumo deve ter no máximo 4000 caracteres e ser formatado para o Discord. Texto original: "${text}"`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

module.exports = { summarizeText, describeImage, resumirRP };
