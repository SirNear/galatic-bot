const Command = require('../../structures/Command');
const error = require('../../api/error.js')
const Discord = require('discord.js')

module.exports = class ficha extends Command {
	constructor(client) {
		super(client, {
			name: "ficha",
			category: "rpg",
			aliases: ['iniciar'],
			UserPermission: [""],
			clientPermission: null,
			OnlyDevs: false
		})
	}
  
async run({ message, args, client, server}) { //86
  
  let embed = new Discord.MessageEmbed()
  .setTitle('<:passe:713845479691124867> | **Ficha de Personagem')
  .setColor('RANDOM')
  .setDescription('**Qual é o nome do seu personagem?**')
  .setFooter('Envie em uma só mensagem e espere 30s sem responder para cancelar.')
  
  message.author.send(embed).then(msg => { //85
    let f = m => m.author.id === message.author.id
    const coletor = message.channel.awaitMessages(f, {time: 20000}.then(collected => { //81
      let name = collected.first()
      
      embed.setDescription(`Qual é o avatar/aparência? Utilize o primeiro e segundo nome da celebridade ou personagem que irá utilizar como avatar.`)
      embed.addField('**Nome: ' + name, true)
      
      msg.edit(embed).then(msg => { //80
        let f1 = m => m.author.id === message.author.id
        const coletor2 = message.channel.awaitMessages(f1, {time: 20000}.then(colletced => { //79
          let avatar = collected.first()
          
          embed.setDescription('Qual é o seu clã/familia?')
          embed.addField('**Aparência:**', avatar, true)
          
          msg.edit(embed).then(msg => { // 78
            let f2 = m => m.author.id === message.author.id
            const coletor3 = message.channel.awaitMessages(f2, {time: 20000}.then(collected => { //77
              let cla = collected.first()
              
              embed.setDescription(`Ficha de Personagem de ${message.author} | ${message.author.id}`)
              embed.addField('**Clã/Familia**: ', cla, true)
              embed.setThumbnail(message.author.avatarURL)
              embed.setFooter('Confirma?')
              
              msg.edit(embed).then(msg => { //76
                msg.react('757662908548382740')
                msg.react('816811156512440331')
                

              let filtro1 = (reaction, usuario) => reaction.emoji.name === "blackcheck" && usuario.id === message.author.id;
              const coletor1 = msg.createReactionCollector(filtro1, {max: 1, time: 360000});    
                
              let filtro2 = (reaction, usuario) => reaction.emoji.name === "errorYaro" && usuario.id === message.author.id;
              const coletor2 = msg.createReactionCollector(filtro2, {max: 1, time: 360000});
                
                
                coletor1.on("collect", em => { //68
                  let guildc = message.guild.channels.cache.get('829364519058145340')
                  
                  guildc.send(embed)
                  
                }) //63
                
               coletor2.on("collect", em => {//74
                 msg.delete()
                 
                 msg.channel.send('**Ação cancelada.**')                 
              })    //70 
                 
              })//51w
            })//43
          })//41
        })//35
      })//33
    }) //first  - 27 
        
        if(!coletor) return msg.channel.send('**Ação Cancelada**')
        
   }) //25
  }
}
