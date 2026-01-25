const cron = require("node-cron");
const { google } = require("googleapis");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

module.exports = (client) => {
  // Executa todo domingo às 18:00 (ajuste conforme necessário)
  cron.schedule("0 18 * * 0", async () => {
    console.log("CRON: Iniciando verificação de versos incompletos...");

    try {
      const keyFilPat = path.join(__dirname, "../regal-primacy-233803-4fc7ea1a8a5a.json");
      const autGoo = new google.auth.GoogleAuth({
        keyFile: keyFilPat,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      const sheGoo = google.sheets({ version: "v4", auth: autGoo });

      const resShe = await sheGoo.spreadsheets.values.get({
        spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
        range: "UNIVERSO!A:C",
      });

      const rowVal = resShe.data.values || [];
      const mapJog = new Map(); // Mapa para agrupar versos por jogador

      // Pula o cabeçalho (i = 1)
      for (let i = 1; i < rowVal.length; i++) {
        const [nomVer, usoVer, nomJog] = rowVal[i];
        if (!nomVer || !nomJog) continue;

        const usoNum = parseFloat((usoVer || "0").replace("%", "").replace(",", "."));

        if (usoNum < 100) {
          if (!mapJog.has(nomJog)) {
            mapJog.set(nomJog, []);
          }
          mapJog.get(nomJog).push({ verso: nomVer, uso: usoNum });
        }
      }

      for (const [nomJog, lisVer] of mapJog) {
        // Busca o usuário no banco de dados pelo nome do jogador
        const useDb = await client.database.userData.findOne({ jogador: nomJog });

        if (useDb && useDb.uid) {
          try {
            const useDis = await client.users.fetch(useDb.uid);
            if (useDis) {
              const lisTxt = lisVer.map((v) => `• **${v.verso}** (${v.uso}%)`).join("\n");

              const embAvi = new EmbedBuilder()
                .setColor("#FFA500")
                .setTitle("⚠️ Lembrete Semanal de Versos")
                .setDescription(
                  `Olá, **${nomJog}**! Notei que você possui universos com uso incompleto.\n\n` +
                  `**Seus Versos Pendentes:**\n${lisTxt}\n\n` +
                  `Não se esqueça de registrar as aparências utilizadas nesses versos para liberar novos registros!\n` +
                  `💡 *Dica: Você pode editar a porcentagem de uso pesquisando o verso no comando* \`/aparencia\` *ou* \`g!ap\`.`
                )
                .setFooter({ text: "Galatic Bot - Sistema de RPG" })
                .setTimestamp();

              await useDis.send({ embeds: [embAvi] });
              console.log(`CRON: Aviso enviado para ${nomJog} (${useDb.uid}).`);
            }
          } catch (errEnv) {
            console.error(`CRON: Erro ao enviar DM para ${nomJog}:`, errEnv.message);
          }
        }
      }
    } catch (err) {
      console.error("CRON: Erro fatal na verificação semanal:", err);
    }
  });
};