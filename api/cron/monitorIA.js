const cronManager = require('./cronManager.js');
const { updatePanel } = require('../aiUsageManager');

module.exports = (client) => {
    cronManager.registerJob({
        id: 'monitor_ia',
        name: '🤖 Monitor do Painel IA',
        schedule: '*/5 * * * *',
        description: 'Atualiza o painel de consumo, tokens e modelos ativos da API Gemini a cada 5 minutos.',
        taskFn: async () => {
            await updatePanel(client);
            return 'Painel de IA sincronizado com sucesso.';
        }
    });
};
