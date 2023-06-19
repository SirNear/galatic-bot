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
const conversa = '<span class="x1lliihq x1plvlek xryxfnj x1n2onr6 x193iq5w xeuugli x13faqbe x1vvkbs x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x x1xmvt09 x1nxh6w3 x1xlr1w8 xzsf02u x4zkp8e x676frb xq9mrsl" dir="auto" style="line-height: var(--base-line-clamp-line-height); --base-line-clamp-line-height: 17px;"><span class="x1lliihq x193iq5w x6ikm8r x10wlt62 xlyipyv xuxw1ft">Silas Skar: Fingir dormir</span></span>'
	await page.click(conversa)
  const searchResultSelector = '#:r17f: [aria-label="Mensagem"]';
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
