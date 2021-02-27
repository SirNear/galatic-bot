module.exports = class ReloadCommand extends Command {
	constructor(client) {
		super(client, {
			name: "reload",
			aliases: ["recarregar"],
			category: "dev",
			OnlyDevs: true
		})
	}

	run({ message, args, server }, t) {
		const option = this.getOption(args[0], ["command", "comando"], ["evento", "event"])
		if (!option) return message.channel.send("**Erro:** me dê uma opção válida. Opções disponíveis: `evento`, `comando`")
		if (!args[1]) return message.channel.send("**ERRO:** me dê um comando/evento para recarregar.")
		const type = option === "yes" ? "comando" : "evento"

		const rst = option === "yes" ? this.client.reloadCommand(args[1]) : this.client.reloadEvent(args[1])
		if (rst instanceof Error) return message.channel.send(`**Erro:**falha no recarregamento do ${type}.Stack:\n\`\`\`js${rst}\`\`\``)
		if (rst === false) return message.channel.send(`**Erro:** ${type} inexistente.`)

		message.channel.send(`${type} recarregado com sucesso!`)
	}
