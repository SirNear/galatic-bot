const { Discord, ModalBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, TextInputStyle, TextInputBuilder, fetchRecommendedShardCount } = require('discord.js');
const Command = require('../../structures/Command.js');
const error = require('../../api/error.js')
const { google } = require('googleapis');
const ms = require('ms');
const API_KEY = 'AIzaSyCulP8QuMiKOq5l1FvAbvHX7vjX1rWJUOQ';
const sheets = google.sheets({ version: 'v4', auth: API_KEY });
const colors = require('../../api/colors.json')
const {iniciarContador, pararContador} = require('../../api/contador.js');


module.exports = class aparencia extends Command {
    constructor(client) {
        super(client, {
            name: "aparencia",
            category: "rpg",
            aliases: ['ap', 'aparencias', 'aparência', 'aparências', 'pesquisaraparencia', 'pesquisaraparência', 'pesquisarap', 'pesquisaraparecia', 'pesquisaraparencias', 'pesquisaraparências    ', 'pesquisaraparecias'],
            UserPermission: [""],
            clientPermission: null,
            OnlyDevs: false
        })
    }
  
async run({ message, args, client, server}) {

    // ----------------- MENSAGEM DE NAVEGAÇÃO INICIAL (FRONT) -----------------
    //? MENSAGEM DE NAVEGAÇÃO INICIAL - SELECIONAR BASE DE DADOS
    const embedNavegacao = new EmbedBuilder()
        .setColor('#02607a') // ← removed alpha (was '#ff0c0cff'/'#02607aff' etc)
        .setTitle('<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | <:DNAstrand:1406986203278082109>')
        .setDescription('Escolha o que você deseja conferir a disponibilidade')
        .setFooter({ text: 'Use os botões abaixo para navegar.' });

    // ----------------- BOTÕES DE SELEÇÃO -----------------
    const botaoSelecao = new ActionRowBuilder() 
        .addComponents(
            new ButtonBuilder()
                .setCustomId('botaoNavAparencia')
                .setLabel('APARÊNCIA')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('verso')
                .setLabel('VERSO')
                .setStyle(ButtonStyle.Success),
        );

    // MSG UNIVERSAL ABAIXO - APENAS EDITAR
    const msgNavegacao = await message.reply({ embeds: [embedNavegacao], components: [botaoSelecao] });

    // ----------------- COLETOR DOS BOTÕES PRINCIPAL -----------------
    //? COLETOR DOS BOTÕES
    const coletorBotoesNavegacao = msgNavegacao.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 }); //60s de espera

    coletorBotoesNavegacao.on('collect', async i => {
        if (i.customId === 'botaoNavAparencia') {

           // * -------------------------  EMBED APARENCIA -------------------------

            // título genérico do embed (mantendo front/estrutura)
            const embedAparencia = new EmbedBuilder()
                .setColor('#212416')
                .setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **`)
                .setDescription('Envie no chat a aparência que deseja verificar.')
                .setFooter({ text: 'envie apenas o nome da aparência, sem emojis, acentuações ou outros caracteres.' });
                      

            // * ------------------------- EMBED APARENCIA -------------------------

            // * ------------------------- RESPONDER À INTERAÇÃO E PREPARAR MENSAGEM -------------------------
            await i.update({ embeds: [embedAparencia], components: [] }).catch(() => {}); // responde à interação do botão
            const msgAparencia = msgNavegacao; // mensagem padrão para editar/mostrar embeds
            // ----------------- CONTADOR VISUAL (TEMPO PARA O USUÁRIO RESPONDER) -----------------
            // * ------------------------- contador de tempo para enviar a aparência -------------------------
            tempoRestante = 15
            let sujeito = 'enviar a aparência'
            let msgAlvo = msgNavegacao
            let {intervalo, contador} = await iniciarContador(tempoRestante, sujeito, msgAlvo, message);


            // ----------------- COLETOR DE MENSAGENS (APARENCIA) -----------------
            // * ------------------------- COLETOR DE MENSAGENS PARA APARENCIA -------------------------
            const coletorAparencia = msgAparencia.channel.createMessageCollector({ filter: (m) => m.author.id === message.author.id, time: 15000, max: 1 });
   
            coletorAparencia.on('collect', async m => {
                // * ------------------------- RESPOSTA RECEBIDA / LIMPAR INTERVALO -------------------------

            const nomeAparencia = await pararContador(m.content, intervalo, contador);

                // ? ------------------------- BUSCA NA PLANILHA -------------------------
                let resultados = [];
                // normaliza texto: remove acentos, caracteres extras, trim e lowercase
                function normalizeText(s) {
                  return String(s || '')
                    .normalize('NFD')                     // separa acentos
                    .replace(/[\u0300-\u036f]/g, '')      // remove acentos
                    .replace(/[^\w\s-]/g, '')             // remove chars especiais (mantém letras, números, underscore e espaços)
                    .replace(/\s+/g, ' ')                 // normaliza espaços múltiplos
                    .trim()
                    .toLowerCase();
                }

                const target = normalizeText(nomeAparencia);
                try {
                    const res = await sheets.spreadsheets.values.get({ spreadsheetId: '17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo', range: 'A:D' });
                    const rows = res.data.values || []; //array de dados das linhas da planilha

                    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
                      const row = rows[rowIndex]; // pega uma linha específica 
                      if (!row) continue; // pula linha vazia
                      const [aparencia, universo, personagem, jogador] = row; // cada atributo para cada célula
                      if (!aparencia) continue; // pula linha se não tiver aparencia

                      const aparNorm = normalizeText(aparencia);

                     if (aparNorm.length < 2) continue;

                      // aceitar tanto igualdade quanto correspondência parcial (includes)
                     if (
                       aparNorm === target ||
                       (aparNorm.length >= 3 && aparNorm.includes(target)) || // exige ao menos 3 chars para includes em aparência
                       (target.length >= 3 && target.includes(aparNorm))      // exige ao menos 3 chars no target para includes em aparência
                     ) {
                        resultados.push({ aparencia, universo, personagem, jogador });
                      }
                    }

                } catch (err) {
                    console.error(err);
                    await message.channel.send('Erro ao acessar a planilha.'); 
                    return; 
                }
                // ? ------------------------- BUSCA NA PLANILHA -------------------------

                // ----------------- MONTAR PAGES (CABEÇALHO PADRÃO) -----------------
                // cria cabeçalho padrão de pages (apenas título) e depois preenche conforme ifs
                const EmbedPagesAparencia = resultados.map((r, idx) => new EmbedBuilder()
                    .setTitle(`<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS ** | Resultado ${idx + 1} de ${resultados.length}`)
                    .setColor('#212416') // was '#212416ff'
                );

                let page = 0;

                // ----------------- CASO: 1 RESULTADO -----------------
                if (resultados.length === 1) { // se tiver uma aparencia
                    const found = resultados[0]; // pega o primeiro resultado

                    // preenche a única página existente
                    EmbedPagesAparencia[0]
                        .setDescription(`<:PepeHands:1407563136197984357> | Aparência em uso!`)
                        .setColor('#8f0808') // was '#8f0808ff'
                        .addFields(
                            {name: '**APARÊNCIA**', value: found.aparencia ?? '—'}, 
                            {name: '**UNIVERSO**', value: found.universo ?? '—' },
                            {name: '**PERSONAGEM**', value: found.personagem ?? '—' },
                            {name: '**JOGADOR**', value: found.jogador ?? '—' }
                        );

                    await msgNavegacao.edit({ embeds: [EmbedPagesAparencia[0]], components: [] }).catch(() => {});

                // ----------------- CASO: MULTIPLOS RESULTADOS (PAGINAÇÃO) -----------------
                } else if (resultados.length > 1) { // se tiver mais de uma aparencia

                    // preenche cada página mantendo o cabeçalho padrão
                    resultados.forEach((r, idx) => {
                        EmbedPagesAparencia[idx]
                            .setDescription(`<:patrickconcern:1407564230256758855> | Resultado ${idx + 1}`)
                            .addFields(
                                {name: '**APARÊNCIA**', value: r.aparencia ?? '—'},
                                {name: '**UNIVERSO**', value: r.universo ?? '—'},
                                {name: '**PERSONAGEM**', value: r.personagem ?? '—'},
                                {name: '**JOGADOR**', value: r.jogador ?? '—'}
                            )
                            .setFooter({ text: `Página ${idx + 1}/${EmbedPagesAparencia.length} - ⏩ = proxima página | ⏪ = página anterior | ❌ = cancelar busca` });
                    });

                    // botões de navegação (prev / next / close)
                    const navRow = (idx) => new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('prev_ap').setLabel('⏪').setStyle(ButtonStyle.Primary).setDisabled(idx === 0),
                        new ButtonBuilder().setCustomId('next_ap').setLabel('⏩').setStyle(ButtonStyle.Primary).setDisabled(idx === EmbedPagesAparencia.length - 1),
                        new ButtonBuilder().setCustomId('close_ap').setLabel('❌').setStyle(ButtonStyle.Danger)
                    );

                    await msgNavegacao.edit({ embeds: [EmbedPagesAparencia[page]], components: [navRow(page)] }).catch(() => {});

                    // collector para navegação (usa msgNavegacao)
                    const navCollector = msgNavegacao.createMessageComponentCollector({ filter: ii => ii.user.id === message.author.id, time: 60000 });
                    navCollector.on('collect', async ii => {
                        await ii.deferUpdate().catch(() => {});
                        if (ii.customId === 'prev_ap') {
                            page = Math.max(0, page - 1);
                            await msgNavegacao.edit({ embeds: [EmbedPagesAparencia[page]], components: [navRow(page)] }).catch(() => {});
                        } else if (ii.customId === 'next_ap') {
                            page = Math.min(EmbedPagesAparencia.length - 1, page + 1);
                            await msgNavegacao.edit({ embeds: [EmbedPagesAparencia[page]], components: [navRow(page)] }).catch(() => {});
                        } else if (ii.customId === 'close_ap') {
                            navCollector.stop('closed');
                            msgNavegacao.delete()
                            message.reply({ content: '<a:cdfpatpat:1407135944456536186> | **NAVEGAÇÃO FINALIZADA!**' }).catch(() => {});
                        }
                    });

                    navCollector.on('end', async () => {
                        // remove botões e limpa embeds ao finalizar a navegação
                        await msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
                    });

                // ----------------- CASO: NENHUM RESULTADO (OFERECE REGISTRO) -----------------
                } else {
                    // nenhum resultado — apresenta opção de registrar
                    const embedEmpty = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **')
                        .setDescription('Aparência disponível!')
                        .addFields({name: 'Deseja registrar a aparência?', value: 'Clique no botão para responder'});

                    const botaoSelecaoRegistro = new ActionRowBuilder() 
                        .addComponents(
                            new ButtonBuilder().setCustomId('sim_ap').setLabel('SIM').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('nao_ap').setLabel('NÃO').setStyle(ButtonStyle.Danger),
                        );

                    await msgNavegacao.edit({ embeds: [embedEmpty], components: [botaoSelecaoRegistro] }).catch(() => {});

                    // collector para registro (responder ao clique)
                    const coletorBotoesRegistro = msgNavegacao.createMessageComponentCollector({ filter: ii => ii.user.id === message.author.id, time: 15000 });
                    coletorBotoesRegistro.on('collect', async ii => {
                        await ii.deferUpdate().catch(() => {});
                        if (ii.customId === 'sim_ap') {
                            if(!row) {

                                let tempoRA = 15;
                                const contadorRA = await message.reply({ content: `<a:AmongUs3D:1407001955699785831> | Você tem ${tempoRA} segundos para enviar o verso...` });
                                const intervalRA = setInterval(() => {
                                    tempoRA--;
                                    if (tempoRA <= 0) {
                                        clearInterval(intervalRA);
                                        msgNavegacao.delete().catch(() => {});
                                        contadorRA.edit({ content: 'Tempo esgotado.' }).catch(() => {});
                                    } else {
                                        contadorRA.edit({ content: `<a:AmongUs3D:1407001955699785831> | Você tem ${tempoRA} segundos para responder...` }).catch(() => {});
                                    }
                                }, 1000);

                                let embedRegistro = new EmbedBuilder()
                                    .setColor(Colors.green)
                                    .setTitle ('<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **')
                                    .setDescription('**Iniciando registro de aparência...** /n Por favor, envie no chat o nome completo da aparência.')
                                    .setFooter('Por enquanto, envie apenas o nome, sem abreviações ou universo pertencente.')

                                await msgNavegacao.edit({ embeds: [embedRegistro]})

                                const registroCollector = msg.createMessageComponentCollector({ filter: ii => ii.user.id === message.author.id, time: 60000 });

                                registroCollector.on('collect', async m => {
                                    clearInterval(intervalRA); 
                                    contadorRA.edit({ content: '<a:AmongUs3D:1407001955699785831> | Resposta recebida.' }).catch(() => {});

                                    function normalizeText(s) {
                                        return String(s || '')
                                            .normalize('NFD')
                                            .replace(/[\u0300-\u036f]/g, '')
                                            .replace(/[^\w\s-]/g, '')
                                            .replace(/\s+/g, ' ')
                                            .trim()

                                    }

                                    let aparenciaRegistro = m.content;
                                    let targetRA = normalizeText(aparenciaRegistro)

                                    

                                    
                                })

                                
                            }

                            await message.reply({ content: `Registro: ainda implementado.` }).catch(() => {});
                        } else if (ii.customId === 'nao_ap') {
                            msgNavegacao.delete().catch(() => {});
                            await message.reply({ content: '<a:cdfpatpat:1407135944456536186> | **REGISTRO CANCELADO!** Tudo bem, você pode reservar depois, se estiver disponível' }).catch(() => {});
                        }
                    });
                }
             });
 
            // ----------------- COLETOR APARENCIA END (LIMPEZA) -----------------
            coletorAparencia.on('end', (collected, reason) => {
                 // garante que o intervalo foi limpo e mostra mensagem final se o tempo acabou
                 clearInterval(intervalo);
                 if (reason === 'time' && collected.size === 0) {
                     contador.edit({ content: 'Tempo esgotado.' }).catch(() => {});
                     msgNavegacao.delete().catch(() => {});
                 } //!IF TEMPO ESGOTADO
                // limpa o embed de resultado quando o coletor termina (timeout ou fim natural)
                msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
            }); //!COLETORAPARENCIA.END

        // ----------------- FLUXO: VERSO -----------------
        } else if (i.customId === 'verso') {
            // fluxo equivalente para pesquisar versos (adaptado do aparencia.js -> pesquisar_verso)
            await i.update({ components: [] }).catch(() => {});

            // * ------------------------- EMBED VERSO -------------------------
            const embedVerso = new EmbedBuilder()
                .setColor('#212416')
                .setTitle('<:DNAstrand:1406986203278082109> | ** SISTEMA DE VERSOS **')
                .setDescription('Envie no chat o nome do verso que deseja pesquisar.')
                .setFooter({ text: 'envie apenas o nome do verso.' });

            await msgNavegacao.edit({ embeds: [embedVerso], components: [] }).catch(() => {});

            // ----------------- CONTADOR VERSO -----------------
            let tempoV = 15;
            const contadorV = await message.reply({ content: `<a:AmongUs3D:1407001955699785831> | Você tem ${tempoV} segundos para enviar o verso...` });
            const intervalV = setInterval(() => {
                tempoV--;
                if (tempoV <= 0) {
                    clearInterval(intervalV);
                    msgNavegacao.delete().catch(() => {});
                    contadorV.edit({ content: 'Tempo esgotado.' }).catch(() => {});
                } else {
                    contadorV.edit({ content: `<a:AmongUs3D:1407001955699785831> | Você tem ${tempoV} segundos para responder...` }).catch(() => {});
                }
            }, 1000);

            // ----------------- COLETOR VERSO -----------------
            const coletorVerso = msgNavegacao.channel.createMessageCollector({ filter: m => m.author.id === message.author.id, time: 15000, max: 1 });

            coletorVerso.on('collect', async m => {
                // * ------------------------- RESPOSTA VERSO / LIMPEZA -------------------------
                clearInterval(intervalV);
                contadorV.edit({ content: '<a:AmongUs3D:1407001955699785831>  | Resposta recebida.' }).catch(() => {});
                const verseName = m.content;

                // normaliza texto: remove acentos, caracteres extras, trim e lowercase
                function normalizeText(s) {
                  return String(s || '')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .toLowerCase();
                }
                const targetV = normalizeText(verseName);

                // ----------------- BUSCA NA PLANILHA (VERSO) -----------------

                let resultadosVerso = [];
                try {
                    const res = await sheets.spreadsheets.values.get({
                      spreadsheetId: '17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo',
                      range: 'UNIVERSO!A:C'
                    });
                    const rows = res.data.values || [];

                    for (let r = 1; r < rows.length; r++) {
                      const row = rows[r];
                      if (!row) continue;
                      const [universo, uso, jogador] = row;
                      if (!universo) continue;

                      const uniNorm = normalizeText(universo);

                      // Ignora entradas muito curtas/ruidosas (ex.: "N")
                      if (uniNorm.length < 2) continue;

                      // aceitar igualdade e correspondência parcial com limites (evita "N" casando)
                      if (
                        uniNorm === targetV ||
                        (uniNorm.length >= 3 && uniNorm.includes(targetV)) ||
                        (targetV.length >= 3 && targetV.includes(uniNorm))
                      ) {
                        resultadosVerso.push({ universo, uso, jogador });
                      }
                    }
                } catch (err) {
                    console.error(err);
                    await message.channel.send('Erro ao acessar a planilha de versos.');
                    return;
                }

                // ----------------- CASO: VERSO NÃO ENCONTRADO -----------------
                if (resultadosVerso.length === 0) {
                    const embedOk = new EmbedBuilder()
                        .setTitle('✅ Verso Disponível')
                        .setColor('#00ff00')
                        .setDescription(`Verso **${verseName}** não está sendo utilizado.`);
                    await msgNavegacao.edit({ embeds: [embedOk], components: [] }).catch(() => {});
                    return;
                }

                // ----------------- MONTAR PAGES DE VERSOS -----------------
                // monta páginas para versos
                const pagesV = resultadosVerso.map((r, idx) => new EmbedBuilder()
                    .setTitle(`<:DNAstrand:1406986203278082109> | VERSO | Resultado ${idx + 1} de ${resultadosVerso.length}`)
                    .setColor('#212416')
                    .setDescription(`Verso: **${r.universo ?? '—'}**`)
                    .addFields(
                        { name: 'USO (%)', value: String(r.uso ?? '—') },
                        { name: 'JOGADOR', value: r.jogador ?? '—' }
                    )
                    .setFooter({ text: `Página ${idx + 1}/${resultadosVerso.length}` })
                );

                // ----------------- NAVEGAÇÃO DE PÁGINAS (VERSO) -----------------
                let pageV = 0;
                const navRowV = (idx) => new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prev_v').setLabel('⏪').setStyle(ButtonStyle.Primary).setDisabled(idx === 0),
                    new ButtonBuilder().setCustomId('next_v').setLabel('⏩').setStyle(ButtonStyle.Primary).setDisabled(idx === pagesV.length - 1),
                    new ButtonBuilder().setCustomId('close_v').setLabel('❌').setStyle(ButtonStyle.Danger)
                );

                await msgNavegacao.edit({ embeds: [pagesV[pageV]], components: [navRowV(pageV)] }).catch(() => {});

                const navCollectorV = msgNavegacao.createMessageComponentCollector({ filter: ii => ii.user.id === message.author.id, time: 60000 });
                navCollectorV.on('collect', async ii => {
                    await ii.deferUpdate().catch(() => {});
                    if (ii.customId === 'prev_v') {
                        pageV = Math.max(0, pageV - 1);
                        await msgNavegacao.edit({ embeds: [pagesV[pageV]], components: [navRowV(pageV)] }).catch(() => {});
                    } else if (ii.customId === 'next_v') {
                        pageV = Math.min(pagesV.length - 1, pageV + 1);
                        await msgNavegacao.edit({ embeds: [pagesV[pageV]], components: [navRowV(pageV)] }).catch(() => {});
                    } else if (ii.customId === 'close_v') {
                        navCollectorV.stop('closed');
                        msgNavegacao.delete().catch(() => {});
                        message.reply({ content: '<a:cdfpatpat:1407135944456536186> | **NAVEGAÇÃO FINALIZADA!**' }).catch(() => {});
                    }
                });

                navCollectorV.on('end', async () => {
                    // remove botões e limpa embeds ao finalizar a navegação de versos
                    await msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
                });
            });

            // ----------------- COLETOR VERSO END (LIMPEZA) -----------------
            coletorVerso.on('end', (collected, reason) => {
                clearInterval(intervalV);
                if (reason === 'time' && collected.size === 0) {
                    contadorV.edit({ content: 'Tempo esgotado.' }).catch(() => {});
                }
               // limpa o embed de resultado do fluxo de versos ao terminar
               msgNavegacao.edit({ embeds: [], components: [] }).catch(() => {});
            });

        }
    })
  }
}
