const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ComponentType, PermissionsBitField, TextDisplayBuilder } = require('discord.js');
const { iniciarContador, pararContador } = require('../api/contador.js');

const cacheUpgradeSystem = new Map();
const cacheAdmNavigationState = new Map();

function divText(text, maxLength = 3900) {
    const parts = [];
    let currentChunk = text;
    while (currentChunk.length > 0) {
        if (currentChunk.length <= maxLength) {
            parts.push(currentChunk);
            break;
        }
        let splitIndex = currentChunk.lastIndexOf('\n\n', maxLength);
        if (splitIndex === -1) splitIndex = currentChunk.lastIndexOf('\n', maxLength);
        if (splitIndex === -1) splitIndex = currentChunk.lastIndexOf(' ', maxLength);
        if (splitIndex === -1) splitIndex = maxLength;
        
        parts.push(currentChunk.substring(0, splitIndex).trim());
        currentChunk = currentChunk.substring(splitIndex).trim();
    }
    return parts.length ? parts : ['Sem texto'];
}

function formatLocalTime(ms) {
    if (!ms || isNaN(ms)) return 'Nenhum tempo';
    const horas = Math.floor(ms / 3600000);
    const minutos = Math.floor((ms % 3600000) / 60000);
    
    if (horas > 0) return `${horas}h`;
    return `${minutos > 0 ? minutos : 1}m`;
}

async function buscaMsg(canal, msgIniId, msgFimId) {
    const listaMsg = [];
    let lastMsgId = msgFimId;
    let reachIniMsg = false;
    let fetchedTotal = 0;
    
    const msgFim = await canal.messages.fetch(msgFimId);
    listaMsg.push(msgFim); //ultimsg msg entra primeiro na lista, posição 0

    while (!reachIniMsg) {
        const opcBusca = { limit: 100, before: lastMsgId };
        const msgs = await canal.messages.fetch(opcBusca);
        if (msgs.size === 0) {
            canal.send(`❌ Não consegui encontrar a mensagem inicial do treino. Certifique-se de que ela está no mesmo canal e tente novamente.`).catch(() => null);
            return null;
        }

        for (const msg of msgs.values()) {
            if (msg.id === msgIniId) {
                reachIniMsg = true;
                break;
            }
            listaMsg.push(msg);
        }
        lastMsgId = msgs.last().id; //ultima msg logo após a msgFimId fica por ultimo na lista
        fetchedTotal += msgs.size;
        
        if (!reachIniMsg && fetchedTotal >= 300) {
            canal.send(`❌ O limite de busca segura foi atingido (300 mensagens). Tente dividir seu treino ou verifique se marcou as mensagens no canal correto.`).catch(() => null);
            return null;
        }
    }
    const msgIni = await canal.messages.fetch(msgIniId);
    listaMsg.push(msgIni);
    return listaMsg.reverse(); //inverte pra ordenar certo
}

async function chamarIA(systemInstruction, promptText) {
    const models = [
        'gemini-2.5-pro',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-pro-latest'
    ];
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('[IA UPGRADE] Chave GEMINI_API_KEY ausente no .env.');
        return null;
    }

    for (const model of models) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { temperature: 0.2 }
                })
            });
            if (response.ok) {
                const data = await response.json();
                if (data.candidates && data.candidates[0].content.parts[0].text) {
                    let texto = data.candidates[0].content.parts[0].text;
                    
                    // Puxa estritamente o conteúdo entre a primeira chave { e a última }
                    const matchJson = texto.match(/\{[\s\S]*\}/);
                    if (matchJson) {
                        try {
                            return JSON.parse(matchJson[0]);
                        } catch (errParse) {
                            console.error(`[IA UPGRADE] Falha ao fazer parse do JSON no modelo ${model}:`, errParse);
                            console.error(`[IA UPGRADE] Texto bruto Extraído:`, matchJson[0]);
                        }
                    } else {
                        console.error(`[IA UPGRADE] Formato JSON não foi retornado pelo modelo ${model}. Resposta:`, texto);
                    }
                }
            } else {
                const errText = await response.text();
                console.error(`[IA UPGRADE] Erro na API Gemini (Status: ${response.status}) no modelo ${model}:`, errText);
            }
        } catch (e) {
            console.error(`[IA UPGRADE] Exceção ao se comunicar com o modelo ${model}:`, e);
        }
    }
    return null;
}

async function processarIA_Extrair(upgradeText, loreText) {
    const sys = `Você é um assistente de RPG de mesa. O usuário fornecerá dois textos: "UPGRADES" (onde ele lista seus ganhos) e "LORE" (a narrativa do treino).
Sua função é APENAS estruturar os upgrades solicitados no texto "UPGRADES". Para cada um, preencha as chaves e gere um "resumo" em um parágrafo que justifique a habilidade usando a "LORE". Não invente upgrades que não estejam listados.
Atenção para a chave "categoria": Se for melhoria de uma habilidade principal, use "Principal"; se for sub-habilidade, use "sub-habilidade"; se for uma técnica, use "técnica". Se a habilidade ou sub-habilidade for nova ou constar como desbloqueio, insira "(NOVA) " antes do nome da categoria (Ex: "(NOVA) Principal").
Retorne EXATAMENTE um objeto JSON neste formato:
{ "upgrades": [ { "tipo": "Física, Mágica ou Passiva", "categoria": "Principal, sub-habilidade, técnica, etc", "nome": "Nome do atributo, poder ou item (Ex: Força)", "descricao": "Melhoria obtida (Ex: +3T)", "resumo": "Justificativa/Feito resumido da lore para este upgrade em específico." } ] }`;
    
    const prompt = `--- LORE ---\n${loreText}\n\n--- UPGRADES ---\n${upgradeText}`;
    return await chamarIA(sys, prompt);
}

async function processarIA_Resumo(upgradesObj, loreText) {
    const sys = `Você é um assistente de RPG de mesa. O usuário fornecerá "UPGRADES" (um JSON com habilidades) e "LORE" (a narrativa).
Sua função é ler os upgrades e, para aqueles cujo campo "resumo" estiver vazio, gerar um resumo sinérgico (1 parágrafo) que justifique o ganho usando a "LORE".
Retorne EXATAMENTE o mesmo JSON completo e atualizado no campo "resumo" (garanta que seja um JSON válido e sem blocos markdown):
{ "upgrades": [ { "tipo": "...", "categoria": "...", "nome": "...", "descricao": "...", "resumo": "Novo resumo justificado aqui" } ] }`;
    
    const prompt = `--- LORE ---\n${loreText}\n\n--- UPGRADES ---\n${JSON.stringify(upgradesObj)}`;
    return await chamarIA(sys, prompt);
}

