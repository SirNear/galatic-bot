const cron = require('node-cron');
const { updatePanel } = require('../aiUsageManager');

module.exports = (client) => {
    // Atualiza o painel a cada 5 minutos
    cron.schedule('*/5 * * * *', async () => {
        try {
            await updatePanel(client);
        } catch (error) {
            console.error("Erro na rotina de atualização do Painel de IA:", error);
        }
    });
};
