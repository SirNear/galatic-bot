// TODO: TESTAR SE ELE ESTÁ CONSEGUINDO ENCONTRAR O CÓDIGO NO EMAIL. ACONTECE QUE O FACEBOOK NÃO ESTÁ ENVIANDO, O DOWNDETECTOR DETECTOU PROBLEMAS NO LOGIN.

const { MessageAttachment, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SlashCommandBuilder, Discord } = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js');
const puppeteer = require('puppeteer');
let Imap = require("node-imap");
let inspect = require("util").inspect;
const fs = require('fs').promises;
const path = require('path');

// Mover funções para cá, antes da classe
async function saveCookies(browser) {
    const page = (await browser.pages())[0];
    const cookies = await page.cookies();
    await fs.writeFile(
        path.join(__dirname, 'facebook-cookies.json'),
        JSON.stringify(cookies, null, 2)
    );
    console.log('Cookies salvos com sucesso!');
}

async function loadCookies(page) {
    try {
        const cookiesString = await fs.readFile(
            path.join(__dirname, 'facebook-cookies.json'),
            'utf8'
        );
        const cookies = JSON.parse(cookiesString);
        await page.setCookie(...cookies);
        console.log('Cookies carregados com sucesso!');
        return true;
    } catch (error) {
        console.log('Nenhum cookie salvo encontrado');
        return false;
    }
}

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
  
    async run({ message, args, client, server }) {
        // TODO: LER EMAIL E CHECAR CREDENCIAIS DO FACEBOOK
		
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

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(0);

        // Tenta carregar cookies salvos
        const hasCookies = await loadCookies(page);

        // Acessa a página
        await page.goto('https://www.facebook.com/groups/atrevimentorpg?locale=pt_BR', { 
            waitUntil: 'load', 
            timeout: 0 
        });

        // Verifica se está logado checando um elemento que só aparece quando não está
        const needsLogin = await page.$('input[name="email"]') !== null;

        if (needsLogin) {
            console.log('Precisamos fazer login...');
            // Fazer login
            await page.type('input[name="email"]', 'henrivlyt@gmail.com', { delay: 500 });
            console.log('email digitado');
            await page.keyboard.press('Tab');
            await page.type('input[name="pass"]', 'henrique25', { delay: 500 });
            console.log('senha digitada');
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');
            await page.keyboard.press('Enter');

            // OTIMIZAÇÃO: Adicionado um seletor para mensagens de erro para evitar timeout.
            await page.waitForFunction(
                () => document.querySelector('div[aria-label="Pesquisar"]') ||
                      document.querySelector('div[role="alert"]') || // Checa por mensagens de erro
                      window.location.href.includes('checkpoint') ||
                      window.location.href.includes('auth_platform') ||
                      window.location.href.includes('two_step_verification'),
                { timeout: 60000 } // Aumenta o timeout para 60s para dar tempo de carregar
            );

            // Checa se o login falhou
            const loginError = await page.$('div[role="alert"]');
            if (loginError) {
                const errorText = await page.evaluate(el => el.textContent, loginError);
                await page.screenshot({ path: 'login_error.png' });
                message.channel.send({ content: `Erro de login detectado: ${errorText}`, files: ['./login_error.png'] });
                await browser.close();
                return; // Termina a execução
            }

            // Salvar cookies após login bem-sucedido
            try {
                await saveCookies(browser);
            } catch (err) {
                console.error('Erro ao salvar cookies:', err);
            }

            // Verificar se a URL contém "auth_platform" (caso de autenticação via e-mail)
            const currentUrl = await page.url();
            if (currentUrl.includes('auth_platform')) {
				if(currentUrl.includes('auth_platform/afad')) {
					await page.keyboard.press('Tab');  
					await page.keyboard.press('Enter');

          await new Promise(resolve => setTimeout(resolve, 10000));
					await page.screenshot({ path: 'authAfad.png' });
					message.channel.send({ content: `Outro metodo de auth man: ${currentUrl}`, files: ['./authAfad.png'] });

          await new Promise(resolve => setTimeout(resolve, 10000));
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

                try {
                    // Espera 20 segundos para o e-mail chegar
                    await new Promise(resolve => setTimeout(resolve, 20000));

                    // Pega o código de verificação do e-mail
                    const verificationCode = await getEmailVerificationCode();
                    console.log("Código de verificação obtido:", verificationCode);

                    // Selecionar o campo de email e preenchê-lo com o código de verificação
                    await page.waitForSelector('input[name="email"]');
                    await page.type('input[name="email"]', `${verificationCode}`, { delay: 500 }); // digita o codigo

                    await page.screenshot({ path: 'codigoautenticacaomonitoria.png' });
                    message.channel.send({ content: 'codigo preenchido', files: ['./codigoautenticacaomonitoria.png'] });

                    await page.keyboard.press('Tab'); // Pressiona Tab para ir para o próximo campo
                    await page.keyboard.press('Tab'); // Pressiona Tab novamente para ir para o campo de senha
                    await page.keyboard.press('Tab'); // Pressiona Tab novamente para ir para o botão de login
                    await page.keyboard.press('Enter');

                    // Espera a navegação completar
                    console.log("logado?");
                    await page.screenshot({ path: 'paginamain2.png' });
                    message.channel.send({ content: 've se ta logado ai chefe', files: ['./paginamain2.png'] });

                        // Salvar cookies após autenticação completa
                    try {
                        await saveCookies(browser);
                    } catch (err) {
                        console.error('Erro ao salvar cookies após 2FA:', err);
                    }

                    // Espera mais 10 segundos
                    await new Promise(resolve => setTimeout(resolve, 10000));

                    await page.screenshot({ path: 'resultadofinal.png' });
                    message.channel.send({ content: 'olha como tá chefe', files: ['./resultadofinal.png'] });

                    await page.keyboard.press('Tab');
                    await page.keyboard.press('Tab');
                    await page.keyboard.press('Tab');
                    await page.keyboard.press('Tab');
                    await page.keyboard.press('Tab');
                    await page.keyboard.press('Tab');
                    await page.keyboard.press('Tab');
                    await page.keyboard.press('Enter');
                    await page.screenshot({ path: 'tireiatividade.png' });
                    message.channel.send({ content: 'final', files: ['./tireiatividade.png'] });

                    await page.waitForSelector('div[aria-label="Pesquisar"]');
                    await page.click('div[aria-label="Pesquisar"]');
                    console.log('cliquei na pesquisa');
                    await page.screenshot({ path: 'cliqueiPesquisa.png' });
                    message.channel.send({ content: 'cliquei na pesquisa', files: ['./cliqueiPesquisa.png'] });

                    await page.waitForSelector('input[placeholder="Pesquisar neste grupo"]')
                    await page.click('input[placeholder="Pesquisar neste grupo"]');
                    await page.type('input[placeholder="Pesquisar neste grupo"]', `${args[0]}`, { delay: 500 });
                    await page.screenshot({ path: 'pesquisando.png' });
                    message.channel.send({ content: 'pesquisando', files: ['./pesquisando.png'] });
                    await page.keyboard.press('Enter');
                    await new Promise(resolve => setTimeout(resolve, 10000));


                    if(currentUrl.includes('search')) {

                      await page.screenshot({ path: 'resultadoPesquisa.png' });
                      message.channel.send({ content: 'resultado da pesquisa', files: ['./resultadoPesquisa.png'] });

                    }else { 
                      console.log('Não consegui pesquisar') 
                      await new Promise(resolve => setTimeout(resolve, 10000));
                      await page.screenshot({ path: 'naopesquisa.png' });
                      message.channel.send({content: `Não consegui pesquisar. URL atual: ${currentUrl}`, files: ['./naopesquisa.png'] });
                    }




                } catch (error) {
                    console.log("Erro ao obter o código do e-mail:", error);
                    message.channel.send(`Erro ao obter o código do e-mail: ${error.message}`);
                }
			} else {
		console.log("URL não contém 'auth_platform'.");
		if(currentUrl.includes('two_step_verification')) {
			console.log("BOT CAPTCHA SOLICITADO");
			// OTIMIZAÇÃO: A espera por navegação aqui é redundante, a URL já foi verificada.
			await page.keyboard.type('Tab')
			await page.screenshot({ path: 'botcaptcha.png' });
			message.channel.send({ content: 'BOT CAPTCHA SOLICITADO', files: ['./botcaptcha.png'] });
		}else {
			console.log("URL não contém 'two_step_verification'.");
			// OTIMIZAÇÃO: Esta espera também é desnecessária e pode causar timeout.
			await page.screenshot({ path: 'botnocaptcha.png' });
			message.channel.send({ content: `${currentUrl}`, files: ['./botnocaptcha.png'] });
				}
        }
    } else {
        console.log('Já estava logado, pulando o processo de login.');
        await page.screenshot({ path: 'ja_logado.png' });
        message.channel.send({ content: 'Já estava logado!', files: ['./ja_logado.png'] });
    }
    } finally {
        await browser.close();
    }
    } // Fecha o método run
}; // Fecha a classe
