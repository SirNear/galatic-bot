const Client = require('./GalaticClient')
const GatewayIntentBits = require('discord.js')
const config = require('./config')
const client = new Client({
   intents: ["MessageContent"],
   disableMentions: "everyone",
})
const puppeteer = require('puppeteer');

async function sendCommandArgument() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  // Acessar o Messenger
  await page.goto('https://www.facebook.com/messages/t/5124318804265221/', {waitUntil: 'load', timeout: 0});

	
	// Fazer login	
	await page.type('#email', 'offhenriquebj@gmail.com');
	console.log('email digitado')
	
	await page.type('#pass', 'henriquebj25');
	console.log('senha digitada')
	
	await page.waitForSelector('#loginbutton', { visible: true });
	await page.click('#loginbutton');
	console.log('logado no messenger')

 
	// Aguardar o carregamento da página
	await page.waitForNavigation();
	console.log('pagina carregada')

   const mensagens = await page.$$eval('[aria-label="Mensagens na conversa com título Adms atrevidos"]', elementos => {
      const mensagensEncontradas = [];
      elementos.forEach(elemento => {
          const texto = elemento.textContent;
         if (texto.includes('g!')) {
            console.log('encontrei uma mensagem com o comando')
         }
         
      })
   })
})

client.loadCommands('./commands')
client.loadEvents('./events')
client.login(config.token)
.then(() => console.log("Acordei"))
.catch((err) => console.log(`Erro ao iniciar: ${err.message}`));
