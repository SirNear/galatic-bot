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
	
	await page.waitForSelector('[placeholder="Pesquisar no Messenger"]')
	console.log('barra de pesquisa encontrada')
	await page.click('[placeholder="Pesquisar no Messenger"]')
	console.log('cliquei na barra de pesquisa')

	await page.type('[placeholder="Pesquisar no Messenger"]', args[0])
	await page.waitForSelector(`[id="${args[0]}"]`)
	console.log('encontrei as pesquisas')

	 const grupos = await page.evaluate(() => {
	        const gruposElementos = Array.from(document.querySelectorAll(`[id="${args[0]}"]`)).map(el => el.innerText);
	        return gruposElementos;
     	 });

	await page.waitForSelector(`[role="grid"]`)
	let element = page.$(`[role="row"]`)
	let textSearched = page.$('[class="x193iq5w xeuugli x13faqbe x1vvkbs xt0psk2 x1xmvt09 x1nxh6w3 x1fcty0u xi81zsa xq9mrsl"]')
	let value = await page.evaluate(el => el.textContent, element)

	const select = new StringSelectMenuBuilder()
			.setCustomId('encontrados')
			.setPlaceholder('Selecione um dos grupos para ver as mensagens correspondentes!')

	     grupos.forEach((grupo, index) => {
	        selectMenu.addOption({
	          label: grupo,
	          value: String(index),
	          description: value,
	        });
	      });

	

 	
	// Aguardar um tempo para a mensagem ser enviada
	await page.waitForTimeout(2000000);

	await browser.close();

	}
	
	// Executar a função principal
	sendCommandArgument();
	
	
	}
	}
