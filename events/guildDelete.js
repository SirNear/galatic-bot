const Discord = require('discord.js')

module.exports = class GuildDelete {
	constructor(client) {
		this.client = client
	}

    async run(guild) {
            const guildR = await this.client.database.gReacts.findById(guild.id)
	    const server = await this.client.database.Guilds.findById(guild.id)
	    
	    if(!server) return
	    
            let dono = guild.owner.id

            const leaveMessage = new Discord.MessageEmbed()
            .setColor('RANDOM')
            .setTitle('<:GadgetLeave:821521172956053513> | **Espero que não seja um adeus...**')
            .setDescription(`Percebi que me expulsou de seu servidor ${this.client.guild.name}, espero que não seja eterno e que eu não tenha feito nada de errado.`)
            .addField('**Excluir configurações do banco de dados?**', 'Reaja com "<:blackcheck:757662908548382740>" para excluir o servidor do banco de dados do bot. Caso adicione novamente, você terá que configurar novamente.', 'Reaja com "<:errorYaro:816811156512440331>" para cancelar a operação.')
            .addField(`**Convite do Bot**`, "[CLIQUE AQUI](https://discord.com/oauth2/authorize?client_id=INSERT_CLIENT_ID_HERE&scope=bot&permissions=8)")

            dono.send(leaveMessage).then(msg => {
                msg.react('757662908548382740')
                msg.react('816811156512440331')

                if(!guildR) {
                    this.client.database.gReacts({
                        _id: guild.id,
                        ownerId: guild.ownerId,
                        msgId: msg.id,
                    }).save()
                }

                let filtroExcluir = (reaction, usuario) => reaction.emoji.name === "blackcheck" && usuario.id === message.author.id;
                const coletorExcluir = msg.createReactionCollector(filtroExcluir, {max: 1, time: 360000}); 
 
                let filtroCancelar = (reaction, usuario) => reaction.emoji.name === "errorYaro" && usuario.id === message.author.id;
                const coletorCancelar = msg.createReactionCollector(filtroCancelar, {max: 1, time: 360000});
                
                coletorExcluir.on("collect", em => {
                    msg.delete()
                    server.delete()
                    guildR.delete()
                    msg.send('<:blackcheck:757662908548382740> | **Todos os dados do servidor no banco de dados foi apagado. Espero que eu possa voltar um dia.**')

                })

                coletorCancelar.on("collect", em => {
                    msg.delete()
                    guildR.delete()
                    msg.send('<:blackcheck:757662908548382740> | **Os dados do servidor foram mantidos no banco de dados. Espero que eu possa voltar um dia.**')
                })


                
            })

    }
}
