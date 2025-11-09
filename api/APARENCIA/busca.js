const configAparencia = {
    colunas: ["aparencia", "universo", "personagem", "jogador"],
    escopo: "INDIVIDUAIS!A:D",
    planilha: "17L8NZsgH5_tjPhj4eIZ",
}

 async function normalizeText(s) {
            return String(s || "")
            .normalize("NFD") // separa acentos
            .replace(/[\u0300-\u036f]/g, "") // remove acentos
            .replace(/[^\w\s-]/g, "") // remove chars especiais (mantém letras, números, underscore e espaços)
            .replace(/\s+/g, " ") // normaliza espaços múltiplos
            .trim()
            .toLowerCase();
        }
        

async function buscarAparencia(configAparencia) { 
    
    /* #region  CONTADOR */
    let tempoRestante = 15;
    let sujeito = "enviar a aparência";
    let msgAlvo = msgNavegacao;
    let { intervalo, contador } = await iniciarContador(
        tempoRestante,
        sujeito,
        msgAlvo,
        message
    );
    /* #endregion */

    /* #region  BACK BUSCA E REGISTRO DE APARÊNCIA */
    return new Promise((resolve, reject) => {
    const coletorAparencia = msgNavegacao.channel.createMessageCollector({
            filter: (m) => m.author.id === message.author.id,
            time: 15000,
            max: 1,
        });



    coletorAparencia.on("collect", async (m)  => { 

        const nomeAparencia = await pararContador(
            m.content,
            intervalo,
            contador
        );

        const target = normalizeText(nomeAparencia); 
        let resultados = [];
        /* #region  BUSCA RESULTADOS NA PLANILHA */

        try { 
    
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: configAparencia.planilha,
                range: configAparencia.escopo,
            });

            const rows = res.data.values || []; //array de dados das linhas da planilha
    
            for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
                const row = rows[rowIndex];
                const [aparencia] = row;
                const aparNorm = normalizeText(aparencia);
                if (!aparencia || aparNorm.length < 2 || !row || row.length == 0) continue; // pula linha se não tiver aparencia
    
    
                /* #region  VERIFICAÇÃO PARCIAL E IGUAL */
    
                if (
                    aparNorm === target ||
                    (aparNorm.length >= 3 && aparNorm.includes(target)) || // exige ao menos 3 chars para includes em aparência
                    (target.length >= 3 && target.includes(aparNorm)) // exige ao menos 3 chars no target para includes em aparência
                ) {
                    const item = {};
                    
                    configAparencia.colunas.forEach((col, idx) => {
                        item[col] = row[idx] || "—"; // atribui valor da célula ou "—" se estiver vazia
                    });
                    item.rowIndex = rowIndex + 1; // Adiciona o número da linha ao resultado
    
                    resultados.push(item);
                }
                /* #endregion */
            
            }
            
            if (resultados.length === 0) {
                await message.reply("Nenhum resultado encontrado!");
            } resolve(resultados);
        } catch (err) {
            console.error("Erro ao buscar na planilha:", err);
        reject(err);
    }
});
    
coletorAparencia.on("end", (collected, reason) => {
    if(reason == "time"){
        reject(new Error("Tempo esgotado para enviar a aparência."));
    }
        });
    });
}
/* #endregion */

const configEmbed ={
    titulo: "<:DNAstrand:1406986203278082109> | ** SISTEMA DE APARÊNCIAS **",
    mensagens: {
     mensagemAparenciaDisponivel: `Aparência ${target} disponível!`,
     mensagemAparenciaIndisponivel: `<:PepeHands:1407563136197984357> | Aparência em uso!` 
    },
    cores: {
    corTexto: "#212416",
    corDisponivel: "#00ff00",
    corIndisponivel: "#8f0808",
    },
    camposAparenciaEncontrada: [
        { name: "**APARÊNCIA**", value: found.aparencia ?? "—" },
        { name: "**UNIVERSO**", value: found.universo ?? "—" },
        { name: "**PERSONAGEM**", value: found.personagem ?? "—" },
        { name: "**JOGADOR**", value: found.jogador ?? "—" }
    ]
       
    
}

