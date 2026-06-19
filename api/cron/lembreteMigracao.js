const cronManager = require('./cronManager.js');
const { google } = require("googleapis");
const { EmbedBuilder } = require("discord.js");

module.exports = (client) => {
  cronManager.registerJob('migracao_versos', 'Lembrete Diário de Migração', '0 12 * * *', async () => {
    console.log("CRON: Iniciando aviso diário de migração de versos...");

    try {
      let auth;
      if (process.env.GOOGLE_CREDENTIALS) {
        auth = new google.auth.GoogleAuth({
          credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      } else {
        console.warn("CRON Migração: GOOGLE_CREDENTIALS não encontrado.");
        return;
      }
      
      const sheets = google.sheets({ version: "v4", auth });

      const resShe = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID || "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
        range: "UNIVERSO!A:C",
      });

      const rows = resShe.data.values || [];
      const usuariosParaAvisar = new Set();

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 3) continue;

        const uso = row[1];
        const jogador = row[2];

        if (uso && uso.toLowerCase().includes("[domínio total] - antigo")) {
          usuariosParaAvisar.add(jogador);
        }
      }

      for (const jogador of usuariosParaAvisar) {
        const userDb = await client.database.userData.findOne({ jogador: jogador });

        if (userDb && userDb.uid) {
          try {
            const userDis = await client.users.fetch(userDb.uid, { force: true });
            if (userDis) {
              const embAvi = new EmbedBuilder()
                .setColor("#ff0000")
                .setTitle("⚠️ Ação Necessária: Atualização do Sistema de Versos")
                .setDescription(
                  `Olá, **${jogador}**!\n\n` +
                  `O sistema de registros de Versos e Universos do RPG foi **atualizado**. Nós abandonamos o uso de porcentagens para focar em **Categorias Modulares**.\n\n` +
                  `Notamos que você ainda possui registros com o formato antigo (agora marcados como \`[Domínio Total] - Antigo\`). **Enquanto eles não forem atualizados, sua conta continuará travada para registrar novos universos.**\n\n` +
                  `Por favor, atualize seus registros para as novas tags modulares (como \`[Poder]\`, \`[Lore]\` ou \`[Biologia]\`) seguindo o nosso tutorial detalhado!\n\n` +
                  `🔗 **Acesse o Tutorial de Atualização aqui:** <#1517590947993489568>`
                )
                .setFooter({ text: "Galatic Bot - Notificação Automática (1 Mês)" })
                .setTimestamp();

              await userDis.send({ embeds: [embAvi] });
              console.log(`CRON Migração: Aviso enviado para ${jogador} (${userDb.uid}).`);
            }
          } catch (errEnv) {
            console.error(`CRON Migração: Erro ao enviar DM para ${jogador}:`, errEnv.message);
          }
        }
      }
    } catch (err) {
      console.error("CRON Migração: Erro fatal na verificação diária:", err);
    }
  });
};