async function listenerInteractionUpg(interaction, client) {
    if (interaction.isButton() && interaction.customId === 'upgrade_cancel') {
        return interaction.update({ content: '❌ Operação cancelada.', embeds: [], components: [] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('upgrade_queue_open_')) {
        const upgId = interaction.customId.split('_')[3];
        const upgDoc = await client.database.UpgradeModel.findById(upgId);
        if (!upgDoc) return interaction.reply({ content: '❌ Este upgrade não foi encontrado ou já foi excluído.', flags: 64 });
        if (upgDoc.userId !== interaction.user.id) return interaction.reply({ content: '❌ Você não é o dono destes upgrades e não pode visualizá-los desta forma.', flags: 64 });

        return mosFilaUpg(interaction, upgDoc, 0);
    }

    if (interaction.isButton() && interaction.customId.startsWith('upgrade_queue_nav_')) {
        const parts = interaction.customId.split('_');
        const navDir = parts[3];
        const upgId = parts[4];
        let index = parseInt(parts[5], 10);
        if (navDir === 'prev') index--;
        if (navDir === 'next') index++;
        const upgDoc = await client.database.UpgradeModel.findById(upgId);
        if (!upgDoc) return interaction.update({ content: '❌ Upgrade não encontrado no sistema.', embeds: [], components: [] });
        if (upgDoc.userId !== interaction.user.id) return interaction.reply({ content: '❌ Você não é o dono destes upgrades.', flags: 64 });
        return mosFilaUpg(interaction, upgDoc, index, true);
    }

    if (interaction.isButton() && interaction.customId === 'upgrade_start') {
        if (client.maintenance && client.owners.includes(interaction.user.id)) {
            const textoLorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\n".repeat(15);
            
            await interaction.update({ content: '🛠️ Modo desenvolvedor ativo: Auto-preenchendo treino com Lorem Ipsum...', embeds: [], components: [] });
            
            cacheUpgradeSystem.set(interaction.user.id, { loreText: textoLorem, upgAmount: 1, currentStep: 1, upgrades: [] });
            await QntUpg(interaction, 1);
            return;
        }

        const embedCapturaTreino = new EmbedBuilder()
            .setTitle('<a:rahhh:1502049620640006257> | CENTRAL DE UPGRADES | <a:rahhh:1502049620640006257>')
            .setAuthor({name: 'Sistema de Treinos', iconURL: interaction.guild.iconURL()})
            .setDescription('Reaja com ➕ na **primeira** mensagem do seu treino no chat.')
            .setColor([223, 108, 7]);

        await interaction.reply({ content: `<@${interaction.user.id}>`, embeds: [embedCapturaTreino] });
        await interaction.message.delete().catch(() => null);

        let { intervalo: intervaloIni, contador: contadorIni } = await iniciarContador(300, 'marcar a primeira mensagem com ➕', interaction.channel);
        let timeoutIniReact;
        const filtroReaction = (reactionIni, userIni) => userIni.id === interaction.user.id;

        const lidIniUpg = async (reactionIni, userIni) => {
            if (!filtroReaction(reactionIni, userIni) || reactionIni.emoji.name !== '➕') return;
            clearTimeout(timeoutIniReact);
            await pararContador(null, intervaloIni, contadorIni);
            if (contadorIni) await contadorIni.delete().catch(() => null);
            const msgIni = reactionIni.message;
            client.removeListener('messageReactionAdd', lidIniUpg);

            await interaction.editReply({ content: `<@${interaction.user.id}>`, embeds: [new EmbedBuilder().setDescription(`Agora reaja com ➖ na **última** mensagem do seu treino.`).setColor([223, 108, 7])] });

            let { intervalo: intervaloFim, contador: contadorFim } = await iniciarContador(300, 'marcar a última mensagem com ➖', interaction.channel);
            let timeoutFimReaction;

            const lidFimUpg = async (reactionFim, userFim) => {
                if (!filtroReaction(reactionFim, userFim) || reactionFim.emoji.name !== '➖') return;
                clearTimeout(timeoutFimReaction);
                await pararContador(null, intervaloFim, contadorFim);
                if (contadorFim) await contadorFim.delete().catch(() => null);
                const msgFim = reactionFim.message;
                client.removeListener('messageReactionAdd', lidFimUpg);

                if (msgIni.createdTimestamp > msgFim.createdTimestamp) {
                    await interaction.editReply({ content: '❌ A mensagem inicial deve ser anterior à final. Vamos recomeçar o processo!', embeds: [embedCapturaTreino] });
                    const novoContadorIni = await iniciarContador(300, 'marcar a primeira mensagem com ➕', interaction.channel);
                    intervaloIni = novoContadorIni.intervalo;
                    contadorIni = novoContadorIni.contador;
                    client.on('messageReactionAdd', lidIniUpg);
                    timeoutIniReact = setTimeout(() => { client.removeListener('messageReactionAdd', lidIniUpg); interaction.editReply({ content: '❌ Tempo esgotado para marcar o início.', embeds: [] }).catch(() => {}); }, 300000);
                    return;
                }

                await interaction.editReply({ content: `<@${interaction.user.id}>\n<a:discordchristmas:1502159689528512612> Coletando mensagens do treino...`, embeds: [] });

                const listaMsg = await buscaMsg(interaction.channel, msgIni.id, msgFim.id);
                if (!listaMsg) return;

                await interaction.deleteReply().catch(() => null);

                let textoCapturado = `**🔗 CLIQUE AQUI PARA IR ATÉ A MENSAGEM ORIGINAL**\n\n`;
                listaMsg.forEach(m => { if (m.author.id === interaction.user.id && m.content) textoCapturado += `${m.content}\n\n`; });

                cacheUpgradeSystem.set(interaction.user.id, { loreText: textoCapturado, upgAmount: 1, currentStep: 1, upgrades: [], aiMode: false });
                
                const embAi = new EmbedBuilder()
                    .setTitle('<a:rahhh:1502049620640006257> | CENTRAL DE UPGRADES | <a:rahhh:1502049620640006257>')
                    .setDescription('Treino (Lore) capturado com sucesso!\n\n**Como você deseja enviar os seus upgrades?**')
                    .setColor('#2b2d31');
                const rowAi = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('upgrade_mode_chat').setLabel('Coletar do Chat (IA)').setStyle(ButtonStyle.Success).setEmoji('🤖'),
                    new ButtonBuilder().setCustomId('upgrade_mode_manual').setLabel('Preencher Manualmente').setStyle(ButtonStyle.Secondary)
                );
                
                await interaction.followUp({ embeds: [embAi], components: [rowAi], flags: 64 });
            };
            client.on('messageReactionAdd', lidFimUpg);
            timeoutFimReaction = setTimeout(() => { client.removeListener('messageReactionAdd', lidFimUpg); interaction.editReply({ content: '❌ Tempo esgotado para marcar o fim.', embeds: [] }).catch(() => {}); }, 300000);
        };
        client.on('messageReactionAdd', lidIniUpg);
        timeoutIniReact = setTimeout(() => { client.removeListener('messageReactionAdd', lidIniUpg); interaction.editReply({ content: '❌ Tempo esgotado para marcar o início.', embeds: [] }).catch(() => {}); }, 300000);
    }

    if (interaction.isButton() && interaction.customId === 'upgrade_mode_manual') {
        const cacheUpgradeSystemAtu = cacheUpgradeSystem.get(interaction.user.id);
        if (!cacheUpgradeSystemAtu) return;
        await interaction.deferUpdate();
        await QntUpg(interaction, 1, true);
    }

    if (interaction.isButton() && interaction.customId === 'upgrade_mode_chat') {
        const cacheUpgradeSystemAtu = cacheUpgradeSystem.get(interaction.user.id);
        if (!cacheUpgradeSystemAtu) return interaction.reply({ content: 'Sessão expirada.', flags: 64 });
        
        await interaction.update({ content: `<@${interaction.user.id}>`, embeds: [new EmbedBuilder().setDescription('Reaja com ➕ na **primeira** mensagem onde estão listados seus UPGRADES no chat.').setColor([223, 108, 7])], components: [] });

        let { intervalo: intervaloIni, contador: contadorIni } = await iniciarContador(300, 'marcar a primeira mensagem de upgrades com ➕', interaction.channel);
        let timeoutIniReact;
        const filtroReaction = (reactionIni, userIni) => userIni.id === interaction.user.id;

        const lidIniUpg = async (reactionIni, userIni) => {
            if (!filtroReaction(reactionIni, userIni) || reactionIni.emoji.name !== '➕') return;
            clearTimeout(timeoutIniReact);
            await pararContador(null, intervaloIni, contadorIni);
            if (contadorIni) await contadorIni.delete().catch(() => null);
            const msgIni = reactionIni.message;
            client.removeListener('messageReactionAdd', lidIniUpg);

            await interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`Agora reaja com ➖ na **última** mensagem dos seus upgrades.`).setColor([223, 108, 7])] });

            let { intervalo: intervaloFim, contador: contadorFim } = await iniciarContador(300, 'marcar a última mensagem de upgrades com ➖', interaction.channel);
            let timeoutFimReaction;

            const lidFimUpg = async (reactionFim, userFim) => {
                if (!filtroReaction(reactionFim, userFim) || reactionFim.emoji.name !== '➖') return;
                clearTimeout(timeoutFimReaction);
                await pararContador(null, intervaloFim, contadorFim);
                if (contadorFim) await contadorFim.delete().catch(() => null);
                const msgFim = reactionFim.message;
                client.removeListener('messageReactionAdd', lidFimUpg);

                if (msgIni.createdTimestamp > msgFim.createdTimestamp) {
                    return interaction.editReply({ content: '❌ A mensagem inicial deve ser anterior à final. Você precisará recomeçar o processo de upgrades (use o comando /upgrade novamente).', embeds: [] });
                }

                await interaction.editReply({ content: `<@${interaction.user.id}>\n<a:discordchristmas:1502159689528512612> Lendo upgrades e gerando resumos com a IA... Isso pode levar alguns segundos.`, embeds: [] });

                const listaMsg = await buscaMsg(interaction.channel, msgIni.id, msgFim.id);
                if (!listaMsg) return;

                let upgradeText = ``;
                listaMsg.forEach(m => { if (m.author.id === interaction.user.id && m.content) upgradeText += `${m.content}\n\n`; });

                const resultadoIA = await processarIA_Extrair(upgradeText, cacheUpgradeSystemAtu.loreText);
                
                if (!resultadoIA || !resultadoIA.upgrades || resultadoIA.upgrades.length === 0) {
                    return interaction.editReply({ content: '❌ Houve um erro ao extrair com a IA. Redirecionando para o modo manual...' }).then(() => QntUpg(interaction, 1, false));
                }
                
                cacheUpgradeSystemAtu.aiMode = true;
                cacheUpgradeSystemAtu.upgrades = resultadoIA.upgrades.map(u => ({...u, status: 'pendente'}));
                cacheUpgradeSystemAtu.currentStep = 0; 
                cacheUpgradeSystemAtu.upgAmount = cacheUpgradeSystemAtu.upgrades.length;
                
                await mosAiUpg(interaction, cacheUpgradeSystemAtu, true);
            };
            client.on('messageReactionAdd', lidFimUpg);
            timeoutFimReaction = setTimeout(() => { client.removeListener('messageReactionAdd', lidFimUpg); interaction.editReply({ content: '❌ Tempo esgotado para marcar o fim.', embeds: [] }).catch(() => {}); }, 300000);
        };
        client.on('messageReactionAdd', lidIniUpg);
        timeoutIniReact = setTimeout(() => { client.removeListener('messageReactionAdd', lidIniUpg); interaction.editReply({ content: '❌ Tempo esgotado para marcar o início.', embeds: [] }).catch(() => {}); }, 300000);
    }

    if (interaction.isButton() && interaction.customId.startsWith('upgrade_ai_nav_')) {
        const cacheUpgradeSystemAtu = cacheUpgradeSystem.get(interaction.user.id);
        if (!cacheUpgradeSystemAtu) return interaction.reply({ content: 'Sessão expirada.', flags: 64 });
        
        const acao = interaction.customId.replace('upgrade_ai_nav_', '');
        
        if (acao === 'prev' && cacheUpgradeSystemAtu.currentStep > 0) {
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
            cacheUpgradeSystemAtu.currentStep--;
            await mosAiUpg(interaction, cacheUpgradeSystemAtu, true);
        } else if (acao === 'next' && cacheUpgradeSystemAtu.currentStep < cacheUpgradeSystemAtu.upgAmount - 1) {
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
            cacheUpgradeSystemAtu.currentStep++;
            await mosAiUpg(interaction, cacheUpgradeSystemAtu, true);
        } else if (acao === 'edit') {
            await mosModUpg(interaction, cacheUpgradeSystemAtu.currentStep + 1, cacheUpgradeSystemAtu.upgAmount, cacheUpgradeSystemAtu.upgrades[cacheUpgradeSystemAtu.currentStep]);
        } else if (acao === 'editsummary') {
            const upgAtual = cacheUpgradeSystemAtu.upgrades[cacheUpgradeSystemAtu.currentStep];
            const modSumm = new ModalBuilder().setCustomId('upgrade_ai_modal_summary').setTitle('Editar Resumo do Upgrade');
            modSumm.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('resumo_ai_input').setLabel('Resumo Sinérgico').setStyle(TextInputStyle.Paragraph).setValue(upgAtual.resumo || '').setRequired(true)));
            await interaction.showModal(modSumm);
        } else if (acao === 'confirm') {
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
            await interaction.editReply({ content: 'Preparando envio...', embeds: [], components: [] });
            await envioUpg(interaction, client, cacheUpgradeSystemAtu);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'upgrade_ai_modal_summary') {
        const cacheUpgradeSystemAtu = cacheUpgradeSystem.get(interaction.user.id);
        if (!cacheUpgradeSystemAtu) return interaction.reply({ content: 'Sessão expirada.', flags: 64 });
        
        cacheUpgradeSystemAtu.upgrades[cacheUpgradeSystemAtu.currentStep].resumo = interaction.fields.getTextInputValue('resumo_ai_input');
        
        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
        await mosAiUpg(interaction, cacheUpgradeSystemAtu, true);
    }

    if (interaction.isButton() && interaction.customId.startsWith('upgrade_qntUpgrade_')) {
        const cacheUpgradeSystemAtu = cacheUpgradeSystem.get(interaction.user.id);
        if (!cacheUpgradeSystemAtu) return;

        const acaoQntdUpgd = interaction.customId.split('_')[2];
        if (acaoQntdUpgd === 'confirmar') return mosModUpg(interaction, cacheUpgradeSystemAtu.currentStep, cacheUpgradeSystemAtu.upgAmount);
        
        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
        
        if (acaoQntdUpgd === 'aumentar') cacheUpgradeSystemAtu.upgAmount++;
        if (acaoQntdUpgd === 'reduzir' && cacheUpgradeSystemAtu.upgAmount > 1) cacheUpgradeSystemAtu.upgAmount--;
        await QntUpg(interaction, cacheUpgradeSystemAtu.upgAmount, true);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'upgrade_modal_for') {
        const cacheUpgradeSystemAtual = cacheUpgradeSystem.get(interaction.user.id);
        if (!cacheUpgradeSystemAtual) return interaction.reply({ content: '❌ Sua sessão expirou. Por favor, inicie o processo novamente.', flags: 64 });

        const dadosHabilidade = {
            tipo: interaction.fields.getTextInputValue('upgrade_modal_input_tipoHabilidade'),
            categoria: interaction.fields.getTextInputValue('upgrade_modal_input_categoria'),
            nome: interaction.fields.getTextInputValue('upgrade_modal_input_nome'),
            descricao: interaction.fields.getTextInputValue('upgrade_modal_input_descricao'),
            resumo: interaction.fields.getTextInputValue('upgrade_modal_input_resumo') || ''
        };

        if (cacheUpgradeSystemAtual.aiMode) {
            cacheUpgradeSystemAtual.upgrades[cacheUpgradeSystemAtual.currentStep] = dadosHabilidade;
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
            return mosAiUpg(interaction, cacheUpgradeSystemAtual, true);
        }

        cacheUpgradeSystemAtual.upgrades.push(dadosHabilidade);

        if (cacheUpgradeSystemAtual.currentStep < cacheUpgradeSystemAtual.upgAmount) {
            cacheUpgradeSystemAtual.currentStep++;
            const botaoProxModalUpg = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('upgrade_next_modal').setLabel(`Próximo: ${cacheUpgradeSystemAtual.currentStep}/${cacheUpgradeSystemAtual.upgAmount}`).setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ content: `✅ Dados do Upgrade ${cacheUpgradeSystemAtual.currentStep - 1} (${cacheUpgradeSystemAtual.upgrades[cacheUpgradeSystemAtual.currentStep - 2].nome}) salvos.`, components: [botaoProxModalUpg], flags: 64 });
        } else {
            const needsSummary = cacheUpgradeSystemAtual.upgrades.some(u => !u.resumo || u.resumo.trim() === '');
            if (needsSummary) {
                if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
                await interaction.editReply({ content: '<a:discordchristmas:1502159689528512612> Gerando resumos automáticos com a IA baseando-se no seu treino...', embeds: [], components: [] });
                
                const resultadoIA = await processarIA_Resumo(cacheUpgradeSystemAtual.upgrades, cacheUpgradeSystemAtual.loreText);
                if (resultadoIA && resultadoIA.upgrades) {
                    cacheUpgradeSystemAtual.upgrades = resultadoIA.upgrades.map(u => ({...u, status: 'pendente'}));
                    cacheUpgradeSystemAtual.aiMode = true; 
                    cacheUpgradeSystemAtual.currentStep = 0;
                    return mosAiUpg(interaction, cacheUpgradeSystemAtual, true);
                } else {
                    await interaction.followUp({ content: '❌ Houve um erro ao gerar os resumos com a IA. Enviando assim mesmo...', flags: 64 });
                    return envioUpg(interaction, client, cacheUpgradeSystemAtual);
                }
            } else {
                return envioUpg(interaction, client, cacheUpgradeSystemAtual);
            }
        }
    }

    if (interaction.isButton() && interaction.customId === 'upgrade_next_modal') {
        const cacheUpgradeSystemAtual = cacheUpgradeSystem.get(interaction.user.id);
        await mosModUpg(interaction, cacheUpgradeSystemAtual.currentStep, cacheUpgradeSystemAtual.upgAmount);
    }

    if (interaction.isButton() && interaction.customId.startsWith('upgrade_adm_avaliar_')) {
        const idUpgAtual = interaction.customId.split('_')[3];
        const docDbUpgAtual = await client.database.UpgradeModel.findById(idUpgAtual);
        
        if (docDbUpgAtual.lockAdmod?.userId && docDbUpgAtual.lockAdmod.expiresAt > Date.now() && docDbUpgAtual.lockAdmod.userId !== interaction.user.id) {
            return interaction.reply({ content: `🔒 Em avaliação por <@${docDbUpgAtual.lockAdmod.userId}>`, flags: 64 });
        }

        docDbUpgAtual.lockAdmod = { userId: interaction.user.id, expiresAt: Date.now() + 1200000 };
        await docDbUpgAtual.save();
        cacheAdmNavigationState.set(interaction.user.id, { idUpgAtual, currentIndex: 0 });
        await navAdmUpg(interaction, client, docDbUpgAtual);
    }

    if (interaction.isButton() && interaction.customId.startsWith('upgrade_adm_navegar_')) {
        if (interaction.customId.includes('_accept_') || interaction.customId.includes('_reject_') || interaction.customId.includes('_lorePrev_') || interaction.customId.includes('_loreNext_')) {
            // Deixa a interação passar para o handler adequado abaixo
        } else {
            const [, , , acaoNavAdm, idNav] = interaction.customId.split('_');
            const cacheAdmNavigationStateAtu = cacheAdmNavigationState.get(interaction.user.id);
            if (!cacheAdmNavigationStateAtu) return interaction.reply({ content: 'Sua sessão expirou.', flags: 64 });
            
            const docNavUpg = await client.database.UpgradeModel.findById(idNav);
            
            if (acaoNavAdm === 'previousUpgd') { cacheAdmNavigationStateAtu.currentIndex--; }
            if (acaoNavAdm === 'nextUpgd') { cacheAdmNavigationStateAtu.currentIndex++; }
            if (acaoNavAdm === 'lore') return mosLorUpg(interaction, docNavUpg, 0);
            if (acaoNavAdm === 'close') {
                docNavUpg.lockAdmod = null;
                await docNavUpg.save();
                return interaction.update({ content: 'Painel fechado.', embeds: [], components: [] });
            }
            await navAdmUpg(interaction, client, docNavUpg, true);
            return;
        }
    }

    if (interaction.isButton() && (interaction.customId.startsWith('upgrade_adm_navegar_lorePrev_') || interaction.customId.startsWith('upgrade_adm_navegar_loreNext_'))) {
        const parts = interaction.customId.split('_');
        const isNext = parts[3] === 'loreNext';
        const idNav = parts[4];
        let pagina = parseInt(parts[5]);
        pagina = isNext ? pagina + 1 : Math.max(0, pagina - 1);
        
        const docNavUpg = await client.database.UpgradeModel.findById(idNav);
        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
        return mosLorUpg(interaction, docNavUpg, pagina);
    }

    if (interaction.isButton() && (interaction.customId.startsWith('upgrade_adm_navegar_accept_') || interaction.customId.startsWith('upgrade_adm_navegar_reject_'))) {
        const parts = interaction.customId.split('_');
        const acao = parts[3]; // accept ou reject
        const escopo = parts[4]; // currentUpgd ou allUpgd
        const idDocDbUpg = parts[5]; // O ID do documento
        const docDecUpg = await client.database.UpgradeModel.findById(idDocDbUpg);
        const cacheAdmNavigationStateAtu = cacheAdmNavigationState.get(interaction.user.id);

        if (acao === 'accept') {
            if (escopo === 'allUpgd') {
                const rowConfirm = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`upgrade_adm_confirmAll_${idDocDbUpg}`).setLabel('Tenho certeza, continuar').setStyle(ButtonStyle.Success)
                );
                return interaction.reply({ content: '⚠️ **Tem certeza?** Verifique se não há algum upgrade que pede para você dizer o aumento ou ganho específico antes de aprovar todos de uma vez. A sua devolutiva (justificativa) será dada a todos.', components: [rowConfirm], flags: 64 });
            }

            const modAccUpg = new ModalBuilder().setCustomId(`upgrade_adm_modal_accept_${escopo}_${idDocDbUpg}`).setTitle('Aprovar Upgrade');
            modAccUpg.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('upgrade_adm_modal_accept_input_motif').setLabel('Resultado/Melhoria (Ex: 2m para 5m)').setStyle(TextInputStyle.Paragraph).setPlaceholder('Descreva os ganhos ou digite "Aprovado"').setRequired(true)));
            return interaction.showModal(modAccUpg);
        }

        if (acao === 'reject') {
            const modRejUpg = new ModalBuilder().setCustomId(`upgrade_adm_modal_reject_${idDocDbUpg}`).setTitle('Motivo da Rejeição');
            modRejUpg.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('upgrade_adm_modal_reject_input_motif').setLabel('Justificativa').setStyle(TextInputStyle.Paragraph).setRequired(true)));
            return interaction.showModal(modRejUpg);
        }
    }

    if (interaction.isButton() && interaction.customId.startsWith('upgrade_adm_confirmAll_')) {
        const idDocDbUpg = interaction.customId.split('_')[3];
        const modAccUpg = new ModalBuilder().setCustomId(`upgrade_adm_modal_accept_allUpgd_${idDocDbUpg}`).setTitle('Aprovar Todos Upgrades');
        modAccUpg.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('upgrade_adm_modal_accept_input_motif').setLabel('Resultado/Melhoria Geral').setStyle(TextInputStyle.Paragraph).setPlaceholder('Descreva os ganhos ou digite "Aprovado"').setRequired(true)));
        return interaction.showModal(modAccUpg);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('upgrade_adm_modal_accept_')) {
        await interaction.deferUpdate();
        const parts = interaction.customId.split('_');
        const escopo = parts[4];
        const idAccUpg = parts[5];
        const feedbackUpg = interaction.fields.getTextInputValue('upgrade_adm_modal_accept_input_motif');
        const docDbAccUpg = await client.database.UpgradeModel.findById(idAccUpg);
        const cacheAdmNavigationStateAtu = cacheAdmNavigationState.get(interaction.user.id);

        if (escopo === 'allUpgd' || docDbAccUpg.upgrades.length === 1) {
            docDbAccUpg.status = 'aprovado';
            docDbAccUpg.upgrades.forEach(u => { u.status = 'aprovado'; u.motivo = feedbackUpg; });
            docDbAccUpg.AdmodAvaliou = interaction.user.id;
            await docDbAccUpg.save();
            await atualStatusUpg(interaction, client, docDbAccUpg, `Aprovado: ${feedbackUpg}`);
            return interaction.editReply({ content: '✅ Avaliação concluída!', embeds: [], components: [] });
        }

        const upgIndex = cacheAdmNavigationStateAtu.currentIndex;
        docDbAccUpg.upgrades[upgIndex].status = 'aprovado';
        docDbAccUpg.upgrades[upgIndex].motivo = feedbackUpg;
        await docDbAccUpg.save();

        const allEvaluated = docDbAccUpg.upgrades.every(u => u.status !== 'pendente');
        if (allEvaluated) {
            docDbAccUpg.status = 'avaliado';
            docDbAccUpg.AdmodAvaliou = interaction.user.id;
            await docDbAccUpg.save();
            const aprovados = docDbAccUpg.upgrades.filter(u => u.status === 'aprovado').length;
            const recusados = docDbAccUpg.upgrades.filter(u => u.status === 'recusado').length;
            await atualStatusUpg(interaction, client, docDbAccUpg, `${aprovados} Aprovado(s), ${recusados} Recusado(s)`);
            return interaction.editReply({ content: '✅ Avaliação concluída!', embeds: [], components: [] });
        } else {
            return navAdmUpg(interaction, client, docDbAccUpg, true);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('upgrade_adm_modal_reject_')) {
        await interaction.deferUpdate();
        const idRejectedUpg = interaction.customId.split('_')[4];
        const motifRejectedUpg = interaction.fields.getTextInputValue('upgrade_adm_modal_reject_input_motif');
        const docDbRejectedUpg = await client.database.UpgradeModel.findById(idRejectedUpg);
        const cacheAdmNavigationStateAtu = cacheAdmNavigationState.get(interaction.user.id);
        
        if (docDbRejectedUpg.upgrades.length === 1) {
            docDbRejectedUpg.status = 'recusado';
            docDbRejectedUpg.upgrades[0].status = 'recusado';
            docDbRejectedUpg.upgrades[0].motivo = motifRejectedUpg;
            docDbRejectedUpg.AdmodAvaliou = interaction.user.id;
            await docDbRejectedUpg.save();
            await atualStatusUpg(interaction, client, docDbRejectedUpg, `Recusado: ${motifRejectedUpg}`);
            return interaction.editReply({ content: '❌ Avaliação concluída (Recusado)!', embeds: [], components: [] });
        }

        const upgIndex = cacheAdmNavigationStateAtu.currentIndex;
        docDbRejectedUpg.upgrades[upgIndex].status = 'recusado';
        docDbRejectedUpg.upgrades[upgIndex].motivo = motifRejectedUpg;
        await docDbRejectedUpg.save();

        const allEvaluated = docDbRejectedUpg.upgrades.every(u => u.status !== 'pendente');
        if (allEvaluated) {
            docDbRejectedUpg.status = 'avaliado';
            docDbRejectedUpg.AdmodAvaliou = interaction.user.id;
            await docDbRejectedUpg.save();
            
            const aprovados = docDbRejectedUpg.upgrades.filter(u => u.status === 'aprovado').length;
            const recusados = docDbRejectedUpg.upgrades.filter(u => u.status === 'recusado').length;
            const resultString = `${aprovados} Aprovado(s), ${recusados} Recusado(s)`;
            
            await atualStatusUpg(interaction, client, docDbRejectedUpg, resultString);
            return interaction.editReply({ content: '✅ Avaliação concluída!', embeds: [], components: [] });
        } else {
            return navAdmUpg(interaction, client, docDbRejectedUpg, true);
        }
    }
}

