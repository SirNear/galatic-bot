const cron = require('node-cron');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

const jobs = new Map();
let painelChannelId = "1510784621904793740";
let clientRef = null;
let lastDashboardMsgId = null;

function setClient(client) {
    clientRef = client;
}

function registerJob(id, name, schedule, taskFn) {
    if (jobs.has(id)) {
        const existing = jobs.get(id);
        if (existing.cronJob) existing.cronJob.stop();
    }
    
    const jobData = {
        id,
        name,
        schedule,
        lastRun: null,
        status: 'Ativo',
        history: [],
        taskFn,
        cronJob: null
    };

    jobData.cronJob = cron.schedule(schedule, async () => {
        jobData.lastRun = new Date();
        try {
            await taskFn();
            jobData.history.unshift({ time: new Date(), success: true, log: "Executado com sucesso" });
        } catch (err) {
            console.error(`Cron [${name}] falhou:`, err);
            jobData.history.unshift({ time: new Date(), success: false, log: err.message });
        }
        if (jobData.history.length > 5) jobData.history.pop();
        await updateDashboard();
    });

    jobs.set(id, jobData);
    updateDashboard().catch(()=>{});
}

function getJobs() {
    return Array.from(jobs.values());
}

async function updateDashboard() {
    if (!clientRef) return;
    const channel = clientRef.channels.cache.get(painelChannelId) || await clientRef.channels.fetch(painelChannelId).catch(()=>null);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('⏱️ Painel de Monitoramento Cron')
        .setColor('#2c3e50')
        .setDescription('Acompanhe todos os eventos agendados que estão rodando em segundo plano no bot.')
        .setTimestamp();

    if (jobs.size === 0) {
        embed.setDescription('Nenhum cron job registrado no momento.');
    } else {
        for (const job of jobs.values()) {
            const statusEmoji = job.status === 'Ativo' ? '🟢' : '🔴';
            const lastRunTxt = job.lastRun ? `<t:${Math.floor(job.lastRun.getTime() / 1000)}:R>` : 'Nunca executado';
            embed.addFields({
                name: `${statusEmoji} ${job.name} (\`${job.id}\`)`,
                value: `**Schedule:** \`${job.schedule}\`\n**Última Execução:** ${lastRunTxt}`,
                inline: false
            });
        }
    }

    const rows = [];
    if (jobs.size > 0) {
        const options = Array.from(jobs.values()).map(j => ({
            label: j.name,
            description: `Gerenciar este job (${j.status})`,
            value: j.id
        }));
        
        rows.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('cron_select_job')
                .setPlaceholder('Selecione um job para ver detalhes')
                .addOptions(options)
        ));
    }

    try {
        if (lastDashboardMsgId) {
            const msg = await channel.messages.fetch(lastDashboardMsgId).catch(()=>null);
            if (msg) {
                await msg.edit({ embeds: [embed], components: rows });
                return;
            }
        }
        // Se não conseguiu editar, limpa as mensagens antigas do bot no canal e cria uma nova
        const msgs = await channel.messages.fetch({ limit: 10 }).catch(()=>new Map());
        for (const msg of msgs.values()) {
            if (msg.author.id === clientRef.user.id) await msg.delete().catch(()=>{});
        }
        const sent = await channel.send({ embeds: [embed], components: rows });
        lastDashboardMsgId = sent.id;
    } catch (e) {
        console.error("Erro ao atualizar dashboard do cron:", e);
    }
}

async function handleCronInteraction(interaction) {
    if (interaction.customId === 'cron_select_job') {
        const jobId = interaction.values[0];
        const job = jobs.get(jobId);
        if (!job) return interaction.reply({ content: 'Job não encontrado.', flags: 64 });

        const historyTxt = job.history.length === 0 ? "Nenhum histórico." : 
            job.history.map(h => `${h.success ? '✅' : '❌'} <t:${Math.floor(h.time.getTime() / 1000)}:T> - ${h.log}`).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`Detalhes do Job: ${job.name}`)
            .setColor(job.status === 'Ativo' ? '#2ecc71' : '#e74c3c')
            .addFields(
                { name: 'ID', value: `\`${job.id}\``, inline: true },
                { name: 'Status', value: job.status, inline: true },
                { name: 'Agendamento', value: `\`${job.schedule}\``, inline: true },
                { name: 'Histórico Recente', value: historyTxt }
            );

        const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`cron_force_${job.id}`).setLabel('Forçar Execução').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`cron_toggle_${job.id}`).setLabel(job.status === 'Ativo' ? 'Pausar' : 'Retomar').setStyle(job.status === 'Ativo' ? ButtonStyle.Danger : ButtonStyle.Success)
        );

        await interaction.reply({ embeds: [embed], components: [btnRow], ephemeral: true });
    } 
    else if (interaction.customId.startsWith('cron_force_')) {
        const jobId = interaction.customId.replace('cron_force_', '');
        const job = jobs.get(jobId);
        if (!job) return interaction.reply({ content: 'Job não encontrado.', flags: 64 });

        await interaction.deferReply({ ephemeral: true });
        try {
            await job.taskFn();
            job.lastRun = new Date();
            job.history.unshift({ time: new Date(), success: true, log: "Execução forçada com sucesso" });
            await interaction.editReply("✅ Job executado forçadamente com sucesso!");
        } catch (e) {
            job.history.unshift({ time: new Date(), success: false, log: `Forçado: ${e.message}` });
            await interaction.editReply(`❌ Erro ao executar job: ${e.message}`);
        }
        if (job.history.length > 5) job.history.pop();
        await updateDashboard();
    }
    else if (interaction.customId.startsWith('cron_toggle_')) {
        const jobId = interaction.customId.replace('cron_toggle_', '');
        const job = jobs.get(jobId);
        if (!job) return interaction.reply({ content: 'Job não encontrado.', flags: 64 });

        if (job.status === 'Ativo') {
            if (job.cronJob) job.cronJob.stop();
            job.status = 'Pausado';
        } else {
            if (job.cronJob) job.cronJob.start();
            job.status = 'Ativo';
        }
        await updateDashboard();
        await interaction.reply({ content: `✅ Job ${job.name} agora está **${job.status}**.`, flags: 64 });
    }
}

module.exports = {
    setClient,
    registerJob,
    getJobs,
    handleCronInteraction,
    updateDashboard
};