function criaEmbedResultados(resultados, configEmbed){
    
    const EmbedPages = resultados.map(
        (r, idx) =>
            new EmbedBuilder()
                .setTitle(
                    `${configEmbed.titulo} | Resultados ${idx + 1
                    } de ${resultados.length}`
                )
                .setColor(`${configEmbed.cores.corTexto}`) 
            );
        
            let page = 0;
            const embedEmpty = new EmbedBuilder()
                .setColor(`${configEmbed.cores.corDisponivel}`)
                .setTitle(`${configEmbed.titulo}`)
                .setDescription(`${configEmbed.mensagens.mensagemAparenciaDisponivel}`);
            
                switch (resultados.length) {
                    case 1:
                        const found = resultados[0]; // pega o primeiro resultado
        
                        EmbedPagesReserva[0]
                            .setDescription(`${configEmbed.mensagemAparenciaIndisponivel}`)
                            .setColor(`${configEmbed.cores.corIndisponivel}`)
                            .addFields(
                               configEmbed.camposAparenciaEncontrada.forEach(campo => {
                                EmbedPagesReserva[0].addFields(campo);
                               })
                            );
        
                        await msgNavegacao.edit({ embeds: [EmbedPagesReserva[0]], components: [] }).catch(() => { });
        
                        break;
                        case 0:
                            await handleRegistro(msgNavegacao, message, client, embedEmpty, sChannel, target);
                            break;
                        default: return
                    } //switch resultados.length
        }
        
        
        switch (i.customId) {
            case "botaoNavAparencia":
                const resultados = await buscarAparencia(configAparencia)

        } 
        /* #endregion */

        // !CRIAÇÃO DE EMBED PADRÃO PARA CADA PAGINA


           

        if (resultados.length >= 1) {
            const exactMatchFound = resultados.some(r => normalizeText(r.aparencia) === target);
            let EmbedPagesAparencia = [];
            let page = 0;

            if (!exactMatchFound) {
                const embedRegistro = new EmbedBuilder()
                    .setTitle(`✅ | **APARÊNCIA DISPONÍVEL!**`)
                    .setDescription(
                        `Aparência **${target}** disponível. Também encontramos resultados similares.
                            \nSelecione "sim" para registrar e "não" para ver os outros resultados disponíveis.`
                    )
                    .setColor("#00ff00");

                EmbedPagesAparencia.unshift(embedRegistro);
            }


            resultados.forEach((r, idx) => {
                const embed = new EmbedBuilder()
                    .setTitle(configEmbed.titulo)
                    .setColor(configEmbed.cores.corTexto)
                    .setDescription(
                        `<:patrickconcern:1407564230256758855> | Resultado similar ${idx + 1} de ${resultados.length}`
                    )
                    .addFields(
                        { name: "**APARÊNCIA**", value: r.aparencia ?? "—" },
                        { name: "**UNIVERSO**", value: r.universo ?? "—" },
                        { name: "**PERSONAGEM**", value: r.personagem ?? "—" },
                        { name: "**JOGADOR**", value: r.jogador ?? "—" }
                    )
                EmbedPagesAparencia.push(embed);
            });

            EmbedPagesAparencia.forEach((embed, idx) => embed.setFooter({ text: `Página ${idx + 1}/${EmbedPagesAparencia.length}` }));

            const navRow = async (idx) => {
                const components = [
                    new ButtonBuilder()
                        .setCustomId("prev_ap")
                        .setLabel("⏪")
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(idx === (!exactMatchFound ? 1 : 0)),
                    new ButtonBuilder()
                        .setCustomId("next_ap")
                        .setLabel("⏩")
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(idx === EmbedPagesAparencia.length - 1),
                    new ButtonBuilder()
                        .setCustomId("close_ap")
                        .setLabel("❌")
                        .setStyle(ButtonStyle.Danger)
                ];

                const currentResult = resultados[idx];
                let userDb = await this.client.database.userData.findById(`${message.author.globalName} ${message.guild.name}`);
                if(!userDb ) console.log(`${err}`)
                if(!currentResult ) console.log(`${err}`)
                if (currentResult && userDb) {

                    const jogadorAparencia = await normalizeText(currentResult.jogador);
                    const jogadorUsuario = await normalizeText(userDb.jogador);
                    
                    const isOwner = jogadorAparencia == jogadorUsuario;
                    const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

                    console.log('É dono?', isOwner);
                    console.log('É admin?', isAdmin);

                    if (isOwner || isAdmin) {
                        const rowIndex = currentResult.rowIndex;
                        components.push(
                            new ButtonBuilder()
                                .setCustomId(`edit_appearance_${rowIndex}`)
                                .setEmoji('✏️')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId(`delete_appearance_${rowIndex}`)
                                .setEmoji('🗑️')
                                .setStyle(ButtonStyle.Danger)
                        );
                    }
                }

                if (idx === 0 && !exactMatchFound) {
                    return new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("sim_ap")
                            .setLabel("SIM")
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId("nao_ap")
                            .setLabel("NÃO")
                            .setStyle(ButtonStyle.Danger)
                    );
                }

                return new ActionRowBuilder().addComponents(components);
            };

            await msgNavegacao
                .edit({
                    embeds: [EmbedPagesAparencia[page]],
                    components: [await navRow(page)],
                })
                .catch(() => { });

            const navCollector = msgNavegacao.createMessageComponentCollector({
                filter: (ii) => ii.user.id === message.author.id,
                time: 60000,
                idle: 30000
            });

            navCollector.on("collect", async (ii) => {
                switch (ii.customId) {
                    case 'sim_ap':

                        const formularioRegisto = new ModalBuilder()
                            .setCustomId("esqueletoFormularioRegistro")
                            .setTitle("Registro de Ficha");
                        const campoNome = new TextInputBuilder()
                            .setCustomId("campoNome")
                            .setLabel("Nome da Aparência")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);
                        const campoUniverso = new TextInputBuilder()
                            .setCustomId("campoUniverso")
                            .setLabel("Universo de Origem")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);
                        const campoPersonagem = new TextInputBuilder()
                            .setCustomId("campoPersonagem")
                            .setLabel("Personagem do RPG")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);
                        const actionRowNome = new ActionRowBuilder().addComponents(campoNome);
                        const actionRowUniverso = new ActionRowBuilder().addComponents(campoUniverso);
                        const actionRowPersonagem = new ActionRowBuilder().addComponents(campoPersonagem);
                        formularioRegisto.addComponents(actionRowNome, actionRowUniverso, actionRowPersonagem);

                        await ii.showModal(formularioRegisto).catch(() => { });

                        const filter = (modalInteraction) => modalInteraction.customId === "esqueletoFormularioRegistro" && modalInteraction.user.id === ii.user.id;

                        ii.awaitModalSubmit({ filter, time: 150000 }).then(async (modalInteraction) => {
                            await modalInteraction.deferUpdate();

                            const argNome = modalInteraction.fields.getTextInputValue("campoNome");
                            const argUniverso = modalInteraction.fields.getTextInputValue("campoUniverso");
                            const argPersonagem = modalInteraction.fields.getTextInputValue("campoPersonagem");
                            const userDb = await this.client.database.userData.findById(`${message.author.globalName} ${message.guild.name}`);
                            const argJogador = userDb.jogador;

                            /* #region   ACHJAR LINHA VAZIA*/
                            const res = await sheets.spreadsheets.values.get({
                                spreadsheetId:
                                    "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                                range: "A:D",
                            });
                            const rows = res.data.values || [];
                            let i = 0;
                            for (i = 0; i < rows.length; i++) {
                                if (!rows[i][0]) break;
                            }
                            const path = require("path");
                            const keyFilePath = path.join(
                                __dirname,
                                "../../api/regal-primacy-233803-4fc7ea1a8a5a.json"
                            );

                            let authUp = new google.auth.GoogleAuth({
                                keyFile: keyFilePath,
                                scopes: [
                                    "https://www.googleapis.com/auth/spreadsheets",
                                ],
                            });
                            let sheetsUp = google.sheets({
                                version: "v4",
                                auth: authUp,
                            });

                            await sheetsUp.spreadsheets.values.update({
                                spreadsheetId:
                                    "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                                range: `INDIVIDUAIS!A${i + 1}:D${i + 1}`,
                                valueInputOption: "USER_ENTERED",
                                resource: {
                                    majorDimension: "ROWS",
                                    values: [
                                        [argNome, argUniverso, argPersonagem, argJogador],
                                    ],
                                },
                            });
                            /* #endregion */

                            message.reply({
                                content: `<a:cat_dance:1409062402288521266> | A aparência ${argNome} do universo de ${argUniverso} foi registrada com sucesso para o personagem ${argPersonagem} em nome de ${argJogador}`,
                            });

                            logs.AparenciaRegistrada(message, userDb, argNome, argUniverso, argPersonagem, sChannel);

                        }).catch(err => {
                            console.error("Erro ao enviar modal:", err);
                        });
                        break;
                    case 'nao_ap':
                        page = 1;
                        await msgNavegacao.edit({
                            embeds: [EmbedPagesAparencia[page]], 
                            components: [await navRow(page)],
                        }).catch(() => { });
                        break;
                    case 'prev_ap':
                        page = Math.max((!exactMatchFound ? 1 : 0), page - 1);
                        await msgNavegacao.edit({
                            embeds: [EmbedPagesAparencia[page]],
                            components: [await navRow(page)],
                        }).catch(() => { });
                        break;
                    case 'next_ap':
                        page = Math.min(EmbedPagesAparencia.length - 1, page + 1);
                        await msgNavegacao.edit({
                            embeds: [EmbedPagesAparencia[page]],
                            components: [await navRow(page)],
                        }).catch(() => { });
                        break;
                    case 'close_ap':
                        navCollector.stop("closed");
                        await msgNavegacao.delete().catch(() => { });
                        message.reply({
                            content: "<a:cdfpatpat:1407135944456536186> | **NAVEGAÇÃO FINALIZADA!**",
                        }).catch(() => { });
                        break;
                }
            });

            navCollector.on("end", async (collected, reason) => {
                if (reason === "closed") return;
                await msgNavegacao.edit({ embeds: [], components: [] }).catch(() => { });
            });
        }
    }) //coletorAparencia

    coletorAparencia.on("end", (collected, reason) => {
        clearInterval(intervalo);

        if (reason === "time" && collected.size === 0) {
            contador.edit({ content: "Tempo esgotado." }).catch(() => { });
            msgNavegacao.delete().catch(() => { });
        } //!IF TEMPO ESGOTADO

        msgNavegacao.edit({ embeds: [], components: [] }).catch(() => { });
    }); //!COLETORAPARENCIA.END
    /* #endregion */

    break;
}
