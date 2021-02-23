const i18next = require("i18next")

module.exports = class MessageReceive {
	constructor(client) {
		this.client = client
	}

	async run(message) {

		if (message.channel.type === "dm") return
		if (message.author.bot) return
		let server = await this.client.database.Guilds.findById(message.guild.id)
		if (!server) {
			this.client.database.Guilds({
				_id: message.guild.id
			}).save()
		}
        
	let userData = await this.client.database.userData.findById(message.author.id)

		
         if(!userData) {
              uD = database.userData({
                 _id: message.author.id,
                  uid: message.author.id,
                  uName: message.author.username,
                 uServer: message.guild.id
             }).save()

         }
         
         /*  
     if(userData.monitor == 'ativado') {

        if(!message.guild.channels.cache.get(`${userData.monitorChannelId}`)) {
         userData.monitor = 'desativado'
         userData.save()
		
	}

    }else {


      let embedMonitor = new Discord.MessageEmbed()
      .setTitle(`<:nani:572425789178642472> | **Nova mensagem de ${message.author.username}** | <:nani:572425789178642472>`)
      .setDescription(message.content)
      .addField(`**Canal:**`, message.channel)
      .setTimestamp()


       message.guild.channels.cache.get(`${userData.monitorChannelId}`).send(embedMonitor)

        }       
     
     */
     
        if(message.mentions.has(client.user.id)) return message.channel.send(` **Hey ${message.author}, Tudo bom? Meu nome é Galatic, sou o Deus deste universo, para me pedir algo, utilize meu prefix que é** \`\`${server.prefix}\`\`**, Caso queira saber mais comandos meus, basta usar o comando \`\`${server.prefix}ajuda\`\`, espero que se divirta comigo!**`) 
        


	if (!message.content.startsWith(server.prefix)) return
		const args = message.content.slice(server.prefix.length).trim().split(/ +/g)
		const command = args.shift().toLowerCase()
		const comando = this.client.commands.get(command) || this.client.commands.get(this.client.aliases.get(command))
    
    try {
      new Promise((res, rej) => {
				message.channel.startTyping()
				res(comando.run({ message, args, server }, t))
			}).then(() => message.channel.stopTyping())
			
           
          	  const bt = message.guild.member(message.guild.members.cache.get(client.user.id))
    
          	   if(!bt.hasPermission("ADMINISTRATOR")) {
      
              		  let dono = message.guild.owner
      
           	         const embed = new Discord.MessageEmbed()
             		   .setColor('RANDOM')
               		   .setTitle('<:error_2:676239899065843722> | Sem Permissão | <:error_2:676239899065843722>')
                	   .setDescription(`Olá ${dono.user}, estou no seu servidor ${message.guild.name} porém meu cargo está sem a permissão \`ADMINISTRADOR\` e preciso dela para funcionar.`)
      
                	 dono.send(embed)
        
		  }
    		} catch (err) {
				
			
		message.channel.send(`**ERRO:**\`${err}\``)
		console.error(err.stack)
				
		}
	    }
