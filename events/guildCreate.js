const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')
const color = require('../api/colors.json')

module.exports = class GuildCreate {

	constructor(client) {
		this.client = client
	}

	async run(guild, client) {
		const server = await this.client.database.Guilds.findById(guild.id);
		
		let embedBanned = new EmbedBuilder()
		.setColor(color.red)
		.setTitle('<:errorYaro:816811156512440331> | **Seu servidor está banido**')
		.setDescription(`Você me adicionou ao ${guild.name} e fico feliz por me escolher, mas eu fui retirado do seu servidor por um dos meus administradores. Entre em contato com o [suporte](https://discord.gg/EsAb4jDAvx) para saber mais.`)
				
		let embedCreated = new EmbedBuilder()
		.setColor(color.green)
		.setTitle('**NOVO SERVIDOR**')
		.addFields(
			{name: '**Servidor:**', value: guild.name},
			{name: '**ID**', value: guild.id},
			{name: '**Dono**', value: guild.ownerId},
		)
		
		async function msgLog(guild, embedCreated, client, context) {
		  const canal = context.client.channels.cache.get('1094070734151766026')

		  canal.send({ embeds: [embedCreated] }).then(async (msg) => {
		    const row = new ActionRowBuilder()
		      .addComponents(
			new ButtonBuilder()
			  .setCustomId('secondary')
			  .setLabel('SAIR')
			  .setStyle(ButtonStyle.Danger),
		      )

		    let msgLeave = await msg.channel.send({content: 'Devo sair do servidor?', components: [row] })

		    const collector = msgLeave.createMessageComponentCollector({ filter: i => i.user.id === '540725346241216534', time: 15000 });

		    collector.on('collect', async i => {
		      msgLeave.delete()
		      guild.leave()

		      server.banned === true
		      server.save()
		    })//collector
		  })//canal.send
		}

		
		if(!server) {
			 this.client.database.Guilds({
				 _id: guild.id,
			 }).save().then(msg => {
				 
				let prefix = server ? server.prefix : 'g!';

				let embedNew = new EmbedBuilder()
				.setColor(color.green)
				.setTitle('<a:hypeneon:729338461454205059> | **Você me adicionou ao seu servidor! = )**')
				.setDescription(`Você me adicionou ao ${guild.name}, fico feliz por ter me escolhido! Em seu servidor, dê o comando **${prefix}painel ver** para configurar algumas coisas do servidor!`)

				 this.client.users.send(guild.ownerId, {embeds: [embedNew]})
				 msgLog(guild, embedCreated, this.client, this)
			 })

		  }else {
			  
			if(server.banned === true) {
				this.client.users.send(guild.ownerId, {embeds: [embedBanned]})

			}else {

				let embedOld = new EmbedBuilder()
				.setColor(color.green)
				.setTitle('<a:hypeneon:729338461454205059> | **Você me adicionou ao seu servidor! = )**')
				.setDescription(`Você me adicionou ao ${guild.name}, fico feliz por voltar! Verifique as configurações anteriores em **${server.prefix}painel ver**.`)

				  this.client.users.send(guild.ownerId, {embeds: [embedOld]})
				  msgLog(guild, embedCreated, this.client, this)
			  }//else do if server	
		  }//else do if server.banned
       }
}
