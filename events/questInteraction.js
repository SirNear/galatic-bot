async function handleQuestInteraction(interaction, client) {
    if (interaction.isButton()) {
        return client.handleQuestApproval(interaction);
    }
}

module.exports = { handleQuestInteraction };