const Translate = require('google-translate-api');

async function translateWord(word, sourceLang, targetLang) {
  try {
    const result = await translate(word, { from: sourceLang, to: targetLang });
    return result.text;
  } catch (error) {
    console.error(error);
  }
}

const word = 'hello';
const sourceLang = 'en';
const targetLang = 'pt';

translateWord(word, sourceLang, targetLang)
  .then(translatedWord => console.log(translatedWord))
  .catch(error => console.error(error));


module.exports = class translate {
  construtor(client) {
    this.client = client;
  
  }
}
