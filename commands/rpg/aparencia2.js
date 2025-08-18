const { Discord, ModalBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, TextInputStyle, TextInputBuilder, fetchRecommendedShardCount } = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')
const { google } = require('googleapis');
const API_KEY = 'AIzaSyCulP8QuMiKOq5l1FvAbvHX7vjX1rWJUOQ';

module.exports = class aparencia2 extends Command {
	constructor(client) {
		super(client, {
			name: "aparencia",
			category: "rpg",
			aliases: ['aparencias', 'ap'],
			UserPermission: [""],
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
async run({ message, args, client, server}) {

    //? MENSAGEM DE NAVEGAÇÃO INICIAL - SELECIONAR BASE DE DADOS

    const embedNavegacao = new EmbedBuilder()
        .setColor('#02607aff')
        .setTitle('<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109>')
        .setDescription('Escolha o que você deseja conferir a disponibilidade')
        .setFooter({ text: 'Use os botões abaixo para navegar.' });

    const botaoSelecao = new ActionRowBuilder() 
        .addComponents(
            new ButtonBuilder()
                .setCustomId('ap')
                .setLabel('APARÊNCIA')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('verso')
                .setLabel('VERSO')
                .setStyle(ButtonStyle.Sucess),
        );

    const msgNavegacao = await message.reply({ embeds: [embedNavegacao], components: [botaoSelecao], ephemeral: true })

    //? COLETOR DOS BOTÕES

    const coletorBotoesNavegacao = msgNavegacao.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000 }); //15s de espera

    coletorBotoesNavegacao.on('collect', async i => {
        if (i.customId === 'ap') {
            
            // !FRONTEND DE APARENCIA
            const EmbedPagesAparencia = resultados.map((r, idx) => { 
                return new EmbedBuilder()
                .setColor('#212416ff')
                .setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | Resiltado ${idx + 1} de ${resultado.length}`)
                .setDescription('Envie no chat a aparência que deseja verificar.')
                .setFooter({ text: 'envie apenas o nome da aparência, sem emojis, acentuações ou outros caracteres.' });
            })

            const msgAparencia = await msgNavegacao.edit({ embeds: [embedAparencia], ephemeral: true})

            // contador editável para mostrar o tempo restante
            let remaining = 15; // segundos
            const contador = await message.reply({ content: `<a:AmongUs3D:1407001955699785831> | Você tem ${remaining} segundos para enviar a aparência...`, ephemeral: true});

            // inicia o intervalo que atualiza a mensagem a cada segundo
            const interval = setInterval(async () => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(interval);
                    contador.edit({ content: 'Tempo esgotado.' }).catch(() => {});
                } else {
                    contador.edit({ content: `<a:AmongUs3D:1407001955699785831> | Você tem ${remaining} segundos para responder...` }).catch(() => {});
                }
            }, 1000);

            // coletor para a resposta do usuário (15s)
            const coletorAparencia = msgAparencia.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 15000, max: 1 });
             
            coletorAparencia.on('collect', async m => {
                clearInterval(interval); // parar o contador
                contador.edit({ content: 'Resposta recebida.' }).catch(() => {});
                const nomeAparencia = m.content;
                const EmbedPagesAparencia = new EmbedBuilder()
                    .setColor('#7289da')
                    .setTitle('<:DNAstrand:1406986203278082109> | SISTEMA DE APARÊNCIAS | <:DNAstrand:1406986203278082109>');


                const sheets = google.sheets({ version: 'v4', auth: API_KEY });
                const SPREADSHEET_ID = '17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo'; // ID da planilha

                try {
                    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'A:d' });
                    const rows = res.data.values;

                    let resultados = [];

                    for (let i = 1; i < rows.length; i++) {
                        const [aparencia, universo, personagem, jogador] = rows[i];
                        if (aparencia.toLowerCase() === nomeAparencia.toLowerCase()) {
                            const aparenciaNome = await resultados.push({ aparencia });
                            const universoNome = await resultados.push({ universo });
                            const personagemNome = await resultados.push({ personagem });
                            const jogadorNome = await resultados.push({ jogador }); 
                        }
                    }

                    if (resultados.length == 1) {
                       EmbedPagesAparencia.setDescription(`Aparência em uso!`)
                       EmbedPagesAparencia.setColor('#8f0808ff')
                       EmbedPagesAparencia.addFields(
                            {name: '**APARÊNCIA**', value: aparenciaNome},
                            {name: '**UNIVERSO**', value: universoNome},
                            {name: '**PERSONAGEM**', value: personagemNome},
                            {name: '**JOGADOR**', value: jogadorNome}
                       );

                       msgNavegacao.edit({ embeds: [EmbedPagesAparencia] });

                       if(resultados.length > 1) {

                           const botaoNavegacao = new ButtonBuilder()
                               .setLabel('AVANÇAR')
                               .setStyle(ButtonStyle.Success)

                            msgNavegacao.edit({ embeds: [EmbedPagesAparencia], components: [botaoNavegacao] });

                            const coletorBotoesNavegacao = msgNavegacao.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000 }); //15s de espera

                            coletorBotoesNavegacao.on('collect', async i => {
                                if (i.customId === 'avancar') {
                                    page = (page - 1 + pages.length) % pages.length
                                    await msgNavegacao.edit({ embeds: [pages[page]], components: });
                                }
                            });

                       }

                    } else {

                        EmbedPagesAparencia.setColor('#00ff00')
                        EmbedPagesAparencia.setDescription('Aparência disponível!')
                        EmbedPagesAparencia.addFields(
                            {name: 'Deseja registrar a aparência?', value: 'Clique no botão para responder'}
                        );

                        const botaoSelecaoRegistro = new ActionRowBuilder() 
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('sim')
                                    .setLabel('SIM')
                                    .setStyle(ButtonStyle.Sucess),
                                new ButtonBuilder()
                                    .setCustomId('nao')
                                    .setLabel('NÃO')
                                    .setStyle(ButtonStyle.Danger),
                            );

                        msgNavegacao.edit({ embeds: [EmbedPagesAparencia], components: [botaoSelecaoRegistro] });

                    }
                } catch (err) {
                    console.error(err);
                    message.channel.send('Erro ao acessar a planilha.');
                }
                
 
                // TODO: BACKEND DE APARENCIA

                 const resultado = await verificarAparencia(nomeAparencia); // vc faz teu código ai de como verificar, isso aqui é exemplo
 
                 if (resultado) {

                    EmbedPagesAparencia.addFields(
                        setDescription('A aparência ${nomeAparencia} não está disponível! = ('),
                        setAuthor({ name: 'message.author.username', iconURL: `${message.author.iconURL}` }),
                        setFooter({ text: 'Você pode tentar negociar sua aparência!', iconURL: '' }),
                        addFields({ name: 'Dono Original', value: '{ coloca o código que pega o nome de quem é dono }' }),
                        addFields({ name: 'Universo', value: '{ coloca o código que pega o universo pertencente }' })
                    )

                     await message.reply({ content: `A aparência "${nomeAparencia}" está disponível!` });
                     
                    const coletorBotoesRegistro = msgNavegacao.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000 }); //15s de espera

                    coletorBotoesRegistro.on('collect', async i => {
                        if (i.customId === 'sim') {
                            // Lógica para registrar a aparência
                        } else if (i.customId === 'nao') {
                            msgNavegacao.edit({ content: '<a:cdfpatpat:1407135944456536186> | **REGISTRO CANCELADO!** Tudo bem, você pode reservar depois, se estiver disponível'});
                        }
                    });


                 } else {

                     await message.reply({ content: `A aparência "${nomeAparencia}" não foi encontrada.` });
                 }

             });
 
            coletorAparencia.on('end', (collected, reason) => {

                // garante que o intervalo foi limpo e mostra mensagem final se o tempo acabou
                clearInterval(interval);

                if (reason === 'time' && collected.size === 0) {
                    contador.edit({ content: 'Tempo esgotado.' }).catch(() => {});
                } //!IF TEMPO ESGOTADO

            }); //!COLETORAPARENCIA.END

        } else if (i.customId === 'verso') {
            /* 
            TODO: BACKEND DE VERSO
            */


        }
    })



  }
}
