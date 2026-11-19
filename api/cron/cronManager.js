const cron = require('node-cron');
let CronExpressionParser = null;
try {
    const cp = require('cron-parser');
    CronExpressionParser = cp.CronExpressionParser || cp;
} catch (_) {
    // cron-parser opcional: fallback nativo utilizado para evitar MODULE_NOT_FOUND em ambientes restritos
}
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const mongoose = require('../../mongoose.js');

const jobs = new Map();
const PAINEL_CHANNEL_ID = "1510784621904793740";
let clientRef = null;
let updateTimeout = null;
let isUpdating = false;

function setClient(client) {
    clientRef = client;
}

/**
 * Traduz expressões cron comuns para linguagem humana em português.
 */
function humanizeSchedule(schedule) {
    if (!schedule) return 'Não agendado';
    const s = schedule.trim();
    if (s === '*/5 * * * *') return '⏱️ A cada 5 minutos';
    if (s === '*/10 * * * *') return '⏱️ A cada 10 minutos';
    if (s === '*/15 * * * *') return '⏱️ A cada 15 minutos';
    if (s === '*/30 * * * *') return '⏱️ A cada 30 minutos';
    if (s === '0 * * * *') return '⏱️ De hora em hora';
    if (s === '0 */2 * * *') return '⏱️ A cada 2 horas';
    if (s === '0 */6 * * *') return '⏱️ A cada 6 horas';
    if (s === '0 */12 * * *') return '⏱️ A cada 12 horas';
    if (s === '0 3 * * 0') return '📅 Todo domingo às 03:00';
    if (s === '0 12 * * *') return '📅 Todos os dias às 12:00';
    if (s === '0 10 */3 * *') return '📅 A cada 3 dias às 10:00';

    const parts = s.split(/\s+/);
    if (parts.length === 5) {
        const [min, hour, dom, mon, dow] = parts;
        if (min === '0' && hour.startsWith('*/') && dom === '*' && mon === '*' && dow === '*') {
            return `⏱️ A cada ${hour.replace('*/', '')} horas`;
        }
        if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
            return `⏱️ A cada ${min.replace('*/', '')} minutos`;
        }
        if (dom === '*' && mon === '*' && dow === '*') {
            return `📅 Diariamente às ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
        }
    }
    return `Expressão: \`${schedule}\``;
}

/**
 * Calcula a data da próxima execução com base na expressão cron.
 */
function getNextExecution(schedule) {
    if (CronExpressionParser) {
        try {
            const interval = CronExpressionParser.parse(schedule, { tz: 'America/Sao_Paulo' });
            return interval.next().toDate();
        } catch (_) {}
    }
    // Fallback nativo simples para calcular próxima execução sem cron-parser
    try {
        if (!schedule) return null;
        const parts = schedule.trim().split(/\s+/);
        if (parts.length !== 5) return null;
        const [min, hour, dom, mon, dow] = parts;
        const now = new Date();
        const next = new Date(now);

        if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
            const step = parseInt(min.replace('*/', ''), 10) || 5;
            const currentMin = now.getMinutes();
            const nextMin = (Math.floor(currentMin / step) + 1) * step;
            next.setMinutes(nextMin, 0, 0);
            return next;
        }

        if (min === '0' && hour.startsWith('*/') && dom === '*' && mon === '*' && dow === '*') {
            const step = parseInt(hour.replace('*/', ''), 10) || 1;
            const currentHour = now.getHours();
            const nextHour = (Math.floor(currentHour / step) + 1) * step;
            next.setHours(nextHour, 0, 0, 0);
            return next;
        }

        if (!isNaN(parseInt(min, 10)) && !isNaN(parseInt(hour, 10)) && dom === '*' && mon === '*' && dow === '*') {
            next.setHours(parseInt(hour, 10), parseInt(min, 10), 0, 0);
            if (next <= now) next.setDate(next.getDate() + 1);
            return next;
        }

        if (!isNaN(parseInt(min, 10)) && !isNaN(parseInt(hour, 10)) && dom === '*' && mon === '*' && !isNaN(parseInt(dow, 10))) {
            const targetDow = parseInt(dow, 10);
            next.setHours(parseInt(hour, 10), parseInt(min, 10), 0, 0);
            const currentDow = now.getDay();
            let daysAhead = (targetDow - currentDow + 7) % 7;
            if (daysAhead === 0 && next <= now) daysAhead = 7;
            next.setDate(next.getDate() + daysAhead);
            return next;
        }
    } catch (_) {}
    return null;
}

