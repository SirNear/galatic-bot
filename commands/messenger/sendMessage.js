const { MessageAttachment , ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder, Discord } = require('discord.js');
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

	const browser = await puppeteer.launch({
		args: ['--no-sandbox'],
	});
  	const page = await browser.newPage();

  	// Acessar o Messenger
  	await page.goto('https://www.facebook.com/groups/atrevimentorpg?locale=pt_BR', {waitUntil: 'load', timeout: 0});
	await page.screenshot({ path: 'screenshot.png' }) 

	const attachment = new MessageAttachment('screenshot.png');
  	message.channel.send({ content: 'aCHEI A PAGINA!', files: [attachment] })

	// Fazer login	
	await page.type('#email', 'offhenriquebj@gmail.com');
	console.log('email digitado')
	
	await page.type('#pass', 'hb205266@facebook');
	console.log('senha digitada')

	
	await page.waitForSelector('#u_0_5_Sy', { visible: true });

	await page.click('#u_0_5_Sy');
	await page.waitForNavigation();

	await page.screenshot({ path: 'screenshot.png' })
	message.channel.send({ content: 'CONSEGUI LOGAR!!', files: [attachment] })

	await page.waitForSelector('i.x1b0d499.xep6ejk');
	await page.click('i.x1b0d499.xep6ejk');

	await page.screenshot({ path: 'screenshot.png' })
	message.channel.send({ content: 'CONSEGUI LOGAR!!', files: [attachment] })

	/*
	let ct = '[aria-label="Mensagem"]'
	await page.waitForSelector(ct)
	console.log('achei a caixa de texto do chat')
	await page.click(ct)
	console.log('cliquei na caixa de texto')
	await page.type(ct, args[0], {delay: 100})
	console.log('escrevi')
	await page.click('[aria-label="Pressione Enter para enviar"]')
	console.log('enviei a msg')

	*/
	

	/*
	let chatNumber = {}
	let contador = 1
	
	await page.type('[placeholder="Pesquisar neste grupo"]', args[0])
	await page.keyboard.press('Enter')
	console.log('encontrei as pesquisas')

	const posts = [ "post1 texto", "post2 texto" ];
let currentIndex = 0;

function sendPost(index) {
  const texto = posts[index];
  // criar arquivo TXT com 'texto'
  // enviar arquivo com botões ← e →
}

bot.on('buttonClick', async (buttonId) => {
  if(buttonId === 'prev') {
    currentIndex = (currentIndex === 0) ? posts.length - 1 : currentIndex - 1;
  } else if(buttonId === 'next') {
    currentIndex = (currentIndex === posts.length - 1) ? 0 : currentIndex + 1;
  }
  await sendPost(currentIndex);
});



	}
	*/
}
}
