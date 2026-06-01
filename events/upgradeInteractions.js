const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ComponentType, PermissionsBitField, TextDisplayBuilder, AttachmentBuilder } = require('discord.js');
const { iniciarContador, pararContador } = require('../api/contador.js');
const fetch = global.fetch || require('node-fetch');
const { registerUsage, sendLogIA } = require('../api/aiUsageManager.js');
const FILA_CHANNEL_ID = '1502919510787887104';
const ADM_CHANNEL_ID = '1502919601107763252';

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

function getFakeChannel(interaction) {
    return {
        send: async (opts) => {
            if (typeof opts === 'string') opts = { content: opts };
            opts.flags = 64;
            opts.fetchReply = true;
            try {
                const msg = await interaction.followUp(opts);
                const originalEdit = msg.edit.bind(msg);
                msg.edit = async (editOpts) => {
                    try { return await originalEdit(editOpts); } catch (e) { return msg; }
                };
                return msg;
            } catch (e) {
                delete opts.flags;
                return await interaction.channel.send(opts);
            }
        }
    };
}

async function safeEditReply(interaction, options) {
    try {
        await interaction.editReply(options);
    } catch (e) {
        delete options.flags;
        await interaction.channel.send(options).then(m => setTimeout(() => m.delete().catch(()=>null), 30000));
    }
}

async function sendTimeoutError(interaction, actionDesc) {
    const emb = new EmbedBuilder()
        .setColor('Red')
        .setTitle('⏳ Tempo Esgotado')
        .setDescription(`O tempo limite para **${actionDesc}** expirou.\nA operação foi cancelada. Por favor, inicie o comando novamente quando estiver pronto.`);
    try {
        await interaction.followUp({ embeds: [emb], flags: 64 });
    } catch (e) {
        await interaction.channel.send({ content: `<@${interaction.user.id}>`, embeds: [emb] }).then(m => setTimeout(() => m.delete().catch(()=>{}), 15000));
    }
}