/**
 * Registra um cron job no gerenciador. Suporta objeto de configuração ou parâmetros posicionais.
 */
function registerJob(idOrOptions, name, schedule, taskFn) {
    let id, jobName, cronSchedule, fn, description;

    if (typeof idOrOptions === 'object') {
        id = idOrOptions.id;
        jobName = idOrOptions.name;
        cronSchedule = idOrOptions.schedule;
        fn = idOrOptions.taskFn;
        description = idOrOptions.description || 'Nenhuma descrição fornecida.';
    } else {
        id = idOrOptions;
        jobName = name;
        cronSchedule = schedule;
        fn = taskFn;
        description = 'Nenhuma descrição fornecida.';
    }

    if (jobs.has(id)) {
        const existing = jobs.get(id);
        if (existing.cronJob) existing.cronJob.stop();
    }

    const jobData = {
        id,
        name: jobName,
        schedule: cronSchedule,
        humanSchedule: humanizeSchedule(cronSchedule),
        description,
        lastRun: null,
        nextRun: getNextExecution(cronSchedule),
        lastDurationMs: null,
        status: 'Ativo',
        history: [],
        taskFn: fn,
        cronJob: null
    };

    jobData.cronJob = cron.schedule(cronSchedule, async () => {
        jobData.status = 'Executando';
        jobData.lastRun = new Date();
        const start = Date.now();

        try {
            const resultMsg = await fn();
            const durationMs = Date.now() - start;
            jobData.lastDurationMs = durationMs;
            jobData.status = 'Ativo';
            jobData.nextRun = getNextExecution(cronSchedule);

            const logEntry = {
                time: new Date(),
                success: true,
                durationMs,
                log: typeof resultMsg === 'string' ? resultMsg : "Executado com sucesso"
            };

            jobData.history.unshift(logEntry);
            if (jobData.history.length > 5) jobData.history.pop();

            // Salva no banco de dados MongoDB
            if (mongoose.CronLog) {
                await mongoose.CronLog.create({
                    jobId: id,
                    jobName,
                    executedAt: new Date(),
                    success: true,
                    durationMs,
                    log: logEntry.log,
                    triggeredBy: 'agendado'
                }).catch(err => console.error(`[CRON] Erro ao salvar log no banco:`, err));
            }
        } catch (err) {
            const durationMs = Date.now() - start;
            jobData.lastDurationMs = durationMs;
            jobData.status = 'Ativo';
            jobData.nextRun = getNextExecution(cronSchedule);

            console.error(`[CRON] Job [${jobName}] falhou:`, err);
            const logEntry = {
                time: new Date(),
                success: false,
                durationMs,
                log: err.message
            };

            jobData.history.unshift(logEntry);
            if (jobData.history.length > 5) jobData.history.pop();

            if (mongoose.CronLog) {
                await mongoose.CronLog.create({
                    jobId: id,
                    jobName,
                    executedAt: new Date(),
                    success: false,
                    durationMs,
                    log: 'Falha na execução',
                    error: err.message,
                    triggeredBy: 'agendado'
                }).catch(e => console.error(`[CRON] Erro ao salvar log de erro no banco:`, e));
            }
        }

        scheduleDashboardUpdate();
    });

    jobs.set(id, jobData);
    scheduleDashboardUpdate();
}

function getJobs() {
    return Array.from(jobs.values());
}

/**
 * Agenda a atualização do painel com debounce (evita múltiplas chamadas seguidas).
 */
function scheduleDashboardUpdate(delay = 500) {
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
        updateDashboard().catch(err => console.error('[CRON] Erro ao atualizar painel:', err));
    }, delay);
}

/**
 * Atualiza o painel de monitoramento no canal com persistência no MongoDB e prevenção de duplicatas.
 */
