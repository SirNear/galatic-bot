const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ComponentType
} = require('discord.js');
const Command = require('../../structures/Command');

module.exports = class embed extends Command {
    constructor(client) {
        super(client, {
            name: "embed",
            description: "Criação e edição de Embeds personalizaveis",
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
                .addChannelOption(opt =>
                    opt.setName('canal')
                        .setDescription('Canal onde o embed será enviado')
                        .setRequired(true)
                );
        }
    }

    async execute(interaction) {

        if(!interaction.user.id === '712201885233654048') {
            return interaction.reply({ content: '❌ Comando em desenvolvimento.', ephemeral: true });
        }

        const embedDb = this.client.database.EmbedModel;

        const formEmbed = new ModalBuilder()
            .setCustomId('modal_inicial')
            .setTitle('Preencha com as informações do embed');
    
        const inpTitulo = new TextInputBuilder()
            .setCustomId('input_titulo')
            .setLabel('Título do Embed')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
    
        const inpDescricao = new TextInputBuilder()
            .setCustomId('input_descricao')
            .setLabel('Descrição do Embed')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(4000);

        const inpCor = new TextInputBuilder()
            .setCustomId('input_cor')
            .setLabel('Cor do Embed')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder('Hexadecimal, ex: #FF5733');

        const inpFooter = new TextInputBuilder()
            .setCustomId('input_footer')
            .setLabel('Rodapé do Embed')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        formEmbed.addComponents(
            new ActionRowBuilder().addComponents(inpTitulo),
            new ActionRowBuilder().addComponents(inpDescricao),
            new ActionRowBuilder().addComponents(inpCor),
            new ActionRowBuilder().addComponents(inpFooter)
        );

        await interaction.showModal(formEmbed);

        try {
            const subForm = await interaction.awaitModalSubmit({
                time: 60000, 
                filter: (modalInt) => modalInt.user.id === interaction.user.id
            })

            const titulo = subForm.fields.getTextInputValue('input_titulo');
            const descricao = subForm.fields.getTextInputValue('input_descricao');
            const cor = subForm.fields.getTextInputValue('input_cor') || '#5865F2';
            const footer = subForm.fields.getTextInputValue('input_footer') || interaction.user.username;
            const canal = interaction.options.getChannel('canal');

            const novoEmbed = new EmbedBuilder()
                .setTitle(titulo)
                .setDescription(descricao)
                .setColor(cor)
                .setFooter({ text: footer, iconURL: interaction.user.displayAvatarURL() });

            await embedDb.create({
                messageId: null,
                guildId: interaction.guild.id,
                titulo: titulo,
                descricao: descricao,
                cor: cor,
                footer: footer,
                canal: canal.id,
                createdAt: new Date(),
                createdBy: interaction.user.id
            });

            console.log(`EMBED PERSONALIZADO - NOVO EMBED SALVO: ${titulo} do usuário ${interaction.user.tag} (${interaction.user.id}) no canal ${canal.name} (${canal.id})`);

            const btn_edit = new ButtonBuilder()
                .setCustomId('btn_edit')
                .setEmoji('✏️')
                .setStyle(ButtonStyle.Primary);

            await canal.send({ embeds: [novoEmbed], components: [new ActionRowBuilder().addComponents(btn_edit)] });
            let embedMsg = await canal.messages.fetch({ limit: 1 }).then(messages => messages.last());

            embedDb.messageId = embedMsg.id;
            await embedDb.findOneAndUpdate({ guildId: interaction.guild.id, createdBy: interaction.user.id, canal: canal.id, titulo: titulo }, { messageId: embedMsg.id });

            await subForm.reply({ content: `✅ Embed enviado com sucesso! Confir em <#${canal.id}>`, ephemeral: true });

        }catch (err) {
            console.error(`EMBED PERSONALIZADO - ERRO MODAL INICIAL: ${err}`);
        }
    }   
};