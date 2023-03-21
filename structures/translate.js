const translate = require('google-translate-api');

async function translateWord(word, sourceLang, targetLang) {
  try {
    const result = await translate(word, { from: sourceLang, to: targetLang });
    return result.text;
  } catch (error) {
    console.error(error);
  }
}

async function translateWord(word, sourceLang, targetLang) {
  try {
    const result = await translate(word, { from: sourceLang, to: targetLang });
    return result.text;
  } catch (error) {
    console.error(error);
  }
}


module.exports = class translate {
  constructor(client) {
    this.client = client;
    this.instance = {
      translateWord: translateWord
    }
  }
}
