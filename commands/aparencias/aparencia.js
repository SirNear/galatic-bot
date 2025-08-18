const { Command } = require('../../structures/Command');
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { google } = require('googleapis');
const creds = require('../../credenciais.json');

module.exports = class Aparencia extends Command {
    constructor(client) {
        super(client, {
            name: 'aparencia',
            category: 'rpg',
            aliases: ['ap'],
            UserPermission: [],
            clientPermission: null,
            OnlyDevs: false
        });
    }

    async run({ message, args }) {
        const embedMenu = new EmbedBuilder()
            .setTitle('🎨 Menu de Aparências')
            .setDescription('Selecione uma opção clicando no botão abaixo:')
            .setColor('Blue');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pesquisar')
                    .setLabel('Pesquisar Aparência')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('registrar')
                    .setLabel('Registrar Aparência')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('listar')
                    .setLabel('Listar Aparências em Uso')
                    .setStyle(ButtonStyle.Secondary)
            );

        const menuMsg = await message.channel.send({ embeds: [embedMenu], components: [row] });

        const collector = menuMsg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60000 });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();

            if (interaction.customId === 'pesquisar') {
                message.channel.send('Digite o nome da aparência que deseja pesquisar:');
                const msgCollector = message.channel.createMessageCollector({ filter: m => m.author.id === message.author.id, max: 1, time: 60000 });

                msgCollector.on('collect', async (msg) => {
                    const appearanceName = msg.content;

                    // Conexão com Google Sheets
                    const auth = new google.auth.GoogleAuth({
                        credentials: creds,
                        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Mudar quando colocar funcionalidade de registro
                    });
                    const sheets = google.sheets({ version: 'v4', auth });
                    const SPREADSHEET_ID = '17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo'; // ID da planilha

                    try {
                        const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'A:d' });
                        const rows = res.data.values;

                        let found = false;
                        for (let i = 1; i < rows.length; i++) {
                            const [aparencia, universo, personagem, jogador] = rows[i];
                            if (aparencia.toLowerCase() === appearanceName.toLowerCase()) {
                                found = true;
                                const embed = new EmbedBuilder()
                                    .setTitle('⚠️ Aparência em Uso')
                                    .setColor('Red')
                                    .setDescription(`Aparência: **${aparencia}**\nVerso: **${universo}**\nPersonagem: **${personagem}**\nJogador: **${jogador}**`);
                                return message.channel.send({ embeds: [embed] });
                            }
                        }

                        if (!found) {
                            const embed = new EmbedBuilder()
                                .setTitle('✅ Aparência Disponível')
                                .setColor('Green')
                                .setDescription(`Aparência **${appearanceName}** não está sendo utilizada.`);
                            message.channel.send({ embeds: [embed] });
                        }
                    } catch (err) {
                        console.error(err);
                        message.channel.send('Erro ao acessar a planilha.');
                    }
                });
            }

            if (interaction.customId === 'registrar') {
                message.channel.send('Função de registro ainda não implementada.');
            }

            if (interaction.customId === 'listar') {
                message.channel.send('Função de listagem ainda não implementada.');
            }
        });
    }
};
