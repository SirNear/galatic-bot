const cronManager = require('./cronManager.js');
const { updatePanel } = require('../aiUsageManager');

module.exports = (client) => {
    cronManager.registerJob('monitor_ia', 'Monitor do Painel IA', '*/5 * * * *', async () => {
        try {
            await updatePanel(client);
        } catch (error) {
            console.error("Erro na rotina de atualização do Painel de IA:", error);
        }
    });
};
