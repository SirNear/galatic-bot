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
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  // Acessar o Messenger
  await page.goto('https://www.messenger.com', {waitUntil: 'load', timeout: 0});

  // Fazer login
  await page.click('div')
  await page.type('#email', 'offhenriquebj@gmail.com');
		console.log('email digitado')
  await page.type('#pass', 'henriquebj25');
	console.log('senha digitada')
  await page.waitForSelector('#loginbutton', { visible: true });
  await page.click('#loginbutton');
	console.log('logado no messenger')

  // Aguardar o carregamento da página
  await page.waitForNavigation();

	/*
  // Localizar a conversa específica
const conversa = await page.$$('.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft')
	await page.waitForSelector(conversa)
		console.log('conversa localizada')
	await page.click(conversa)

 */


	await page.goto('https://www.facebook.com/t/5124318804265221/');
	console.log('entrei na conversa')
	
  const searchResultSelector = '#:r17f: [aria-label="Mensagem"]';
	console.log('caixa de texto selecionada')
  await page.waitForSelector(searchResultSelector);
  await page.click(searchResultSelector);
	  
  await page.keybord.type(args[0]);
  await page.keyboard.press('Enter');

  // Aguardar um tempo para a mensagem ser enviada
  await page.waitForTimeout(2000);
}

// Executar a função principal
sendCommandArgument();


  }
}
