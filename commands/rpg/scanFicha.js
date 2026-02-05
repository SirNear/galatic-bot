const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ModalBuilder,
  ChannelType,
} = require('discord.js');
const Command = require('../../structures/Command');
const error = require('../../api/error.js');
const { Ficha } = require('../../mongoose');

module.exports = class ScanFicha extends Command {
  constructor(client) {
    super(client, {
      name: "scanficha", 
      description: "Escaneia o canal para criar uma ficha automaticamente.", 
      category: "rpg", 
      aliases: ["scan", "lerficha", "sf"],
      UserPermission: [], 
      clientPermission: [], 
      OnlyDevs: false, 
      slash: true, 
    });

    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addChannelOption(opt => 
            opt.setName('canal')
               .setDescription('O canal a ser escaneado (opcional)')
               .setRequired(false)
        )
    }
  }

  async execute(interaction) {
        await interaction.deferReply();
        const canAlv = interaction.options.getChannel('canal') || interaction.channel;

        // Verifica se é texto ou fórum
        if (!canAlv.isTextBased() && canAlv.type !== ChannelType.GuildForum) {
            return interaction.editReply('❌ Por favor, mencione um canal de texto ou um fórum.');
        }

        let canaisParaProcessar = [];
        if (canAlv.type === ChannelType.GuildForum) {
            try {
                const threadsAtivas = await canAlv.threads.fetchActive();
                canaisParaProcessar = Array.from(threadsAtivas.threads.values());
                if (canaisParaProcessar.length === 0) {
                    return interaction.editReply('❌ Nenhum tópico ativo encontrado neste fórum.');
                }
            } catch (err) {
                console.error("Erro ao buscar threads do fórum:", err);
                return interaction.editReply('❌ Erro ao buscar tópicos do fórum.');
            }
        } else {
            canaisParaProcessar = [canAlv];
        }

        let processados = 0;
        let ultimaFicha = null;

        // Função auxiliar para processar um único canal/tópico
        const processarCanal = async (canalAlvo) => {
            try {
                const menSag = await canalAlvo.messages.fetch({ limit: 100 });
                const ordMes = Array.from(menSag.values()).reverse();

                let ficDat = {
                    channelId: canalAlvo.id,
                    guildId: interaction.guild.id,
                    userId: null,
                    nome: "Desconhecido",
                    reino: "Desconhecido",
                    raca: "Desconhecido",
                    idade: "Desconhecido",
                    aparencia: "Ver Imagem",
                    imagemURL: null,
                    atributos: { forca: "?", velocidade: "?", resistencia: "?", mana: "?" },
                    habilidades: []
                };

                const padRoes = {
                    nome: /(?:Nome|Name|Nom|Identidade)[\s\W]*[:\->=↢❦]+\s*(.+)/i,
                    idade: /(?:Idade|Age|Anos)[\s\W]*[:\->=↢❦]+\s*(.+)/i,
                    raca: /(?:Raça|Raca|Race|Espécie)[\s\W]*[:\->=↢❦]+\s*(.+)/i,
                    reino: /(?:Reino|Kingdom|Nacionalidade|Origem)[\s\W]*[:\->=↢❦]+\s*(.+)/i,
                    aparencia: /(?:Aparência|Aparencia|Appearance|Desc)[\s\W]*[:\->=↢❦]+\s*(.+)/i,
                    forca: /(?:Força|Forca|Strength)[\s\W]*[:\->=↢❦]+\s*(.+)/i,
                    velocidade: /(?:Velocidade|Speed|Vel)[\s\W]*[:\->=↢❦]+\s*(.+)/i,
                    resistencia: /(?:Resistência|Resistencia|Defense)[\s\W]*[:\->=↢❦]+\s*(.+)/i,
                    mana: /(?:Mana|Energia|Ki|Chakra)[\s\W]*[:\->=↢❦]+\s*(.+)/i
                };

                for (const msg of ordMes) {
                    const conTeu = msg.content;
                    if (!conTeu) continue;

                    if (!ficDat.userId) ficDat.userId = msg.author.id;
                    
                    if (!ficDat.imagemURL && msg.attachments.size > 0) {
                        ficDat.imagemURL = msg.attachments.first().url;
                    }

                    const linHas = conTeu.split('\n');
                    
                    for (const lin of linHas) {
                        if (lin.match(padRoes.nome) && ficDat.nome === "Desconhecido") ficDat.nome = lin.match(padRoes.nome)[1].trim();
                        if (lin.match(padRoes.idade)) ficDat.idade = lin.match(padRoes.idade)[1].trim();
                        if (lin.match(padRoes.raca)) ficDat.raca = lin.match(padRoes.raca)[1].trim();
                        if (lin.match(padRoes.reino)) ficDat.reino = lin.match(padRoes.reino)[1].trim();
                        if (lin.match(padRoes.aparencia)) ficDat.aparencia = lin.match(padRoes.aparencia)[1].trim();

                        if (lin.match(padRoes.forca)) ficDat.atributos.forca = lin.match(padRoes.forca)[1].trim();
                        if (lin.match(padRoes.velocidade)) ficDat.atributos.velocidade = lin.match(padRoes.velocidade)[1].trim();
                        if (lin.match(padRoes.resistencia)) ficDat.atributos.resistencia = lin.match(padRoes.resistencia)[1].trim();
                        if (lin.match(padRoes.mana)) ficDat.atributos.mana = lin.match(padRoes.mana)[1].trim();
                    }

                    const ehCabHab = /\[.*(Habilidade|Skill|Poder|Passiva|Ativa|Técnica).*\]|[\u2600-\u26FF].*(Habilidade|Skill)/i.test(conTeu);
                    const temTitCol = /^\[.+\]/.test(conTeu);

                    if (ehCabHab || temTitCol || conTeu.length > 200) {
                        if (!conTeu.match(padRoes.nome)) {
                            let titUlo = conTeu.split('\n')[0].substring(0, 50);
                            if (titUlo.length === 0) titUlo = "Habilidade";
                            
                            ficDat.habilidades.push({
                                nome: titUlo.replace(/[*_`\[\]]/g, ''),
                                descricao: conTeu.substring(0, 1020) + (conTeu.length > 1020 ? "..." : ""),
                                categoria: "Geral"
                            });
                        }
                    }
                }

                if (!ficDat.userId) ficDat.userId = interaction.user.id;

                await Ficha.findOneAndUpdate(
                    { userId: ficDat.userId, guildId: interaction.guild.id, nome: ficDat.nome },
                    ficDat,
                    { upsert: true, new: true }
                );
                return ficDat;
            } catch (err) {
                console.error(`Erro ao processar canal ${canalAlvo.id}:`, err);
                return null;
            }
        };

        // Processa todos os canais identificados
        for (const canal of canaisParaProcessar) {
            const resultado = await processarCanal(canal);
            if (resultado) {
                processados++;
                ultimaFicha = resultado;
            }
        }

        if (processados === 0) {
            return interaction.editReply('❌ Nenhuma ficha válida encontrada ou erro ao processar.');
        }

        // Se processou apenas uma, mostra o embed detalhado (comportamento original)
        if (processados === 1 && ultimaFicha) {
            const embRes = new EmbedBuilder()
                .setTitle('✅ Ficha Sincronizada!')
                .setDescription(`Ficha de **${ultimaFicha.nome}** foi lida com sucesso do canal <#${ultimaFicha.channelId}>.`)
                .addFields(
                    { name: 'Força', value: ultimaFicha.atributos.forca || '?', inline: true },
                    { name: 'Velocidade', value: ultimaFicha.atributos.velocidade || '?', inline: true },
                    { name: 'Habilidades Encontradas', value: `${ultimaFicha.habilidades.length}`, inline: true }
                )
                .setColor('Green');

            if (ultimaFicha.imagemURL) embRes.setThumbnail(ultimaFicha.imagemURL);

            return interaction.editReply({ embeds: [embRes] });
        } else {
            // Se processou várias (Fórum), mostra resumo
            const embRes = new EmbedBuilder()
                .setTitle('✅ Scan Completo!')
                .setDescription(`Foram escaneadas e atualizadas **${processados}** fichas a partir do fórum ${canAlv}.`)
                .setColor('Green');
            return interaction.editReply({ embeds: [embRes] });
        }
  }
};
