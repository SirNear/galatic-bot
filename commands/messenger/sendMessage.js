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

	let ct = '[aria-label="Mensagem"]'
	await page.waitForSelector(ct)
	console.log('achei a caixa de texto do chat')
	await page.click(ct)
	console.log('cliquei na caixa de texto')
	await page.type(ct, args[0], {delay: 100})
	console.log('escrevi')
	await page.click('[aria-label="Pressione Enter para enviar"]')
	console.log('enviei a msg')
	
	/*
	await page.waitForSelector('[placeholder="Pesquisar no Messenger"]')
	console.log('barra de pesquisa encontrada')
	await page.click('[placeholder="Pesquisar no Messenger"]')
	console.log('cliquei na barra de pesquisa')

	await page.type('[placeholder="Pesquisar no Messenger"]', args[0])
	await page.waitForSelector(`[id="${args[0]}"]`)
	console.log('encontrei as pesquisas')

	let contador = '0'
	let paginas = await page.waitForSelector('[role="row"]')
	paginas.forEach = contador++
	
	 console.log(`Encontrei ${contador} resultados`)

 	*/
 
	// Aguardar um tempo para a mensagem ser enviada
	await page.waitForTimeout(2000);

	await browser.close();

	}
	
	// Executar a função principal
	sendCommandArgument();
	
	
	}
	}