module.exports = { listenerInteractionUpg };

async function QntUpg(interaction, qntAtual, qntNova = false) {
    const emb = new EmbedBuilder().setTitle('<a:rahhh:1502049620640006257> | CENTRAL DE UPGRADES | <a:rahhh:1502049620640006257>').setAuthor({name: 'Sistema de Treinos', iconURL: interaction.guild.iconURL()}).setDescription('Ajuste quantos upgrades deseja registrar.').setColor('#2b2d31');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('upgrade_qntUpgrade_reduzir').setLabel('➖').setStyle(ButtonStyle.Secondary).setDisabled(qntAtual <= 1),
        new ButtonBuilder().setCustomId('upgrade_qntUpgrade_confirmar').setLabel(`${qntAtual}`).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('upgrade_qntUpgrade_aumentar').setLabel('➕').setStyle(ButtonStyle.Secondary)
    );
    const opcQntd = { content: `<@${interaction.user.id}>`, embeds: [emb], components: [row], flags: 64 };
    qntNova ? await interaction.editReply(opcQntd) : await interaction.followUp(opcQntd);
}

async function mosAiUpg(interaction, cacheData, isUpdate = false) {
    const upg = cacheData.upgrades[cacheData.currentStep];
    
    const embed = new EmbedBuilder()
        .setTitle(`<a:rahhh:1502049620640006257> | CENTRAL DE UPGRADES (IA) | <a:rahhh:1502049620640006257>`)
        .setDescription(`**Foram identificados ${cacheData.upgAmount} upgrades!**\nRevise-os abaixo e edite se necessário.`)
        .addFields(
            { name: `Upgrade ${cacheData.currentStep + 1}/${cacheData.upgAmount}`, value: `**Nome:** ${upg.nome}\n**Tipo:** ${upg.tipo}\n**Categoria:** ${upg.categoria}` },
            { name: 'Descrição / Valor', value: (upg.descricao || 'Sem descrição').substring(0, 1024) },
            { name: 'Resumo Sinérgico', value: (upg.resumo || 'Sem resumo').substring(0, 1024) }
        )
        .setColor('#2b2d31');

    const rowNav = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('upgrade_ai_nav_prev').setEmoji('◀️').setStyle(ButtonStyle.Primary).setDisabled(cacheData.currentStep === 0),
        new ButtonBuilder().setCustomId('upgrade_ai_nav_edit').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('upgrade_ai_nav_next').setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(cacheData.currentStep === cacheData.upgAmount - 1)
    );

    const rowAcao = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('upgrade_ai_nav_editsummary').setLabel('Editar Resumo').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('upgrade_ai_nav_confirm').setLabel('Confirmar e Enviar').setStyle(ButtonStyle.Success).setEmoji('✅')
    );

    const payload = { embeds: [embed], components: [rowNav, rowAcao], flags: 64 };
    isUpdate ? await interaction.editReply(payload) : await interaction.followUp(payload);
}

