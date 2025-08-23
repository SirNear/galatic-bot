const Command = require("../../structures/Command")
const error = require("../../api/error")

module.exports = class ReloadCommand extends Command {
    constructor(client) {
        super(client, {
            name: "reload",
            aliases: ["recarregar", 'atualizar', 'rcharge', 'f5'],
            category: "dev",
            OnlyDevs: true,
            structure: 'comando/evento nome_do_comando'
        })
    }

    async run({ message, args, server }, t) {
        // Verifica se o primeiro e o segundo argumento estão presentes
        if (!args[0] || !args[1]) {
            return error.helpCmd(server, this.config, message);
        }

        // Verifica se o tipo é 'comando' ou 'evento' com base no primeiro argumento
        const option = this.getOption(args[0], ["command", "comando"], ["evento", "event"]);

        // Caso a opção não seja válida, retorna erro
        if (!option) {
            return message.reply({
                content: `**Erro:** me dê uma opção válida. Opções disponíveis: \`evento\`, \`comando\``,
                ephemeral: true
            });
        }

        const type = option === "yes" ? "comando" : "evento";  // Definir se é comando ou evento

        // Recarregar comando ou evento com base na opção
        let rst;
        if (type === "comando") {
            rst = await this.client.reloadCommand(args[1]);  // Recarrega o comando
        } else {
            rst = await this.client.reloadEvent(args[1]);  // Recarrega o evento
        }

        // Debugging: Verificando o resultado do recarregamento
        console.log('RELOADCOMMAND | Resultado do recarregamento:', rst);

        // Verifica se houve um erro no recarregamento
        if (rst instanceof Error) {
            return message.reply({
                content: `**Erro:** falha no recarregamento do ${type}. Stack:\n\`\`\`js\n${rst.stack}\n\`\`\``,
                ephemeral: true
            });
        }

        // Verifica se o comando ou evento não foi encontrado
        if (rst === false) {
            return message.reply({
                content: `**Erro:** ${type} inexistente.`,
                ephemeral: true
            });
        }

        // Confirma que o comando ou evento foi recarregado com sucesso
        message.channel.send(`${type} recarregado com sucesso!`);
    }
}
