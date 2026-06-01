const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const Command = require('../../structures/Command');
const { extrairFicha } = require('../../structures/fichaParser');
const { Ficha } = require('../../mongoose');
const { gerarRespostaComFallback, extrairSkillsPorIA } = require('../../api/IAUtils');

module.exports = class ficha extends Command {
    constructor(client) {
        super(client, {
            name: "ficha",
            description: "Administração de fichas de personagem",
            category: "rpg",
            aliases: [],
            UserPermission: [],
            clientPermission: [],
            OnlyDevs: false,
            slash: true,
        });

        if (this.config.slash) {
            this.data = new SlashCommandBuilder()
                .setName(this.config.name)
                .setDescription(this.config.description)
                .addSubcommand(sub =>
                    sub.setName('importar')
                        .setDescription('Importa uma ficha. Pode puxar as mensagens deste canal/tópico automaticamente.')
                        .addStringOption(opt =>
                            opt.setName('texto')
                                .setDescription('Cole o texto manualmente (se não quiser varrer o canal)')
                                .setRequired(false)
                        )
                        .addUserOption(opt =>
                            opt.setName('usuario')
                                .setDescription('De quem é a ficha? (Padrão: você)')
                                .setRequired(false)
                        )
                        .addChannelOption(opt =>
                            opt.setName('canal')
                                .setDescription('O canal ou tópico fechado de onde extrair as mensagens')
                                .setRequired(false)
                        )
                        .addChannelOption(opt =>
                            opt.setName('canal2')
                                .setDescription('Opcional: Um SEGUNDO canal/fórum para juntar na mesma ficha')
                                .setRequired(false)
                        )
                        .addIntegerOption(opt =>
                            opt.setName('limite')
                                .setDescription('Quantas mensagens voltar no canal? (Máx 1000, Padrão 200)')
                                .setRequired(false)
                                .setMaxValue(1000)
                                .setMinValue(1)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName('ver')
                        .setDescription('Visualiza a ficha de um personagem')
                        .addStringOption(opt =>
                            opt.setName('nome')
                                .setDescription('Nome do personagem')
                                .setRequired(true)
                        )
                );
        }
    }

    async execute(interaction) {
        const subCmd = interaction.options.getSubcommand();

        if (subCmd === 'importar') {
            await interaction.deferReply({ ephemeral: true });

            const textoManual = interaction.options.getString('texto');
            const targetUser = interaction.options.getUser('usuario') || interaction.user;
            const canalAlvo = interaction.options.getChannel('canal') || interaction.channel;
            const limite = interaction.options.getInteger('limite') || 200;

            let textoFinal = '';

            const canalAlvo2 = interaction.options.getChannel('canal2');
            let canaisAlvo = [canalAlvo];
            if (canalAlvo2) canaisAlvo.push(canalAlvo2);

            const { gerarRespostaComFallback } = require('../../api/IAUtils');

            let blocosBrutos = []; // Guarda as mensagens agrupadas por tópico

            if (textoManual) {
                blocosBrutos.push({ titulo: "Ficha Geral", texto: textoManual });
            } else {
                for (const c of canaisAlvo) {
                    let canalResolvido = c;
                    if (!canalResolvido.messages) {
                        try {
                            canalResolvido = await interaction.client.channels.fetch(c.id);
                        } catch (e) {
                            return interaction.editReply(`❌ Erro ao buscar dados do canal ${c.name}: ${e.message}`);
                        }
                    }

                    try {
                        // Se for um Fórum (Type 15)
                        if (canalResolvido.type === 15) {
                            const activeThreads = await canalResolvido.threads.fetchActive();
                            const archivedThreads = await canalResolvido.threads.fetchArchived({ limit: 50 });
                            
                            const todasAsThreads = [
                                ...Array.from(activeThreads.threads.values()),
                                ...Array.from(archivedThreads.threads.values())
                            ];

                            // Para cada thread, vamos puxar as mensagens e criar um bloco
                            for (const thread of todasAsThreads) {
                                let msgsDoTopico = [];
                                let last_id;
                                let fetchedCount = 0;
                                while (fetchedCount < 100) {
                                    const fetchOptions = { limit: Math.min(100, 100 - fetchedCount) };
                                    if (last_id) fetchOptions.before = last_id;

                                    const msgs = await thread.messages.fetch(fetchOptions);
                                    if (msgs.size === 0) break;

                                    msgs.forEach(m => {
                                        if (m.author.id === targetUser.id && m.content.trim().length > 0) {
                                            msgsDoTopico.push(m);
                                        }
                                    });
                                    last_id = msgs.last().id;
                                    fetchedCount += msgs.size;
                                }
                                
                                if (msgsDoTopico.length > 0) {
                                    msgsDoTopico.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                                    msgsDoTopico.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                                    blocosBrutos.push({
                                        titulo: thread.name,
                                        texto: msgsDoTopico.map(m => m.content).join('\n\n'),
                                        mensagens: msgsDoTopico.map(m => ({
                                            content: m.content,
                                            imagemURL: m.attachments.size > 0 ? m.attachments.first().url : null
                                        }))
                                    });
                                }
                            }
                        } 
                        // Se for um canal de texto normal ou Thread isolada
                        else if (canalResolvido.isTextBased()) {
                            let msgsDoCanal = [];
                            let last_id;
                            let fetchedCount = 0;

                            while (fetchedCount < limite) {
                                const fetchOptions = { limit: Math.min(100, limite - fetchedCount) };
                                if (last_id) fetchOptions.before = last_id;

                                const mensagensObtidas = await canalResolvido.messages.fetch(fetchOptions);
                                if (mensagensObtidas.size === 0) break;

                                mensagensObtidas.forEach(m => {
                                    if (m.author.id === targetUser.id && m.content.trim().length > 0) {
                                        msgsDoCanal.push(m);
                                    }
                                });
                                last_id = mensagensObtidas.last().id;
                                fetchedCount += mensagensObtidas.size;
                            }

                            if (msgsDoCanal.length > 0) {
                                msgsDoCanal.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                                msgsDoCanal.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                                blocosBrutos.push({
                                    titulo: canalResolvido.name,
                                    texto: msgsDoCanal.map(m => m.content).join('\n\n'),
                                    mensagens: msgsDoCanal.map(m => ({
                                        content: m.content,
                                        imagemURL: m.attachments.size > 0 ? m.attachments.first().url : null
                                    }))
                                });
                            }
                        } else {
                             return interaction.editReply(`❌ O canal selecionado não é um fórum nem um canal de texto válido (Tipo: ${canalResolvido.type}).`);
                        }
                    } catch (e) {
                        return interaction.editReply(`❌ Não consegui ler as mensagens do canal ${c.name}. Erro: ${e.message}`);
                    }
                }

                if (blocosBrutos.length === 0) {
                    return interaction.editReply(`❌ Não encontrei nenhuma mensagem enviada por ${targetUser} nos canais selecionados.`);
                }

                // DUMP DE DEBUG: Salva o texto bruto em um arquivo local para o Agente analisar
                try {
                    require('fs').writeFileSync('debug_ficha_raw.json', JSON.stringify(blocosBrutos, null, 2));
                    console.log('✅ Dados brutos da ficha salvos em debug_ficha_raw.json para análise do agente.');
                } catch(e) {
                    console.error('Falha ao salvar dump de debug', e);
                }
            }

            // --- MAPEAMENTO DIRETO (SEM IA) ---
            // Em vez de usar IA para tentar adivinhar a qual sistema a aba pertence, 
            // o bot simplesmente adotará o título da aba/postagem do fórum como a categoria exata.
            let mapeamentoSistemas = {};
            blocosBrutos.forEach(b => mapeamentoSistemas[b.titulo] = b.titulo);

            const fichaExtraida = extrairFicha(blocosBrutos, mapeamentoSistemas);

            function isTitle(line) {
                if (!line || line.trim() === '') return false;
                let trimmed = line.trim();
                if (trimmed.length > 80) return false;
                if (/^[\p{Emoji_Presentation}\p{Extended_Pictographic}★✡️🔴🟡🔵🟢🔱📓📋📖👾👺🪬🌍❌🔸✏️🎲⏳♥️♾️👁️‍🗨️🐉⏱️💀🜏•]/u.test(trimmed)) return true;
                if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.length > 5) return true;
                return false;
            }

            function splitTextIntoSkills(text) {
                if (!text) return [];
                const lines = text.split('\n');
                let blocks = [];
                let currentBlock = [];
                let currentTitle = null;

                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i];
                    let isStandalone = (i === 0 || lines[i-1].trim() === '') && isTitle(line);

                    if (isStandalone && currentBlock.join('\n').trim().length > 0) {
                        let textoBruto = currentBlock.join('\n').trim();
                        if (currentTitle && textoBruto.startsWith(currentTitle)) {
                            textoBruto = textoBruto.substring(currentTitle.length).trim();
                        }
                        blocks.push({
                            titulo: currentTitle,
                            texto: textoBruto
                        });
                        currentBlock = [line];
                        currentTitle = line.trim();
                    } else {
                        currentBlock.push(line);
                        if (currentBlock.length === 1 && isTitle(line)) {
                            currentTitle = line.trim();
                        }
                    }
                }
                if (currentBlock.length > 0) {
                    let textoBruto = currentBlock.join('\n').trim();
                    if (currentTitle && textoBruto.startsWith(currentTitle)) {
                        textoBruto = textoBruto.substring(currentTitle.length).trim();
                    }
                    blocks.push({
                        titulo: currentTitle,
                        texto: textoBruto
                    });
                }
                
                // Agrupar blocos pequenos (ex: listas de atributos, status do pet)
                let mergedBlocks = [];
                let buffer = [];
                
                for (let i = 0; i < blocks.length; i++) {
                    let b = blocks[i];
                    let totalChars = (b.titulo ? b.titulo.length : 0) + (b.texto ? b.texto.length : 0);
                    
                    if (totalChars < 150) {
                        buffer.push(b);
                    } else {
                        if (buffer.length === 1) {
                            if (buffer[0].texto.trim() === '') {
                                b.titulo = buffer[0].titulo + (b.titulo ? ' - ' + b.titulo : '');
                            } else {
                                mergedBlocks.push(buffer[0]);
                            }
                        } else if (buffer.length > 1) {
                            let mergedText = buffer.map(x => (x.titulo ? x.titulo + '\n' : '') + x.texto).join('\n\n');
                            mergedBlocks.push({
                                titulo: buffer[0].titulo || 'Informações Gerais',
                                texto: mergedText
                            });
                        }
                        buffer = [];
                        mergedBlocks.push(b);
                    }
                }
                
                if (buffer.length === 1) {
                    mergedBlocks.push(buffer[0]);
                } else if (buffer.length > 1) {
                    let mergedText = buffer.map(x => (x.titulo ? x.titulo + '\n' : '') + x.texto).join('\n\n');
                    mergedBlocks.push({
                        titulo: buffer[0].titulo || 'Informações Gerais',
                        texto: mergedText
                    });
                }

                return mergedBlocks;
            }

            fichaExtraida.habilidades = [];
            for (const bloco of blocosBrutos) {
                const sysNome = bloco.titulo;
                if (!fichaExtraida.sistemas || !fichaExtraida.sistemas[sysNome]) continue;

                let pageNum = 1;
                for (const msg of bloco.mensagens) {
                    const skills = splitTextIntoSkills(msg.content);
                    if (skills.length === 0 && msg.imagemURL) {
                        fichaExtraida.habilidades.push({
                            sistema: sysNome,
                            nome: `${sysNome} (Imagem/Anexo)`,
                            descricao: '*(Apenas imagem)*',
                            imagemURL: msg.imagemURL,
                            tipo: 'Imagem'
                        });
                        continue;
                    }

                    skills.forEach((sk, idx) => {
                        let textToSlice = sk.texto || '';
                        
                        // Ignorar blocos de "Títulos Vazios" sem imagem
                        if (textToSlice.trim() === '' && (!msg.imagemURL || idx > 0)) return;

                        let iterou = false;
                        while (textToSlice.length > 0 || !iterou) {
                            iterou = true;
                            let slice = textToSlice.substring(0, 4000);
                            let lastNewline = slice.lastIndexOf('\n\n');
                            
                            if (lastNewline > 3000 && textToSlice.length > 4000) {
                                slice = textToSlice.substring(0, lastNewline);
                                textToSlice = textToSlice.substring(lastNewline).trim();
                            } else {
                                textToSlice = textToSlice.substring(slice.length).trim();
                            }

                            fichaExtraida.habilidades.push({
                                sistema: sysNome,
                                nome: sk.titulo || `${sysNome} (Parte ${pageNum})`,
                                descricao: slice || '*(Sem descrição)*',
                                imagemURL: idx === 0 ? msg.imagemURL : null,
                                tipo: 'Regex'
                            });
                            pageNum++;
                        }
                    });
                }
            }

            let state = {
                sistemaVisualizado: null,
                paginaAtual: 0,
                menuPage: 0
            };

            const formatEmbedCapaPreview = () => {
                const embedPreview = new EmbedBuilder()
                    .setTitle(`Preview da Extração: ${fichaExtraida.nome}`)
                    .setColor('#2b2d31')
                    .setDescription('Verifique os dados extraídos. Navegue pelo menu abaixo para visualizar todas as abas. Confirme para Salvar ou Atualizar.');

                let basicosStr = '';
                for (const [key, value] of Object.entries(fichaExtraida.dados_basicos)) {
                    basicosStr += `**${key}:** ${value}\n`;
                }
                if (basicosStr) embedPreview.addFields({ name: 'Dados Básicos', value: basicosStr.substring(0, 1024) });

                let statusStr = '';
                for (const [key, value] of Object.entries(fichaExtraida.status)) {
                    statusStr += `**${key}:** ${value}\n`;
                }
                if (statusStr) embedPreview.addFields({ name: 'Status', value: statusStr.substring(0, 1024) });

                const sysNomesArr = Object.keys(fichaExtraida.sistemas || {});
                const qtdSistemas = sysNomesArr.length;
                if (qtdSistemas > 0) {
                    const startIdx = state.menuPage * 20;
                    const endIdx = Math.min(startIdx + 20, qtdSistemas);
                    const sysNomesSlice = sysNomesArr.slice(startIdx, endIdx);
                    
                    let valStr = `Foram mapeados **${qtdSistemas}** fóruns/abas adicionais.\nMostrando sistemas **${startIdx + 1} a ${endIdx}** da página atual:\n*${sysNomesSlice.join(', ')}*\nEles serão salvos como abas independentes na ficha.`;
                    embedPreview.addFields({ name: `Sistemas Identificados (Pág. ${state.menuPage + 1})`, value: valStr.substring(0, 1024), inline: false });
                }
                return embedPreview;
            };

            const escapedNome = fichaExtraida.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const existingFicha = await Ficha.findOne({ userId: targetUser.id, guildId: interaction.guild.id, nome: new RegExp(`^${escapedNome}$`, 'i') });

            const rowButtons = new ActionRowBuilder();
            if (existingFicha) {
                rowButtons.addComponents(
                    new ButtonBuilder().setCustomId('btn_merge_ficha').setLabel('Atualizar Ficha Existente (Merge)').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('btn_cancelar_ficha').setLabel('Cancelar').setStyle(ButtonStyle.Danger)
                );
            } else {
                rowButtons.addComponents(
                    new ButtonBuilder().setCustomId('btn_salvar_ficha').setLabel('Salvar como Nova Ficha').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('btn_cancelar_ficha').setLabel('Cancelar').setStyle(ButtonStyle.Danger)
                );
            }

            const buildComponents = () => {
                const sysNomesArr = Object.keys(fichaExtraida.sistemas || {});
                const totalMenuPages = Math.ceil(sysNomesArr.length / 20);

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('selecionar_sistema_preview')
                    .setPlaceholder('Explore o Preview das Abas Mapeadas')
                    .addOptions(new StringSelectMenuOptionBuilder().setLabel('Capa da Ficha').setDescription('Voltar para os Dados Básicos.').setValue('aba_capa_preview').setEmoji('📖'));

                if (fichaExtraida.anotacoes && fichaExtraida.anotacoes.trim().length > 0) {
                    menu.addOptions(new StringSelectMenuOptionBuilder().setLabel('Anotações / Geral').setDescription('Visualize o texto não formatado.').setValue('aba_anotacoes_preview').setEmoji('📝'));
                }

                if (fichaExtraida.sistemas) {
                    const startIdx = state.menuPage * 20;
                    const endIdx = Math.min(startIdx + 20, sysNomesArr.length);
                    sysNomesArr.slice(startIdx, endIdx).forEach(sis => {
                        menu.addOptions(new StringSelectMenuOptionBuilder().setLabel(sis.substring(0, 100)).setValue(`aba_sis_${sis}`.substring(0, 100)).setEmoji('⚙️'));
                    });
                }

                const comps = [new ActionRowBuilder().addComponents(menu)];

                if (state.sistemaVisualizado) {
                    const skills = fichaExtraida.habilidades.filter(h => h.sistema === state.sistemaVisualizado);
                    if (skills.length > 1) {
                        const rowPaginacao = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('btn_prev_skill').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(state.paginaAtual === 0),
                            new ButtonBuilder().setCustomId('btn_next_skill').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(state.paginaAtual === skills.length - 1)
                        );
                        comps.push(rowPaginacao);
                    }
                    
                    const rowEdit = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_edit_skill').setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('btn_del_skill').setLabel('Excluir').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
                    );
                    comps.push(rowEdit);
                } else {
                    if (totalMenuPages > 1) {
                        const rowPaginacaoMenu = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('btn_prev_menu').setLabel('Pág. Anterior do Menu').setEmoji('⬅️').setStyle(ButtonStyle.Primary).setDisabled(state.menuPage === 0),
                            new ButtonBuilder().setCustomId('btn_next_menu').setLabel('Próxima Pág. do Menu').setEmoji('➡️').setStyle(ButtonStyle.Primary).setDisabled(state.menuPage === totalMenuPages - 1)
                        );
                        comps.push(rowPaginacaoMenu);
                    }
                }

                comps.push(rowButtons);
                return comps;
            };

            const formatSkillEmbed = (sysNome, pagina) => {
                const skills = fichaExtraida.habilidades.filter(h => h.sistema === sysNome);
                if (skills.length === 0) {
                    return new EmbedBuilder()
                        .setTitle(`⚙️ Preview: ${sysNome}`)
                        .setColor('#2b2d31')
                        .setDescription(fichaExtraida.sistemas[sysNome] ? fichaExtraida.sistemas[sysNome].substring(0, 4096) : 'Nenhuma habilidade fatiada encontrada neste fórum.');
                }
                const skill = skills[pagina];
                return new EmbedBuilder()
                    .setTitle(`📄 ${skill.nome ? skill.nome.substring(0, 250) : sysNome}`)
                    .setColor('#2b2d31')
                    .setDescription(skill.descricao ? skill.descricao.substring(0, 4096) : 'Bloco sem texto.')
                    .setImage(skill.imagemURL || null)
                    .setFooter({ text: `Tópico/Fórum: ${sysNome} • Página ${pagina + 1} de ${skills.length}` });
            };



            const msg = await interaction.editReply({ embeds: [formatEmbedCapaPreview()], components: buildComponents() });
            const coletor = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 300000 }); // 5 minutos de leitura

            coletor.on('collect', async i => {
                try {
                    // Não dar deferUpdate se for abrir modal, porque Discord proíbe.
                    if (i.customId !== 'btn_edit_skill') {
                        await i.deferUpdate().catch(() => {});
                    }

                    if (i.isStringSelectMenu()) {
                        const escolha = i.values[0];
                        if (escolha === 'aba_capa_preview') {
                            state.sistemaVisualizado = null;
                            await interaction.editReply({ embeds: [formatEmbedCapaPreview()], components: buildComponents() });
                        } else if (escolha === 'aba_anotacoes_preview') {
                            state.sistemaVisualizado = null;
                            const embedAnotacoes = new EmbedBuilder()
                                .setTitle('📝 Preview: Anotações / Geral')
                                .setColor('#2b2d31')
                                .setDescription(fichaExtraida.anotacoes.substring(0, 4096));
                            await interaction.editReply({ embeds: [embedAnotacoes], components: buildComponents() });
                        } else if (escolha.startsWith('aba_sis_')) {
                            state.sistemaVisualizado = escolha.replace('aba_sis_', '');
                            state.paginaAtual = 0;
                            await interaction.editReply({ embeds: [formatSkillEmbed(state.sistemaVisualizado, state.paginaAtual)], components: buildComponents() });
                        }
                    } else if (i.isButton()) {
                        if (i.customId === 'btn_prev_menu' && !state.sistemaVisualizado) {
                            state.menuPage--;
                            await interaction.editReply({ embeds: [formatEmbedCapaPreview()], components: buildComponents() });
                        } else if (i.customId === 'btn_next_menu' && !state.sistemaVisualizado) {
                            state.menuPage++;
                            await interaction.editReply({ embeds: [formatEmbedCapaPreview()], components: buildComponents() });
                        } else if (i.customId === 'btn_prev_skill' && state.sistemaVisualizado) {
                            state.paginaAtual--;
                            await interaction.editReply({ embeds: [formatSkillEmbed(state.sistemaVisualizado, state.paginaAtual)], components: buildComponents() });
                        } else if (i.customId === 'btn_next_skill' && state.sistemaVisualizado) {
                            state.paginaAtual++;
                            await interaction.editReply({ embeds: [formatSkillEmbed(state.sistemaVisualizado, state.paginaAtual)], components: buildComponents() });
                        } else if (i.customId === 'btn_del_skill' && state.sistemaVisualizado) {
                            const skills = fichaExtraida.habilidades.filter(h => h.sistema === state.sistemaVisualizado);
                            const skill = skills[state.paginaAtual];
                            const indexOfSkill = fichaExtraida.habilidades.findIndex(h => h === skill);
                            if (indexOfSkill !== -1) {
                                fichaExtraida.habilidades.splice(indexOfSkill, 1);
                            }
                            
                            const newSkills = fichaExtraida.habilidades.filter(h => h.sistema === state.sistemaVisualizado);
                            if (newSkills.length === 0) {
                                state.sistemaVisualizado = null;
                                await interaction.editReply({ embeds: [formatEmbedCapaPreview()], components: buildComponents() });
                            } else {
                                if (state.paginaAtual >= newSkills.length) state.paginaAtual = newSkills.length - 1;
                                await interaction.editReply({ embeds: [formatSkillEmbed(state.sistemaVisualizado, state.paginaAtual)], components: buildComponents() });
                            }
                        } else if (i.customId === 'btn_edit_skill' && state.sistemaVisualizado) {
                            const skills = fichaExtraida.habilidades.filter(h => h.sistema === state.sistemaVisualizado);
                            const skill = skills[state.paginaAtual];
                            
                            const modal = new ModalBuilder()
                                .setCustomId('modal_edit_skill')
                                .setTitle('Editar Habilidade');

                            const titleInput = new TextInputBuilder()
                                .setCustomId('skill_title')
                                .setLabel('Título da Habilidade')
                                .setStyle(TextInputStyle.Short)
                                .setValue((skill.nome || '').substring(0, 250))
                                .setMaxLength(250)
                                .setRequired(true);

                            const descInput = new TextInputBuilder()
                                .setCustomId('skill_desc')
                                .setLabel('Descrição')
                                .setStyle(TextInputStyle.Paragraph)
                                .setValue((skill.descricao || '').substring(0, 4000))
                                .setMaxLength(4000)
                                .setRequired(false);

                            modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(descInput));
                            await i.showModal(modal);
                            
                            try {
                                const submitted = await i.awaitModalSubmit({ filter: m => m.customId === 'modal_edit_skill' && m.user.id === targetUser.id, time: 300000 });
                                const indexOfSkill = fichaExtraida.habilidades.findIndex(h => h === skill);
                                if (indexOfSkill !== -1) {
                                    fichaExtraida.habilidades[indexOfSkill].nome = submitted.fields.getTextInputValue('skill_title');
                                    fichaExtraida.habilidades[indexOfSkill].descricao = submitted.fields.getTextInputValue('skill_desc') || '*(Sem descrição)*';
                                }
                                await submitted.update({ embeds: [formatSkillEmbed(state.sistemaVisualizado, state.paginaAtual)], components: buildComponents() });
                            } catch (e) {
                                // Timeout or error
                            }
                        } else if (i.customId === 'btn_salvar_ficha') {
                            const novaFicha = new Ficha({
                                userId: targetUser.id,
                                guildId: interaction.guild.id,
                                nome: fichaExtraida.nome,
                                dados_basicos: fichaExtraida.dados_basicos,
                                status: fichaExtraida.status,
                                sistemas: fichaExtraida.sistemas,
                                habilidades: fichaExtraida.habilidades,
                                anotacoes: fichaExtraida.anotacoes
                            });

                            try {
                                await novaFicha.save();
                                await interaction.editReply({ content: `✅ Ficha de **${fichaExtraida.nome}** estruturada e salva com sucesso!`, embeds: [], components: [] });
                            } catch (err) {
                                await interaction.editReply({ content: `❌ Erro ao salvar ficha no banco: ${err.message}`, embeds: [], components: [] });
                            }
                        } else if (i.customId === 'btn_merge_ficha') {
                            for (const [key, val] of Object.entries(fichaExtraida.dados_basicos)) existingFicha.dados_basicos.set(key, val);
                            for (const [key, val] of Object.entries(fichaExtraida.status)) existingFicha.status.set(key, val);
                            if (fichaExtraida.sistemas) {
                                for (const [key, val] of Object.entries(fichaExtraida.sistemas)) {
                                    const oldVal = existingFicha.sistemas.get(key) || '';
                                    existingFicha.sistemas.set(key, oldVal + '\n\n' + val);
                                }
                            }
                            if (fichaExtraida.habilidades && fichaExtraida.habilidades.length > 0) {
                                existingFicha.habilidades = existingFicha.habilidades.concat(fichaExtraida.habilidades);
                            }
                            try {
                                await existingFicha.save();
                                await interaction.editReply({ content: `🔄 Ficha **${existingFicha.nome}** atualizada e skills incorporadas com sucesso!`, embeds: [], components: [] });
                            } catch (err) {
                                await interaction.editReply({ content: `❌ Erro ao atualizar a ficha: ${err.message}`, embeds: [], components: [] });
                            }
                        } else if (i.customId === 'btn_cancelar_ficha') {
                            await interaction.editReply({ content: 'Importação cancelada.', embeds: [], components: [] });
                        }
                    }
                } catch (e) {
                    console.error('Erro no collector de botões/menu:', e);
                    // Tenta garantir que a interação não fique travada
                    try {
                        if (!i.replied && !i.deferred) {
                            await i.reply({ content: `Erro interno: ${e.message}`, ephemeral: true });
                        }
                    } catch (e2) {}
                }
            });

        } else if (subCmd === 'ver') {
            await interaction.deferReply();
            const nome = interaction.options.getString('nome');
            const escapedNomeVer = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const fichaDb = await Ficha.findOne({ guildId: interaction.guild.id, nome: new RegExp(`^${escapedNomeVer}$`, 'i') });

            if (!fichaDb) {
                return interaction.editReply(`❌ Nenhuma ficha encontrada com o nome **${nome}**.`);
            }

            const formatEmbedCapa = () => {
                const embed = new EmbedBuilder()
                    .setTitle(`📖 Ficha: ${fichaDb.nome}`)
                    .setColor('#FFD700')
                    .setDescription('Visão Geral do Personagem')
                    .setFooter({ text: `Dono: <@${fichaDb.userId}> | Navegue pelas abas abaixo` });

                if (fichaDb.imagemURL) embed.setThumbnail(fichaDb.imagemURL);

                let basicosStr = '';
                if (fichaDb.dados_basicos && fichaDb.dados_basicos.size > 0) {
                    for (const [key, value] of fichaDb.dados_basicos.entries()) basicosStr += `**${key}:** ${value}\n`;
                    embed.addFields({ name: '📝 Dados Básicos', value: basicosStr.substring(0, 1024), inline: true });
                }

                let statusStr = '';
                if (fichaDb.status && fichaDb.status.size > 0) {
                    for (const [key, value] of fichaDb.status.entries()) statusStr += `**${key}:** \`${value}\`\n`;
                    embed.addFields({ name: '📊 Status / Atributos', value: statusStr.substring(0, 1024), inline: true });
                }
                return embed;
            };

            const componentes = [];
            if (fichaDb.sistemas && fichaDb.sistemas.size > 0) {
                const menu = new StringSelectMenuBuilder()
                    .setCustomId('selecionar_sistema')
                    .setPlaceholder('Explore os Sistemas e Abas')
                    .addOptions(new StringSelectMenuOptionBuilder().setLabel('Ficha Geral').setDescription('Voltar para a página principal.').setValue('aba_geral').setEmoji('📖'));

                Array.from(fichaDb.sistemas.keys()).slice(0, 24).forEach(sis => {
                    menu.addOptions(new StringSelectMenuOptionBuilder().setLabel(sis.substring(0, 100)).setValue(`aba_${sis}`).setEmoji('⚙️'));
                });

                componentes.push(new ActionRowBuilder().addComponents(menu));
            }

            const resposta = await interaction.editReply({ embeds: [formatEmbedCapa()], components: componentes });

            if (componentes.length > 0) {
                const collector = resposta.createMessageComponentCollector({ time: 180000 });
                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) return i.reply({ content: 'Você não pode interagir com esta ficha!', ephemeral: true });

                    if (i.customId === 'selecionar_sistema') {
                        const escolha = i.values[0];
                        if (escolha === 'aba_geral') {
                            await i.update({ embeds: [formatEmbedCapa()] });
                        } else {
                            const nomeSistema = escolha.replace('aba_', '');
                            const conteudo = fichaDb.sistemas.get(nomeSistema);
                            const embedSistema = new EmbedBuilder()
                                .setTitle(`⚙️ Sistema: ${nomeSistema}`)
                                .setColor('#2b2d31')
                                .setDescription(conteudo ? conteudo.substring(0, 4096) : 'Nenhum dado encontrado.')
                                .setFooter({ text: `Personagem: ${fichaDb.nome}` });
                            await i.update({ embeds: [embedSistema] });
                        }
                    }
                });
                collector.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
            }
        }
    }
};