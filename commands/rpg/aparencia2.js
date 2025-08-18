const { Discord, ModalBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, TextInputStyle, TextInputBuilder, fetchRecommendedShardCount } = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js')

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

    const coletorBotoes = msgNavegacao.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 15000 }); //15s de espera

    coletorBotoes.on('collect', async i => {
        if (i.customId === 'ap') {
            
            // !FRONTEND DE APARENCIA

            const embedAparencia = new EmbedBuilder()
                .setColor('#212416ff')
                .setTitle('<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109>')
                .setDescription('Envie no chat a aparência que deseja verificar.')
                .setFooter({ text: 'envie apenas o nome da aparência, sem emojis, acentuações ou outros caracteres.' });

            const msgAparencia = await message.reply({ embeds: [embedAparencia], ephemeral: true})

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
                const embedResultadoEsqueleto = new EmbedBuilder()
                    .setColor('#7289da')
                    .setTitle('<:DNAstrand:1406986203278082109> | SISTEMA DE APARÊNCIAS | <:DNAstrand:1406986203278082109>')




                    

                const button1 = new ButtonBuilder()
                    .setLabel('AVANÇAR')
                    .setStyle(ButtonStyle.Success)
                                
 
                // TODO: BACKEND DE APARENCIA

                 const resultado = await verificarAparencia(nomeAparencia); // vc faz teu código ai de como verificar, isso aqui é exemplo
 
                 if (resultado) {

                    embedResultadoEsqueleto.addFields(
                        setDescription('A aparência ${nomeAparencia} não está disponível! = ('),
                        setAuthor({ name: 'message.author.username', iconURL: `${message.author.iconURL}` }),
                        setFooter({ text: 'Você pode tentar negociar sua aparência!', iconURL: '' }),
                        addFields({ name: 'Dono Original', value: '{ coloca o código que pega o nome de quem é dono }' }),
                        addFields({ name: 'Universo', value: '{ coloca o código que pega o universo pertencente }' })
                    )

                     await message.reply({ content: `A aparência "${nomeAparencia}" está disponível!` });

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
