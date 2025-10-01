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
  const MAX_LENGTH = 4000;
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  // Alterado para gemini-pro para maior disponibilidade em tarefas de texto
  const prompt = `Resuma a seguinte descrição de habilidade para um RPG de mesa. Mantenha os pontos-chave, mecânicas e efeitos importantes. O resumo deve ser formatado para o Discord. Texto original: "${text}"`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const summary = response.text();

  if (summary.length <= MAX_LENGTH) {
    return [summary];
  }

  const pages = [];
  let remainingText = summary;

  while (remainingText.length > MAX_LENGTH) {
    const chunk = remainingText.substring(0, MAX_LENGTH);
    const lastPeriodIndex = chunk.lastIndexOf(".");

    const cutIndex = lastPeriodIndex !== -1 ? lastPeriodIndex + 1 : MAX_LENGTH;

    pages.push(remainingText.substring(0, cutIndex));
    remainingText = remainingText.substring(cutIndex).trim();
  }

  if (remainingText.length > 0) {
    pages.push(remainingText);
  }

  return pages;
}
/* #endregion */

/* #region  DESCREVER NOME E UNIVERSO DA APARÊNCIA */
async function describeImage(imageBuffer, mimeType) {
  // O modelo 'gemini-1.5-flash' é multimodal e ótimo para essa tarefa.
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt =
    "Identifique o personagem e o universo de origem desta imagem. Responda apenas no formato 'Nome do Personagem, Universo de Origem'. Por exemplo: 'Goku, Dragon Ball Z'. Se não souber, responda 'Desconhecido'.";

  const imagePart = fileToGenerativePart(imageBuffer, mimeType);

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  return response.text();
}
/* #endregion */

async function resumirRP(text) {
  const MAX_LENGTH = 4000;
  // Corrigido o nome do modelo para uma versão existente e adequada.
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Resuma as seguintes mensagens de um RP para um RPG textual. Mantenha os pontos-chave, mecânicas e efeitos importantes, como também especificando personagens. Não divida em tópicos, faça em texto corrido com ordem cronológica dos fatos. Algumas partes são contra-narrações que podem cancelar fatos, observe bem os fatos e acontecimentos. Ao introduzir alguem, resuma quem é. Ao introduzir um poder, resuma sua funcionalidade e efeito. Tente resumir o máximo possível. Texto original: "${text}"`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const summary = response.text();

  if (summary.length <= MAX_LENGTH) {
    return [summary];
  }

  const pages = [];
  let remainingText = summary;

  while (remainingText.length > MAX_LENGTH) {
    const chunk = remainingText.substring(0, MAX_LENGTH);
    const lastPeriodIndex = chunk.lastIndexOf(".");
    const cutIndex = lastPeriodIndex !== -1 ? lastPeriodIndex + 1 : MAX_LENGTH;
    pages.push(remainingText.substring(0, cutIndex));
    remainingText = remainingText.substring(cutIndex).trim();
  }

  if (remainingText.length > 0) {
    pages.push(remainingText);
  }

  return pages;
}

async function summarizeSummary(text) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = `Faça um resumo do resumo a seguir, extraindo apenas os pontos mais cruciais e apresentando-os de forma clara e concisa. O objetivo é criar uma versão ainda mais curta e direta do texto. Texto original: "${text}"`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const summary = response.text();

  // Retorna como array para manter a consistência, embora seja improvável que passe de 4k caracteres.
  return [summary];
}

module.exports = { summarizeText, describeImage, resumirRP, summarizeSummary };