async function mosFilaUpg(interaction, upgDoc, index, isUpdate = false) {
    const upg = upgDoc.upgrades[index];
    const isUpgRejected = upg.status === 'recusado';
    let corStatus = 'Blue';
    if (upg.status === 'aprovado') corStatus = 'Green';
    if (upg.status === 'recusado') corStatus = 'Red';

    const embed = new EmbedBuilder()
        .setTitle(`Seu Upgrade: ${upg.nome} (${index + 1}/${upgDoc.upgrades.length})`)
        .setColor(corStatus)
        .setDescription((upg.descricao || 'Sem descrição').substring(0, 4000))
        .addFields(
            { name: 'Tipo/Categoria', value: `${upg.tipo} | ${upg.categoria}`, inline: true },
            { name: 'Status', value: upg.status, inline: true },
            { name: 'Resumo', value: (upg.resumo || 'Sem resumo').substring(0, 1024) }
        ).setFooter({ text: `Central de Upgrades` });

    if (upg.motivo) embed.addFields({ name: isUpgRejected ? 'Motivo da Recusa' : 'Resultado/Feedback', value: upg.motivo });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`upgrade_queue_nav_prev_${upgDoc._id}_${index}`).setEmoji('◀️').setStyle(ButtonStyle.Primary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId(`upgrade_queue_nav_next_${upgDoc._id}_${index}`).setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(index === upgDoc.upgrades.length - 1)
    );
    const payload = { embeds: [embed], components: [row], flags: 64 };
    isUpdate ? await interaction.update(payload) : await interaction.reply(payload);
}