async function buscaMsg(canal, msgIniId, msgFimId) {
    const listaMsg = [];
    let lastMsgId = msgFimId;
    let reachIniMsg = false;
    let fetchedTotal = 0;
    
    const msgFim = await canal.messages.fetch(msgFimId).catch(() => null);
    if (!msgFim) {
        canal.send(`❌ Não consegui encontrar a mensagem final. Certifique-se de que ela está no mesmo canal e tente novamente.`).catch(() => null);
        return null;
    }
    listaMsg.push(msgFim); 

    while (!reachIniMsg) {
        const opcBusca = { limit: 100, before: lastMsgId };
        const msgs = await canal.messages.fetch(opcBusca).catch(() => null);
        if (!msgs || msgs.size === 0) {
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
        
        if (!reachIniMsg && fetchedTotal >= 5000) {
            canal.send(`❌ O limite de busca segura foi atingido (5000 mensagens). Tente dividir seu treino ou verifique se marcou as mensagens no canal correto.`).catch(() => null);
            return null;
        }
    }
    const msgIni = await canal.messages.fetch(msgIniId).catch(() => null);
    if (msgIni) listaMsg.push(msgIni);
    return listaMsg.reverse(); //inverte pra ordenar certo
}

async function chamarIA(systemInstruction, promptText, debugInfo = null, jsonMode = true, options = {}) {
    const models = [
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.5-pro',
        'gemini-2.5-flash-lite',
        'gemini-flash-latest',
        'gemini-pro-latest'
    ];
    const apiKey = process.env.GEMINI_API_KEY;
    
    let success = false;
    let jsonResult = null;
    let finalUsage = null;
    let finalResponse = null;

    if (debugInfo) debugInfo.rawText = "--- LOG DE TENTATIVAS DA IA ---\n";

    if (apiKey) {
        for (const model of models) {
            try {
                let requestBody = {
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: {
                        temperature: 0.1
                    }
                };

                // Modelos antigos não suportam systemInstruction adequadamente na v1beta
                if (model.includes('1.5') || model.includes('2.0') || model.includes('2.5') || model.includes('3.1') || model.includes('latest')) {
                    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
                } else {
                    requestBody.contents[0].parts[0].text = `Instruções do Sistema: ${systemInstruction}\n\nEntrada do Usuário:\n${promptText}`;
                }

                if (jsonMode) {
                    requestBody.generationConfig.responseMimeType = "application/json";
                }

                requestBody.safetySettings = [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
                ];

                const response = await Promise.race([
                    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de resposta da API')), 20000))
                ]);

                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.usageMetadata) {
                        console.log(`[IA UPGRADE] Modelo ${model} usou ${data.usageMetadata.totalTokenCount} tokens (Prompt: ${data.usageMetadata.promptTokenCount} | Resposta: ${data.usageMetadata.candidatesTokenCount}).`);
                        registerUsage(data.usageMetadata, model).catch(console.error);
                        finalUsage = data.usageMetadata;
                    }

                    if (data.promptFeedback && data.promptFeedback.blockReason) {
                        console.warn(`[IA UPGRADE] Modelo ${model} bloqueou o prompt por segurança: ${data.promptFeedback.blockReason}`);
                    }

                    // Adiciona verificações para evitar crash caso o prompt acione o filtro de segurança (Safety Settings)
                    if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0].text) {
                        let texto = data.candidates[0].content.parts[0].text;
                        if (debugInfo) debugInfo.rawText += `\n\n[RESPOSTA GEMINI ${model}]:\n${texto}`; // Salva o texto cru para debug
                        
                        if (!jsonMode) {
                            jsonResult = texto;
                            finalResponse = texto;
                            success = true;
                            break;
                        }
                        
                        let cleanedTexto = texto.replace(/```json/gi, '').replace(/```/g, '').trim();
                        const matchJson = cleanedTexto.match(/(\{|\[)[\s\S]*(\}|\])/);
                        if (matchJson) {
                            try {
                                let parsed = JSON.parse(matchJson[0]);
                                if (Array.isArray(parsed)) {
                                    parsed = { upgrades: parsed };
                                } else if (!parsed.upgrades && (parsed.nome || parsed.tipo)) {
                                    parsed = { upgrades: [parsed] };
                                }
                                if (!parsed.upgrades || !Array.isArray(parsed.upgrades) || parsed.upgrades.length === 0) {
                                    console.warn(`[IA UPGRADE] Modelo ${model} retornou JSON sem upgrades válidos:`, texto);
                                    continue; // Rejeita a resposta vazia e tenta o próximo modelo
                                }
                                jsonResult = parsed;
                                finalResponse = texto;
                                success = true;
                                break;
                            } catch (errParse) {
                                console.error(`[IA UPGRADE] Erro de parse no modelo ${model}: ${texto}`);
                                if (debugInfo) debugInfo.rawText += `\nErro de parse JSON: ${errParse.message}`;
                            }
                        } else {
                            console.error(`[IA UPGRADE] Resposta do modelo ${model} não contém JSON: ${texto.substring(0, 200)}...`);
                            if (debugInfo) debugInfo.rawText += `\nErro: Não foi possível encontrar chaves de JSON na resposta.`;
                        }
                    } else if (data.candidates && data.candidates[0].finishReason !== 'STOP') {
                        console.warn(`[IA UPGRADE] Modelo ${model} parou por motivo: ${data.candidates[0].finishReason}`);
                        if (debugInfo) debugInfo.rawText += `\nErro: Modelo parou pelo motivo ${data.candidates[0].finishReason}`;
                    } else if (!data.candidates) {
                        console.warn(`[IA UPGRADE] Modelo ${model} não retornou candidates (possível bloqueio de segurança). Resposta: ${JSON.stringify(data).substring(0, 200)}`);
                        if (debugInfo) debugInfo.rawText += `\nErro: Modelo não retornou texto. Possível bloqueio de segurança.`;
                    }
                } else if (response.status === 429) {
                    console.warn(`[IA UPGRADE] Modelo ${model} retornou 429 Too Many Requests.`);
                    if (debugInfo) debugInfo.rawText += `\nErro: 429 Too Many Requests para ${model}.`;
                    continue;
                } else {
                    const errText = await response.text();
                    console.error(`[IA UPGRADE] Erro na API Gemini (Status: ${response.status}) no modelo ${model}:`, errText);
                    if (debugInfo) debugInfo.rawText += `\nErro API (${response.status}): ${errText}`;
                    continue;
                }
            } catch (e) {
                console.error(`[IA UPGRADE] Exceção ao se comunicar com o modelo ${model}:`, e.message);
                continue;
            }
        }
    }

    if (success) {
        if (options.client && options.userId) {
            sendLogIA(options.client, {
                userId: options.userId,
                action: "Central de Upgrades (Gemini)",
                prompt: promptText,
                context: systemInstruction,
                response: finalResponse,
                usage: finalUsage
            });
        }
        return jsonResult;
    }

    // Fallback 1: Pollinations AI (Baseado em OpenAI / ChatGPT)
    try {
        const resPol = await Promise.race([
            fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: systemInstruction },
                        { role: 'user', content: promptText }
                    ],
                    jsonMode: jsonMode,
                    temperature: 0.2
                })
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout da API')), 20000))
        ]);
        if (resPol.ok) {
            const texto = await resPol.text();
            if (debugInfo) debugInfo.rawText += `\n\n[RESPOSTA POLLINATIONS 1]:\n${texto}`;
            
            if (!jsonMode) {
                if (options.client && options.userId) {
                    sendLogIA(options.client, { userId: options.userId, action: "Central de Upgrades (Pollinations 1)", prompt: promptText, context: systemInstruction, response: texto });
                }
                return texto;
            }
            
            let cleanedTexto = texto.replace(/```json/gi, '').replace(/```/g, '').trim();
            const matchJson = cleanedTexto.match(/(\{|\[)[\s\S]*(\}|\])/);
            if (matchJson) {
                try {
                    let parsed = JSON.parse(matchJson[0]);
                    if (Array.isArray(parsed)) parsed = { upgrades: parsed };
                    else if (!parsed.upgrades && (parsed.nome || parsed.tipo)) parsed = { upgrades: [parsed] };
                    
                    if (!parsed.upgrades || parsed.upgrades.length === 0) {
                        console.warn(`[IA UPGRADE] Pollinations 1 retornou JSON sem upgrades:`, texto.substring(0, 200));
                        if (debugInfo) debugInfo.rawText += `\nErro: Array vazio.`;
                        throw new Error("Pollinations 1 retornou array vazio");
                    }
                    if (options.client && options.userId) {
                        sendLogIA(options.client, { userId: options.userId, action: "Central de Upgrades (Pollinations 1)", prompt: promptText, context: systemInstruction, response: texto });
                    }
                    return parsed;
                } catch (e) {
                    console.error(`[IA UPGRADE] Erro de parse no Pollinations 1:`, e.message);
                    if (debugInfo) debugInfo.rawText += `\nErro de parse JSON: ${e.message}`;
                }
            } else {
                console.error(`[IA UPGRADE] Pollinations 1 não retornou JSON:`, texto.substring(0, 200));
                if (debugInfo) debugInfo.rawText += `\nErro: Sem JSON na resposta.`;
            }
        } else {
            console.error(`[IA UPGRADE] Pollinations 1 falhou com status: ${resPol.status}`);
            if (debugInfo) debugInfo.rawText += `\nErro API: ${resPol.status}`;
        }
    } catch (e) {
        console.error(`[IA UPGRADE] Exceção no fallback Pollinations:`, e.message);
    }

    // Fallback 2: Outra rota da Pollinations em último caso
    try {
        const promptCompleto = `SYSTEM: ${systemInstruction}\nUSER: ${promptText}\nResponda APENAS com o JSON.`;
        const resPol2 = await Promise.race([
            fetch('https://text.pollinations.ai/openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'openai',
                    messages: [
                        { role: 'user', content: promptCompleto }
                    ],
                    temperature: 0.2
                })
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout da API')), 20000))
        ]);
        if (resPol2.ok) {
            const data = await resPol2.json();
            if (data.choices && data.choices[0].message && data.choices[0].message.content) {
                const texto2 = data.choices[0].message.content;
                if (debugInfo) debugInfo.rawText += `\n\n[RESPOSTA POLLINATIONS 2]:\n${texto2}`;
                
                if (!jsonMode) {
                    if (options.client && options.userId) {
                        sendLogIA(options.client, { userId: options.userId, action: "Central de Upgrades (Pollinations 2)", prompt: promptCompleto, response: texto2 });
                    }
                    return texto2;
                }
                
                let cleanedTexto2 = texto2.replace(/```json/gi, '').replace(/```/g, '').trim();
                const matchJson2 = cleanedTexto2.match(/(\{|\[)[\s\S]*(\}|\])/);
                if (matchJson2) {
                    try {
                        let parsed = JSON.parse(matchJson2[0]);
                        if (Array.isArray(parsed)) parsed = { upgrades: parsed };
                        else if (!parsed.upgrades && (parsed.nome || parsed.tipo)) parsed = { upgrades: [parsed] };
                        
                        if (!parsed.upgrades || parsed.upgrades.length === 0) {
                            console.warn(`[IA UPGRADE] Pollinations 2 retornou JSON sem upgrades:`, texto2.substring(0, 200));
                            if (debugInfo) debugInfo.rawText += `\nErro: Array vazio.`;
                            throw new Error("Pollinations 2 retornou array vazio");
                        }
                        if (options.client && options.userId) {
                            sendLogIA(options.client, { userId: options.userId, action: "Central de Upgrades (Pollinations 2)", prompt: promptCompleto, response: texto2 });
                        }
                        return parsed;
                    } catch (e) {
                        console.error(`[IA UPGRADE] Erro de parse no Pollinations 2:`, e.message);
                        if (debugInfo) debugInfo.rawText += `\nErro de parse JSON: ${e.message}`;
                    }
                } else {
                    console.error(`[IA UPGRADE] Pollinations 2 não retornou JSON:`, texto2.substring(0, 200));
                }
            }
        } else {
            console.error(`[IA UPGRADE] Pollinations 2 falhou com status: ${resPol2.status}`);
            if (debugInfo) debugInfo.rawText += `\nErro: Sem JSON na resposta.`;
        }
    } catch (e) {
         console.error(`[IA UPGRADE] Exceção no fallback 2 Pollinations:`, e.message);
    }

    return null;
}