async function updateDashboard() {
    if (!clientRef || isUpdating) return;
    isUpdating = true;

    try {
        const channel = clientRef.channels.cache.get(PAINEL_CHANNEL_ID) || await clientRef.channels.fetch(PAINEL_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle('⏱️ Painel de Monitoramento Cron')
            .setColor('#2c3e50')
            .setDescription(
                'Acompanhe todos os eventos agendados e automações em segundo plano do Galatic Bot.\n' +
                'Selecione qualquer job abaixo para verificar detalhes completos, forçar execução ou visualizar o histórico salvo na database.'
            )
            .setTimestamp();

        if (jobs.size === 0) {
            embed.addFields({ name: 'Status', value: 'Nenhum cron job registrado no momento.' });
        } else {
            for (const job of jobs.values()) {
                const statusEmoji = job.status === 'Ativo' ? '🟢' : job.status === 'Executando' ? '🟡' : '🔴';
                const lastRunTxt = job.lastRun ? `<t:${Math.floor(job.lastRun.getTime() / 1000)}:R>` : '*Nunca executado*';
                const nextRunTxt = job.nextRun ? `<t:${Math.floor(job.nextRun.getTime() / 1000)}:R> (<t:${Math.floor(job.nextRun.getTime() / 1000)}:f>)` : '*Não agendado*';

                embed.addFields({
                    name: `${statusEmoji} ${job.name} (\`${job.id}\`)`,
                    value: `**O que faz:** ${job.description}\n**Agendamento:** ${job.humanSchedule} (\`${job.schedule}\`)\n**Última Execução:** ${lastRunTxt}\n**Próxima Execução:** ${nextRunTxt}`,
                    inline: false
                });
            }
        }

        const rows = [];
        if (jobs.size > 0) {
            const options = Array.from(jobs.values()).map(j => ({
                label: j.name.length > 25 ? j.name.substring(0, 25) : j.name,
                description: `${j.humanSchedule} • Status: ${j.status}`.substring(0, 50),
                value: j.id
            }));

            rows.push(new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('cron_select_job')
                    .setPlaceholder('Selecione um job para ver histórico e gerenciar')
                    .addOptions(options)
            ));

            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('cron_refresh_panel')
                    .setLabel('Atualizar Painel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            ));
        }

        // ─── Busca e Edição da Mensagem Persistente ───────────────────────────
        let panelConfig = null;
        if (mongoose.PanelConfig) {
            panelConfig = await mongoose.PanelConfig.findById('cron_panel').catch(() => null);
        }

        let targetMessage = null;

        if (panelConfig && panelConfig.messageId) {
            targetMessage = await channel.messages.fetch(panelConfig.messageId).catch(() => null);
        }

        // Se não achou pelo ID do banco, procura mensagens existentes no canal para evitar duplicatas
        if (!targetMessage) {
            const recentMessages = await channel.messages.fetch({ limit: 15 }).catch(() => new Map());
            const duplicates = [];

            for (const msg of recentMessages.values()) {
                if (msg.author.id === clientRef.user.id && msg.embeds.length > 0) {
                    const title = msg.embeds[0].title || '';
                    if (title.includes('Painel de Monitoramento Cron')) {
                        if (!targetMessage) {
                            targetMessage = msg;
                        } else {
                            duplicates.push(msg);
                        }
                    }
                }
            }

            // Remove mensagens duplicadas do mesmo painel que possam ter sobrado
            for (const dup of duplicates) {
                await dup.delete().catch(() => {});
            }
        }

        if (targetMessage) {
            await targetMessage.edit({ embeds: [embed], components: rows });
            if (panelConfig) {
                panelConfig.messageId = targetMessage.id;
                panelConfig.channelId = channel.id;
                panelConfig.updatedAt = new Date();
                await panelConfig.save().catch(() => {});
            } else if (mongoose.PanelConfig) {
                await mongoose.PanelConfig.create({
                    _id: 'cron_panel',
                    channelId: channel.id,
                    messageId: targetMessage.id
                }).catch(() => {});
            }
        } else {
            const sent = await channel.send({ embeds: [embed], components: rows });
            if (mongoose.PanelConfig) {
                await mongoose.PanelConfig.findOneAndUpdate(
                    { _id: 'cron_panel' },
                    { channelId: channel.id, messageId: sent.id, updatedAt: new Date() },
                    { upsert: true }
                ).catch(() => {});
            }
        }
    } catch (e) {
        console.error("[CRON] Erro fatal no updateDashboard:", e);
    } finally {
        isUpdating = false;
    }
}

/**
 * Trata as interações disparadas pelo painel do Cron (select menus e botões).
 */
async function handleCronInteraction(interaction) {
    const customId = interaction.customId;

    if (customId === 'cron_refresh_panel') {
        await interaction.deferReply({ ephemeral: true });
        await updateDashboard();
        return interaction.editReply({ content: '✅ Painel do Cron sincronizado com sucesso!' });
    }

    if (customId === 'cron_select_job') {
        const jobId = interaction.values[0];
        const job = jobs.get(jobId);
        if (!job) return interaction.reply({ content: '❌ Job não encontrado ou desativado.', flags: 64 });

        const lastRunTxt = job.lastRun ? `<t:${Math.floor(job.lastRun.getTime() / 1000)}:F> (<t:${Math.floor(job.lastRun.getTime() / 1000)}:R>)` : 'Nunca executado';
        const nextRunTxt = job.nextRun ? `<t:${Math.floor(job.nextRun.getTime() / 1000)}:F> (<t:${Math.floor(job.nextRun.getTime() / 1000)}:R>)` : 'Não agendado';

        const historyTxt = job.history.length === 0 ? "*Nenhum histórico recente nesta sessão.*" :
            job.history.map(h => `${h.success ? '✅' : '❌'} <t:${Math.floor(h.time.getTime() / 1000)}:T> \`[${h.durationMs ? h.durationMs + 'ms' : 'OK'}]\` — ${h.log}`).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`Detalhes do Job: ${job.name}`)
            .setColor(job.status === 'Ativo' ? '#2ecc71' : job.status === 'Executando' ? '#f1c40f' : '#e74c3c')
            .setDescription(`**Descrição do Trabalho:**\n${job.description}`)
            .addFields(
                { name: '🆔 Identificador', value: `\`${job.id}\``, inline: true },
                { name: '📊 Status Atual', value: `\`${job.status}\``, inline: true },
                { name: '⏰ Frequência', value: `${job.humanSchedule}\n\`${job.schedule}\``, inline: true },
                { name: '🕒 Última Execução', value: lastRunTxt, inline: false },
                { name: '⏳ Próxima Execução', value: nextRunTxt, inline: false },
                { name: '📜 Histórico Recente (Sessão)', value: historyTxt, inline: false }
            );

        const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`cron_force_${job.id}`)
                .setLabel('Forçar Execução')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⚡'),
            new ButtonBuilder()
                .setCustomId(`cron_toggle_${job.id}`)
                .setLabel(job.status === 'Ativo' ? 'Pausar' : 'Retomar')
                .setStyle(job.status === 'Ativo' ? ButtonStyle.Danger : ButtonStyle.Success)
                .setEmoji(job.status === 'Ativo' ? '⏸️' : '▶️'),
            new ButtonBuilder()
                .setCustomId(`cron_history_${job.id}`)
                .setLabel('Histórico Completo (Database)')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🗄️')
        );

        return interaction.reply({ embeds: [embed], components: [btnRow], flags: 64 });
    }

    if (customId.startsWith('cron_force_')) {
        const jobId = customId.replace('cron_force_', '');
        const job = jobs.get(jobId);
        if (!job) return interaction.reply({ content: '❌ Job não encontrado.', flags: 64 });

        await interaction.deferReply({ ephemeral: true });
        const start = Date.now();

        try {
            const res = await job.taskFn(interaction);
            const durationMs = Date.now() - start;
            job.lastRun = new Date();
            job.lastDurationMs = durationMs;
            job.nextRun = getNextExecution(job.schedule);

            const logEntry = {
                time: new Date(),
                success: true,
                durationMs,
                log: typeof res === 'string' ? res : "Execução forçada com sucesso"
            };

            job.history.unshift(logEntry);
            if (job.history.length > 5) job.history.pop();

            if (mongoose.CronLog) {
                await mongoose.CronLog.create({
                    jobId: job.id,
                    jobName: job.name,
                    executedAt: new Date(),
                    success: true,
                    durationMs,
                    log: logEntry.log,
                    triggeredBy: 'manual'
                }).catch(() => {});
            }

            scheduleDashboardUpdate();
            return interaction.editReply(`✅ **${job.name}** executado forçadamente com sucesso em **${durationMs}ms**!\n*Detalhes:* ${logEntry.log}`);
        } catch (e) {
            const durationMs = Date.now() - start;
            job.lastDurationMs = durationMs;

            const logEntry = {
                time: new Date(),
                success: false,
                durationMs,
                log: `Erro: ${e.message}`
            };

            job.history.unshift(logEntry);
            if (job.history.length > 5) job.history.pop();

            if (mongoose.CronLog) {
                await mongoose.CronLog.create({
                    jobId: job.id,
                    jobName: job.name,
                    executedAt: new Date(),
                    success: false,
                    durationMs,
                    log: 'Falha na execução forçada',
                    error: e.message,
                    triggeredBy: 'manual'
                }).catch(() => {});
            }

            scheduleDashboardUpdate();
            return interaction.editReply(`❌ Erro ao executar job **${job.name}** (${durationMs}ms): ${e.message}`);
        }
    }

    if (customId.startsWith('cron_toggle_')) {
        const jobId = customId.replace('cron_toggle_', '');
        const job = jobs.get(jobId);
        if (!job) return interaction.reply({ content: '❌ Job não encontrado.', flags: 64 });

        if (job.status === 'Ativo') {
            if (job.cronJob) job.cronJob.stop();
            job.status = 'Pausado';
        } else {
            if (job.cronJob) job.cronJob.start();
            job.status = 'Ativo';
            job.nextRun = getNextExecution(job.schedule);
        }

        scheduleDashboardUpdate();
        return interaction.reply({ content: `✅ Job **${job.name}** agora está **${job.status}**.`, flags: 64 });
    }

    if (customId.startsWith('cron_history_')) {
        const jobId = customId.replace('cron_history_', '');
        const job = jobs.get(jobId);
        if (!job) return interaction.reply({ content: '❌ Job não encontrado.', flags: 64 });

        await interaction.deferReply({ ephemeral: true });

        if (!mongoose.CronLog) {
            return interaction.editReply({ content: '❌ Módulo de banco de dados não disponível para consultar histórico.' });
        }

        const totalLogs = await mongoose.CronLog.countDocuments({ jobId: job.id }).catch(() => 0);
        const logs = await mongoose.CronLog.find({ jobId: job.id })
            .sort({ executedAt: -1 })
            .limit(12)
            .lean()
            .catch(() => []);

        if (logs.length === 0) {
            return interaction.editReply({
                content: `ℹ️ Ainda não há histórico salvo no banco de dados para o job **${job.name}**.`
            });
        }

        const embedHistory = new EmbedBuilder()
            .setTitle(`🗄️ Histórico Completo: ${job.name}`)
            .setColor('#34495e')
            .setDescription(`Exibindo os últimos **${logs.length}** registros de **${totalLogs}** execuções salvas na database.`);

        for (const log of logs) {
            const timeStamp = Math.floor(new Date(log.executedAt).getTime() / 1000);
            const statusIcon = log.success ? '✅' : '❌';
            const dur = log.durationMs != null ? `\`${log.durationMs}ms\`` : '`N/A`';
            const trig = log.triggeredBy === 'manual' ? '👤 Manual' : '⏰ Agendado';
            const detail = log.error ? `*Erro:* \`${log.error}\`` : `*Log:* ${log.log || 'Sem observações'}`;

            embedHistory.addFields({
                name: `${statusIcon} <t:${timeStamp}:f> (<t:${timeStamp}:R>) • ${dur} • ${trig}`,
                value: detail,
                inline: false
            });
        }

        return interaction.editReply({ embeds: [embedHistory] });
    }
}

module.exports = {
    setClient,
    registerJob,
    getJobs,
    humanizeSchedule,
    getNextExecution,
    handleCronInteraction,
    updateDashboard,
    scheduleDashboardUpdate
};
