const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ModalBuilder,
  ButtonStyle,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ComponentType,
  MessageFlags
} = require('discord.js');
const Command = require('../../structures/Command');
const { LojaModel } = require('../../mongoose.js');

module.exports = class loja extends Command {
  constructor(client) {
    super(client, {
      name: "loja", 
      description: "configura a loja de atrevicoins", // Descrição para o comando de barra
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
          subcommand.setName('criar')
            .setDescription('Cria uma nova loja')
            .addStringOption(option => 
              option.setName('nome')
                .setDescription('insira o nome da loja')
                .setRequired(true)
            )
            .addChannelOption(option =>
                option.setName('canal')
                    .setDescription('selecione o canal onde a loja será criada')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('descricao')
                    .setDescription('insira a descrição principal da loja')
                    .setRequired(true)
            )
        )
        .addSubcommand(subcommand => 
          subcommand.setName('deletar')
            .setDescription('Deleta uma loja existente')
            .addStringOption(option =>
              option.setName('id')
                  .setDescription('insira o ID da mensagem da loja a ser deletada')
                  .setRequired(true)
            )
        )
        .addSubcommand(subcommand => 
          subcommand.setName('editar')
            .setDescription('Edita uma loja existente')
            .addStringOption(option =>
              option.setName('id')
                  .setDescription('insira o ID da mensagem da loja a ser deletada')
                  .setRequired(true)
            )
        )
        .addSubcommand(subcommand => 
          subcommand.setName('categoria')
            .setDescription('Adiciona uma categoria de item à loja') 
            .addStringOption(option =>
              option.setName('loja')
                  .setDescription('insira o ID da mensagem da loja onde a categoria será adicionada')
                  .setRequired(true)
            )
            .addStringOption(option => 
              option.setName('nome')
                  .setDescription('insira o nome da categoria')
                  .setRequired(true)
            )
            .addStringOption(option => 
              option.setName('emoji')
                  .setDescription('insira o emoji da categoria')
            )
        )
        .addSubcommand(subcommand => 
          subcommand.setName('item')
            .setDescription('Adiciona um item à loja')
            .addStringOption(option =>
              option.setName('loja')
                  .setDescription('insira o ID da mensagem da loja onde o item será adicionado')
                  .setRequired(true)
            )
            .addStringOption(option => 
              option.setName('nome')
                  .setDescription('insira o nome do item')
                  .setRequired(true)
            )
            .addStringOption(option => 
              option.setName('descricao')
                  .setDescription('insira a descrição do item')
                  .setRequired(true)
            )
            .addIntegerOption(option =>
              option.setName('preco')
                  .setDescription('insira o preço do item')
                  .setRequired(true)
            )
            .addStringOption(option =>
              option.setName('moeda')
                  .setDescription('selecione a moeda para o preço do item')
                  .setRequired(true)
                  .setAutocomplete(true)
            )
            .addStringOption(option => 
              option.setName('emoji')
                  .setDescription('insira o emoji do item')
            )
        )
            
    }
  }

  async autocomplete(interaction) {
    if (interaction.options.getSubcommand() === 'item') {
        const focVal = interaction.options.getFocused();
        const moedas = await this.client.database.MoedaConfig.find({ guildId: interaction.guild.id });
        const escolhas = moedas.map(m => m.nome);
        const filtrado = escolhas.filter(esc => esc.startsWith(focVal));
        await interaction.respond(
            filtrado.slice(0, 25).map(esc => ({ name: esc, value: esc })),
        );
    }
  }

  async execute(interaction) {
    const hasPermission = interaction.member.roles.cache.has('731974690125643869') || interaction.member.roles.cache.has('1438672389918556310') || interaction.member.roles.cache.has('1409771551099715645');
    if (!hasPermission) {
        return interaction.reply({
            content: 'Você não tem permissão para usar este comando. Peça para um admod adicionar o cargo "Comerciante" a você, caso tenha uma lojinha em RP.',
            flags: MessageFlags.Ephemeral
        });
    }

    switch (interaction.options.getSubcommand()) {
      case 'criar': {
        const nome = interaction.options.getString('nome');
        const canal = interaction.options.getChannel('canal');
        const descricao = interaction.options.getString('descricao');
        const admodRole = '731974690125643869';
        const isAdmod = interaction.member.roles.cache.has(admodRole);

        try {
          const lojaExistente = await LojaModel.findOne({ canalId: canal.id, status: 'aprovada' });
          if (lojaExistente) {
            return interaction.reply({ content: '❌ Já existe uma loja aprovada neste canal.', flags: MessageFlags.Ephemeral });
          }

          if (isAdmod) {
            const embed = new EmbedBuilder().setTitle(nome).setDescription(descricao).setColor('#119446').setFooter({ text: 'Loja criada por ' + interaction.user.username, iconURL: interaction.user.displayAvatarURL() });
            const lojaMessage = await canal.send({ embeds: [embed] });

            await LojaModel.create({
              messageId: lojaMessage.id,
              nome: nome,
              createdBy: interaction.user.id,
              canalId: canal.id,
              descricao: descricao,
              status: 'aprovada'
            });

            return interaction.reply({ content: `✅ Loja criada com sucesso por um AdMod em ${canal.toString()}`, flags: MessageFlags.Ephemeral });
          } else {
            const canalConfirma = await interaction.guild.channels.fetch('1441471406889111643');
            if (!canalConfirma) return interaction.reply({ content: '❌ Canal de aprovação não encontrado. Contate um desenvolvedor.', flags: MessageFlags.Ephemeral });

            const novaLojaPendente = new LojaModel({
              nome: nome,
              createdBy: interaction.user.id,
              canalId: canal.id,
              descricao: descricao,
              status: 'pendente'
            });
            await novaLojaPendente.save();

            const botoesAprovacao = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`approve_loja_${novaLojaPendente._id}_${interaction.user.id}`).setLabel('Aprovar').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId(`reject_loja_${novaLojaPendente._id}_${interaction.user.id}`).setLabel('Rejeitar').setStyle(ButtonStyle.Danger)
            );

            await canalConfirma.send({ content: `O usuário ${interaction.user} solicitou a criação de uma nova loja em ${canal.toString()}. Por favor, um AdMod avalie a solicitação.`, components: [botoesAprovacao] });
            return interaction.reply({ content: '✅ Sua solicitação de loja foi enviada para aprovação dos AdMods.', flags: MessageFlags.Ephemeral });
          }
        } catch (err) {
          console.error(`SISTEMA DE LOJA | erro ao criar loja: ${err}`);
          return interaction.reply({ content: `Ocorreu um erro ao criar a loja.\n\`\`\`js\n${err.stack || err}\n\`\`\``, flags: MessageFlags.Ephemeral });
        }
      }
      case 'deletar':
        const lojaId = interaction.options.getString('id'); // Corrigido para 'id' minúsculo
        const lojaDB = await LojaModel.findOne({ messageId: lojaId });
        if (!lojaDB) return interaction.reply({ content: 'Loja não encontrada com esse ID de mensagem.', flags: MessageFlags.Ephemeral });

        if (lojaDB.createdBy !== interaction.user.id && !interaction.member.roles.cache.has('1438672389918556310')) {
          return interaction.reply({ content: 'Você não tem permissão para deletar esta loja.', flags: MessageFlags.Ephemeral });
        }

        try {
          const canalLoja = await interaction.guild.channels.fetch(lojaDB.canalId);
          const msgLoja = await canalLoja.messages.fetch(lojaDB.messageId);
          await msgLoja.delete();
          await LojaModel.deleteOne({ messageId: lojaId });
          return interaction.reply({ content: '✅ Loja deletada com sucesso!', flags: MessageFlags.Ephemeral });
        } catch (err) {
          console.error(`SISTEMA DE LOJA | erro ao deletar loja: ${err}`);
          await LojaModel.deleteOne({ messageId: lojaId }); // Tenta deletar do DB mesmo se a mensagem falhar
          return interaction.reply({ content: `Ocorreu um erro ao deletar a mensagem da loja, mas ela foi removida do banco de dados. Verifique se a mensagem ainda existe.\n\`\`\`js\n${err.stack || err}\n\`\`\``, ephemeral: true });
        }
      case 'editar': {
        const lojaIdEditar = interaction.options.getString('id');
        const lojaDBEditar = await LojaModel.findOne({ messageId: lojaIdEditar });
        if (!lojaDBEditar) return interaction.reply({ content: 'Loja não encontrada com esse ID.', flags: MessageFlags.Ephemeral });

        if (lojaDBEditar.createdBy !== interaction.user.id) {
          return interaction.reply({ content: 'Você não tem permissão para editar esta loja.', flags: MessageFlags.Ephemeral });
        }

        const modalEdit = new ModalBuilder()
          .setCustomId(`lojaEditModal_${lojaIdEditar}`)
          .setTitle(`Editar Loja - ${lojaDBEditar.nome}`);

        const nomeInput = new TextInputBuilder().setCustomId('nome').setLabel("Novo nome da Loja").setValue(lojaDBEditar.nome).setStyle(TextInputStyle.Short).setRequired(true);
        const descInput = new TextInputBuilder().setCustomId('descricao').setLabel("Nova descrição da Loja").setValue(lojaDBEditar.descricao).setStyle(TextInputStyle.Paragraph).setRequired(true);

        modalEdit.addComponents(new ActionRowBuilder().addComponents(nomeInput), new ActionRowBuilder().addComponents(descInput));

        await interaction.showModal(modalEdit);

        await modalEdit.awaitModalSubmit({
          time: 320000,
          filter: i => i.user.id === interaction.user.id && i.customId.startsWith('lojaEditModal_'),
          componentType: ComponentType.ModalSubmit
        }).then(async modalInteraction => {
          const novoNome = modalInteraction.fields.getTextInputValue('nome');
          const novaDescricao = modalInteraction.fields.getTextInputValue('descricao');

          lojaDBEditar.nome = novoNome;
          lojaDBEditar.descricao = novaDescricao;

          try {
            const canal = await client.channels.fetch(lojaDBEditar.canalId);
            const msgLoja = await canal.messages.fetch(lojaDBEditar.messageId);

            const embedAtualizado = EmbedBuilder.from(msgLoja.embeds[0])
              .setTitle(novoNome)
              .setDescription(novaDescricao);

            await msgLoja.edit({ embeds: [embedAtualizado] });
            await lojaDBEditar.save();

            await modalInteraction.reply({ content: '✅ Loja atualizada com sucesso!', flags: MessageFlags.Ephemeral });

          } catch (err) {
            console.error(`SISTEMA DE LOJA | erro ao editar loja: ${err}`);
            await modalInteraction.reply({
              content: `Ocorreu um erro ao editar a loja. Verifique se a mensagem original ainda existe. Envie à um desenvolvedor: \n\`\`\`js\n${err.stack || err}\n\`\`\``,
              flags: MessageFlags.Ephemeral
            });
          }
        })

        break;
      }
      case 'categoria':
        const lojaIdCat = interaction.options.getString('loja');
        const nomeCat = interaction.options.getString('nome');
        const emojiInput = interaction.options.getString('emoji');

        const isUnicodeEmoji = (s) => {
            return /^\p{Emoji}$/u.test(s);
        };

        const customEmojiRegex = /<a?:.+?:\d+>/;
        const emojiCat = (emojiInput && (customEmojiRegex.test(emojiInput) || isUnicodeEmoji(emojiInput))) ? emojiInput : null;

        const lojaDBCat = await LojaModel.findOne({ messageId: lojaIdCat });
        if (!lojaDBCat) return interaction.reply({ content: 'Loja não encontrada com esse ID de mensagem.', flags: MessageFlags.Ephemeral });

        if (lojaDBCat.createdBy !== interaction.user.id) return interaction.reply({ content: 'Você não tem permissão para adicionar categorias a esta loja.', flags: MessageFlags.Ephemeral });
       
        lojaDBCat.categorias.push({ nome: nomeCat, emoji: emojiCat || '' });
        await lojaDBCat.save();

        try {
            const canalLoja = await interaction.guild.channels.fetch(lojaDBCat.canalId);
            const msgLoja = await canalLoja.messages.fetch(lojaDBCat.messageId);

            const botoesCat = lojaDBCat.categorias.map(cat => {
                const botao = new ButtonBuilder()
                    .setCustomId(`categoria_${lojaDBCat.messageId}_${cat.nome}`)
                    .setLabel(cat.nome)
                    .setStyle(ButtonStyle.Primary);
                if (cat.emoji) botao.setEmoji(cat.emoji);
                return botao;
            });

            const novaLinhaAcao = new ActionRowBuilder().addComponents(botoesCat);
            await msgLoja.edit({ components: [novaLinhaAcao] });

            await interaction.reply({ content: '✅ Categoria adicionada e botão atualizado na loja!', flags: MessageFlags.Ephemeral });
        } catch (err) {
            console.error(`SISTEMA DE LOJA | erro ao atualizar msg da loja com categoria: ${err}`);
            await interaction.reply({ content: `A categoria foi salva, mas ocorreu um erro ao atualizar a mensagem da loja.\n\`\`\`js\n${err.stack || err}\n\`\`\``, flags: MessageFlags.Ephemeral });
        }

        break;
      case 'item':
        const lojaIdItem = interaction.options.getString('loja');
        const lojaDBItem = await LojaModel.findOne({ messageId: lojaIdItem });
        if (!lojaDBItem) return interaction.reply({ content: 'Loja não encontrada com esse ID de mensagem.', flags: MessageFlags.Ephemeral });

        if (lojaDBItem.createdBy !== interaction.user.id && !interaction.member.roles.cache.has('1438672389918556310')) {
            return interaction.reply({ content: 'Você não tem permissão para adicionar itens a esta loja.', flags: MessageFlags.Ephemeral });
        }

        if (!lojaDBItem.categorias || lojaDBItem.categorias.length === 0) {
            return interaction.reply({ content: 'Esta loja não possui categorias. Crie uma com `/loja categoria` primeiro.', flags: MessageFlags.Ephemeral });
        }

        const nomeItem = interaction.options.getString('nome');
        const descItem = interaction.options.getString('descricao');
        const precoItem = interaction.options.getInteger('preco');
        const moedaItem = interaction.options.getString('moeda');

        const moedaCfg = await this.client.database.MoedaConfig.findOne({ guildId: interaction.guild.id, nome: moedaItem.toLowerCase() });
        if (!moedaCfg) {
            return interaction.reply({ content: `A moeda "${moedaItem}" não é uma moeda válida no servidor.`, flags: MessageFlags.Ephemeral });
        }

        const catOpts = lojaDBItem.categorias.map(cat => ({
            label: cat.nome,
            value: cat.nome,
            emoji: cat.emoji || undefined
        }));

        const selMenu = new StringSelectMenuBuilder()
            .setCustomId('sel_cat_item')
            .setPlaceholder('Selecione a categoria para este item')
            .addOptions(catOpts);

        const acaoLinha = new ActionRowBuilder().addComponents(selMenu);

        const resp = await interaction.reply({
            content: 'Em qual categoria você deseja adicionar este item?',
            components: [acaoLinha],
            flags: MessageFlags.Ephemeral,
            fetchReply: true
        });

        const coletor = resp.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        });

        coletor.on('collect', async i => {
            const catSel = i.values[0];

            const categoriaAlvo = lojaDBItem.categorias.find(c => c.nome === catSel);
            if (!categoriaAlvo) return i.update({ content: 'Erro: Categoria selecionada não foi encontrada. Tente novamente.', components: [] });

            categoriaAlvo.itens.push({
                nome: nomeItem,
                descricao: descItem,
                preco: precoItem,
                moeda: moedaItem,
            });

            await lojaDBItem.save();

            await i.update({ content: `✅ Item **${nomeItem}** adicionado com sucesso à categoria **${catSel}**!`, components: [] });
            coletor.stop();
        });

        coletor.on('end', (collected) => {
            if (collected.size === 0) interaction.editReply({ content: 'Tempo esgotado. A adição do item foi cancelada.', components: [] }).catch(() => {});
        });
        break;
    }
  }
}
