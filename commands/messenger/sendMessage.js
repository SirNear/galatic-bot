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
  await page.type('#email', 'offhenriquebj@gmail.com');
  await page.type('#pass', 'henriquebj25');
  await page.click('#loginbutton');

  // Aguardar o carregamento da página
  await page.waitForNavigation();

  // Localizar a conversa específica
  const conversationSelector = '#\:rk\: > div > div > div > div > div:nth-child(2) > div > div:nth-child(1) > div > div:nth-child(1)';
  await page.waitForSelector(conversationSelector);
  await page.click(conversationSelector);

  // Aguardar o carregamento da conversa
  await page.waitForSelector('div[aria-label="Mensagem"][contenteditable="true"]');

  // Enviar o comando com o argumento
  const commandPrefix = 'g!';
  const command = 'comando';
  const argument = args[0];

  const messageInputSelector = 'div[aria-label="Mensagem"][contenteditable="true"]';
  const commandMessage = args[0]
  
  await page.type(messageInputSelector, commandMessage);
  await page.keyboard.press('Enter');

  // Aguardar um tempo para a mensagem ser enviada
  await page.waitForTimeout(2000);

  // Fechar o navegador
  await browser.close();
}

// Executar a função principal
sendCommandArgument();


  }
}
