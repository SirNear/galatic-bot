const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Command = require('../../structures/Command.js');
const { google } = require("googleapis");
const path = require("path");

module.exports = class ForcarLembrete extends Command {
    constructor(client) {
        super(client, {
            name: "forcarlembrete",
            description: "Força o envio de lembretes de versos incompletos.",
            category: "dev",
            aliases: ["fl"],
            UserPermission: [],
            clientPermission: [],
            OnlyDevs: true,
            slash: true,
        });

        if (this.config.slash) {
            this.data = new SlashCommandBuilder()
                .setName(this.config.name)
                .setDescription(this.config.description)
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Opcional. Envia o lembrete apenas para este usuário.')
                        .setRequired(false)
                );
        }
    }

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const usuAlv = interaction.options.getUser('usuario');
        const idUsuAlv = usuAlv ? usuAlv.id : null;

        await interaction.editReply({ content: `Iniciando verificação... ${usuAlv ? `(Alvo: ${usuAlv})` : '(Alvo: Todos)'}` });

        const resumo = await this.runLogLem(this.client, idUsuAlv);

        const embRes = new EmbedBuilder()
            .setTitle('📄 Relatório de Lembretes Forçados')
            .setColor(resumo.erros > 0 ? '#FF0000' : '#00FF00')
            .addFields(
                { name: 'Avisos Enviados', value: resumo.enviados.toString(), inline: true },
                { name: 'Jogadores não encontrados', value: resumo.naoEncontrados.toString(), inline: true },
                { name: 'Erros', value: resumo.erros.toString(), inline: true }
            )
            .setDescription(resumo.log.length > 0 ? `**Log de Operações:**\n\`\`\`\n${resumo.log.join('\n')}\n\`\`\`` : 'Nenhuma ação foi necessária.')
            .setTimestamp();

        await interaction.followUp({ embeds: [embRes], ephemeral: true });
    }

    async run({ message, args, client }) {
        const usuAlv = message.mentions.users.first() || (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);
        const idUsuAlv = usuAlv ? usuAlv.id : null;

        const msgSta = await message.reply({ content: `Iniciando verificação... ${usuAlv ? `(Alvo: ${usuAlv})` : '(Alvo: Todos)'}` });

        const resumo = await this.runLogLem(client, idUsuAlv);

        const embRes = new EmbedBuilder()
            .setTitle('📄 Relatório de Lembretes Forçados')
            .setColor(resumo.erros > 0 ? '#FF0000' : '#00FF00')
            .addFields(
                { name: 'Avisos Enviados', value: resumo.enviados.toString(), inline: true },
                { name: 'Jogadores não encontrados', value: resumo.naoEncontrados.toString(), inline: true },
                { name: 'Erros', value: resumo.erros.toString(), inline: true }
            )
            .setDescription(resumo.log.length > 0 ? `**Log de Operações:**\n\`\`\`\n${resumo.log.join('\n')}\n\`\`\`` : 'Nenhuma ação foi necessária.')
            .setTimestamp();

        await msgSta.edit({ content: 'Verificação concluída!', embeds: [embRes] });
    }

    async runLogLem(client, idUsuAlv = null) {
        const resumo = {
            enviados: 0,
            naoEncontrados: 0,
            erros: 0,
            log: []
        };

        try {
            const camArqCha = path.join(__dirname, "../../api/regal-primacy-233803-4fc7ea1a8a5a.json");
            const autGoo = new google.auth.GoogleAuth({
                keyFile: camArqCha,
                scopes: ["https://www.googleapis.com/auth/spreadsheets"],
            });
            const sheGoo = google.sheets({ version: "v4", auth: autGoo });

            const resPla = await sheGoo.spreadsheets.values.get({
                spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                range: "UNIVERSO!A:C",
            });

            const valLin = resPla.data.values || [];
            const mapJog = new Map();

            for (let i = 1; i < valLin.length; i++) {
                const [nomVer, usoVer, nomJog] = valLin[i];
                if (!nomVer || !nomJog) continue;

                const usoNum = parseFloat((usoVer || "0").replace("%", "").replace(",", "."));

                if (usoNum < 100) {
                    if (!mapJog.has(nomJog)) mapJog.set(nomJog, []);
                    mapJog.get(nomJog).push({ verso: nomVer, uso: usoVer });
                }
            }

            let jogPro = Array.from(mapJog.entries());
            let targetPlayerName = null;

            if (idUsuAlv) {
                const usuDb = await client.database.userData.findOne({ uid: idUsuAlv });
                if (usuDb && usuDb.jogador) {
                    targetPlayerName = usuDb.jogador;
                    jogPro = jogPro.filter(([nomJog]) => nomJog === targetPlayerName);
                    if (jogPro.length === 0) resumo.log.push(`Jogador alvo (${targetPlayerName}) não possui versos pendentes.`);
                } else {
                    resumo.log.push(`Jogador alvo com ID ${idUsuAlv} não encontrado no banco de dados ou não associado.`);
                    return resumo;
                }
            }

            for (const [nomJog, lisVer] of jogPro) {
                let uidDestino = null;

                if (idUsuAlv && nomJog === targetPlayerName) {
                    uidDestino = idUsuAlv;
                } else {
                    const usuDb = await client.database.userData.findOne({ jogador: nomJog });
                    if (usuDb) uidDestino = usuDb.uid;
                }

                if (uidDestino) {
                    try {
                        const usuDis = await client.users.fetch(uidDestino, { force: true });
                        if (usuDis) {
                            const lisTxt = lisVer.map((v) => `• **${v.verso}** (${v.uso})`).join("\n");
                            const embAvi = new EmbedBuilder().setColor("#FFA500").setTitle("⚠️ Lembrete de Versos Pendentes").setDescription(`Olá, **${nomJog}**! Notei que você possui universos com uso incompleto.\n\n**Seus Versos Pendentes:**\n${lisTxt}\n\nNão se esqueça de registrar as aparências utilizadas nesses versos para liberar novos registros!\n💡 *Dica: Você pode editar a porcentagem de uso pesquisando o verso no comando* \`/aparencia\` *ou* \`g!ap\`.`).setFooter({ text: "Galatic Bot - Sistema de RPG" }).setTimestamp();
                            await usuDis.send({ embeds: [embAvi] });
                            resumo.enviados++;
                            resumo.log.push(`Aviso enviado para ${nomJog} (${uidDestino}).`);
                        }
                    } catch (errEnv) {
                        resumo.erros++;
                        resumo.log.push(`Erro ao enviar DM para ${nomJog}: ${errEnv.message}`);
                    }
                } else {
                    resumo.naoEncontrados++;
                    resumo.log.push(`Jogador ${nomJog} não encontrado no banco de dados ou sem UID vinculado.`);
                }
            }
        } catch (err) {
            resumo.erros++;
            resumo.log.push(`Erro fatal na verificação: ${err.message}`);
            console.error("COMANDO FORCARLEMBRETE: Erro fatal na verificação:", err);
        }
        return resumo;
    }
};