async function processarIA_Extrair(upgradeText, loreText, client, interaction, debugInfo = null) {
    let exemplosTreino = "";
    if (client) {
        try {
            const treinos = await client.database.AiTraining.find({ tipo: 'estilo_resumo' }).sort({ createdAt: -1 }).limit(5);
            if (treinos && treinos.length > 0) {
                exemplosTreino = "\n\nEXEMPLOS DE BONS RESUMOS (USE COMO INSPIRAÇÃO DE ESTILO E TAMANHO):\n";
                treinos.forEach(t => {
                    t.exemplos.forEach(ex => {
                        exemplosTreino += `- ${ex.nome}: ${ex.resumo}\n`;
                    });
                });
            }
        } catch(e) {}
    }

    const sys = `Você é uma IA especializada em extração de dados estruturados para um RPG de mesa textual. O usuário enviará os textos "LORE" (a narrativa) e "UPGRADES" (uma lista bruta de atributos, técnicas e melhorias).

Sua ÚNICA função é converter a lista de "UPGRADES" em um JSON válido.
REGRAS OBRIGATÓRIAS:
1. NUNCA retorne um array vazio. Encontre e extraia todas as melhorias do texto bruto.
2. Cada upgrade deve ser um objeto na array "upgrades".
3. Se a lista contiver vários personagens (Ex: Fulano:, Ciclano:), inclua o nome do personagem no campo "nome" (Ex: "Força (Fulano)").
4. Leia atentamente toda a lista, ignorando símbolos estranhos como "->", "-&gt;" ou erros de digitação.
5. "tipo": classifique como "Física", "Mágica", "Passiva" ou "Status".
6. "categoria": classifique como "Atributo", "Habilidade Principal", "Sub-habilidade" ou "Técnica". Se for nova, inicie com "(NOVA) ".
7. "descricao": MANTENHA A DESCRIÇÃO O MAIS FIEL POSSÍVEL AO ORIGINAL. Não reescreva demais, não resuma excessivamente e NUNCA remova informações vitais como variáveis matemáticas ou valores indefinidos. Remova apenas trechos que sejam pura narrativa e que não descrevam a mecânica do poder em si. NUNCA INVENTE VALORES que não estejam escritos. Caso a lista cite uma melhoria sem valor, SUGIRA baseando-se no esforço e DEIXE EXPLICITO (ex: "[VALOR SUGERIDO PELA IA]: +X").
8. "resumo": DEVE SER UMA JUSTIFICATIVA NARRATIVA do motivo pelo qual o personagem ganhou o upgrade, baseando-se nos esforços e ações lidos na "LORE". Crie um resumo ÚNICO e ESPECÍFICO para CADA upgrade listado. NUNCA repita o mesmo texto para upgrades diferentes, a menos que sejam literalmente a mesma coisa. Caso não haja explicação na LORE, insira um aviso claro (ex: "[AVISO DA IA: Não foi possível identificar o contexto na Lore]").

Retorne EXATAMENTE um objeto JSON neste formato:
{ "upgrades": [ { "tipo": "...", "categoria": "...", "nome": "...", "descricao": "...", "resumo": "..." } ] }${exemplosTreino}`;
    
    const prompt = `--- LORE ---\n${loreText}\n\n--- UPGRADES ---\n${upgradeText}`;
    return await chamarIA(sys, prompt, debugInfo, true, { client: interaction.client, userId: interaction.user.id });
}

async function processarIA_Resumo(upgradesObj, loreText, client, interaction) {
    let exemplosTreino = "";
    if (client) {
        try {
            const treinos = await client.database.AiTraining.find({ tipo: 'estilo_resumo' }).sort({ createdAt: -1 }).limit(5);
            if (treinos && treinos.length > 0) {
                exemplosTreino = "\n\nEXEMPLOS DE BONS RESUMOS (USE COMO INSPIRAÇÃO DE ESTILO E TAMANHO):\n";
                treinos.forEach(t => {
                    t.exemplos.forEach(ex => {
                        exemplosTreino += `- ${ex.nome}: ${ex.resumo}\n`;
                    });
                });
            }
        } catch(e) {}
    }

    const sys = `Você é uma IA especializada em RPG de mesa textual. O usuário fornecerá "UPGRADES" (um JSON com habilidades) e "LORE" (a narrativa).
Sua função é ler os upgrades e, APENAS para aqueles cujo campo "resumo" estiver vazio, gerar uma JUSTIFICATIVA NARRATIVA (1 parágrafo) explicando por que o personagem merece o ganho, baseando-se EXCLUSIVAMENTE nos eventos da "LORE".
REGRAS:
1. NUNCA reescreva a descrição do poder no resumo. O resumo NÃO É para explicar como a habilidade funciona.
2. O resumo DEVE explicar QUAIS AÇÕES NA LORE (treinos, combates, descobertas) levaram o personagem a evoluir ou obter esse upgrade.
3. Crie um resumo ÚNICO e ESPECÍFICO para CADA upgrade processado. NUNCA copie e cole ou repita o mesmo resumo para upgrades diferentes.
4. Caso não haja menção ao upgrade ou treinamento correspondente na LORE, insira o aviso: "[AVISO DA IA: Não foi possível identificar o contexto ou a explicação na Lore para este upgrade]".
Retorne EXATAMENTE o mesmo JSON completo e atualizado no campo "resumo" (garanta que seja um JSON válido):
{ "upgrades": [ { "tipo": "...", "categoria": "...", "nome": "...", "descricao": "...", "resumo": "Nova justificativa NARRATIVA baseada na LORE aqui" } ] }${exemplosTreino}`;
    
    const prompt = `--- LORE ---\n${loreText}\n\n--- UPGRADES ---\n${JSON.stringify(upgradesObj)}`;
    return await chamarIA(sys, prompt, null, true, { client: interaction.client, userId: interaction.user.id });
}

