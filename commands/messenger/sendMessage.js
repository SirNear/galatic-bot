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
  const conversationSelector = '#\:rk\: > div > div > div > div > div:nth-child(2) > div > div:nth-child(2) > div > div:nth-child(1) > a > div > div > div.x9f619.x1n2onr6.x1ja2u2z.x78zum5.x1iyjqo2.xs83m0k.xeuugli.x1qughib.x6s0dn4.x1a02dak.x1q0g3np.xdl72j9 > div > div > span > span > span';
  await page.waitForSelector(conversationSelector);
  await page.click(conversationSelector);

  // Aguardar o carregamento da conversa
  await page.waitForSelector('#:r3n: [class="xat24cr xdj266r"]');

  const messageInputSelector = '#:r3n: [class="xat24cr xdj266r"]';
  const commandMessage = args[0]

	await page.click('div')
  
  await page.type(messageInputSelector, commandMessage);
  await page.keyboard.press('Enter');

  // Aguardar um tempo para a mensagem ser enviada
  await page.waitForTimeout(2000);
}

// Executar a função principal
sendCommandArgument();


  }
}