async function mosModUpg(interaction, qntdAtual, qntdTotal, prefill = null) {
    const isDev = interaction.client.maintenance && interaction.client.owners.includes(interaction.user.id);
    const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.";

    const modalUpgBuilder = new ModalBuilder()
        .setCustomId('upgrade_modal_for')
        .setTitle(`Upgrade ${qntdAtual}/${qntdTotal}`.substring(0, 45));

    const inputTipoHabilidade = new TextInputBuilder()
        .setCustomId('upgrade_modal_input_tipoHabilidade')
        .setLabel('Tipo de Habilidade')
        .setPlaceholder('Física, mágica, passiva ou sistemas únicos')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    if (prefill) inputTipoHabilidade.setValue(prefill.tipo); else if (isDev) inputTipoHabilidade.setValue("Física");

    const inputCategoriaHabilidade = new TextInputBuilder()
        .setCustomId('upgrade_modal_input_categoria')
        .setLabel('Categoria')
        .setPlaceholder('Principal, sub-habilidade ou técnica')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    if (prefill) inputCategoriaHabilidade.setValue(prefill.categoria); else if (isDev) inputCategoriaHabilidade.setValue("Técnica");

    const inputNomeHabilidade = new TextInputBuilder().setCustomId('upgrade_modal_input_nome').setLabel('Nome').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(400).setPlaceholder('Insira o nome da habilidade ou status para upgrade')
    if (prefill) inputNomeHabilidade.setValue(prefill.nome); else if (isDev) inputNomeHabilidade.setValue("Golpe de Teste");
    
    const inputDescricao = new TextInputBuilder().setCustomId('upgrade_modal_input_descricao').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Descreva o upgrade ou habilidade a ser desbloqueada')
    if (prefill) inputDescricao.setValue(prefill.descricao); else if (isDev) inputDescricao.setValue(lorem);
    
    const inputResumo = new TextInputBuilder().setCustomId('upgrade_modal_input_resumo').setLabel('Resumo do Treino').setPlaceholder('Deixe em branco para a IA gerar automaticamente').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000);
    if (prefill) inputResumo.setValue(prefill.resumo); else if (isDev) inputResumo.setValue(lorem);

    modalUpgBuilder.addComponents(
        new ActionRowBuilder().addComponents(inputTipoHabilidade),
        new ActionRowBuilder().addComponents(inputCategoriaHabilidade),
        new ActionRowBuilder().addComponents(inputNomeHabilidade),
        new ActionRowBuilder().addComponents(inputDescricao),
        new ActionRowBuilder().addComponents(inputResumo)
    );

    await interaction.showModal(modalUpgBuilder);
}

