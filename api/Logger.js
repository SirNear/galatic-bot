const { EmbedBuilder, WebhookClient } = require('discord.js');

class Logger {
    constructor(urlWeb) {
        this.cliWeb = urlWeb ? new WebhookClient({ url: urlWeb }) : null;
        this.filLog = [];
        this.emExe = false;
        this.avaBot = null;
        this.nivLog = {
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
        for (const nivel of Object.keys(this.nivLog)) {
            const metOri = console[nivel.toLowerCase()] || console.log;
            console[nivel.toLowerCase()] = (...argumentos) => {
                metOri.apply(console, argumentos);
                const msgFor = argumentos.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2)).join(' ');
                this.adicionarFila({
                    nivel: nivel,
                    mensagem: msgFor,
                    timestamp: new Date()
                });
            };
        }
    }

    adicionarFila(entradaLog) {
        this.filLog.push(entradaLog);
    }

    defAva(url) {
        this.avaBot = url;
    }

    async enviarFilaLog() {
        if (!this.cliWeb || this.filLog.length === 0 || this.emExe) {
            return;
        }

        this.emExe = true;
        const logParEnv = this.filLog.splice(0, 10);
        const desEmb = logParEnv
            .map(log => {
                const { icone } = this.nivLog[log.nivel];
                const temFor = log.timestamp.toLocaleTimeString('pt-BR');
                return `${icone} [${temFor}] ${log.mensagem}`;
            })
            .join('\n')
            .substring(0, 4096);

        const nivMaiAlt = this.determinarNivelAlto(logParEnv);
        const { cor } = this.nivLog[nivMaiAlt];

        const embLog = new EmbedBuilder()
            .setTitle('CONSOLE LOG')
            .setDescription(desEmb)
            .setColor(cor)
            .setTimestamp();

        try {
            await this.cliWeb.send({
                username: 'Galatic Bot - LOG',
                avatarURL: this.avaBot,
                embeds: [embLog],
            });
        } catch (erro) {
            console.error('Falha ao enviar log para o Discord:', erro);
            this.filLog.unshift(...logParEnv);
        } finally {
            this.emExe = false;
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
