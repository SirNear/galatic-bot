const ActivityType = require('discord.js')

module.exports = class {

	constructor(client) {
		this.client = client
	}

	async run() {

	async function sendCommandArgument() {
	  const browser = await puppeteer.launch({
	    args: ['--no-sandbox'],
	  });
	  const page = await browser.newPage();
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

		const monitorarElementos = async () => {
			try {
			   const mensagens = await page.$$eval('[aria-label="Mensagens na conversa com título Adms atrevidos"]', elementos => {
			      const mensagensEncontradas = [];
			      elementos.forEach(elemento => {
			          const texto = elemento.textContent;
			         if (texto.includes('g!')) {
			            console.log('encontrei uma mensagem com o comando')
			         }
			         
			      })
			   })

				setTimeout(monitorarElementos, 5000);
				
			}catch (error) {
    			  console.error('Erro ao monitorar elementos:', error);
    			}
			
		} 
		
		monitorarElementos();
	}

		
		this.client.owner = await this.client.users.fetch("395788326835322882")

		console.log([
			`Logado em ${this.client.user.tag}`,
			`${this.client.commands.size} comandos carregados!`,
		].join('\n'));
		
		let status = [ 	
			{name: `Pó de café na pia`, type: ActivityType.Playing},
			{name: 'Me mencione para saber mais sobre mim!', type: ActivityType.Playing},
			{name: `${this.client.guilds.size} universos diferentes!`, type: ActivityType.Watching},
			{name: 'Observou bugs? Tem sugestões ou dúvidas? Envie uma DM ao meu criador: Near#7447', type: ActivityType.Playing},
			{name: 'Servidor de suporte em andamento.', type: ActivityType.Playing}
		]
		
		setInterval(() => {
			let randomStatus = status[Math.floor(Math.random() * status.length)]
			this.client.user.setActivity(randomStatus, {type: randomStatus} )
		}, 10000)
		
	}
  
};
