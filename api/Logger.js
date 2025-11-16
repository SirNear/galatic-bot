const { EmbedBuilder, WebhookClient } = require('discord.js');

class Logger {
    constructor(urlWebhook) {
        this.clienteWebhook = urlWebhook ? new WebhookClient({ url: urlWebhook }) : null;
        this.filaLog = [];
        this.emExecucao = false;
        this.niveisLog = {
            LOG: { cor: 0x5865F2, icone: 'ℹ️' },
            WARN: { cor: 0xFEE75C, icone: '⚠️' },
            ERROR: { cor: 0xED4245, icone: '❌' },
            DEBUG: { cor: 0x57F287, icone: '🔧' },
            INFO: { cor: 0x0099ff, icone: '💡' }
        };

        this.sobrescreverConsole();
        setInterval(() => this.enviarFilaLog(), 5000);
    }

    sobrescreverConsole() {
        for (const nivel of Object.keys(this.niveisLog)) {
            const metodoOriginal = console[nivel.toLowerCase()] || console.log;
            console[nivel.toLowerCase()] = (...argumentos) => {
                metodoOriginal.apply(console, argumentos);
                const mensagemFormatada = argumentos.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)).join(' ');
                this.adicionarFila({
                    nivel: nivel,
                    mensagem: mensagemFormatada,
                    timestamp: new Date()
                });
            };
        }
    }

    adicionarFila(entradaLog) {
        this.filaLog.push(entradaLog);
    }

    async enviarFilaLog() {
        if (!this.clienteWebhook || this.filaLog.length === 0 || this.emExecucao) {
            return;
        }

        this.emExecucao = true;
        const logsParaEnviar = this.filaLog.splice(0, 10);
        const descricaoEmbed = logsParaEnviar
            .map(log => {
                const { icone } = this.niveisLog[log.nivel];
                const tempoFormatado = log.timestamp.toLocaleTimeString('pt-BR');
                return `${icone} [${tempoFormatado}] ${log.mensagem}`;
            })
            .join('\n')
            .substring(0, 4096);

        const nivelMaisAlto = this.determinarNivelAlto(logsParaEnviar);
        const { cor } = this.niveisLog[nivelMaisAlto];

        const embedLog = new EmbedBuilder()
            .setTitle('Relatório de Atividades do Bot')
            .setDescription(descricaoEmbed)
            .setColor(cor)
            .setTimestamp();

        try {
            await this.clienteWebhook.send({
                username: 'Bot Logger',
                avatarURL: 'https://i.imgur.com/z32K4sC.png',
                embeds: [embedLog],
            });
        } catch (erro) {
            console.error('Falha ao enviar log para o Discord:', erro);
            this.filaLog.unshift(...logsParaEnviar);
        } finally {
            this.emExecucao = false;
        }
    }

    determinarNivelAlto(logs) {
        if (logs.some(log => log.nivel === 'ERROR')) return 'ERROR';
        if (logs.some(log => log.nivel === 'WARN')) return 'WARN';
        if (logs.some(log => log.nivel === 'DEBUG')) return 'DEBUG';
        if (logs.some(log => log.nivel === 'INFO')) return 'INFO';
        return 'LOG';
    }
}

module.exports = Logger;
