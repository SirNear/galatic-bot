const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Command = require('../../structures/Command');
const { google } = require("googleapis");

module.exports = class MigrarVersos extends Command {
    constructor(client) {
        super(client, {
            name: "migrarversos",
            description: "Migra os dados antigos de % de versos para o novo sistema de escopos e notifica os jogadores.",
            category: "dev",
            aliases: ["migracaoverso"],
            UserPermission: [],
            clientPermission: [],
            OnlyDevs: true,
            slash: false,
        });
    }

    async run({ message, args, client, server }) {
        if (!this.client.owners.includes(message.author.id)) {
            return message.reply({ content: '❌ Apenas desenvolvedores podem usar este comando.', ephemeral: true });
        }

        const msgLog = await message.reply("⏳ Iniciando a migração dos versos na planilha...");

        try {
            const auth = new google.auth.GoogleAuth({
                credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
                scopes: ["https://www.googleapis.com/auth/spreadsheets"]
            });
            const sheets = google.sheets({ version: "v4", auth });
            const spreadsheetId = process.env.SPREADSHEET_ID || "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo";

            const res = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: "UNIVERSO!A:C"
            });
            const rows = res.data.values || [];

            if (rows.length <= 1) {
                return msgLog.edit("Planilha vazia ou com apenas cabeçalhos.");
            }

            const updates = [];
            const jogadoresPendentes = new Set();
            let countTotal = 0;
            let countPendentes = 0;

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || !row[1]) continue;

                let usoOriginal = String(row[1]).trim();
                let isPercentage = usoOriginal.includes('%') || !isNaN(parseFloat(usoOriginal.replace(',', '.')));
                let isPendente = usoOriginal.startsWith('Pendente');

                if (isPendente) {
                    if (row[2]) {
                        jogadoresPendentes.add(row[2].trim());
                    }
                } else if (isPercentage) {
                    const val = parseFloat(usoOriginal.replace('%', '').replace(',', '.'));

                    let novoUso = "";
                    if (val >= 100) {
                        novoUso = "Total / Completo";
                        countTotal++;
                    } else {
                        novoUso = `Pendente (Era ${usoOriginal})`;
                        countPendentes++;
                        if (row[2]) {
                            jogadoresPendentes.add(row[2].trim());
                        }
                    }

                    updates.push({
                        range: `UNIVERSO!B${i + 1}`,
                        values: [[novoUso]]
                    });
                }
            }

            if (updates.length > 0) {
                await sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: spreadsheetId,
                    resource: {
                        valueInputOption: "USER_ENTERED",
                        data: updates
                    }
                });
                await msgLog.edit(`✅ **Planilha atualizada!**\n- ${countTotal} convertidos para "Total / Completo"\n- ${countPendentes} convertidos para "Pendente"\n\n⏳ Iniciando envio de DMs para ${jogadoresPendentes.size} jogadores...`);
            } else if (jogadoresPendentes.size > 0) {
                await msgLog.edit(`✅ **A planilha já estava atualizada.**\n\n⏳ Iniciando envio de DMs para ${jogadoresPendentes.size} jogadores pendentes...`);
            } else {
                return msgLog.edit("Nenhuma linha com % ou Pendente encontrada para migração/notificação.");
            }

            // Notificar jogadores
            let dmsEnviadas = 0;
            let dmsFalhas = 0;

            const jogadoresArr = Array.from(jogadoresPendentes);
            for (const jogador of jogadoresArr) {
                try {
                    // Tentar achar o UID do jogador no banco
                    const regexJog = new RegExp(`^${jogador}$`, 'i');
                    const userDb = await this.client.database.userData.findOne({ jogador: regexJog });

                    if (userDb && userDb.uid) {
                        const discordUser = await this.client.users.fetch(userDb.uid).catch(() => null);
                        if (discordUser) {
                            if (this.client.maintenance && !this.client.owners.includes(discordUser.id)) {
                                console.log(`[TESTE/DEV] DM para ${discordUser.tag} (${jogador}) ignorada devido ao modo manutenção.`);
                                dmsFalhas++;
                            } else {
                                const embedDm = new EmbedBuilder()
                                    .setTitle("⚠️ Atualização no Sistema de Versos")
                                    .setColor("#ffaa00")
                                    .setDescription(`Olá, **${jogador}**!\nO sistema de percentual (%) para registro de Versos foi atualizado para um sistema de **Escopos**.\n\nAlguns dos seus versos que estavam abaixo de 100% foram marcados como **Pendente**.`)
                                    .addFields({ name: "O que você precisa fazer?", value: "Por favor, vá ao servidor, use o comando `/aparencia verso`, encontre o seu verso pendente e clique no botão ✏️ (Editar) para escolher o novo escopo correto (ex: `Sistema de Poder` ou `Lore / Facções`)." })
                                    .setFooter({ text: "Esta é uma mensagem automática de migração." });

                                await discordUser.send({ embeds: [embedDm] });
                                dmsEnviadas++;
                            }
                        } else {
                            dmsFalhas++;
                        }
                    } else {
                        dmsFalhas++;
                    }
                } catch (e) {
                    console.error(`Falha ao tentar notificar o jogador ${jogador}:`, e);
                    dmsFalhas++;
                }
            }

            await msgLog.edit(`🎉 **Migração Concluída com Sucesso!**\n- **Planilha:** ${updates.length} versos atualizados.\n- **Notificações:** ${dmsEnviadas} enviadas, ${dmsFalhas} falhas.`);

        } catch (error) {
            console.error("Erro na migração:", error);
            await msgLog.edit("❌ Ocorreu um erro durante a migração. Verifique o console.");
        }
    }
};
