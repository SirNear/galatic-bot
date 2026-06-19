const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { google } = require('googleapis');

function normalize(str) {
  return String(str || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function handleProporTroca(interaction, rowIndex, targetResult, sheets, client) {
    if (!targetResult) {
        return interaction.reply({ content: '❌ Erro: Aparência alvo não encontrada.', flags: 64 });
    }

    const userDb = await client.database.userData.findOne({ uid: interaction.user.id });
    if (!userDb || !userDb.jogador) {
        return interaction.reply({ content: '❌ Erro: Seu registro não foi encontrado no banco de dados.', flags: 64 });
    }

    const resUni = await sheets.spreadsheets.values.get({
        spreadsheetId: "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo",
        range: "INDIVIDUAIS!A:D"
    });
    
    const rows = resUni.data.values || [];
    const myAppearances = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row && row.length >= 4 && normalize(row[3]) === normalize(userDb.jogador)) {
            myAppearances.push({
                rowIndex: i + 1,
                nome: row[0],
                universo: row[1],
                personagem: row[2]
            });
        }
    }

    if (myAppearances.length === 0) {
        return interaction.reply({ content: '❌ Você não possui nenhuma aparência registrada para oferecer em troca!', flags: 64 });
    }

    // Cria o dropdown com no máximo 25 opções (limite do Discord)
    const options = myAppearances.slice(0, 25).map(ap => {
        return new StringSelectMenuOptionBuilder()
            .setLabel((ap.nome || "Aparência").substring(0, 50))
            .setDescription(`Personagem: ${(ap.personagem || "").substring(0, 50)}`)
            .setValue(ap.rowIndex.toString());
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('oferta_troca_select')
        .setPlaceholder('Escolha a aparência para oferecer')
        .addOptions(options);

    const rowComponent = new ActionRowBuilder().addComponents(selectMenu);

    const responseMsg = await interaction.reply({
        content: `Você está propondo uma troca pela aparência **${targetResult.aparencia}** de **${targetResult.jogador}**.\nSelecione no menu abaixo qual das SUAS aparências você deseja dar em troca:`,
        components: [rowComponent],
        ephemeral: true,
        fetchReply: true
    }).catch(console.error);

    if (!responseMsg) return;

    try {
        const selectionInt = await responseMsg.awaitMessageComponent({
            filter: i => i.customId === 'oferta_troca_select' && i.user.id === interaction.user.id,
            time: 60000
        });

        const selectedRowIndex = selectionInt.values[0];
        const minhaOferta = myAppearances.find(a => a.rowIndex == selectedRowIndex);

        // Buscar dono alvo no BD para enviar DM
        const donoDb = await client.database.userData.findOne({ jogador: new RegExp(`^${targetResult.jogador}$`, 'i') });
        if (!donoDb || !donoDb.uid) {
            return selectionInt.update({ content: `❌ Erro: O dono da aparência alvo (${targetResult.jogador}) não está registrado no banco de dados para receber a DM.`, components: [] });
        }

        const donoUser = await client.users.fetch(donoDb.uid).catch(() => null);
        if (!donoUser) {
            return selectionInt.update({ content: `❌ Erro: Não foi possível contatar o dono da aparência alvo via DM (DM fechada ou bot bloqueado).`, components: [] });
        }

        // Monta os Custom IDs da DM contendo as linhas de ambas para fazer a troca: "aceitar_troca_OFERTAROW_ALVOROW"
        const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aceitar_troca_${selectedRowIndex}_${targetResult.rowIndex}_${interaction.user.id}`).setLabel('Aceitar Troca').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`recusar_troca_${interaction.user.id}`).setLabel('Recusar').setStyle(ButtonStyle.Danger)
        );

        const embedDM = new EmbedBuilder()
            .setTitle("🔃 Nova Proposta de Troca de Aparência!")
            .setColor("#FFA500")
            .setDescription(`O jogador **${userDb.jogador}** (${interaction.user.username}) fez uma oferta pela sua aparência!`)
            .addFields(
                { name: "Você Dá", value: `👤 **Aparência:** ${targetResult.aparencia}\n🌌 **Universo:** ${targetResult.universo}`, inline: true },
                { name: "Você Recebe", value: `👤 **Aparência:** ${minhaOferta.nome}\n🌌 **Universo:** ${minhaOferta.universo}`, inline: true },
                { name: "Vantagem Mútua", value: "Se você aceitar, **AMBOS** recebem +1 Token de Aparência!\n*(Atenção: Uma mesma aparência não gera token duas vezes).*"}
            );

        await donoUser.send({ embeds: [embedDM], components: [btnRow] });

        await selectionInt.update({ content: `✅ Proposta enviada para o dono (**${targetResult.jogador}**). Se ele aceitar, você receberá uma DM e +1 Token!`, components: [] });

    } catch (err) {
        console.log("Tempo esgotado para escolha da troca.", err.message);
    }
}

async function handleTradeResponse(interaction, client, isAccept) {
    await interaction.deferUpdate().catch(() => {});

    const [, , ofertaRow, alvoRow, proposerId] = interaction.customId.split('_');
    const proposerUser = await client.users.fetch(proposerId).catch(() => null);

    if (!isAccept) {
        await interaction.editReply({ content: "❌ Você recusou a proposta de troca.", components: [] });
        if (proposerUser) proposerUser.send("❌ Sua proposta de troca de aparências foi **recusada**.").catch(()=>{});
        return;
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
        });
        const sheets = google.sheets({ version: "v4", auth });
        const spreadsheetId = "17L8NZsgH5_tjPhj4eIZogbeteYN54WG8Ex1dpXV3aCo";

        // Ler as duas linhas para garantir que os jogadores originais ainda batem
        const resOferta = await sheets.spreadsheets.values.get({ spreadsheetId, range: `INDIVIDUAIS!A${ofertaRow}:D${ofertaRow}` });
        const resAlvo = await sheets.spreadsheets.values.get({ spreadsheetId, range: `INDIVIDUAIS!A${alvoRow}:D${alvoRow}` });

        const rowOferta = resOferta.data.values ? resOferta.data.values[0] : null;
        const rowAlvo = resAlvo.data.values ? resAlvo.data.values[0] : null;

        if (!rowOferta || !rowAlvo) {
            return interaction.followUp("❌ Ocorreu um erro: As linhas das aparências sumiram da planilha.");
        }

        const donoOfertaNome = rowOferta[3]; // A quem pertencia originalmente a oferta (propositor)
        const donoAlvoNome = rowAlvo[3]; // A quem pertencia originalmente o alvo (dono aceitante)

        // Swap de nomes
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `INDIVIDUAIS!D${ofertaRow}`,
            valueInputOption: "USER_ENTERED",
            resource: { values: [[donoAlvoNome]] }
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `INDIVIDUAIS!D${alvoRow}`,
            valueInputOption: "USER_ENTERED",
            resource: { values: [[donoOfertaNome]] }
        });

        // Gerenciar Tokens e Trade Log
        // Hash de proteção: "nome_universo_personagem"
        const hashOferta = `troca_${normalize(rowOferta[0])}_${normalize(rowOferta[1])}`;
        const hashAlvo = `troca_${normalize(rowAlvo[0])}_${normalize(rowAlvo[1])}`;

        const proposerDb = await client.database.userData.findOne({ uid: proposerId });
        const acceptorDb = await client.database.userData.findOne({ uid: interaction.user.id });

        let proposerGanhouToken = false;
        let acceptorGanhouToken = false;

        if (proposerDb) {
            const history = proposerDb.tradedItems || [];
            if (!history.includes(hashOferta)) {
                proposerDb.tokenAp = (proposerDb.tokenAp || 0) + 1;
                proposerDb.tradedItems = [...history, hashOferta];
                proposerGanhouToken = true;
                await proposerDb.save();
            }
        }

        if (acceptorDb) {
            const history = acceptorDb.tradedItems || [];
            if (!history.includes(hashAlvo)) {
                acceptorDb.tokenAp = (acceptorDb.tokenAp || 0) + 1;
                acceptorDb.tradedItems = [...history, hashAlvo];
                acceptorGanhouToken = true;
                await acceptorDb.save();
            }
        }

        await interaction.editReply({ content: `✅ **Troca Concluída com Sucesso!**\nAs aparências foram invertidas na planilha.\n${acceptorGanhouToken ? "🪙 Você ganhou +1 Token!" : "⚠️ Nenhum token gerado: a aparência que você cedeu já havia sido trocada antes."}`, components: [] });

        if (proposerUser) {
            proposerUser.send(`✅ **Troca Concluída com Sucesso!** O dono aceitou e as aparências foram trocadas!\n${proposerGanhouToken ? "🪙 Você ganhou +1 Token!" : "⚠️ Nenhum token gerado: a aparência que você cedeu já havia sido trocada antes."}`).catch(()=>{});
        }

    } catch (e) {
        console.error(e);
        await interaction.followUp("❌ Ocorreu um erro interno ao processar a troca nas planilhas.");
    }
}

module.exports = {
    handleProporTroca,
    handleTradeResponse
};
