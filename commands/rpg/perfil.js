const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
} = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js');
const color = require('../../api/colors.json');
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
    keyFile: "./api/regal-primacy-233803-4fc7ea1a8a5a.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });


module.exports = class perfil extends Command {
  constructor(client) {
    super(client, {
      name: "perfil", 
      description: "visualizar o seu perfil dde jogador no rpg.", 
      category: "rpg", 
      aliases: [],
      UserPermission: [], 
      clientPermission: [], 
      OnlyDevs: false, 
      slash: true, 
    });

    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addSubcommand(subcommand =>
          subcommand
            .setName('associar')
            .setDescription('Associa um membro a um nome de jogador no RPG.')
            .addUserOption(option => 
              option.setName('membro')
                .setDescription('O membro a ser associado.')
                .setRequired(true))
            .addStringOption(option =>
              option.setName('jogador')
                .setDescription('O nome do jogador no RPG.')
                .setRequired(true))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('ver')
            .setDescription('Visualiza o seu perfil de jogador do RPG.')
            .addUserOption(option =>
                option.setName('membro')
                    .setDescription('O membro do qual você quer ver o perfil. Deixe em branco para ver o seu.')
                    .setRequired(false))
        );
    }
  }

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'associar': {

            if (!interaction.member.roles.cache.has('731974690125643869')) {
                 return interaction.reply({ content: '❌ Você não tem permissão para usar este comando.', ephemeral: true });
            }

            const member = interaction.options.getMember('membro');
            const msgJogador = interaction.options.getString('jogador');

            let embedConfirma = new EmbedBuilder()
                .setColor(color.moderation)
                .setTitle('<a:Nowoted:1408666836538495017> | DESEJA REGISTRAR ESSE USUÁRIO?')
                .setDescription(`O membro mencionado (${member}) será atribuído ao jogador \`\`${msgJogador}\`\`. Isso significa que todo seu registro atual de ficha, aparências e futuras modificações ou dados passarão a pertencer e serem associados a ele. **Deseja continuar?**`)
                .setFooter({ text: 'Use os botões para confirmar ou cancelar a operação' });

            const botaoConfirma = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('confirma_assoc').setLabel('SIM').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('nega_assoc').setLabel('CANCELAR').setStyle(ButtonStyle.Danger),
                );

            const msgPadrao = await interaction.reply({ embeds: [embedConfirma], components: [botaoConfirma], fetchReply: true, flags: MessageFlags.Ephemeral });

            const coletorBotao = msgPadrao.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });

            coletorBotao.on('collect', async i => {
                if (i.customId === 'confirma_assoc') {
                await i.deferUpdate();
                
                await this.client.database.userData.findOneAndUpdate(
                    { uid: member.id, uServer: interaction.guild.id },
                    {
                    $set: { jogador: msgJogador, uName: member.user.username },
                    $setOnInsert: {
                        uid: member.id,
                        uServer: interaction.guild.id,
                        monitor: "desativado",
                        moeda: { 'atrevicoins': 0 }
                    }
                    },
                    { upsert: true, new: true }
                );

                console.log(`RPG - SISTEMA DE ASSOCIAÇÃO | usuário ${member.user.username} associado ao jogador ${msgJogador} por ${interaction.user.username}`);
                
                let embedRegistrado = new EmbedBuilder()
                    .setColor(color.moderation)
                    .setTitle('<a:CaughtIn4K:1408664555382509598> | USUÁRIO REGISTRADO!')
                    .setDescription(`Membro ${member} associado ao jogador \`\`${msgJogador}\`\` `);

                await i.update({ embeds: [embedRegistrado], components: [] });
                coletorBotao.stop('closed');

                } else if (i.customId === 'nega_assoc') {
                    await i.update({ content: '<a:cdfpatpat:1407135944456536186> | Tudo bem! Você pode registar mais tarde!', components: [], embeds: [] });
                    coletorBotao.stop('closed');
                }
            });

            break
        }
        case 'ver': {
            await interaction.deferReply({ ephemeral: true });

            const targetUser = interaction.options.getUser('membro') || interaction.user;
            const targetMember = interaction.options.getMember('membro') || interaction.member;

            const jogadorDb = await this.client.database.userData.findOne({ uid: targetUser.id, uServer: interaction.guild.id });

            if (!jogadorDb || !jogadorDb.jogador) {
                return interaction.editReply({ content: `❌ O usuário ${targetUser} ainda não foi associado a um jogador.` });
            }

            const nomeJogador = jogadorDb.jogador;

            let aparenciasEncontradas = [];
            try {
                const res = await sheets.spreadsheets.values.get({
                    spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
                    range: "INDIVIDUAIS!A:E",
                });
                const rows = res.data.values || [];

                for (const row of rows) {
                    const [nome, universo, personagem, jogador, imagem] = row;
                    if (jogador && jogador.toLowerCase() === nomeJogador.toLowerCase()) {
                        aparenciasEncontradas.push({
                            nome: nome || 'Sem nome',
                            universo: universo || 'Sem universo',
                            personagem: personagem || 'Não especificado',
                            imagem: imagem || null
                        });
                    }
                }

                jogadorDb.aparencias = aparenciasEncontradas;
                await jogadorDb.save();

            } catch (err) {
                console.error("Erro ao buscar aparências na planilha:", err);
            }

            const generateMainEmbed = async (aparenciasSalvas = []) => {
                const personagens = [...new Set(aparenciasSalvas.map(ap => ap.personagem).filter(p => p !== 'Não especificado'))];
                
                let carteiraTxt = 'Nenhuma moeda.';
                
                if (jogadorDb.moeda && jogadorDb.moeda.size > 0) {
                    const moedasPositivas = [];
                    const moedasConfig = await this.client.database.MoedaConfig.find({ guildId: interaction.guild.id });
                    
                    for (const [nome, qtd] of jogadorDb.moeda.entries()) {
                        if (qtd > 0) {
                            const config = moedasConfig.find(m => m.nome === nome);
                            moedasPositivas.push(`${config?.emoji || '💰'} **${qtd}** ${nome}`);
                        }
                    }
                    if (moedasPositivas.length > 0) carteiraTxt = moedasPositivas.join('\n');
                }

                const embed = new EmbedBuilder()
                    .setColor(color.purple)
                    .setTitle(`PERFIL DE JOGADOR`)
                    .setAuthor({ name: targetUser.username, iconURL: targetMember.displayAvatarURL() })
                    .addFields(
                        { name: 'Jogador', value: nomeJogador },
                        { name: 'Carteira', value: carteiraTxt },
                        { name: 'Personagens', value: `${personagens.length}`, inline: true },
                        { name: 'Aparências', value: `${aparenciasSalvas.length}`, inline: true }
                    )
                    .setTimestamp();
                if (aparenciasSalvas.length > 0 && aparenciasSalvas[0].imagem) {
                    embed.setThumbnail(aparenciasSalvas[0].imagem);
                }
                return embed;
            };

            const generateAppearancesEmbed = (aparenciasSalvas, page = 0) => {
                const itemsPerPage = 1; 
                const allItems = aparenciasSalvas.map(ap => `• **${ap.nome}** (*${ap.universo}*)`);
                const pages = [];
                let currentPageContent = "";

                for (const item of allItems) {
                    if (currentPageContent.length + item.length + 1 > 4096) {
                        pages.push(currentPageContent);
                        currentPageContent = item + "\n";
                    } else {
                        currentPageContent += item + "\n";
                    }
                }
                if (currentPageContent) pages.push(currentPageContent);

                const embed = new EmbedBuilder()
                    .setColor(color.purple)
                    .setTitle(`APARÊNCIAS DE ${nomeJogador.toUpperCase()}`)
                    .setDescription(pages[page] || 'Nenhuma aparência encontrada.')
                    .setFooter({ text: `Página ${page + 1} de ${pages.length}` });

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('voltar_perfil').setLabel('⬅️ Voltar').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('ant_ap_pagina').setLabel('Anterior').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
                    new ButtonBuilder().setCustomId('prox_ap_pagina').setLabel('Próximo').setStyle(ButtonStyle.Primary).setDisabled(page >= pages.length - 1)
                );

                return { embeds: [embed], components: [buttons], pages };
            };


            const mainProfileEmbed = await generateMainEmbed(jogadorDb.aparencias || []);
            const mainButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ver_aparencias').setLabel('Ver Aparências').setStyle(ButtonStyle.Primary)
            );

            const reply = await interaction.editReply({ embeds: [mainProfileEmbed], components: [mainButtons] });

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => i.user.id === interaction.user.id,
                time: 300000 
            });

            let currentPage = 0;

            collector.on('collect', async i => {
                await i.deferUpdate();

                if (i.customId === 'ver_aparencias') {
                    const aparenciasSalvas = jogadorDb.aparencias || [];
                    currentPage = 0;
                    if (aparenciasSalvas.length === 0) {
                        await i.editReply({ content: 'Nenhuma aparência encontrada para este jogador.', embeds: [], components: [] });
                        setTimeout(() => i.editReply({ embeds: [mainProfileEmbed], components: [mainButtons] }), 5000);
                        return;
                    }
                    const { embeds, components } = generateAppearancesEmbed(aparenciasSalvas, currentPage);
                    await i.editReply({ embeds, components });
                }

                if (i.customId === 'voltar_perfil') {
                    const updatedMainEmbed = await generateMainEmbed(jogadorDb.aparencias || []);
                    await i.editReply({ embeds: [updatedMainEmbed], components: [mainButtons] });
                }

                if (i.customId === 'prox_ap_pagina') {
                    const { pages } = generateAppearancesEmbed(jogadorDb.aparencias || []);
                    if (currentPage < pages.length - 1) {
                        currentPage++;
                        const { embeds, components } = generateAppearancesEmbed(jogadorDb.aparencias || [], currentPage);
                        await i.editReply({ embeds, components });
                    }
                }

                if (i.customId === 'ant_ap_pagina') {
                    if (currentPage > 0) {
                        currentPage--;
                        const { embeds, components } = generateAppearancesEmbed(jogadorDb.aparencias || [], currentPage);
                        await i.editReply({ embeds, components });
                    }
                }
            });

            collector.on('end', () => {
                reply.edit({ components: [] }).catch(() => {});
            });

            break;
        }
        
        
    }

    
  }
};
