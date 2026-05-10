const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Command = require('../../structures/Command');
const { buscarContextoLocal } = require('../../api/loreManager');

async function gerarResposta(pergunta, contexto) {
    const systemInstruction = `Você é um arquivista e assistente avançado de lore de um RPG. Sua tarefa é analisar profundamente o contexto fornecido para responder à pergunta do usuário.
Conecte o máximo de informações possíveis, cruzando dados, personagens, diálogos, locais e eventos para gerar uma resposta rica, detalhada e coesa.
Traga à tona conexões implícitas e associativas presentes nos textos para enriquecer a explicação. 
Responda estritamente baseando-se no contexto abaixo, mas extraindo e correlacionando o máximo de significado possível dele:

CONTEXTO:
${contexto}`;
    
    const models = [
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-1.5-pro',
        'gemini-2.5-pro',
        'gemini-3.1-pro-preview'
    ];
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (apiKey) {
        for (const model of models) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: systemInstruction }] },
                        contents: [{ parts: [{ text: pergunta }] }],
                        generationConfig: { temperature: 0.3 }
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.candidates && data.candidates[0].content.parts[0].text) {
                        return { text: data.candidates[0].content.parts[0].text, model };
                    }
                } else if (response.status === 429) {
                    continue; // Silencia o erro 429 de limite de cota
                } else {
                    console.error(`[ASK IA] Erro na API Gemini (Status: ${response.status}) no modelo ${model}`);
                }
            } catch (e) {
                console.error(`[ASK IA] Exceção no modelo ${model}:`, e.message);
            }
        }
    }
    
    try {
        const resPol = await fetch('https://text.pollinations.ai/openai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'openai',
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: pergunta }
                ],
                temperature: 0.3
            })
        });
        if (resPol.ok) {
            const data = await resPol.json();
            if (data.choices && data.choices[0].message.content) {
                return { text: data.choices[0].message.content, model: 'pollinations.ai (fallback)' };
            }
        }
    } catch (e) {}

    throw new Error("Todos os modelos de IA falharam ou estão sobrecarregados no momento.");
}

module.exports = class Ask extends Command {
  constructor(client) {
    super(client, {
      name: "ask",
      description: "Consulta a lore do RPG usando IA",
      category: "rpg",
          aliases: [],
          UserPermission: [],
          clientPermission: [],
          OnlyDevs: true,
      slash: true,
    });

    if (this.config.slash) {
      this.data = new SlashCommandBuilder()
        .setName(this.config.name)
        .setDescription(this.config.description)
        .addStringOption(opt => opt.setName('pergunta').setDescription('O que deseja saber?').setRequired(true));
    }
  }

  async execute(interaction) {
    await interaction.deferReply();
    const pergunta = interaction.options.getString('pergunta');

    try {
      const contexto = buscarContextoLocal(pergunta);
      const { text, model } = await gerarResposta(pergunta, contexto);

      const embed = new EmbedBuilder()
        .setTitle('📚 Consulta à Lore')
        .setDescription(text.substring(0, 4096))
        .setColor('#0099ff')
        .setFooter({ text: `Respondido por: ${model} | Baseado nos seus TXTs` });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply(`❌ Erro: ${err.message}`);
    }
  }
};