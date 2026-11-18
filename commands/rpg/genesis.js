const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const Command = require('../../structures/Command');
const {
    SYSTEM_NAME,
    DEV_OWNER_ID,
    STAR_TABLE,
    getStarByStep,
    findHighestStarByStatsOnly,
    normalizeStr,
    parseForceOrResistanceToKgf,
    formatForceOrResistance,
    parseSpeedToKmh,
    formatSpeed,
    parseMana,
    parseCristais,
    formatMana,
    parseManaAndCristaisField,
    isGenesisTestMode,
    calcularOpcoesEvolucao,
    enviarPropostaEvolucaoPV,
    aplicarSomaStatusV2
} = require('../../api/statusEvolution.js');

module.exports = class genesis extends Command {
    constructor(client) {
        super(client, {
            name: 'genesis',
            description: 'Gerencia o Sistema Paralelo de Status e Estrelas (Projeto Genesis V2).',
            category: 'rpg',
            OnlyDevs: true,
            slash: true
        });

        this.data = new SlashCommandBuilder()
            .setName('genesis')
            .setDescription('Painel e cascata de comandos do Projeto Genesis (Status V2 & Estrelas).')
            // Grupo 1: FICHA
            .addSubcommandGroup(group =>
                group
                    .setName('ficha')
                    .setDescription('Criar, visualizar, somar ganhos, editar ou excluir fichas de status Genesis.')
                    .addSubcommand(sub =>
                        sub
                            .setName('criar')
                            .setDescription('Cria uma nova ficha de status Genesis para um personagem.')
                            .addUserOption(opt => opt.setName('jogador').setDescription('Jogador dono do personagem').setRequired(true))
                            .addStringOption(opt => opt.setName('personagem').setDescription('Nome do personagem').setRequired(true))
                            .addStringOption(opt => opt.setName('forca').setDescription('Força inicial (Ex: 500 kgf, 1.5 Tf)').setRequired(false))
                            .addStringOption(opt => opt.setName('resistencia').setDescription('Resistência inicial (Ex: 500 kgf, 1.5 Tf)').setRequired(false))
                            .addStringOption(opt => opt.setName('velocidade').setDescription('Velocidade inicial (Ex: 230 km/h)').setRequired(false))
                            .addStringOption(opt => opt.setName('mana').setDescription('Mana inicial (Ex: 130)').setRequired(false))
                            .addIntegerOption(opt => opt.setName('cristais').setDescription('Cristais do Tempo iniciais').setRequired(false))
                            .addIntegerOption(opt => opt.setName('passo_estrela').setDescription('Passo da Estrela (1 a 54). Se omitido, calcula automaticamente.').setMinValue(1).setMaxValue(54).setRequired(false))
                    )
                    .addSubcommand(sub =>
                        sub
                            .setName('ver')
                            .setDescription('Visualiza a ficha de status Genesis de um personagem e abre o painel interativo.')
                            .addUserOption(opt => opt.setName('jogador').setDescription('Jogador dono do personagem (padrão: você)').setRequired(false))
                            .addStringOption(opt => opt.setName('personagem').setDescription('Nome do personagem (deixe vazio para listar todos do jogador)').setRequired(false))
                    )
                    .addSubcommand(sub =>
                        sub
                            .setName('adicionar')
                            .setDescription('Soma novos ganhos de status/cristais ao personagem e envia proposta de evolução no PV.')
                            .addUserOption(opt => opt.setName('jogador').setDescription('Jogador dono do personagem').setRequired(true))
                            .addStringOption(opt => opt.setName('personagem').setDescription('Nome do personagem').setRequired(true))
                            .addStringOption(opt => opt.setName('forca').setDescription('Força a somar (Ex: +500 kgf, +2 Tf)').setRequired(false))
                            .addStringOption(opt => opt.setName('resistencia').setDescription('Resistência a somar (Ex: +300 kgf, +1 Tf)').setRequired(false))
                            .addStringOption(opt => opt.setName('velocidade').setDescription('Velocidade a somar (Ex: +50 km/h)').setRequired(false))
                            .addStringOption(opt => opt.setName('mana').setDescription('Mana a somar (Ex: +100)').setRequired(false))
                            .addIntegerOption(opt => opt.setName('cristais').setDescription('Cristais do Tempo a somar (Ex: 20, 99)').setRequired(false))
                            .addStringOption(opt => opt.setName('motivo').setDescription('Observação ou motivo do ganho').setRequired(false))
                    )
                    .addSubcommand(sub =>
                        sub
                            .setName('editar')
                            .setDescription('Edita/sobrescreve diretamente os valores exatos da ficha de um personagem.')
                            .addUserOption(opt => opt.setName('jogador').setDescription('Jogador dono do personagem').setRequired(true))
                            .addStringOption(opt => opt.setName('personagem').setDescription('Nome do personagem').setRequired(true))
                            .addStringOption(opt => opt.setName('forca').setDescription('Novo valor total de Força (Ex: 16 Tf, 800 kgf)').setRequired(false))
                            .addStringOption(opt => opt.setName('resistencia').setDescription('Novo valor total de Resistência (Ex: 16 Tf, 800 kgf)').setRequired(false))
                            .addStringOption(opt => opt.setName('velocidade').setDescription('Novo valor total de Velocidade (Ex: 625 km/h)').setRequired(false))
                            .addStringOption(opt => opt.setName('mana').setDescription('Novo valor total de Mana (Ex: 470)').setRequired(false))
                            .addIntegerOption(opt => opt.setName('cristais').setDescription('Novo saldo de Cristais do Tempo').setRequired(false))
                            .addIntegerOption(opt => opt.setName('passo_estrela').setDescription('Definir Passo da Estrela (1 a 54)').setMinValue(1).setMaxValue(54).setRequired(false))
                    )
                    .addSubcommand(sub =>
                        sub
                            .setName('excluir')
                            .setDescription('Exclui uma ficha de status Genesis do banco de dados.')
                            .addUserOption(opt => opt.setName('jogador').setDescription('Jogador dono do personagem').setRequired(true))
                            .addStringOption(opt => opt.setName('personagem').setDescription('Nome do personagem').setRequired(true))
                    )
            )
            // Grupo 2: ESTRELAS
            .addSubcommandGroup(group =>
                group
                    .setName('estrelas')
                    .setDescription('Consultar a tabela oficial das 54 Estrelas ou disparar evolução de um personagem.')
                    .addSubcommand(sub =>
                        sub
                            .setName('tabela')
                            .setDescription('Exibe a tabela oficial das 54 Estrelas (Ouros, Diamante e Radiante) com custos e requisitos.')
                            .addStringOption(opt =>
                                opt
                                    .setName('grupo')
                                    .setDescription('Filtrar por grupo de estrelas')
                                    .setRequired(false)
                                    .addChoices(
                                        { name: '📋 Todas as 54 Estrelas', value: 'todas' },
                                        { name: '🟡 Ouros (Iniciantes: Azul, Rosa, Amarela)', value: 'ouros' },
                                        { name: '💎 Diamante (Intermediárias: Vermelha, Verde, Preta — 20 Cristais)', value: 'diamante' },
                                        { name: '🌟 Radiante (Campeão: Branca, Dourada, Multicolorida — 99 Cristais)', value: 'radiante' }
                                    )
                            )
                    )
                    .addSubcommand(sub =>
                        sub
                            .setName('evoluir')
                            .setDescription('Verifica e envia a proposta interativa de evolução de Estrela no PV.')
                            .addUserOption(opt => opt.setName('jogador').setDescription('Jogador dono do personagem').setRequired(true))
                            .addStringOption(opt => opt.setName('personagem').setDescription('Nome do personagem').setRequired(true))
                    )
            )
            // Subcomando: CAPTURAS
            .addSubcommand(sub =>
                sub
                    .setName('capturas')
                    .setDescription('Lista as capturas silenciosas de upgrades de status registradas nos treinos.')
                    .addStringOption(opt =>
                        opt
                            .setName('filtro')
                            .setDescription('Filtrar por status da captura')
                            .setRequired(false)
                            .addChoices(
                                { name: '⏳ Capturadas Silenciosamente (Pendentes)', value: 'capturado_silenciosamente' },
                                { name: '✅ Confirmadas pelo Dev', value: 'confirmado_dev' },
                                { name: '👤 Avaliadas por Admod Comum', value: 'avaliado_admod_comum' },
                                { name: '📋 Todas', value: 'todas' }
                            )
                    )
            )
            // Subcomando: CONFIG
            .addSubcommand(sub =>
                sub
                    .setName('config')
                    .setDescription('Configura o Modo de Teste do Projeto Genesis (envio de PV para você vs jogador).')
                    .addBooleanOption(opt =>
                        opt
                            .setName('modo_teste')
                            .setDescription('True = envia evolução no seu PV (com dados do jogador); False = envia direto ao jogador.')
                            .setRequired(false)
                    )
            );
    }

    /**
     * Gera o Embed e botões interativos para visualizar e gerenciar uma ficha CharacterStatusV2.
     */
    buildCharacterCardPayload(charDoc, testMode = true) {
        const star = getStarByStep(charDoc.estrelaPasso || 1);
        const nextStar = charDoc.estrelaPasso < 54 ? getStarByStep((charDoc.estrelaPasso || 1) + 1) : null;
        const analise = calcularOpcoesEvolucao(charDoc);

        let proxInfo = '🌈 **Ápice Atingido (6ª Estrela Multicolorida — Infinito)!**';
        if (nextStar) {
            const faltaForca = Math.max(0, nextStar.forcaKgf - (charDoc.forcaKgf || 0));
            const faltaVel = Math.max(0, nextStar.velocidadeKmh - (charDoc.velocidadeKmh || 0));
            const faltaMana = Math.max(0, nextStar.mana - (charDoc.mana || 0));
            const faltaCristais = Math.max(0, (nextStar.custoCristais || 0) - (charDoc.cristais || 0));

            proxInfo = `${nextStar.emoji} **${nextStar.nomeEstrela}** (*${nextStar.grupo}* — Passo ${nextStar.passo}/54)\n` +
                `• **Patamar da Próxima:** Força \`${formatForceOrResistance(nextStar.forcaKgf)}\` | Vel. \`${formatSpeed(nextStar.velocidadeKmh)}\` | Mana \`${formatMana(nextStar.mana)}\` | Mult. \`${nextStar.multiplicador === Infinity ? '♾️' : nextStar.multiplicador + '%'}\`\n` +
                `• **Custo do Passo:** \`${nextStar.custoCristais || 0} Cristais\`\n` +
                `• **Status da Evolução:** ${analise.podeEvoluir ? `🟢 **APTO PARA EVOLUIR (${analise.quantidadePassosPossiveis} passo(s) disponível(is))!**` : `⏳ Faltam: ${faltaCristais > 0 ? `\`${faltaCristais} Cristais\` ` : ''}${faltaForca > 0 ? `\`+${formatForceOrResistance(faltaForca)} Força\` ` : ''}${faltaVel > 0 ? `\`+${formatSpeed(faltaVel)} Vel.\` ` : ''}${faltaMana > 0 ? `\`+${formatMana(faltaMana)} Mana\`` : ''}`}`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`🧬 Ficha Genesis V2 • ${charDoc.personagem}`)
            .setColor(analise.podeEvoluir ? '#2ecc71' : '#3498db')
            .setDescription(
                `👤 **Jogador:** <@${charDoc.userId}> (\`${charDoc.userId}\`)\n` +
                `🌟 **Estrela Atual:** ${star.emoji} **${star.nomeEstrela}** — *${star.grupo}* (Passo **${star.passo}/54**)\n` +
                `⚡ **Multiplicador de Poder:** \`${charDoc.infinito ? '♾️ Infinito' : (charDoc.multiplicadorPoder || star.multiplicador) + '%'}\`\n` +
                `🛠️ **Modo de Envio PV:** ${testMode ? '🧪 `Modo de Teste (Envia p/ seu PV)`' : '🚀 `Produção (Envia p/ o Jogador)`'}`
            )
            .addFields(
                {
                    name: '💪 Força Física',
                    value: `\`${charDoc.infinito ? '♾️ Infinito' : formatForceOrResistance(charDoc.forcaKgf)}\``,
                    inline: true
                },
                {
                    name: '🛡️ Resistência Física',
                    value: `\`${charDoc.infinito ? '♾️ Infinito' : formatForceOrResistance(charDoc.resistenciaKgf)}\``,
                    inline: true
                },
                {
                    name: '💨 Velocidade',
                    value: `\`${charDoc.infinito ? '♾️ Infinito' : formatSpeed(charDoc.velocidadeKmh)}\``,
                    inline: true
                },
                {
                    name: '💧 Mana Total',
                    value: `\`${charDoc.infinito ? '♾️ Infinito' : formatMana(charDoc.mana)}\``,
                    inline: true
                },
                {
                    name: '💎 Cristais do Tempo',
                    value: `\`${charDoc.cristais || 0} Cristais\` (Gastos: \`${charDoc.cristaisGastosTotal || 0}\`)`,
                    inline: true
                },
                {
                    name: '📈 Próxima Estrela & Requisitos',
                    value: proxInfo,
                    inline: false
                }
            )
            .setFooter({ text: `${SYSTEM_NAME} • ID: ${charDoc._id} • Registros no histórico: ${charDoc.historicoUpgrades?.length || 0}` })
            .setTimestamp(charDoc.updatedAt || new Date());

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`genesis_panel_add_${charDoc._id}`)
                .setLabel('Somar Ganhos')
                .setEmoji('➕')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`genesis_panel_edit_${charDoc._id}`)
                .setLabel('Editar Valores')
                .setEmoji('✏️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`genesis_panel_setstar_${charDoc._id}`)
                .setLabel('Definir Estrela')
                .setEmoji('🌟')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`genesis_panel_sendpv_${charDoc._id}`)
                .setLabel('Enviar Evolução PV')
                .setEmoji('📩')
                .setStyle(analise.podeEvoluir ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`genesis_panel_hist_${charDoc._id}`)
                .setLabel('Histórico')
                .setEmoji('📜')
                .setStyle(ButtonStyle.Secondary)
        );

        return { embeds: [embed], components: [row1] };
    }

    async execute(interaction) {
        const isDev = (this.client.owners && this.client.owners.includes(interaction.user.id)) || interaction.user.id === DEV_OWNER_ID;
        if (!isDev) {
            return interaction.reply({ content: '❌ Apenas o Dono/Desenvolvedor tem acesso ao painel do Projeto Genesis.', flags: 64 });
        }

        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();
        const testMode = await isGenesisTestMode(this.client);

        // ==================== SUBCOMANDO: CONFIG ====================
        if (!group && sub === 'config') {
            const novoModo = interaction.options.getBoolean('modo_teste');
            let modoAtual = testMode;

            if (typeof novoModo === 'boolean') {
                await this.client.database.BotConfig.findOneAndUpdate(
                    { _id: 'global' },
                    { $set: { genesisTestMode: novoModo } },
                    { upsert: true, new: true }
                );
                modoAtual = novoModo;
            }

            const embedCfg = new EmbedBuilder()
                .setTitle(`⚙️ Configuração • ${SYSTEM_NAME}`)
                .setColor(modoAtual ? '#f39c12' : '#2ecc71')
                .setDescription(
                    `**Modo de Teste de Evolução no PV:** ${modoAtual ? '🧪 **ATIVO (Envia para o seu PV)**' : '🚀 **DESATIVADO (Envia direto para o PV do Jogador)**'}\n\n` +
                    `• Quando **Ativo (\`true\`)**: todas as notificações de evolução de Estrela e cobrança de Cristais são enviadas para o seu PV (<@${DEV_OWNER_ID}>), exibindo todos os dados do jogador como se você fosse ele.\n` +
                    `• Quando **Desativado (\`false\`)**: o bot envia diretamente no PV do jogador dono do personagem.`
                )
                .setTimestamp();

            return interaction.reply({ embeds: [embedCfg], flags: 64 });
        }

        // ==================== SUBCOMANDO: CAPTURAS ====================
        if (!group && sub === 'capturas') {
            const filtro = interaction.options.getString('filtro') || 'todas';
            const query = filtro === 'todas' ? {} : { status: filtro };
            const capturas = await this.client.database.SilentStatusCapture.find(query).sort({ createdAt: -1 }).limit(15).lean();

            if (capturas.length === 0) {
                return interaction.reply({ content: `📭 Nenhuma captura silenciosa encontrada para o filtro \`${filtro}\`.`, flags: 64 });
            }

            const lines = capturas.map((c, idx) => {
                const sug = c.valoresSugeridosIA || {};
                const vals = [];
                if (sug.forcaKgf) vals.push(`F: +${formatForceOrResistance(sug.forcaKgf)}`);
                if (sug.resistenciaKgf) vals.push(`R: +${formatForceOrResistance(sug.resistenciaKgf)}`);
                if (sug.velocidadeKmh) vals.push(`V: +${formatSpeed(sug.velocidadeKmh)}`);
                if (sug.mana) vals.push(`M: +${formatMana(sug.mana)}`);
                if (sug.cristais) vals.push(`💎: +${sug.cristais}`);
                return `**${idx + 1}.** **${c.personagem}** (<@${c.userId}>) • \`${c.nomeUpgradeOriginal}\`\n` +
                       `   └ Status: \`${c.status}\` | Treino: \`${c.upgradeId}\` | IA: ${vals.join(', ') || 'Sem valor numérico'}`;
            });

            const embedCap = new EmbedBuilder()
                .setTitle(`🕵️ Capturas Silenciosas • ${SYSTEM_NAME}`)
                .setColor('#9b59b6')
                .setDescription(lines.join('\n\n').substring(0, 4096))
                .setFooter({ text: `Exibindo as ${capturas.length} capturas mais recentes • Filtro: ${filtro}` })
                .setTimestamp();

            return interaction.reply({ embeds: [embedCap], flags: 64 });
        }

        // ==================== GRUPO: ESTRELAS ====================
        if (group === 'estrelas') {
            if (sub === 'tabela') {
                const grupoFiltro = interaction.options.getString('grupo') || 'todas';
                const stars = grupoFiltro === 'todas'
                    ? STAR_TABLE
                    : STAR_TABLE.filter(s => s.grupoKey === grupoFiltro);

                const pageSize = 9;
                const totalPages = Math.ceil(stars.length / pageSize);
                let page = 0;

                const generateStarTableEmbed = (pIdx) => {
                    const slice = stars.slice(pIdx * pageSize, (pIdx + 1) * pageSize);
                    const lines = slice.map(s => {
                        const custoTxt = s.custoCristais > 0 ? `💎 \`${s.custoCristais} Cristais\`` : '🆓 `0 Cristais`';
                        const fTxt = s.obs && s.passo === 1 ? 'Base Racial' : formatForceOrResistance(s.forcaKgf);
                        const vTxt = s.obs && s.passo === 1 ? 'Base Racial' : formatSpeed(s.velocidadeKmh);
                        const mTxt = s.obs && s.passo === 1 ? 'Mana Inicial' : formatMana(s.mana);
                        const multTxt = s.multiplicador === Infinity ? '♾️ Infinito' : `${s.multiplicador}%`;
                        return `${s.emoji} **[Passo ${s.passo}] ${s.nomeEstrela}** (*${s.grupo}*)\n` +
                               `└ 💪 Força: \`${fTxt}\` | 💨 Vel: \`${vTxt}\` | ⚡ Mult: \`${multTxt}\` | 💧 Mana: \`${mTxt}\` | ${custoTxt}`;
                    });

                    return new EmbedBuilder()
                        .setTitle(`🌟 Tabela Oficial de Estrelas • ${SYSTEM_NAME}`)
                        .setColor('#f1c40f')
                        .setDescription(lines.join('\n\n').substring(0, 4096))
                        .setFooter({ text: `Página ${pIdx + 1}/${totalPages} • Total: ${stars.length} estrelas listadas` });
                };

                const getNavRow = (pIdx) => {
                    if (totalPages <= 1) return [];
                    return [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('star_prev').setLabel('◀ Anterior').setStyle(ButtonStyle.Primary).setDisabled(pIdx === 0),
                            new ButtonBuilder().setCustomId('star_next').setLabel('Próxima ▶').setStyle(ButtonStyle.Primary).setDisabled(pIdx >= totalPages - 1)
                        )
                    ];
                };

                await interaction.reply({
                    embeds: [generateStarTableEmbed(0)],
                    components: getNavRow(0),
                    flags: 64
                });

                if (totalPages > 1) {
                    const replyMsg = await interaction.fetchReply();
                    const collector = replyMsg.createMessageComponentCollector({
                        filter: i => i.user.id === interaction.user.id,
                        time: 180000
                    });
                    collector.on('collect', async i => {
                        if (i.customId === 'star_prev') page = Math.max(0, page - 1);
                        if (i.customId === 'star_next') page = Math.min(totalPages - 1, page + 1);
                        await i.update({
                            embeds: [generateStarTableEmbed(page)],
                            components: getNavRow(page)
                        }).catch(() => {});
                    });
                }
                return;
            }

            if (sub === 'evoluir') {
                const jogador = interaction.options.getUser('jogador');
                const personagem = interaction.options.getString('personagem');
                const persNorm = normalizeStr(personagem);

                const charDoc = await this.client.database.CharacterStatusV2.findOne({
                    userId: jogador.id,
                    personagemNormalized: persNorm
                });

                if (!charDoc) {
                    return interaction.reply({ content: `❌ Ficha de **${personagem}** (<@${jogador.id}>) não encontrada no Projeto Genesis.`, flags: 64 });
                }

                const res = await enviarPropostaEvolucaoPV(this.client, charDoc);
                if (!res.sent) {
                    const analise = res.analise;
                    let extra = '';
                    if (analise?.proximaEstrela) {
                        extra = `\nPróxima Estrela: **${analise.proximaEstrela.nomeEstrela}** (Custo: \`${analise.proximaEstrela.custoCristais} Cristais\`, Saldo atual: \`${charDoc.cristais || 0} Cristais\`).`;
                    }
                    return interaction.reply({ content: `⚠️ Não foi possível enviar proposta de evolução: ${res.reason}${extra}`, flags: 64 });
                }

                return interaction.reply({
                    content: `✅ Proposta interativa de evolução para **${charDoc.personagem}** enviada com sucesso para o PV de <@${res.targetUserId}> (${res.testMode ? 'Modo de Teste Ativo' : 'Modo Produção'})!`,
                    flags: 64
                });
            }
        }

        // ==================== GRUPO: FICHA ====================
        if (group === 'ficha') {
            if (sub === 'criar') {
                const jogador = interaction.options.getUser('jogador');
                const personagem = interaction.options.getString('personagem').trim();
                const persNorm = normalizeStr(personagem);

                const forcaKgf = parseForceOrResistanceToKgf(interaction.options.getString('forca'));
                const resistenciaKgf = parseForceOrResistanceToKgf(interaction.options.getString('resistencia'));
                const velocidadeKmh = parseSpeedToKmh(interaction.options.getString('velocidade'));
                const mana = parseMana(interaction.options.getString('mana'));
                const cristais = interaction.options.getInteger('cristais') || 0;
                const passoManual = interaction.options.getInteger('passo_estrela');

                const passoInicial = passoManual || Math.min(18, findHighestStarByStatsOnly(forcaKgf, velocidadeKmh, mana));
                const starObj = getStarByStep(passoInicial);

                const charDoc = await this.client.database.CharacterStatusV2.findOneAndUpdate(
                    { userId: jogador.id, personagemNormalized: persNorm },
                    {
                        $set: {
                            userId: jogador.id,
                            personagem,
                            personagemNormalized: persNorm,
                            forcaKgf: forcaKgf === Infinity ? 50000000 : forcaKgf,
                            resistenciaKgf: resistenciaKgf === Infinity ? 50000000 : resistenciaKgf,
                            velocidadeKmh: velocidadeKmh === Infinity ? 24000 : velocidadeKmh,
                            mana: mana === Infinity ? 10000 : mana,
                            cristais,
                            estrelaPasso: starObj.passo,
                            multiplicadorPoder: starObj.multiplicador === Infinity ? 999999 : starObj.multiplicador,
                            infinito: Boolean(starObj.infinito),
                            updatedAt: new Date()
                        }
                    },
                    { upsert: true, new: true }
                );

                const payload = this.buildCharacterCardPayload(charDoc, testMode);
                payload.content = `✅ Ficha Genesis de **${personagem}** (<@${jogador.id}>) criada/atualizada com sucesso!`;
                payload.flags = 64;
                return interaction.reply(payload);
            }

            if (sub === 'ver') {
                const jogador = interaction.options.getUser('jogador') || interaction.user;
                const personagem = interaction.options.getString('personagem');

                if (personagem) {
                    const charDoc = await this.client.database.CharacterStatusV2.findOne({
                        userId: jogador.id,
                        personagemNormalized: normalizeStr(personagem)
                    });
                    if (!charDoc) {
                        return interaction.reply({ content: `❌ Nenhuma ficha Genesis encontrada para **${personagem}** (<@${jogador.id}>).`, flags: 64 });
                    }
                    const payload = this.buildCharacterCardPayload(charDoc, testMode);
                    payload.flags = 64;
                    return interaction.reply(payload);
                }

                // Se não informou o nome do personagem, lista todos os personagens daquele jogador
                const chars = await this.client.database.CharacterStatusV2.find({ userId: jogador.id }).sort({ updatedAt: -1 });
                if (chars.length === 0) {
                    return interaction.reply({ content: `📭 O jogador <@${jogador.id}> ainda não possui nenhuma ficha registrada no Projeto Genesis.`, flags: 64 });
                }

                if (chars.length === 1) {
                    const payload = this.buildCharacterCardPayload(chars[0], testMode);
                    payload.flags = 64;
                    return interaction.reply(payload);
                }

                const options = chars.slice(0, 25).map(c => {
                    const st = getStarByStep(c.estrelaPasso || 1);
                    return {
                        label: c.personagem.substring(0, 25),
                        description: `${st.nomeEstrela} | F: ${formatForceOrResistance(c.forcaKgf)} | 💎 ${c.cristais || 0}`.substring(0, 50),
                        value: String(c._id)
                    };
                });

                const selectRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('genesis_panel_select_char')
                        .setPlaceholder('📂 Selecione um personagem para abrir a ficha')
                        .addOptions(options)
                );

                const payload = this.buildCharacterCardPayload(chars[0], testMode);
                payload.components.push(selectRow);
                payload.flags = 64;
                return interaction.reply(payload);
            }

            if (sub === 'adicionar') {
                const jogador = interaction.options.getUser('jogador');
                const personagem = interaction.options.getString('personagem').trim();
                const addedForcaKgf = parseForceOrResistanceToKgf(interaction.options.getString('forca'));
                const addedResistenciaKgf = parseForceOrResistanceToKgf(interaction.options.getString('resistencia'));
                const addedVelocidadeKmh = parseSpeedToKmh(interaction.options.getString('velocidade'));
                const addedMana = parseMana(interaction.options.getString('mana'));
                const addedCristais = interaction.options.getInteger('cristais') || 0;
                const motivo = interaction.options.getString('motivo') || 'Adição manual via /genesis ficha adicionar';

                const { charDoc, evoResult } = await aplicarSomaStatusV2(this.client, {
                    userId: jogador.id,
                    personagem,
                    upgradeId: 'genesis_cmd',
                    upgradeIndex: 0,
                    nomeUpgrade: 'Adição via /genesis',
                    addedForcaKgf,
                    addedResistenciaKgf,
                    addedVelocidadeKmh,
                    addedMana,
                    addedCristais,
                    avaliadoPor: interaction.user.id,
                    feedbackPublico: motivo,
                    dispararCheckEvolucao: true
                });

                const payload = this.buildCharacterCardPayload(charDoc, testMode);
                let msg = `✅ Ganhos somados com sucesso à ficha de **${charDoc.personagem}**!`;
                if (evoResult?.sent) {
                    msg += `\n🌟 **Evolução Disponível!** Proposta interativa enviada para o PV de <@${evoResult.targetUserId}> (${evoResult.testMode ? 'Modo de Teste' : 'Produção'}).`;
                }
                payload.content = msg;
                payload.flags = 64;
                return interaction.reply(payload);
            }

            if (sub === 'editar') {
                const jogador = interaction.options.getUser('jogador');
                const personagem = interaction.options.getString('personagem').trim();
                const persNorm = normalizeStr(personagem);

                let charDoc = await this.client.database.CharacterStatusV2.findOne({
                    userId: jogador.id,
                    personagemNormalized: persNorm
                });

                if (!charDoc) {
                    return interaction.reply({ content: `❌ Ficha de **${personagem}** (<@${jogador.id}>) não encontrada. Use \`/genesis ficha criar\` primeiro.`, flags: 64 });
                }

                const forcaOpt = interaction.options.getString('forca');
                const resOpt = interaction.options.getString('resistencia');
                const velOpt = interaction.options.getString('velocidade');
                const manaOpt = interaction.options.getString('mana');
                const crisOpt = interaction.options.getInteger('cristais');
                const passoOpt = interaction.options.getInteger('passo_estrela');

                if (forcaOpt !== null) charDoc.forcaKgf = parseForceOrResistanceToKgf(forcaOpt);
                if (resOpt !== null) charDoc.resistenciaKgf = parseForceOrResistanceToKgf(resOpt);
                if (velOpt !== null) charDoc.velocidadeKmh = parseSpeedToKmh(velOpt);
                if (manaOpt !== null) charDoc.mana = parseMana(manaOpt);
                if (crisOpt !== null) charDoc.cristais = crisOpt;
                if (passoOpt !== null) {
                    const st = getStarByStep(passoOpt);
                    charDoc.estrelaPasso = st.passo;
                    charDoc.multiplicadorPoder = st.multiplicador === Infinity ? 999999 : st.multiplicador;
                    charDoc.infinito = Boolean(st.infinito);
                }

                charDoc.updatedAt = new Date();
                await charDoc.save();

                const payload = this.buildCharacterCardPayload(charDoc, testMode);
                payload.content = `✅ Valores da ficha de **${charDoc.personagem}** editados com sucesso!`;
                payload.flags = 64;
                return interaction.reply(payload);
            }

            if (sub === 'excluir') {
                const jogador = interaction.options.getUser('jogador');
                const personagem = interaction.options.getString('personagem').trim();
                const deleted = await this.client.database.CharacterStatusV2.findOneAndDelete({
                    userId: jogador.id,
                    personagemNormalized: normalizeStr(personagem)
                });

                if (!deleted) {
                    return interaction.reply({ content: `❌ Ficha de **${personagem}** (<@${jogador.id}>) não encontrada.`, flags: 64 });
                }

                return interaction.reply({ content: `🗑️ Ficha Genesis de **${deleted.personagem}** (<@${jogador.id}>) excluída com sucesso!`, flags: 64 });
            }
        }
    }

    /**
     * Trata os botões e modais do painel interativo de ficha (/genesis ficha ver).
     */
    async handlePanelInteraction(interaction, client) {
        const customId = interaction.customId;
        const testMode = await isGenesisTestMode(client);

        if (interaction.isStringSelectMenu() && customId === 'genesis_panel_select_char') {
            const charId = interaction.values[0];
            const charDoc = await client.database.CharacterStatusV2.findById(charId);
            if (!charDoc) return interaction.reply({ content: '❌ Ficha não encontrada.', flags: 64 });

            const payload = this.buildCharacterCardPayload(charDoc, testMode);
            // Mantém o menu de seleção abaixo
            const chars = await client.database.CharacterStatusV2.find({ userId: charDoc.userId }).sort({ updatedAt: -1 });
            if (chars.length > 1) {
                const options = chars.slice(0, 25).map(c => {
                    const st = getStarByStep(c.estrelaPasso || 1);
                    return {
                        label: c.personagem.substring(0, 25),
                        description: `${st.nomeEstrela} | F: ${formatForceOrResistance(c.forcaKgf)} | 💎 ${c.cristais || 0}`.substring(0, 50),
                        value: String(c._id),
                        default: String(c._id) === String(charDoc._id)
                    };
                });
                payload.components.push(
                    new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('genesis_panel_select_char')
                            .setPlaceholder('📂 Selecione um personagem para abrir a ficha')
                            .addOptions(options)
                    )
                );
            }
            return interaction.update(payload);
        }

        if (interaction.isButton()) {
            if (customId.startsWith('genesis_panel_sendpv_')) {
                const charId = customId.replace('genesis_panel_sendpv_', '');
                const charDoc = await client.database.CharacterStatusV2.findById(charId);
                if (!charDoc) return interaction.reply({ content: '❌ Ficha não encontrada.', flags: 64 });

                const res = await enviarPropostaEvolucaoPV(client, charDoc);
                if (!res.sent) {
                    return interaction.reply({ content: `⚠️ Não foi possível enviar proposta: ${res.reason}`, flags: 64 });
                }
                return interaction.reply({
                    content: `✅ Proposta de evolução enviada com sucesso para o PV de <@${res.targetUserId}> (${res.testMode ? 'Modo de Teste' : 'Produção'})!`,
                    flags: 64
                });
            }

            if (customId.startsWith('genesis_panel_hist_')) {
                const charId = customId.replace('genesis_panel_hist_', '');
                const charDoc = await client.database.CharacterStatusV2.findById(charId).lean();
                if (!charDoc) return interaction.reply({ content: '❌ Ficha não encontrada.', flags: 64 });

                const hist = (charDoc.historicoUpgrades || []).slice().reverse().slice(0, 15);
                if (hist.length === 0) {
                    return interaction.reply({ content: '📭 Nenhum histórico de ganhos registrado para este personagem.', flags: 64 });
                }

                const lines = hist.map((h, i) => {
                    const ganhos = [];
                    if (h.addedForcaKgf) ganhos.push(`F: +${formatForceOrResistance(h.addedForcaKgf)}`);
                    if (h.addedResistenciaKgf) ganhos.push(`R: +${formatForceOrResistance(h.addedResistenciaKgf)}`);
                    if (h.addedVelocidadeKmh) ganhos.push(`V: +${formatSpeed(h.addedVelocidadeKmh)}`);
                    if (h.addedMana) ganhos.push(`M: +${formatMana(h.addedMana)}`);
                    if (h.addedCristais) ganhos.push(`💎: ${h.addedCristais > 0 ? '+' : ''}${h.addedCristais}`);
                    const ts = h.data ? Math.floor(new Date(h.data).getTime() / 1000) : Math.floor(Date.now() / 1000);
                    return `**${i + 1}.** <t:${ts}:d> • **${h.nomeUpgrade || 'Registro'}** (${ganhos.join(', ') || 'Sem alteração'})`;
                });

                const embHist = new EmbedBuilder()
                    .setTitle(`📜 Histórico Genesis • ${charDoc.personagem}`)
                    .setColor('#3498db')
                    .setDescription(lines.join('\n').substring(0, 4096))
                    .setFooter({ text: `Últimos ${hist.length} registros de ${charDoc.historicoUpgrades.length}` });

                return interaction.reply({ embeds: [embHist], flags: 64 });
            }

            if (customId.startsWith('genesis_panel_add_')) {
                const charId = customId.replace('genesis_panel_add_', '');
                const charDoc = await client.database.CharacterStatusV2.findById(charId).lean();
                if (!charDoc) return interaction.reply({ content: '❌ Ficha não encontrada.', flags: 64 });

                const modal = new ModalBuilder()
                    .setCustomId(`genesis_panel_modal_add_${charId}`)
                    .setTitle(`➕ Somar Ganhos: ${charDoc.personagem.substring(0, 22)}`);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('f_forca').setLabel('Força a somar (kgf ou Tf)').setStyle(TextInputStyle.Short).setValue('0').setRequired(false)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('f_res').setLabel('Resistência a somar (kgf ou Tf)').setStyle(TextInputStyle.Short).setValue('0').setRequired(false)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('f_vel').setLabel('Velocidade a somar (km/h)').setStyle(TextInputStyle.Short).setValue('0').setRequired(false)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('f_mana_cris').setLabel('Mana | Cristais a somar (Ex: 100 | 20)').setStyle(TextInputStyle.Short).setValue('0 | 0').setRequired(false)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('f_motivo').setLabel('Observação / Motivo').setStyle(TextInputStyle.Short).setValue('Ganho adicionado no Painel Genesis').setRequired(false)
                    )
                );
                return interaction.showModal(modal);
            }

            if (customId.startsWith('genesis_panel_edit_')) {
                const charId = customId.replace('genesis_panel_edit_', '');
                const charDoc = await client.database.CharacterStatusV2.findById(charId).lean();
                if (!charDoc) return interaction.reply({ content: '❌ Ficha não encontrada.', flags: 64 });

                const modal = new ModalBuilder()
                    .setCustomId(`genesis_panel_modal_edit_${charId}`)
                    .setTitle(`✏️ Editar Ficha: ${charDoc.personagem.substring(0, 22)}`);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('e_forca').setLabel('Força Total (kgf ou Tf)').setStyle(TextInputStyle.Short).setValue(formatForceOrResistance(charDoc.forcaKgf)).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('e_res').setLabel('Resistência Total (kgf ou Tf)').setStyle(TextInputStyle.Short).setValue(formatForceOrResistance(charDoc.resistenciaKgf)).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('e_vel').setLabel('Velocidade Total (km/h)').setStyle(TextInputStyle.Short).setValue(`${charDoc.velocidadeKmh || 0} km/h`).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('e_mana').setLabel('Mana Total').setStyle(TextInputStyle.Short).setValue(`${charDoc.mana || 0}`).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('e_cris').setLabel('Saldo de Cristais do Tempo').setStyle(TextInputStyle.Short).setValue(`${charDoc.cristais || 0}`).setRequired(true)
                    )
                );
                return interaction.showModal(modal);
            }

            if (customId.startsWith('genesis_panel_setstar_')) {
                const charId = customId.replace('genesis_panel_setstar_', '');
                const charDoc = await client.database.CharacterStatusV2.findById(charId).lean();
                if (!charDoc) return interaction.reply({ content: '❌ Ficha não encontrada.', flags: 64 });

                const modal = new ModalBuilder()
                    .setCustomId(`genesis_panel_modal_star_${charId}`)
                    .setTitle(`🌟 Definir Estrela: ${charDoc.personagem.substring(0, 20)}`);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('s_passo')
                            .setLabel('Passo da Estrela (1 a 54)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('1 a 18 (Ouros) | 19 a 36 (Diamante) | 37 a 54 (Radiante)')
                            .setValue(`${charDoc.estrelaPasso || 1}`)
                            .setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('s_sync')
                            .setLabel('Sincronizar Status c/ Patamar da Estrela? (s/n)')
                            .setStyle(TextInputStyle.Short)
                            .setValue('s')
                            .setRequired(true)
                    )
                );
                return interaction.showModal(modal);
            }
        }

        if (interaction.isModalSubmit()) {
            if (customId.startsWith('genesis_panel_modal_add_')) {
                const charId = customId.replace('genesis_panel_modal_add_', '');
                const charBase = await client.database.CharacterStatusV2.findById(charId);
                if (!charBase) return interaction.reply({ content: '❌ Ficha não encontrada.', flags: 64 });

                const addedForcaKgf = parseForceOrResistanceToKgf(interaction.fields.getTextInputValue('f_forca'));
                const addedResistenciaKgf = parseForceOrResistanceToKgf(interaction.fields.getTextInputValue('f_res'));
                const addedVelocidadeKmh = parseSpeedToKmh(interaction.fields.getTextInputValue('f_vel'));
                const { mana: addedMana, cristais: addedCristais } = parseManaAndCristaisField(interaction.fields.getTextInputValue('f_mana_cris'));
                const motivo = interaction.fields.getTextInputValue('f_motivo') || 'Adição pelo Painel Genesis';

                const { charDoc, evoResult } = await aplicarSomaStatusV2(client, {
                    userId: charBase.userId,
                    personagem: charBase.personagem,
                    upgradeId: 'painel_genesis',
                    upgradeIndex: 0,
                    nomeUpgrade: motivo,
                    addedForcaKgf,
                    addedResistenciaKgf,
                    addedVelocidadeKmh,
                    addedMana,
                    addedCristais,
                    avaliadoPor: interaction.user.id,
                    feedbackPublico: motivo,
                    dispararCheckEvolucao: true
                });

                const payload = this.buildCharacterCardPayload(charDoc, testMode);
                payload.content = `✅ Ganhos somados com sucesso!${evoResult?.sent ? ' 🌟 Proposta de evolução enviada no PV!' : ''}`;
                return interaction.update(payload);
            }

            if (customId.startsWith('genesis_panel_modal_edit_')) {
                const charId = customId.replace('genesis_panel_modal_edit_', '');
                const charDoc = await client.database.CharacterStatusV2.findById(charId);
                if (!charDoc) return interaction.reply({ content: '❌ Ficha não encontrada.', flags: 64 });

                charDoc.forcaKgf = parseForceOrResistanceToKgf(interaction.fields.getTextInputValue('e_forca'));
                charDoc.resistenciaKgf = parseForceOrResistanceToKgf(interaction.fields.getTextInputValue('e_res'));
                charDoc.velocidadeKmh = parseSpeedToKmh(interaction.fields.getTextInputValue('e_vel'));
                charDoc.mana = parseMana(interaction.fields.getTextInputValue('e_mana'));
                charDoc.cristais = parseCristais(interaction.fields.getTextInputValue('e_cris'));
                charDoc.updatedAt = new Date();
                await charDoc.save();

                const payload = this.buildCharacterCardPayload(charDoc, testMode);
                payload.content = `✅ Ficha editada com sucesso!`;
                return interaction.update(payload);
            }

            if (customId.startsWith('genesis_panel_modal_star_')) {
                const charId = customId.replace('genesis_panel_modal_star_', '');
                const charDoc = await client.database.CharacterStatusV2.findById(charId);
                if (!charDoc) return interaction.reply({ content: '❌ Ficha não encontrada.', flags: 64 });

                const passo = parseInt(interaction.fields.getTextInputValue('s_passo'), 10) || 1;
                const sync = interaction.fields.getTextInputValue('s_sync').trim().toLowerCase().startsWith('s');
                const star = getStarByStep(passo);

                charDoc.estrelaPasso = star.passo;
                charDoc.multiplicadorPoder = star.multiplicador === Infinity ? 999999 : star.multiplicador;
                charDoc.infinito = Boolean(star.infinito);

                if (sync && !star.infinito) {
                    charDoc.forcaKgf = star.forcaKgf;
                    charDoc.velocidadeKmh = star.velocidadeKmh;
                    charDoc.mana = star.mana;
                }
                charDoc.updatedAt = new Date();
                await charDoc.save();

                const payload = this.buildCharacterCardPayload(charDoc, testMode);
                payload.content = `✅ Estrela definida para **${star.emoji} ${star.nomeEstrela}** (Passo ${star.passo}/54)!`;
                return interaction.update(payload);
            }
        }
    }
};
