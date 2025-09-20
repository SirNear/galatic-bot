// TODO: TESTAR SE ELE ESTÁ CONSEGUINDO ENCONTRAR O CÓDIGO NO EMAIL. ACONTECE QUE O FACEBOOK NÃO ESTÁ ENVIANDO, O DOWNDETECTOR DETECTOU PROBLEMAS NO LOGIN.

const { MessageAttachment, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder, Discord } = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js');
const puppeteer = require('puppeteer');
let Imap = require("node-imap");
let inspect = require("util").inspect;

module.exports = class sendMessage extends Command {
	constructor(client) {
		super(client, {
			name: "sendMessage",
			category: "messenger",
			aliases: ['sm'],
			UserPermission: [""],
			clientPermission: null,
			OnlyDevs: true
		})
	}
  
async run({ message, args, client, server}) {

	//TODO: LER EMAIL E CHECAR CREDENCIAIS DO FACEBOOK
	
    // Configuração do IMAP para ler e-mails
    let imap = new Imap({
      user: "henrivlyt@gmail.com",
      password: "hoea lfev jswl uaud",
      host: "imap.gmail.com",
      port: 993,
      tls: true
    });

    // Função para abrir a caixa de entrada
    function openInbox(cb) {
      imap.openBox("INBOX", true, cb);
    }

    // Função para validar se o texto é imprimível
    function isPrintable(str) {
      return /^[\x20-\x7E\s]*$/.test(str);
    }

    // Função para pegar o código de verificação do e-mail
    async function getEmailVerificationCode() {
      return new Promise((resolve, reject) => {
        imap.once("ready", function () {
          openInbox(function (err, box) {
            if (err) return reject(err);

            if (!box.messages || box.messages.total === 0) {
              imap.end();
              return reject(new Error('INBOX vazia'));
            }

            const seq = box.messages.total;
            console.log(`Buscando mensagem seq: ${seq}`);

            // Pega somente o cabeçalho da última mensagem
            let f = imap.seq.fetch(`${seq}:${seq}`, {
              bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
              struct: false
            });

            f.on("message", function (msg, seqno) {
              console.log(`Message #${seqno}`);
              let buffer = "";
              msg.on("body", function (stream, info) {
                stream.on("data", function (chunk) {
                  buffer += chunk.toString("utf8");
                });
                stream.once("end", function () {
                  try {
                    const headers = Imap.parseHeader(buffer || "");
                    // parseHeader retorna arrays para cada campo
                    const rawSubject = (headers && headers.subject && headers.subject[0]) || "";
                    console.log(`Raw subject: ${rawSubject}`);
                    if (!rawSubject) {
                      return reject(new Error('Subject não encontrado na mensagem'));
                    }
                    // Pega o primeiro termo do assunto como código
                    const verificationCode = rawSubject.split(/\s+/)[0];
                    console.log("Código de verificação encontrado:", verificationCode);
                    resolve(verificationCode);
                  } catch (e) {
                    reject(e);
                  }
                });
              });
            });

            f.once("error", function (err) {
              reject(err);
            });

            f.once("end", function () {
              // encerra conexão após fetch
              imap.end();
            });
          });
        });

        imap.once("error", function (err) {
          reject(err);
        });

        imap.once("end", function () {
          console.log("Connection ended");
        });

        imap.connect();
      });
    }

    // Inicia o Puppeteer
    const browser = await puppeteer.launch({
      headless: true,  // Isso garante que o navegador será executado sem interface gráfica
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    // Define timeout de navegação (0 = desativa)
    await page.setDefaultNavigationTimeout(0);

    // Intercepta requests para abortar o webpack HMR que quebra o 'networkidle0'
    await page.setRequestInterception(true);
    page.on('request', req => {
      // desabilita webpack HMR, que quebra o 'networkidle0'
      if (req.url().endsWith('/__webpack_hmr')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.mouse.move(0, 0);  // Mover o mouse para o canto superior esquerdo da tela
    await page.mouse.click(100, 100);  // Clique em uma posição da tela

    // Acessar a página (exemplo de página do Facebook)
    await page.goto('https://www.facebook.com/groups/atrevimentorpg?locale=pt_BR', { waitUntil: 'load', timeout: 0 });
    await page.screenshot({ path: 'paginamain.png' });

    const printLogin = './paginamain.png';
    message.channel.send({ content: 'aCHEI A PAGINA!', files: [printLogin] });

    // Fazer login
    await page.type('input[name="email"]', 'henrivlyt@gmail.com', { delay: 500 });
    console.log('email digitado');
    await page.keyboard.press('Tab');
    await page.type('input[name="pass"]', 'henrique25', { delay: 500 });
    console.log('senha digitada');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

	await page.waitForNavigation({ waitUntil: 'networkidle0' });

    // Verificar se a URL contém "auth_platform" (caso de autenticação via e-mail)
    const currentUrl = await page.url();
    if (currentUrl.includes('auth_platform')) {
		if(currentUrl.includes('auth_platform/afad')) {
			await page.keyboard.press('Tab');  
			await page.keyboard.press('Enter');

			await page.screenshot({ path: 'authAfad.png' });
			message.channel.send({ content: `Outro metodo de auth man: ${currentUrl}`, files: ['./authAfad.png'] });

			console.log('OUTRO LOGIN DE AUTH')
			await page.type('input[name="email"]', 'henrivlyt@gmail.com', { delay: 500 });
			console.log('email digitado');
			await page.keyboard.press('Tab');
			await page.type('input[name="pass"]', 'henrique25', { delay: 500 });
			console.log('senha digitada');
			await page.keyboard.press('Tab');
			await page.keyboard.press('Tab');
			await page.keyboard.press('Enter');

			await page.screenshot({ path: 'otherAuth.png' });
			message.channel.send({ content: `Outro metodo de auth man: ${currentUrl}`, files: ['./otherAuth.png'] });

			await page.waitForNavigation({ waitUntil: 'networkidle0' });

			await page.screenshot({ path: 'poslogin2.png' });
			message.channel.send({ content: 've se ta logado ai chefe', files: ['./poslogin2.png'] });

			// buscando centro da pagina
			const { width, height } = await page.viewport();

			const centerX = width / 2;
			const centerY = height / 2;

			await page.mouse.click(centerX, centerY);

			await page.keyboard.press('Tab');
			await page.keyboard.press('Enter');

			await page.waitForSelector('input[value="EMAIL"]');
			await page.click('input[value="EMAIL"]');

			await page.screenshot({ path: 'challengeclick.png' });
			message.channel.send({ content: 'cliquei no challenge', files: ['./challengeclick.png'] });

			await page.keyboard.press('Tab');
			await page.keyboard.press('Enter');

			await page.screenshot({ path: 'postChallenge.png' });
			message.channel.send({ content: 've se ta logado ai chefe', files: ['./postChallenge.png'] });
		}

		console.log("URL contém 'auth_platform', acessando o e-mail para pegar o código...");
		await page.screenshot({ path: 'codigoauth.png' });
		message.channel.send({ content: 'URL contém "auth_platform", acessando o e-mail para pegar o código...', files: ['./codigoauth.png'] });

		setTimeout(async () => {
			try {
				// Pega o código de verificação do e-mail
				const verificationCode = await getEmailVerificationCode();
				console.log("Código de verificação obtido:", verificationCode);

				// Selecionar o campo de email e preenchê-lo com o código de verificação

				await page.waitForSelector('input[name="email"]');
				await page.type('input[name="email"]', `${verificationCode}`, { delay: 500 } );  // digita o codigo

				await page.screenshot({ path: 'codigoautenticacaomonitoria.png' });
				message.channel.send({ content: 'codigo preenchido', files: ['./codigoautenticacaomonitoria.png'] });

				await page.keyboard.press('Tab');  // Pressiona Tab para ir para o próximo campo
				await page.keyboard.press('Tab');  // Pressiona Tab novamente para ir para o campo de senha
				await page.keyboard.press('Tab');  // Pressiona Tab novamente para ir para o botão de login
				await page.keyboard.press('Enter');

				// Espera a navegação completar
				console.log("logado?");
				await page.screenshot({ path: 'paginamain2.png' });
				message.channel.send({ content: 've se ta logado ai chefe', files: ['./paginamain2.png'] });

				setTimeout(async () => {
				  await page.screenshot({ path: 'resultadofinal.png' });
				  message.channel.send({ content: 'olha como tá chefe', files: ['./resultadofinal.png'] });

          await page.keyboard.press('Tab');
          await page.keyboard.press('Enter');
          await page.screenshot({ path: 'final.png' });
          message.channel.send({ content: 'final', files: ['./final.png'] });
			
				}, 10000)
			} catch (error) {
				console.log("Erro ao obter o código do e-mail:", error);
				}

		}, 5000) // Espera 5 segundos antes de tentar obter o código
	} else {
		console.log("URL não contém 'auth_platform'.");
		if(currentUrl.includes('two_step_verification')) {
			console.log("BOT CAPTCHA SOLICITADO");
			await page.waitForNavigation({waitUntil: "domcontentloaded"});
			await page.keyboard.type('Tab')
			await page.screenshot({ path: 'botcaptcha.png' });
			message.channel.send({ content: 'BOT CAPTCHA SOLICITADO', files: ['./botcaptcha.png'] });
		}else {
			console.log("URL não contém 'two_step_verification'.");
			await page.waitForNavigation({ waitUntil: 'networkidle0' });
			await page.screenshot({ path: 'botnocaptcha.png' });
			message.channel.send({ content: `${currentUrl}`, files: ['./botnocaptcha.png'] });
				}
    }

    // Fecha o navegador
  }
};

