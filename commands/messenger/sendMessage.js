const Discord = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')

module.exports = class sendMessage extends Command {
	constructor(client) {
		super(client, {
			name: "sendMessage",
			category: "messenger",
			aliases: ['sm'],
			UserPermission: [""],
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
async run({ message, args, client, server}) {

const puppeteer = require('puppeteer');

async function sendCommandArgument() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();

  // Acessar o Messenger
  await page.goto('https://www.messenger.com');

  // Fazer login
  await page.click('div')
  await page.type('#email', 'offhenriquebj@gmail.com');
  await page.type('#pass', 'henriquebj25');
  await page.waitForSelector('#loginbutton', { visible: true });
  await page.waitForTimeout(1000);
  await page.click('#loginbutton');

  // Aguardar o carregamento da página
  await page.waitForNavigation();

  // Localizar a conversa específica
await page.goto('https://www.messenger.com/t/5124318804265221')
await page.waitForTimeout(1000);
  // Aguardar o carregamento da conversa
  //await page.waitForSelector('#:r17f: [aria-label="Mensagem"]');
await page.click('div')

  const messageInputSelector = '#:r17f: [aria-label="Mensagem"]';
  const commandMessage = args[0]

await page.click('div')
  
  await page.type('#:r17f: [aria-label="Mensagem"]', args[0]);
  await page.keyboard.press('Enter');

  // Aguardar um tempo para a mensagem ser enviada
  await page.waitForTimeout(2000);
}

// Executar a função principal
sendCommandArgument();


  }
}
