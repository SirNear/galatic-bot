async function handleFichaInteraction(interaction, client) {
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('modal_edit_ficha_')) {
            const fichaId = interaction.customId.split('_')[3];
            const ficha = await client.database.Ficha.findById(fichaId);
            if (!ficha) return interaction.reply({ content: "Ficha não encontrada.", ephemeral: true });

            ficha.nome = interaction.fields.getTextInputValue('edit_nome');
            ficha.raca = interaction.fields.getTextInputValue('edit_raca');
            ficha.reino = interaction.fields.getTextInputValue('edit_reino');
            ficha.aparencia = interaction.fields.getTextInputValue('edit_aparencia');

            await ficha.save();
            return interaction.reply({ content: "✅ Ficha atualizada com sucesso!", ephemeral: true });
        }

        if (interaction.customId.startsWith('modal_edit_habilidade_')) {
            const habilidadeId = interaction.customId.split('_')[3];
            const ficha = await client.database.Ficha.findOne({ "habilidades._id": habilidadeId });
            if (!ficha) return interaction.reply({ content: "Habilidade ou ficha não encontrada.", ephemeral: true });

            const habilidade = ficha.habilidades.id(habilidadeId);
            if (!habilidade) return interaction.reply({ content: "Habilidade não encontrada.", ephemeral: true });

            habilidade.nome = interaction.fields.getTextInputValue('edit_nome');
            habilidade.descricao = interaction.fields.getTextInputValue('edit_descricao');
            habilidade.categoria = interaction.fields.getTextInputValue('edit_categoria');
            habilidade.custo = interaction.fields.getTextInputValue('edit_custo');

            await ficha.save();
            return interaction.reply({ content: "✅ Habilidade atualizada com sucesso!", ephemeral: true });
        }

        if (interaction.customId.startsWith('modal_edit_subhab_')) {
            const [,,, habilidadePaiId, subHabilidadeId] = interaction.customId.split('_');
            const ficha = await client.database.Ficha.findOne({ "habilidades._id": habilidadePaiId });
            if (!ficha) return interaction.reply({ content: "Ficha não encontrada.", ephemeral: true });

            const habilidadePai = ficha.habilidades.id(habilidadePaiId);
            if (!habilidadePai) return interaction.reply({ content: "Habilidade pai não encontrada.", ephemeral: true });

            const subHab = habilidadePai.subHabilidades.id(subHabilidadeId);
            if (!subHab) return interaction.reply({ content: "Sub-habilidade não encontrada.", ephemeral: true });

            subHab.nome = interaction.fields.getTextInputValue('edit_sub_nome');
            subHab.descricao = interaction.fields.getTextInputValue('edit_sub_desc');
            subHab.custo = interaction.fields.getTextInputValue('edit_sub_custo');

            await ficha.save();
            return interaction.reply({ content: "✅ Sub-habilidade atualizada com sucesso! Navegue novamente para ver as alterações.", ephemeral: true });
        }

        if (interaction.customId.startsWith('modal_add_image_hab_')) {
            const [,,, fichaId, habilidadeId] = interaction.customId.split('_');
            const imageUrl = interaction.fields.getTextInputValue('hab_image_url');

            const ficha = await client.database.Ficha.findById(fichaId);
            if (!ficha) return interaction.reply({ content: "Ficha não encontrada.", ephemeral: true });

            const habilidade = ficha.habilidades.id(habilidadeId);
            if (!habilidade) return interaction.reply({ content: "Habilidade não encontrada.", ephemeral: true });

            habilidade.imagemURL = imageUrl;
            await ficha.save();
            return interaction.reply({ content: "✅ Imagem da habilidade atualizada com sucesso! Navegue novamente para ver a alteração.", ephemeral: true });
        }

        if (interaction.customId.startsWith('modal_add_image_subhab_')) {
            const [,,, habilidadePaiId, subHabilidadeId] = interaction.customId.split('_');
            const imageUrl = interaction.fields.getTextInputValue('subhab_image_url');

            const ficha = await client.database.Ficha.findOne({ "habilidades._id": habilidadePaiId });
            if (!ficha) return interaction.reply({ content: "Ficha não encontrada.", ephemeral: true });

            const habilidadePai = ficha.habilidades.id(habilidadePaiId);
            const subHab = habilidadePai.subHabilidades.id(subHabilidadeId);
            if (!subHab) return interaction.reply({ content: "Sub-habilidade não encontrada.", ephemeral: true });

            subHab.imagemURL = imageUrl;
            await ficha.save();
            return interaction.reply({ content: "✅ Imagem da sub-habilidade atualizada com sucesso! Navegue novamente para ver a alteração.", ephemeral: true });
        }
    }
}

module.exports = { handleFichaInteraction };