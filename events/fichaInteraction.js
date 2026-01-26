async function handleFichaInteraction(interaction, client) {
    if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('modal_edit_ficha_')) {
            await interaction.deferReply({ flags: 64 });
            const fichaId = interaction.customId.split('_')[3];
            const ficha = await client.database.Ficha.findById(fichaId);
            if (!ficha) return interaction.editReply({ content: "Ficha não encontrada." });

            ficha.nome = interaction.fields.getTextInputValue('edit_nome');
            ficha.raca = interaction.fields.getTextInputValue('edit_raca');
            ficha.reino = interaction.fields.getTextInputValue('edit_reino');
            ficha.aparencia = interaction.fields.getTextInputValue('edit_aparencia');

            await ficha.save();
            return interaction.editReply({ content: "✅ Ficha atualizada com sucesso!" });
        }

        if (interaction.customId.startsWith('modal_edit_habilidade_')) {
            await interaction.deferReply({ flags: 64 });
            const habilidadeId = interaction.customId.split('_')[3];
            const ficha = await client.database.Ficha.findOne({ "habilidades._id": habilidadeId });
            if (!ficha) return interaction.editReply({ content: "Habilidade ou ficha não encontrada." });

            const habilidade = ficha.habilidades.id(habilidadeId);
            if (!habilidade) return interaction.editReply({ content: "Habilidade não encontrada." });

            habilidade.nome = interaction.fields.getTextInputValue('edit_nome');
            habilidade.descricao = interaction.fields.getTextInputValue('edit_descricao');
            habilidade.categoria = interaction.fields.getTextInputValue('edit_categoria');
            habilidade.custo = interaction.fields.getTextInputValue('edit_custo');

            await ficha.save();
            return interaction.editReply({ content: "✅ Habilidade atualizada com sucesso!" });
        }

        if (interaction.customId.startsWith('modal_edit_subhab_')) {
            await interaction.deferReply({ flags: 64 });
            const [,,, habilidadePaiId, subHabilidadeId] = interaction.customId.split('_');
            const ficha = await client.database.Ficha.findOne({ "habilidades._id": habilidadePaiId });
            if (!ficha) return interaction.editReply({ content: "Ficha não encontrada." });

            const habilidadePai = ficha.habilidades.id(habilidadePaiId);
            if (!habilidadePai) return interaction.editReply({ content: "Habilidade pai não encontrada." });

            const subHab = habilidadePai.subHabilidades.id(subHabilidadeId);
            if (!subHab) return interaction.editReply({ content: "Sub-habilidade não encontrada." });

            subHab.nome = interaction.fields.getTextInputValue('edit_sub_nome');
            subHab.descricao = interaction.fields.getTextInputValue('edit_sub_desc');
            subHab.custo = interaction.fields.getTextInputValue('edit_sub_custo');

            await ficha.save();
            return interaction.editReply({ content: "✅ Sub-habilidade atualizada com sucesso! Navegue novamente para ver as alterações." });
        }

        if (interaction.customId.startsWith('modal_add_image_hab_')) {
            await interaction.deferReply({ flags: 64 });
            const [,,, fichaId, habilidadeId] = interaction.customId.split('_');
            const imageUrl = interaction.fields.getTextInputValue('hab_image_url');

            const ficha = await client.database.Ficha.findById(fichaId);
            if (!ficha) return interaction.editReply({ content: "Ficha não encontrada." });

            const habilidade = ficha.habilidades.id(habilidadeId);
            if (!habilidade) return interaction.editReply({ content: "Habilidade não encontrada." });

            habilidade.imagemURL = imageUrl;
            await ficha.save();
            return interaction.editReply({ content: "✅ Imagem da habilidade atualizada com sucesso! Navegue novamente para ver a alteração." });
        }

        if (interaction.customId.startsWith('modal_add_image_subhab_')) {
            await interaction.deferReply({ flags: 64 });
            const [,,, habilidadePaiId, subHabilidadeId] = interaction.customId.split('_');
            const imageUrl = interaction.fields.getTextInputValue('subhab_image_url');

            const ficha = await client.database.Ficha.findOne({ "habilidades._id": habilidadePaiId });
            if (!ficha) return interaction.editReply({ content: "Ficha não encontrada." });

            const habilidadePai = ficha.habilidades.id(habilidadePaiId);
            const subHab = habilidadePai.subHabilidades.id(subHabilidadeId);
            if (!subHab) return interaction.editReply({ content: "Sub-habilidade não encontrada." });

            subHab.imagemURL = imageUrl;
            await ficha.save();
            return interaction.editReply({ content: "✅ Imagem da sub-habilidade atualizada com sucesso! Navegue novamente para ver a alteração." });
        }
    }
}

module.exports = { handleFichaInteraction };