const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config.json");
const { registerUsage, sendLogIA } = require("./aiUsageManager");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || config.token);

// Modelos modernos ordenados por disponibilidade, velocidade e cotas diárias
const RESUMO_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest"
];

/**
 * Executa geração de conteúdo com fallback automático entre múltiplos modelos da família Gemini.
 * Se o modelo principal estiver sofrendo alta demanda (503) ou rate limit (429), tenta o próximo imediatamente.
 */
async function generateContentWithFallback(contents) {
  let lastError = null;
  for (const modelName of RESUMO_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(contents);
      const response = await result.response;
      return { response, modelName };
    } catch (err) {
      console.warn(`[IA RESUMO] Falha no modelo ${modelName}: ${err.message}. Tentando próximo modelo...`);
      lastError = err;
      continue;
    }
  }
  throw lastError || new Error("Todos os modelos de IA falharam em responder.");
}

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
async function summarizeText(text, options = {}) {
  const MAX_LENGTH = 4000;
  const prompt = `Resuma a seguinte descrição de habilidade para um RPG de mesa. Mantenha os pontos-chave, mecânicas e efeitos importantes. O resumo deve ser formatado para o Discord. Texto original: "${text}"`;

  const { response, modelName } = await generateContentWithFallback(prompt);
  if (response.usageMetadata) await registerUsage(response.usageMetadata, modelName, "Resumo de Texto").catch(console.error);
  const summary = response.text();

  if (options.client && options.userId) {
      sendLogIA(options.client, {
          userId: options.userId,
          action: "Resumo de Texto",
          prompt: prompt,
          response: summary,
          usage: response.usageMetadata,
          modelName: modelName
      });
  }

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
async function describeImage(imageBuffer, mimeType, options = {}) {
  const prompt =
    "Identifique o personagem e o universo de origem desta imagem. Responda apenas no formato 'Nome do Personagem, Universo de Origem'. Por exemplo: 'Goku, Dragon Ball Z'. Se não souber, responda 'Desconhecido'.";

  const imagePart = fileToGenerativePart(imageBuffer, mimeType);

  const { response, modelName } = await generateContentWithFallback([prompt, imagePart]);
  if (response.usageMetadata) await registerUsage(response.usageMetadata, modelName, "Descrição de Imagem").catch(console.error);
  const summary = response.text();

  if (options.client && options.userId) {
      sendLogIA(options.client, {
          userId: options.userId,
          action: "Descrição de Imagem",
          prompt: prompt,
          response: summary,
          usage: response.usageMetadata,
          attachments: ["Imagem (Buffer)"],
          modelName: modelName
      });
  }

  return summary;
}
/* #endregion */

async function resumirRP(text, options = {}) {
  const MAX_LENGTH = 4000;
  const prompt = `Resuma as seguintes mensagens de um RP para um RPG textual. Mantenha os pontos-chave, mecânicas e efeitos importantes, como também especificando personagens. Não divida em tópicos, faça em texto corrido com ordem cronológica dos fatos. Algumas partes são contra-narrações que podem cancelar fatos, observe bem os fatos e acontecimentos. Ao introduzir alguem, resuma quem é. Ao introduzir um poder, resuma sua funcionalidade e efeito. Tente resumir o máximo possível. Texto original: "${text}"`;

  const { response, modelName } = await generateContentWithFallback(prompt);
  if (response.usageMetadata) await registerUsage(response.usageMetadata, modelName, "Resumo de RP").catch(console.error);
  const summary = response.text();

  if (options.client && options.userId) {
      sendLogIA(options.client, {
          userId: options.userId,
          action: "Resumo de RP",
          prompt: prompt,
          response: summary,
          usage: response.usageMetadata,
          modelName: modelName
      });
  }

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

async function summarizeSummary(text, options = {}) {
  const prompt = `Faça um resumo do resumo a seguir, extraindo apenas os pontos mais cruciais e apresentando-os de forma clara e concisa. O objetivo é criar uma versão ainda mais curta e direta do texto. Texto original: "${text}"`;

  const { response, modelName } = await generateContentWithFallback(prompt);
  if (response.usageMetadata) await registerUsage(response.usageMetadata, modelName, "Resumo do Resumo").catch(console.error);
  const summary = response.text();

  if (options.client && options.userId) {
      sendLogIA(options.client, {
          userId: options.userId,
          action: "Resumo do Resumo",
          prompt: prompt,
          response: summary,
          usage: response.usageMetadata,
          modelName: modelName
      });
  }

  return [summary];
}

module.exports = { summarizeText, describeImage, resumirRP, summarizeSummary, RESUMO_MODELS };