async function envioUpg(interaction, client, listaUpg) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: 64 });
    
    const loreChu = divText(listaUpg.loreText);
    const upgDoc = await client.database.UpgradeModel.create({
        userId: interaction.user.id,
        loreText: loreChu,
        upgrades: listaUpg.upgrades
    });

    const filaChannel = await client.channels.fetch('1502919510787887104').catch(() => null);
    const pendentAdmChannel = await client.channels.fetch('1502919601107763252').catch(() => null);
    const posicaoFila = await client.database.UpgradeModel.countDocuments({ status: 'pendente' });
    const tempoPendencia = 'Menos de 1m';
    const timestampAtu = Math.floor(Date.now() / 1000);


    if (filaChannel) {

        const btnView = new ButtonBuilder().setCustomId(`upgrade_queue_open_${upgDoc._id}`).setLabel('Ver meus upgrades').setStyle(ButtonStyle.Primary).setEmoji('👁️');
        const rowFila = new ActionRowBuilder().addComponents(btnView);

        const msgFil = await filaChannel.send({ embeds: [new EmbedBuilder()
            .setTitle('<a:rahhh:1502049620640006257> | CENTRAL DE UPGRADES | <a:rahhh:1502049620640006257>')
            .setAuthor({name: 'Sistema de Treinos', iconURL: interaction.guild.iconURL()})
            .setDescription(`Jogador: <@${interaction.user.id}>\n\n STATUS: #pendente \n TEMPO DE PENDÊNCIA: ${tempoPendencia} \n \n Posição na Fila: ${posicaoFila}\n\n*Última atualização: <t:${timestampAtu}:f>*`)
            .setColor('Yellow')
            .setFooter({text: `Fila de Notas`})], components: [rowFila]
        });
        upgDoc.filaMessageId = msgFil.id;
    }

    if (pendentAdmChannel) {
        const msgPendente = await pendentAdmChannel.send({
            content: '🔔 **Novo Upgrade Pendente!**',
            embeds: [new EmbedBuilder()
                .setTitle('<a:rahhh:1502049620640006257> | CENTRAL DE UPGRADES | <a:rahhh:1502049620640006257>')
                .setDescription(`Autor: <@${interaction.user.id}>\nUpgrades: ${listaUpg.upgAmount}\n TEMPO DE PENDÊNCIA: ${tempoPendencia} \n \n CLIQUE NO BOTÃO PARA AVALIAR!\n\n*Última atualização: <t:${timestampAtu}:f>*`).setFooter({text: `Fila de Avaliação`})
                .setColor('Orange')],
            components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`upgrade_adm_avaliar_${upgDoc._id}`).setEmoji('👁️').setStyle(ButtonStyle.Secondary))]
        });
        upgDoc.pendenteMessageId = msgPendente.id;
    }

    await upgDoc.save();
    cacheUpgradeSystem.delete(interaction.user.id);
    await interaction.editReply({ content: `✅ Upgrades enviados! Aguarde avaliação e acompanhe o status em ${filaChannel ? filaChannel.toString() : 'nossa fila'}! Você receberá notificação na DM quando for avaliado.`, embeds: [] });
}