async function listenerInteractionUpg(interaction, client) {
    if (interaction.isButton() && interaction.customId === 'upgrade_cancel') {
        return interaction.update({ content: '❌ Operação cancelada.', embeds: [], components: [] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('upgrade_queue_open_')) {
        await interaction.deferReply({ flags: 64 });
        const upgId = interaction.customId.split('_')[3];
        const upgDoc = await client.database.UpgradeModel.findById(upgId);
        if (!upgDoc) return interaction.editReply({ content: '❌ Este upgrade não foi encontrado ou já foi excluído.' });
        if (upgDoc.userId !== interaction.user.id) return interaction.editReply({ content: '❌ Você não é o dono destes upgrades e não pode visualizá-los desta forma.' });

        return mosFilaUpg(interaction, upgDoc, 0);
    }

    if (interaction.isButton() && interaction.customId.startsWith('upgrade_queue_nav_')) {
        await interaction.deferUpdate();
        const parts = interaction.customId.split('_');
        const navDir = parts[3];
        const upgId = parts[4];
        let index = parseInt(parts[5], 10);
        if (navDir === 'prev') index--;
        if (navDir === 'next') index++;
        const upgDoc = await client.database.UpgradeModel.findById(upgId);
        if (!upgDoc) return interaction.editReply({ content: '❌ Upgrade não encontrado no sistema.', embeds: [], components: [] });
        if (upgDoc.userId !== interaction.user.id) return interaction.followUp({ content: '❌ Você não é o dono destes upgrades.', flags: 64 });
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

            await safeEditReply(interaction, { content: `<@${interaction.user.id}>`, embeds: [new EmbedBuilder().setDescription(`Agora reaja com ➖ na **última** mensagem do seu treino.`).setColor([223, 108, 7])] });

            let { intervalo: intervaloFim, contador: contadorFim } = await iniciarContador(300, 'marcar a última mensagem com ➖', interaction.channel);
            let timeoutFimReaction;

            const lidFimUpg = async (reactionFim, userFim) => {
                try {
                    if (!filtroReaction(reactionFim, userFim) || reactionFim.emoji.name !== '➖') return;
                    clearTimeout(timeoutFimReaction);
                    await pararContador(null, intervaloFim, contadorFim);
                    if (contadorFim) await contadorFim.delete().catch(() => null);
                    const msgFim = reactionFim.message;
                    client.removeListener('messageReactionAdd', lidFimUpg);

                    if (msgIni.createdTimestamp > msgFim.createdTimestamp) {
                        await safeEditReply(interaction, { content: '❌ A mensagem inicial deve ser anterior à final. Vamos recomeçar o processo!', embeds: [embedCapturaTreino] });
                        const novoContadorIni = await iniciarContador(300, 'marcar a primeira mensagem com ➕', interaction.channel);
                        intervaloIni = novoContadorIni.intervalo;
                        contadorIni = novoContadorIni.contador;
                        client.on('messageReactionAdd', lidIniUpg);
                        timeoutIniReact = setTimeout(() => { client.removeListener('messageReactionAdd', lidIniUpg); safeEditReply(interaction, { content: '❌ Tempo esgotado para marcar o início.', embeds: [] }); }, 300000);
                        return;
                    }

                    await safeEditReply(interaction, { content: `<@${interaction.user.id}>\n<a:discordchristmas:1502159689528512612> Coletando mensagens do treino...`, embeds: [] });

                    const listaMsg = await buscaMsg(interaction.channel, msgIni.id, msgFim.id);
                    if (!listaMsg) return;

                    try {
                        const rep = await interaction.fetchReply().catch(()=>null);
                        if (rep) await rep.delete().catch(()=>null);
                    } catch(e) {}

                    let textoCapturado = `**🔗 CLIQUE AQUI PARA IR ATÉ A MENSAGEM ORIGINAL**\n\n`;
                    listaMsg.forEach(m => { if (m.content) textoCapturado += `${m.author.username}: ${m.content}\n\n`; });

                    cacheUpgradeSystem.set(interaction.user.id, { loreText: textoCapturado, upgAmount: 1, currentStep: 1, upgrades: [], aiMode: false });
                    
                    const embAi = new EmbedBuilder()
                        .setTitle('<a:rahhh:1502049620640006257> | CENTRAL DE UPGRADES | <a:rahhh:1502049620640006257>')
                        .setDescription('Treino (Lore) capturado com sucesso!\n\n**Como você deseja enviar os seus upgrades?**')
                        .setColor('#2b2d31');
                    const rowAi = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('upgrade_mode_chat').setLabel('Coletar do Chat (IA)').setStyle(ButtonStyle.Success).setEmoji('🤖'),
                        new ButtonBuilder().setCustomId('upgrade_mode_manual').setLabel('Preencher Manualmente').setStyle(ButtonStyle.Secondary)
                    );
                    
                    try {
                        await interaction.followUp({ content: `<@${interaction.user.id}>`, embeds: [embAi], components: [rowAi], flags: 64 });
                    } catch(e) {
                        await interaction.channel.send({ content: `<@${interaction.user.id}>`, embeds: [embAi], components: [rowAi] });
                    }
                } catch (errFimLore) {
                    console.error('[IA UPGRADE] Erro em captura de Lore:', errFimLore);
                    await safeEditReply(interaction, { content: `❌ Ocorreu um erro interno ao processar a captura do seu treino: \`${errFimLore.message}\``, embeds: [] }).catch(() => {});
                }
            };
            client.on('messageReactionAdd', lidFimUpg);
            timeoutFimReaction = setTimeout(() => { client.removeListener('messageReactionAdd', lidFimUpg); safeEditReply(interaction, { content: '❌ Tempo esgotado para marcar o fim.', embeds: [] }); }, 300000);
        };
        client.on('messageReactionAdd', lidIniUpg);
        timeoutIniReact = setTimeout(() => { client.removeListener('messageReactionAdd', lidIniUpg); safeEditReply(interaction, { content: '❌ Tempo esgotado para marcar o início.', embeds: [] }); }, 300000);
    }

    if (interaction.isButton() && interaction.customId === 'upgrade_mode_manual') {
        const cacheUpgradeSystemAtu = cacheUpgradeSystem.get(interaction.user.id);
        if (!cacheUpgradeSystemAtu) return interaction.reply({ content: 'Sessão expirada.', flags: 64 });
        await interaction.deferUpdate();
        await QntUpg(interaction, 1, true);
    }

    if (interaction.isButton() && interaction.customId === 'upgrade_mode_chat') {
        const cacheUpgradeSystemAtu = cacheUpgradeSystem.get(interaction.user.id);
        if (!cacheUpgradeSystemAtu) return interaction.reply({ content: 'Sessão expirada.', flags: 64 });
        
        try {
            await interaction.update({ content: `<@${interaction.user.id}>`, embeds: [new EmbedBuilder().setDescription('Reaja com ➕ na **primeira** mensagem onde estão listados seus UPGRADES no chat.').setColor([223, 108, 7])], components: [] });
        } catch(e) {
            await interaction.channel.send({ content: `<@${interaction.user.id}>`, embeds: [new EmbedBuilder().setDescription('Reaja com ➕ na **primeira** mensagem onde estão listados seus UPGRADES no chat.').setColor([223, 108, 7])] });
        }

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

            await safeEditReply(interaction, { content: `<@${interaction.user.id}>`, embeds: [new EmbedBuilder().setDescription(`Agora reaja com ➖ na **última** mensagem dos seus upgrades.`).setColor([223, 108, 7])] });

            let { intervalo: intervaloFim, contador: contadorFim } = await iniciarContador(300, 'marcar a última mensagem de upgrades com ➖', interaction.channel);
            let timeoutFimReaction;

            const lidFimUpg = async (reactionFim, userFim) => {
                try {
                    if (!filtroReaction(reactionFim, userFim) || reactionFim.emoji.name !== '➖') return;
                    clearTimeout(timeoutFimReaction);
                    await pararContador(null, intervaloFim, contadorFim);
                    if (contadorFim) await contadorFim.delete().catch(() => null);
                    const msgFim = reactionFim.message;
                    client.removeListener('messageReactionAdd', lidFimUpg);

                    if (msgIni.createdTimestamp > msgFim.createdTimestamp) {
                        try {
                            const rep = await interaction.fetchReply().catch(()=>null);
                            if(rep) await rep.delete().catch(()=>null);
                        } catch(e) {}
                        try {
                            return await interaction.followUp({ content: '❌ A mensagem inicial deve ser anterior à final. Você precisará recomeçar o processo de upgrades (use o comando /upgrade novamente).', embeds: [], flags: 64 });
                        } catch(e) {
                            return await interaction.channel.send({ content: `<@${interaction.user.id}>\n❌ A mensagem inicial deve ser anterior à final. Você precisará recomeçar o processo de upgrades (use o comando /upgrade novamente).` });
                        }
                    }

                    try {
                        const rep = await interaction.fetchReply().catch(()=>null);
                        if(rep) await rep.delete().catch(()=>null);
                    } catch(e) {}
                    
                    let msgLoading;
                    try {
                        msgLoading = await interaction.followUp({ content: `<@${interaction.user.id}>\n<a:discordchristmas:1502159689528512612> Lendo upgrades e gerando resumos com a IA... Isso pode levar alguns segundos.`, embeds: [], flags: 64 });
                    } catch(e) {
                        msgLoading = await interaction.channel.send({ content: `<@${interaction.user.id}>\n<a:discordchristmas:1502159689528512612> Lendo upgrades e gerando resumos com a IA... Isso pode levar alguns segundos.` });
                    }

                    const listaMsg = await buscaMsg(interaction.channel, msgIni.id, msgFim.id);
                    if (!listaMsg) return;

                    let upgradeText = ``;
                    listaMsg.forEach(m => { if (m.content) upgradeText += `${m.author.username}: ${m.content}\n\n`; });

                    let debugInfo = {};
                    const resultadoIA = await processarIA_Extrair(upgradeText, cacheUpgradeSystemAtu.loreText, client, interaction, debugInfo);
                    
                    if (msgLoading && typeof msgLoading.delete === 'function') {
                        await msgLoading.delete().catch(()=>null);
                    }

                    if (!resultadoIA || !resultadoIA.upgrades || resultadoIA.upgrades.length === 0) {
                        const files = [];
                        if (debugInfo.rawText) {
                            files.push(new AttachmentBuilder(Buffer.from(debugInfo.rawText, 'utf-8'), { name: 'ia_resposta_bruta.txt' }));
                        }
                        try {
                            await interaction.followUp({ content: '❌ Houve um erro na IA (ela não conseguiu retornar um formato válido). O arquivo anexado contém o que ela tentou responder para fins de análise. Redirecionando para o modo manual...', files: files, flags: 64 });
                        } catch(e) {
                            await interaction.channel.send({ content: `<@${interaction.user.id}>\n❌ Houve um erro na IA (ela não conseguiu retornar um formato válido). O arquivo anexado contém o que ela tentou responder para fins de análise. Redirecionando para o modo manual...`, files: files });
                        }
                        return QntUpg(interaction, 1, false);
                    }
                    
                    cacheUpgradeSystemAtu.aiMode = true;
                    cacheUpgradeSystemAtu.upgrades = resultadoIA.upgrades.map(u => ({...u, status: 'pendente'}));
                    cacheUpgradeSystemAtu.currentStep = 0; 
                    cacheUpgradeSystemAtu.upgAmount = cacheUpgradeSystemAtu.upgrades.length;
                    
                    await mosAiUpg(interaction, cacheUpgradeSystemAtu, false);
                } catch (errFimUpg) {
                    if (msgLoading && typeof msgLoading.delete === 'function') await msgLoading.delete().catch(()=>null);
                    console.error('[IA UPGRADE] Erro fatal em lidFimUpg:', errFimUpg);
                    try {
                        await interaction.followUp({ content: `❌ Ocorreu um erro interno durante a extração: \`${errFimUpg.message}\`. Redirecionando para o modo manual...`, embeds: [], flags: 64 });
                    } catch(e) {
                        await interaction.channel.send({ content: `<@${interaction.user.id}>\n❌ Ocorreu um erro interno durante a extração: \`${errFimUpg.message}\`. Redirecionando para o modo manual...` });
                    }
                    return QntUpg(interaction, 1, false);
                }
            };
            client.on('messageReactionAdd', lidFimUpg);
            timeoutFimReaction = setTimeout(() => { client.removeListener('messageReactionAdd', lidFimUpg); safeEditReply(interaction, { content: '❌ Tempo esgotado para marcar o fim.', embeds: [] }); }, 300000);
        };
        client.on('messageReactionAdd', lidIniUpg);
        timeoutIniReact = setTimeout(() => { client.removeListener('messageReactionAdd', lidIniUpg); safeEditReply(interaction, { content: '❌ Tempo esgotado para marcar o início.', embeds: [] }); }, 300000);
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
            cacheUpgradeSystemAtu.addingNew = false;
            await mosModUpg(interaction, cacheUpgradeSystemAtu.currentStep + 1, cacheUpgradeSystemAtu.upgAmount, cacheUpgradeSystemAtu.upgrades[cacheUpgradeSystemAtu.currentStep]);
        } else if (acao === 'add') {
            cacheUpgradeSystemAtu.addingNew = true;
            await mosModUpg(interaction, cacheUpgradeSystemAtu.upgAmount + 1, cacheUpgradeSystemAtu.upgAmount + 1);
        } else if (acao === 'remove') {
            if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
            cacheUpgradeSystemAtu.upgrades.splice(cacheUpgradeSystemAtu.currentStep, 1);
            cacheUpgradeSystemAtu.upgAmount--;
            if (cacheUpgradeSystemAtu.currentStep >= cacheUpgradeSystemAtu.upgAmount) {
                cacheUpgradeSystemAtu.currentStep = Math.max(0, cacheUpgradeSystemAtu.upgAmount - 1);
            }
            await mosAiUpg(interaction, cacheUpgradeSystemAtu, true);
        } else if (acao === 'editsummary') {
            const upgAtual = cacheUpgradeSystemAtu.upgrades[cacheUpgradeSystemAtu.currentStep];
            const modSumm = new ModalBuilder().setCustomId('upgrade_ai_modal_summary').setTitle('Editar Justificativa do Upgrade');
            modSumm.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('resumo_ai_input').setLabel('Justificativa da Lore').setStyle(TextInputStyle.Paragraph).setValue(upgAtual.resumo || '').setRequired(true)));
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
        if (!cacheUpgradeSystemAtu) return interaction.reply({ content: 'Sessão expirada.', flags: 64 });

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
            if (cacheUpgradeSystemAtual.addingNew) {
                cacheUpgradeSystemAtual.upgrades.push(dadosHabilidade);
                cacheUpgradeSystemAtual.upgAmount++;
                cacheUpgradeSystemAtual.currentStep = cacheUpgradeSystemAtual.upgAmount - 1;
                cacheUpgradeSystemAtual.addingNew = false;
            } else {
                cacheUpgradeSystemAtual.upgrades[cacheUpgradeSystemAtual.currentStep] = dadosHabilidade;
            }
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
                
                const resultadoIA = await processarIA_Resumo(cacheUpgradeSystemAtual.upgrades, cacheUpgradeSystemAtual.loreText, client, interaction);
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
        await interaction.deferReply({ flags: 64 });
        const idUpgAtual = interaction.customId.split('_')[3];
        const docDbUpgAtual = await client.database.UpgradeModel.findById(idUpgAtual);
        
        if (!docDbUpgAtual) return interaction.editReply({ content: '❌ Upgrade não encontrado.' });
        if (docDbUpgAtual.lockAdmod?.userId && docDbUpgAtual.lockAdmod.expiresAt > Date.now() && docDbUpgAtual.lockAdmod.userId !== interaction.user.id) {
            return interaction.editReply({ content: `🔒 Em avaliação por <@${docDbUpgAtual.lockAdmod.userId}>` });
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
            await interaction.deferUpdate();
            const [, , , acaoNavAdm, idNav] = interaction.customId.split('_');
            const cacheAdmNavigationStateAtu = cacheAdmNavigationState.get(interaction.user.id);
            if (!cacheAdmNavigationStateAtu) return interaction.editReply({ content: 'Sua sessão expirou.', embeds: [], components: [] });
            
            const docNavUpg = await client.database.UpgradeModel.findById(idNav);
            if (!docNavUpg) return interaction.editReply({ content: '❌ Upgrade não encontrado.' });
            
            if (acaoNavAdm === 'previousUpgd') { cacheAdmNavigationStateAtu.currentIndex--; }
            if (acaoNavAdm === 'nextUpgd') { cacheAdmNavigationStateAtu.currentIndex++; }
            if (acaoNavAdm === 'lore') return mosLorUpg(interaction, docNavUpg, 0);
            if (acaoNavAdm === 'context') {
                const upgAtualParaContexto = docNavUpg.upgrades[cacheAdmNavigationStateAtu.currentIndex];
                const msgLoading = await interaction.followUp({ content: '⏳ Analisando a Lore e gerando contexto com a IA...', flags: 64, fetchReply: true });
                
                const sysCtx = `Você é um assistente de moderação de RPG textual. O Admod pediu mais contexto sobre um upgrade específico baseado na Lore. Analise a LORE e o UPGRADE, e explique detalhadamente de onde esse poder/melhoria surgiu na narrativa, destacando os feitos e treinamentos associados a ele. Seja direto e analítico.`;
                const promptCtx = `--- LORE ---\n${docNavUpg.loreText.join('\n\n')}\n\n--- UPGRADE ---\nNome: ${upgAtualParaContexto.nome}\nDescrição: ${upgAtualParaContexto.descricao}\nJustificativa Atual: ${upgAtualParaContexto.resumo}`;
                
                const ctxResponse = await chamarIA(sysCtx, promptCtx, null, false, { client: interaction.client, userId: interaction.user.id });
                
                const embCtx = new EmbedBuilder()
                    .setTitle(`Contexto Extra: ${upgAtualParaContexto.nome}`)
                    .setColor('Purple')
                    .setDescription(ctxResponse ? ctxResponse.substring(0, 4000) : 'Falha ao gerar contexto adicional.');
                
                await interaction.webhook.editMessage(msgLoading.id, { content: null, embeds: [embCtx] }).catch(() => null);
                return;
            }
            if (acaoNavAdm === 'duvida') {
                const dbDuvidaExists = await client.database.UpgradeDuvida.findOne({ upgradeId: docNavUpg._id });
                if (dbDuvidaExists) {
                    const chan = await interaction.guild.channels.fetch(dbDuvidaExists.channelId).catch(() => null);
                    if (chan) {
                        return interaction.editReply({ content: `❌ Já existe um canal de dúvida para este treino: <#${dbDuvidaExists.channelId}>`, embeds: [], components: [] });
                    } else {
                        await client.database.UpgradeDuvida.findByIdAndDelete(dbDuvidaExists._id);
                    }
                }

                let categoria = interaction.guild.channels.cache.find(c => c.type === 4 && c.name.toLowerCase() === 'dúvidas de upgrades');
                if (!categoria) {
                    categoria = await interaction.guild.channels.create({
                        name: 'Dúvidas de Upgrades',
                        type: 4, 
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: ['ViewChannel'] },
                            { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
                        ]
                    });
                    const canais = await interaction.guild.channels.fetch();
                    const maxPos = Math.max(...canais.filter(c => c.type === 4).map(c => c.rawPosition));
                    await categoria.setPosition(maxPos + 1).catch(() => null);
                }

                const jogador = await client.users.fetch(docNavUpg.userId).catch(() => null);
                const nomeAjustado = jogador ? jogador.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10) : docNavUpg.userId;
                const nomeCanal = `duvida-${nomeAjustado}`;

                const novoCanal = await interaction.guild.channels.create({
                    name: nomeCanal,
                    type: 0, 
                    parent: categoria.id,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: ['ViewChannel'] },
                        { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                        { id: docNavUpg.userId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
                        { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
                    ]
                });

                await client.database.UpgradeDuvida.create({
                    channelId: novoCanal.id,
                    upgradeId: docNavUpg._id,
                    admodId: interaction.user.id,
                    userId: docNavUpg.userId,
                    expiresAt: Date.now() + (12 * 60 * 60 * 1000),
                    nextReminderAt: Date.now() + (2 * 60 * 60 * 1000)
                });

                await novoCanal.send({
                    content: `Olá <@${docNavUpg.userId}> e <@${interaction.user.id}>!`,
                    embeds: [new EmbedBuilder().setTitle('❓ Dúvida sobre o Upgrade').setColor('Orange').setDescription(`Este canal foi criado para que o Admod possa esclarecer dúvidas sobre os upgrades solicitados.\n\n<@${interaction.user.id}>, por favor, diga qual a sua dúvida em relação ao treino para que o jogador possa responder.\n\n*⏳ Este canal expira em 12 horas, mas o tempo é renovado a cada nova mensagem enviada.*\n*O Admod pode enviar a palavra **Finalizar** neste chat para excluí-lo.*`)]
                });

                return interaction.editReply({ content: `✅ Canal de dúvida criado com sucesso: ${novoCanal.toString()}`, embeds: [], components: [] });
            }
            if (acaoNavAdm === 'close') {
                docNavUpg.lockAdmod = null;
                await docNavUpg.save();
                return interaction.editReply({ content: 'Painel fechado.', embeds: [], components: [] });
            }
            await navAdmUpg(interaction, client, docNavUpg, true);
            return;
        }
    }

    if (interaction.isButton() && (interaction.customId.startsWith('upgrade_adm_navegar_lorePrev_') || interaction.customId.startsWith('upgrade_adm_navegar_loreNext_'))) {
        await interaction.deferUpdate();
        const parts = interaction.customId.split('_');
        const isNext = parts[3] === 'loreNext';
        const idNav = parts[4];
        let pagina = parseInt(parts[5]);
        pagina = isNext ? pagina + 1 : Math.max(0, pagina - 1);
        
        const docNavUpg = await client.database.UpgradeModel.findById(idNav);
        if (!docNavUpg) return interaction.editReply({ content: '❌ Upgrade não encontrado.' });
        return mosLorUpg(interaction, docNavUpg, pagina);
    }

    if (interaction.isButton() && (interaction.customId.startsWith('upgrade_adm_navegar_accept_') || interaction.customId.startsWith('upgrade_adm_navegar_reject_'))) {
        const parts = interaction.customId.split('_');
        const acao = parts[3]; // accept ou reject
        const escopo = parts[4]; // currentUpgd ou allUpgd
        const idDocDbUpg = parts[5]; // O ID do documento

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
            if (escopo === 'allUpgd') {
                const rowConfirm = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`upgrade_adm_confirmRejectAll_${idDocDbUpg}`).setLabel('Tenho certeza, rejeitar todos').setStyle(ButtonStyle.Danger)
                );
                return interaction.reply({ content: '⚠️ **Tem certeza?** Você está prestes a REJEITAR TODOS os upgrades dessa solicitação. A mesma justificativa será aplicada a todos.', components: [rowConfirm], flags: 64 });
            }

            const modRejUpg = new ModalBuilder().setCustomId(`upgrade_adm_modal_reject_${escopo}_${idDocDbUpg}`).setTitle('Motivo da Rejeição');
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

    if (interaction.isButton() && interaction.customId.startsWith('upgrade_adm_confirmRejectAll_')) {
        const idDocDbUpg = interaction.customId.split('_')[3];
        const modRejUpg = new ModalBuilder().setCustomId(`upgrade_adm_modal_reject_allUpgd_${idDocDbUpg}`).setTitle('Rejeitar Todos Upgrades');
        modRejUpg.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('upgrade_adm_modal_reject_input_motif').setLabel('Justificativa Geral').setStyle(TextInputStyle.Paragraph).setRequired(true)));
        return interaction.showModal(modRejUpg);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('upgrade_adm_modal_accept_')) {
        await interaction.deferUpdate();
        const parts = interaction.customId.split('_');
        let escopo = parts[4];
        let idAccUpg = parts[5];
        if (!idAccUpg) {
            idAccUpg = escopo;
            escopo = 'currentUpgd';
        }
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
        const parts = interaction.customId.split('_');
        let escopo = parts[4];
        let idRejectedUpg = parts[5];
        if (!idRejectedUpg) {
            idRejectedUpg = escopo;
            escopo = 'currentUpgd';
        }
        const motifRejectedUpg = interaction.fields.getTextInputValue('upgrade_adm_modal_reject_input_motif');
        const docDbRejectedUpg = await client.database.UpgradeModel.findById(idRejectedUpg);
        const cacheAdmNavigationStateAtu = cacheAdmNavigationState.get(interaction.user.id);
        
        if (escopo === 'allUpgd' || docDbRejectedUpg.upgrades.length === 1) {
            docDbRejectedUpg.status = 'recusado';
            docDbRejectedUpg.upgrades.forEach(u => { u.status = 'recusado'; u.motivo = motifRejectedUpg; });
            docDbRejectedUpg.AdmodAvaliou = interaction.user.id;
            await docDbRejectedUpg.save();
            await atualStatusUpg(interaction, client, docDbRejectedUpg, `Recusados: ${motifRejectedUpg}`);
            return interaction.editReply({ content: '❌ Avaliação concluída (Todos Recusados)!', embeds: [], components: [] });
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

module.exports = { listenerInteractionUpg, cacheUpgradeSystem, QntUpg, chamarIA };

async function QntUpg(interaction, qntAtual, qntNova = false) {
    const emb = new EmbedBuilder().setTitle('<a:rahhh:1502049620640006257> | CENTRAL DE UPGRADES | <a:rahhh:1502049620640006257>').setAuthor({name: 'Sistema de Treinos', iconURL: interaction.guild.iconURL()}).setDescription('Ajuste quantos upgrades deseja registrar.').setColor('#2b2d31');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('upgrade_qntUpgrade_reduzir').setLabel('➖').setStyle(ButtonStyle.Secondary).setDisabled(qntAtual <= 1),
        new ButtonBuilder().setCustomId('upgrade_qntUpgrade_confirmar').setLabel(`${qntAtual}`).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('upgrade_qntUpgrade_aumentar').setLabel('➕').setStyle(ButtonStyle.Secondary)
    );
    const opcQntd = { content: `<@${interaction.user.id}>`, embeds: [emb], components: [row] };
    try {
        if (qntNova) { await interaction.editReply(opcQntd); } 
        else { opcQntd.flags = 64; await interaction.followUp(opcQntd); }
    } catch (e) {
        delete opcQntd.flags;
        await interaction.channel.send(opcQntd);
    }
}

async function mosAiUpg(interaction, cacheData, isUpdate = false) {
    const upg = cacheData.upgrades[cacheData.currentStep];
    
    const embed = new EmbedBuilder()
        .setTitle(`<a:rahhh:1502049620640006257> | CENTRAL DE UPGRADES (IA) | <a:rahhh:1502049620640006257>`)
        .setDescription(`**Foram identificados ${cacheData.upgAmount} upgrades!**\nRevise-os abaixo e edite se necessário.`)
        .addFields(
            { name: `Upgrade ${cacheData.currentStep + 1}/${cacheData.upgAmount}`, value: `**Nome:** ${String(upg.nome || 'Desconhecido').substring(0, 300)}\n**Tipo:** ${String(upg.tipo || 'Desconhecido').substring(0, 300)}\n**Categoria:** ${String(upg.categoria || 'Desconhecida').substring(0, 300)}` },
            { name: 'Descrição / Valor', value: String(upg.descricao || 'Sem descrição').substring(0, 1024) },
            { name: 'Justificativa (Lore)', value: String(upg.resumo || 'Sem resumo').substring(0, 1024) }
        )
        .setColor('#2b2d31');

    const rowNav = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('upgrade_ai_nav_prev').setEmoji('◀️').setStyle(ButtonStyle.Primary).setDisabled(cacheData.currentStep === 0),
        new ButtonBuilder().setCustomId('upgrade_ai_nav_edit').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('upgrade_ai_nav_next').setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(cacheData.currentStep === cacheData.upgAmount - 1)
    );

    const rowAcao = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('upgrade_ai_nav_add').setLabel('Adicionar').setStyle(ButtonStyle.Secondary).setEmoji('➕'),
        new ButtonBuilder().setCustomId('upgrade_ai_nav_remove').setLabel('Remover').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(cacheData.upgAmount <= 1),
            new ButtonBuilder().setCustomId('upgrade_ai_nav_editsummary').setLabel('Editar Justificativa').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('upgrade_ai_nav_confirm').setLabel('Confirmar e Enviar').setStyle(ButtonStyle.Success).setEmoji('✅')
    );

    const payload = { embeds: [embed], components: [rowNav, rowAcao] };
    try {
        if (isUpdate) { await interaction.editReply(payload); }
            else { 
                payload.flags = 64; 
                payload.content = `<@${interaction.user.id}>`;
                await interaction.followUp(payload); 
            }
    } catch (e) {
        delete payload.flags;
            payload.content = `<@${interaction.user.id}>`;
        await interaction.channel.send(payload);
    }
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
        .setDescription(String(upg.descricao || 'Sem descrição').substring(0, 4000))
        .addFields(
            { name: 'Tipo/Categoria', value: `${String(upg.tipo || 'Desconhecido').substring(0, 100)} | ${String(upg.categoria || 'Desconhecida').substring(0, 100)}`, inline: true },
            { name: 'Status', value: upg.status, inline: true },
            { name: 'Justificativa', value: String(upg.resumo || 'Sem resumo').substring(0, 1024) }
        ).setFooter({ text: `Central de Upgrades` });

    if (upg.motivo) embed.addFields({ name: isUpgRejected ? 'Motivo da Recusa' : 'Resultado/Feedback', value: upg.motivo });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`upgrade_queue_nav_prev_${upgDoc._id}_${index}`).setEmoji('◀️').setStyle(ButtonStyle.Primary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId(`upgrade_queue_nav_next_${upgDoc._id}_${index}`).setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(index === upgDoc.upgrades.length - 1)
    );
    const payload = { embeds: [embed], components: [row], flags: 64 };
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
    } else if (isUpdate) {
        await interaction.update(payload);
    } else {
        await interaction.reply(payload);
    }
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
    if (prefill) inputTipoHabilidade.setValue(String(prefill.tipo || '').substring(0, 100)); else if (isDev) inputTipoHabilidade.setValue("Física");

    const inputCategoriaHabilidade = new TextInputBuilder()
        .setCustomId('upgrade_modal_input_categoria')
        .setLabel('Categoria')
        .setPlaceholder('Principal, sub-habilidade ou técnica')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    if (prefill) inputCategoriaHabilidade.setValue(String(prefill.categoria || '').substring(0, 100)); else if (isDev) inputCategoriaHabilidade.setValue("Técnica");

    const inputNomeHabilidade = new TextInputBuilder().setCustomId('upgrade_modal_input_nome').setLabel('Nome').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(400).setPlaceholder('Insira o nome da habilidade ou status para upgrade')
    if (prefill) inputNomeHabilidade.setValue(String(prefill.nome || '').substring(0, 400)); else if (isDev) inputNomeHabilidade.setValue("Golpe de Teste");
    
    const inputDescricao = new TextInputBuilder().setCustomId('upgrade_modal_input_descricao').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Descreva o upgrade ou habilidade a ser desbloqueada')
    if (prefill) inputDescricao.setValue(String(prefill.descricao || '').substring(0, 4000)); else if (isDev) inputDescricao.setValue(lorem);
    
    const inputResumo = new TextInputBuilder().setCustomId('upgrade_modal_input_resumo').setLabel('Justificativa do Treino').setPlaceholder('Deixe em branco para a IA gerar automaticamente').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000);
    if (prefill) inputResumo.setValue(String(prefill.resumo || '').substring(0, 1000)); else if (isDev) inputResumo.setValue(lorem);

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

    const filaChannel = await client.channels.fetch(FILA_CHANNEL_ID).catch(() => null);
    const pendentAdmChannel = await client.channels.fetch(ADM_CHANNEL_ID).catch(() => null);
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
    
    const logChaId = '1409063037905670154';
    if (logChaId) {
        const logChannel = await client.channels.fetch(logChaId).catch(() => null);
        if (logChannel) {
            const embedLog = new EmbedBuilder()
                .setTitle('📤 Novo Treino Enviado')
                .setColor('Blue')
                .setDescription(`O jogador <@${interaction.user.id}> enviou um novo treino para avaliação.`)
                .addFields(
                    { name: 'Quantidade de Upgrades', value: `${listaUpg.upgrades.length}`, inline: true },
                    { name: 'ID do Treino', value: `${upgDoc._id}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `ID do Jogador: ${interaction.user.id}`, iconURL: interaction.user.displayAvatarURL() });
            await logChannel.send({ embeds: [embedLog] }).catch(() => {});
        }
    }
    
    if (listaUpg.aiMode) {
        try {
            const resumosTreino = listaUpg.upgrades.filter(u => u.resumo && u.resumo.length > 20).map(u => ({ nome: u.nome, resumo: u.resumo }));
            if (resumosTreino.length > 0) {
                await client.database.AiTraining.create({
                    tipo: 'estilo_resumo',
                    exemplos: resumosTreino
                });
            }
        } catch(e) {}
    }

    cacheUpgradeSystem.delete(interaction.user.id);
    await interaction.editReply({ content: `✅ Upgrades enviados! Aguarde avaliação e acompanhe o status em ${filaChannel ? filaChannel.toString() : 'nossa fila'}! Você receberá notificação na DM quando for avaliado.`, embeds: [] });
}

async function navAdmUpg(interaction, client, upgDocDb, updated = false) {
    const AdmAtual = cacheAdmNavigationState.get(interaction.user.id);
    const upgAtual = upgDocDb.upgrades[AdmAtual.currentIndex];
    
    const embedUpgAtual = new EmbedBuilder()
        .setTitle(`Avaliação: ${upgAtual.nome} (${AdmAtual.currentIndex + 1}/${upgDocDb.upgrades.length})`)
        .setColor(upgAtual.status === 'aprovado' ? 'Green' : 'Blue')
        .setDescription(String(upgAtual.descricao || 'Sem descrição').substring(0, 4000))
        .addFields(
            { name: 'Tipo/Categoria', value: `${String(upgAtual.tipo || 'Desconhecido').substring(0, 100)} | ${String(upgAtual.categoria || 'Desconhecida').substring(0, 100)}`, inline: true },
            { name: 'Status do Upgrade', value: upgAtual.status, inline: true },
            { name: 'Justificativa', value: String(upgAtual.resumo || 'Sem resumo').substring(0, 1024) }
        )
        .setFooter({ text: `Jogador <@${upgDocDb.userId}>` });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_previousUpgd_${upgDocDb._id}`).setEmoji('🔙').setStyle(ButtonStyle.Secondary).setDisabled(AdmAtual.currentIndex === 0),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_nextUpgd_${upgDocDb._id}`).setEmoji('🔜').setStyle(ButtonStyle.Secondary).setDisabled(AdmAtual.currentIndex === upgDocDb.upgrades.length - 1),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_lore_${upgDocDb._id}`).setEmoji('👁‍🗨').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_duvida_${upgDocDb._id}`).setEmoji('❓').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_close_${upgDocDb._id}`).setEmoji('❌').setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_context_${upgDocDb._id}`).setEmoji('❇️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_accept_currentUpgd_${upgDocDb._id}`).setEmoji('☑️').setStyle(ButtonStyle.Success).setDisabled(upgAtual.status !== 'pendente'),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_accept_allUpgd_${upgDocDb._id}`).setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_reject_currentUpgd_${upgDocDb._id}`).setEmoji('🚫').setStyle(ButtonStyle.Danger).setDisabled(upgAtual.status !== 'pendente'),
        new ButtonBuilder().setCustomId(`upgrade_adm_navegar_reject_allUpgd_${upgDocDb._id}`).setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    );

    const embedLegenda = new EmbedBuilder()
        .setColor('Grey')
        .setTitle('Legenda de Ações')
        .setDescription(
            `🔙 **Anterior** - Navega para o upgrade anterior.\n` +
            `🔜 **Próximo** - Navega para o próximo upgrade.\n` +
            `👁‍🗨 **Ver Lore** - Abre a narrativa enviada pelo jogador.\n` +
            `❓ **Tirar Dúvida** - Cria um canal privado com o jogador.\n` +
            `❇️ **Contexto** - Pede para a IA explicar de onde surgiu o upgrade atual.\n` +
            `❌ **Fechar Painel** - Sai do modo de avaliação e libera para outro Admod.\n` +
            `☑️ **Aprovar Atual** - Aprova apenas o upgrade selecionado na tela.\n` +
            `✅ **Aprovar Todos** - Aprova toda a solicitação de uma vez.\n` +
            `🚫 **Recusar Atual** - Recusa apenas o upgrade selecionado.\n` +
            `🗑️ **Recusar Todos** - Recusa toda a solicitação de uma vez.`
        );

    const botoesEmbedAdm = { embeds: [embedUpgAtual, embedLegenda], components: [row1, row2], flags: 64 };
    if (interaction.deferred || interaction.replied) { 
        await interaction.editReply(botoesEmbedAdm);
    } else if (updated) { 
        await interaction.update(botoesEmbedAdm);
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
    try {
        const dbDuvidaExists = await client.database.UpgradeDuvida.findOne({ upgradeId: upgDocDb._id });
        if (dbDuvidaExists) {
            const chan = await interaction.guild.channels.fetch(dbDuvidaExists.channelId).catch(() => null);
            if (chan) {
                const parent = chan.parent;
                await chan.delete().catch(() => null);
                if (parent && parent.name.toLowerCase() === 'dúvidas de upgrades' && parent.children.cache.size <= 1) {
                    await parent.delete().catch(() => null);
                }
            }
            await client.database.UpgradeDuvida.deleteOne({ _id: dbDuvidaExists._id });
        }
    } catch (e) {}

    try {
        const admodData = await client.database.userData.findOne({ uid: interaction.user.id, uServer: interaction.guildId });
        if (admodData) {
            admodData.treinosAvaliados = (admodData.treinosAvaliados || 0) + 1;
            await admodData.save();
        }
    } catch (e) {
        console.error('[UPGRADE] Erro ao contabilizar treino avaliado:', e);
    }

    const filaChannel = await client.channels.fetch(FILA_CHANNEL_ID).catch(() => null);
    const pendentUpgChannel = await client.channels.fetch(ADM_CHANNEL_ID).catch(() => null);

    const isAllRejected = upgDocDb.upgrades.every(u => u.status === 'recusado');
    const isSomeRejected = upgDocDb.upgrades.some(u => u.status === 'recusado');
    const resultColor = isAllRejected ? 'Red' : (isSomeRejected ? 'Orange' : 'Green');

    const logChaId = '1409063037905670154';
    if (logChaId) {
        const logChannel = await client.channels.fetch(logChaId).catch(() => null);
        if (logChannel) {
            const embedLog = new EmbedBuilder()
                .setTitle('✅ Treino Avaliado')
                .setColor(resultColor)
                .setDescription(`O admod <@${interaction.user.id}> avaliou o treino do jogador <@${upgDocDb.userId}>.`)
                .addFields(
                    { name: 'Resultado', value: result },
                    { name: 'ID do Treino', value: `${upgDocDb._id}` }
                )
                .setTimestamp()
                .setFooter({ text: `Avaliador: ${interaction.user.id} | Jogador: ${upgDocDb.userId}`, iconURL: interaction.user.displayAvatarURL() });
            await logChannel.send({ embeds: [embedLog] }).catch(() => {});
        }
    }

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