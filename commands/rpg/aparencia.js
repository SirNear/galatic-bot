const Discord = require('discord.js');
const  Command  = require('../../structures/Command');
const error = require('../../api/error.js')
const color = require('../../api/colors.json')
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { google } = require('googleapis');
const API_KEY = 'AIzaSyCulP8QuMiKOq5l1FvAbvHX7vjX1rWJUOQ';

module.exports = class aparencia extends Command {
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
                    .setCustomId('pesquisar_verso')
                    .setLabel('Pesquisar Verso')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                        .setCustomId('registrar_verso')
                        .setLabel('Registrar Verso')
                        .setStyle(ButtonStyle.Success),
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
                await message.channel.send('Digite o nome da aparência que deseja pesquisar:');
                const msgCollector = message.channel.createMessageCollector({ filter: m => m.author.id === message.author.id, max: 1, time: 60000 });

                msgCollector.on('collect', async (msg) => {
                    const appearanceName = msg.content;

                    // Conexão com Google Sheets
    
                    const sheets = google.sheets({ version: 'v4', auth: API_KEY });
                    const SPREADSHEET_ID = '17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo'; // ID da planilha

                    try {
                        const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'A:d' });
                        const rows = res.data.values;

                        let resultados = [];

                        for (let i = 1; i < rows.length; i++) {
                            const [aparencia, universo, personagem, jogador] = rows[i];
                            if (aparencia.toLowerCase() === appearanceName.toLowerCase()) {
                                resultados.push({ aparencia, universo, personagem, jogador });
                            }
                        }

                        if (resultados.length > 0) {
                            const description = resultados.map(r => `Aparência: **${r.aparencia}**\nVerso: **${r.universo}**\nPersonagem: **${r.personagem}**\nJogador: **${r.jogador}**`).join('\n\n');
                            const embed = new EmbedBuilder()
                                .setTitle('⚠️ Aparências em Uso')
                                .setColor('Red')
                                .setDescription(description);
                            message.channel.send({ embeds: [embed] });
                        } else {
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

            if (interaction.customId === 'pesquisar_verso') {

                 await message.channel.send('Digite o nome do verso que deseja pesquisar:');
                const msgCollector = message.channel.createMessageCollector({ filter: m => m.author.id === message.author.id, max: 1, time: 60000 });

                msgCollector.on('collect', async (msg) => {
                    const verseName = msg.content;

                    // Conexão com Google Sheets
    
                    const sheets = google.sheets({ version: 'v4', auth: API_KEY });
                    const SPREADSHEET_ID = '17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo'; // ID da planilha

                    try {
                        const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'UNIVERSO!A:c' });
                        const rows = res.data.values;

                        let resultados = [];

                        for (let i = 1; i < rows.length; i++) {
                            const [universo, uso, jogador] = rows[i];
                            if (universo.toLowerCase() === verseName.toLowerCase()) {
                                resultados.push({ universo, uso, jogador });
                            }
                        }

                        if (resultados.length > 0) {
                            const description = resultados.map(r => `Verso: **${r.universo}**\n% de Uso: **${r.uso}**\nJogador: **${r.jogador}**`).join('\n\n');
                            const embed = new EmbedBuilder()
                                .setTitle('⚠️ Verso em Uso')
                                .setColor('Red')
                                .setDescription(description);
                            message.channel.send({ embeds: [embed] });
                        } else {
                            const embed = new EmbedBuilder()
                                .setTitle('✅ Verso Disponível')
                                .setColor('Green')
                                .setDescription(`Verso **${verseName}** não está sendo utilizado.`);
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