async function navAdmUpg(interaction, client, upgDocDb, updated = false) {
    const AdmAtual = cacheAdmNavigationState.get(interaction.user.id);
    const upgAtual = upgDocDb.upgrades[AdmAtual.currentIndex];
    
    const embedUpgAtual = new EmbedBuilder()
        .setTitle(`Avaliação: ${upgAtual.nome} (${AdmAtual.currentIndex + 1}/${upgDocDb.upgrades.length})`)
        .setColor(upgAtual.status === 'aprovado' ? 'Green' : 'Blue')
        .setDescription(upgAtual.descricao.substring(0, 4000))
        .addFields(
            { name: 'Tipo/Categoria', value: `${upgAtual.tipo} | ${upgAtual.categoria}`, inline: true },
            { name: 'Status do Upgrade', value: upgAtual.status, inline: true },
            { name: 'Resumo', value: upgAtual.resumo || 'Sem resumo' }
        )
        .setFooter({ text: `Jogador <@${upgDocDb.userId}>` });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_previousUpgd_${upgDocDb._id}`).setEmoji('🔙').setStyle(ButtonStyle.Secondary).setDisabled(AdmAtual.currentIndex === 0),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_nextUpgd_${upgDocDb._id}`).setEmoji('🔜').setStyle(ButtonStyle.Secondary).setDisabled(AdmAtual.currentIndex === upgDocDb.upgrades.length - 1),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_lore_${upgDocDb._id}`).setEmoji('👁‍🗨').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_close_${upgDocDb._id}`).setEmoji('❌').setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_accept_currentUpgd_${upgDocDb._id}`).setEmoji('☑️').setStyle(ButtonStyle.Success).setDisabled(upgAtual.status !== 'pendente'),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_accept_allUpgd_${upgDocDb._id}`).setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_reject_currentUpgd_${upgDocDb._id}`).setEmoji('🚫').setStyle(ButtonStyle.Primary).setDisabled(upgAtual.status !== 'pendente')
    );

    const botoesEmbedAdm = { embeds: [embedUpgAtual], components: [row1, row2], flags: 64 };
    if (updated) { 
        if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
        await interaction.editReply(botoesEmbedAdm);
    } else { 
        await interaction.reply(botoesEmbedAdm);
    }
}

async function mosLorUpg(interaction, upgDocDb, pagina = 0) {
    const loreParts = upgDocDb.loreText;
    const embedVerLoreAdm = new EmbedBuilder()
        .setTitle('Lore Capturada')
        .setDescription(loreParts[pagina] || 'Sem texto')
        .setColor('Grey')
        .setFooter({ text: `Página ${pagina + 1}/${loreParts.length}` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_lorePrev_${upgDocDb._id}_${pagina}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(pagina === 0),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_loreNext_${upgDocDb._id}_${pagina}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(pagina === loreParts.length - 1)
    );

    const payload = { embeds: [embedVerLoreAdm], components: [row], flags: 64 };
    if (interaction.replied || interaction.deferred) {
        await interaction.editReply(payload);
    } else {
        await interaction.reply(payload);
    }
}

async function atualStatusUpg(interaction, client, upgDocDb, result) {
    const filaChannel = await client.channels.fetch('1502919510787887104').catch(() => null);
    const pendentUpgChannel = await client.channels.fetch('1422258818183729355').catch(() => null);

    const isAllRejected = upgDocDb.upgrades.every(u => u.status === 'recusado');
    const isSomeRejected = upgDocDb.upgrades.some(u => u.status === 'recusado');
    const resultColor = isAllRejected ? 'Red' : (isSomeRejected ? 'Orange' : 'Green');

    if (filaChannel && upgDocDb.filaMessageId) {
        const msg = await filaChannel.messages.fetch(upgDocDb.filaMessageId).catch(() => null);
        if (msg) {
            const novaDesc = msg.embeds[0].description.replace('STATUS: #pendente', 'STATUS: #avaliado');
            await msg.edit({ embeds: [EmbedBuilder.from(msg.embeds[0]).setColor(resultColor).setDescription(`${novaDesc}\n\n**Resultado:** ${result}\n**Avaliador:** <@${interaction.user.id}>`)], components: msg.components });
        }
    }

    if (pendentUpgChannel && upgDocDb.pendenteMessageId) {
        const msg = await pendentUpgChannel.messages.fetch(upgDocDb.pendenteMessageId).catch(() => null);
        if (msg) await msg.delete().catch(() => null);
    }

    const user = await client.users.fetch(upgDocDb.userId).catch(() => null);
    if (user) {
        await user.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('<a:rahhh:1502049620640006257> | CENTRAL DE UPGRADES <a:rahhh:1502049620640006257> | ')
                    .setAuthor({name: 'Sistema de Treinos', iconURL: interaction.guild?.iconURL() || null})
                    .setDescription(`📢 Seus upgrades foram avaliados!\n\n Resultado: **${result}** \n \n **AVALIADOR**: <@${interaction.user.id}>\n\n*Vá até o canal de fila de upgrades e clique no botão \`Ver meus upgrades\` na sua solicitação para ler os detalhes e a resposta individual de cada um.*`)
                    .setColor(resultColor)
            ]
        }).catch(() => {});
    }

    if (filaChannel) {
        const pendentes = await client.database.UpgradeModel.find({ status: 'pendente' });
        const timestampAtu = Math.floor(Date.now() / 1000);

        for (const upg of pendentes) {
            if (upg.filaMessageId) {
                const msgFila = await filaChannel.messages.fetch(upg.filaMessageId).catch(() => null);
                if (msgFila && msgFila.embeds.length > 0) {
                    const olderUpgrades = await client.database.UpgradeModel.countDocuments({ status: 'pendente', createdAt: { $lte: upg.createdAt } });
                    
                    let tempoPendencia = 'Menos de 1m';
                    const ms = Date.now() - new Date(upg.createdAt).getTime();
                    if (ms > 0) {
                        const horas = Math.floor(ms / 3600000);
                        const minutos = Math.floor((ms % 3600000) / 60000);
                        tempoPendencia = horas > 0 ? `${horas}h` : `${minutos > 0 ? minutos : 1}m`;
                    }

                    const newEmbedFila = EmbedBuilder.from(msgFila.embeds[0])
                        .setDescription(`Jogador: <@${upg.userId}>\n\n STATUS: #pendente \n TEMPO DE PENDÊNCIA: ${tempoPendencia} \n \n Posição na Fila: ${olderUpgrades}\n\n*Última atualização: <t:${timestampAtu}:f>*`);
                    await msgFila.edit({ embeds: [newEmbedFila], components: msgFila.components }).catch(() => null);
                }
            }
        }
    }
}