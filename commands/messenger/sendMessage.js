const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder, Discord } = require('discord.js');
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
  await page.goto('https://www.facebook.com/groups/atrevimentorpg?locale=pt_BR', {waitUntil: 'load', timeout: 0});

	
	// Fazer login	
	await page.type('#email', 'offhenriquebj@gmail.com');
	console.log('email digitado')
	
	await page.type('#pass', 'hb205266@facebook');
	console.log('senha digitada')
	
	await page.waitForSelector('#u_0_5_Sy', { visible: true });
	await page.click('#u_0_5_Sy');
	console.log('logado no messenger')

 
	// Aguardar o carregamento da página
	await page.waitForNavigation();
	console.log('pagina carregada')

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
	
	await page.waitForSelector('div > .html-div xdj266r xat24cr xexx8yu xyri2b x18d9i69 x1c1uobl x6s0dn4 x78zum5 xl56j7k x14ayic xwyz465 x1e0frkt')
	console.log('barra de pesquisa encontrada')
	await page.click('div > .html-div xdj266r xat24cr xexx8yu xyri2b x18d9i69 x1c1uobl x6s0dn4 x78zum5 xl56j7k x14ayic xwyz465 x1e0frkt')
	console.log('cliquei na barra de pesquisa')

	let chatNumber = {}
	let contador = 1
	
	await page.type('[placeholder="Pesquisar neste grupo"]', args[0])
	await page.keyboard.press('Enter')
	console.log('encontrei as pesquisas')

	const posts = [ "post1 texto", "post2 texto", ... ];
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
	
	}
	}
