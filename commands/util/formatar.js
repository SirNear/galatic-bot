const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const Command = require('../../structures/Command');
const axios = require('axios');

module.exports = class formatar extends Command {
    constructor(client) {
        super(client, {
            name: "formatar",
            description: "Formata textos para o padrão de RPG (Falas, Pensamentos, Narração).",
            category: "utils",
            aliases: ["fmt"],
            UserPermission: [],
            clientPermission: [],
            OnlyDevs: false,
            slash: true,
        });

        if (this.config.slash) {
            this.data = new SlashCommandBuilder()
                .setName(this.config.name)
                .setDescription(this.config.description)
                .addStringOption(opt =>
                    opt.setName('texto')
                        .setDescription('O texto a ser formatado.')
                        .setRequired(false)
                )
                .addAttachmentOption(opt =>
                    opt.setName('arquivo')
                        .setDescription('Arquivo .txt com o texto.')
                        .setRequired(false)
                );
        }
    }

    async run({ message }) {
        message.reply('Este comando está disponível apenas via Slash Command (/formatar).');
    }

    async execute(interaction) {
        const texEnt = interaction.options.getString('texto');
        const arqEnt = interaction.options.getAttachment('arquivo');

        if (!texEnt && !arqEnt) {
            return interaction.reply({ content: '❌ Você deve fornecer um texto ou um arquivo.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        let conTex = '';

        if (arqEnt) {
            try {
                const resArq = await axios.get(arqEnt.url);
                conTex = resArq.data;
            } catch (err) {
                return interaction.editReply({ content: '❌ Erro ao ler o arquivo.' });
            }
        } else {
            conTex = texEnt;
        }

        if (typeof conTex !== 'string') conTex = String(conTex);

        const linTex = conTex.split(/\r?\n/);
        const linFor = [];
        let emPen = false; // Controle de estado para pensamentos multi-parágrafo

        for (let lin of linTex) {
            let linTri = lin.trim();

            if (linTri.length === 0) {
                linFor.push(lin);
                continue;
            }

            // 1. Verifica Fala (Inicia com -, — ou •)
            if (/^[-—•]/.test(linTri)) {
                // Remove marcador inicial e garante travessão
                let conFal = linTri.replace(/^[-—•]\s*/, '');
                
                // Processa narração interna (entre travessões)
                const parFal = conFal.split('—');
                let linNov = `— ${parFal[0].trim()}`;

                for (let i = 1; i < parFal.length; i++) {
                    let parAtu = parFal[i].trim();
                    if (!parAtu) continue;

                    // Índices ímpares são narrações (após o primeiro travessão)
                    if (i % 2 !== 0) {
                        linNov += ` — **${parAtu}**`;
                    } else {
                        // Índices pares são falas novamente
                        linNov += ` — ${parAtu}`;
                    }
                }
                linFor.push(linNov);
                emPen = false; // Reseta pensamento se mudar de tipo
            } 
            // 2. Verifica Pensamento (Inicia com ( e termina com ))
            else if (emPen || (linTri.startsWith('('))) {
                if (!emPen) {
                    // Início de novo pensamento
                    if (linTri.endsWith(')')) {
                        // Pensamento de linha única
                        linFor.push(`*${linTri}*`);
                    } else {
                        // Início de bloco de pensamento
                        emPen = true;
                        linFor.push(`*${linTri}`);
                    }
                } else {
                    // Continuação de pensamento
                    if (linTri.endsWith(')')) {
                        emPen = false;
                        linFor.push(`${linTri}*`);
                    } else {
                        linFor.push(linTri);
                    }
                }
            }
            // 3. Narração Padrão
            else {
                linFor.push(`**${linTri}**`);
                emPen = false;
            }
        }

        const texFin = linFor.join('\n');

        // Se o texto for maior que o limite do Discord (2000), envia como arquivo
        if (texFin.length > 2000) {
            const bufArq = Buffer.from(texFin, 'utf-8');
            const attArq = new AttachmentBuilder(bufArq, { name: 'formatado.txt' });
            
            const chunks = [];
            let curTex = texFin;
            const MAX_CHUNK = 2000;

            while (curTex.length > 0) {
                let chuTex;
                if (curTex.length <= MAX_CHUNK) {
                    chuTex = curTex;
                    curTex = '';
                } else {
                    let splInd = curTex.lastIndexOf('\n', MAX_CHUNK - 1);
                    if (splInd === -1) splInd = curTex.lastIndexOf(' ', MAX_CHUNK - 1);
                    
                    if (splInd === -1) {
                        chuTex = curTex.substring(0, MAX_CHUNK);
                        curTex = curTex.substring(MAX_CHUNK);
                    } else {
                        chuTex = curTex.substring(0, splInd + 1);
                        curTex = curTex.substring(splInd + 1);
                    }
                }
                chunks.push(chuTex);
            }

            let pagAtu = 0;

            const gerEmb = (idx) => {
                return new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle('✂️ Texto Formatado e Cortado')
                    .setDescription(chunks[idx])
                    .setFooter({ text: `Parte ${idx + 1} de ${chunks.length} | Copie o texto acima` });
            };

            const gerBot = (idx) => {
                const row = new ActionRowBuilder();
                const btnAnt = new ButtonBuilder().setCustomId('fmt_ant').setLabel('Anterior').setStyle(ButtonStyle.Primary).setDisabled(idx === 0);
                const btnPro = new ButtonBuilder().setCustomId('fmt_pro').setLabel('Próximo').setStyle(ButtonStyle.Primary).setDisabled(idx === chunks.length - 1);
                row.addComponents(btnAnt, btnPro);
                return row;
            };

            const msg = await interaction.editReply({ content: '✅ Texto formatado (muito longo, use os botões para navegar):', embeds: [gerEmb(pagAtu)], components: [gerBot(pagAtu)], files: [attArq] });

            const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, filter: i => i.user.id === interaction.user.id, time: 600000 });

            col.on('collect', async i => {
                if (i.customId === 'fmt_ant') pagAtu = pagAtu > 0 ? pagAtu - 1 : pagAtu;
                else if (i.customId === 'fmt_pro') pagAtu = pagAtu < chunks.length - 1 ? pagAtu + 1 : pagAtu;
                await i.update({ embeds: [gerEmb(pagAtu)], components: [gerBot(pagAtu)] });
            });

            col.on('end', () => msg.edit({ components: [] }).catch(() => {}));
        } else {
            await interaction.editReply({ content: texFin });
        }
    }
};
