const Discord = require('discord.js');
const mongoose = require('mongoose');

module.exports.run = async (client, message, args, guild) => {
  if(!message.member.hasPermission("ADMINISTRATOR")) return message.channel.send("Você não possuí as permissões necessárias para acessar o painel deste servidor | **Requer:** `Administrador`.")
  let server = await client.database.Guilds.findById(message.guild.id)


    switch(args[0]) {
        case "ver":
        
            const embedv = new Discord.MessageEmbed()
            .setColor('RANDOM')
            .setTitle('<:Servidor:564589119334776862> | ***Configurações do Servidor***')
            .addField('<:clipe:573934199862722562> | ***Prefix do Bot:***', server.prefix)
            .addField('<:berror:563100784711958528> | ***Canal de Punições:***', server.cPunicoes)
            .addField('<:muted:572627076948164608> | **Cargo de Mute**', server.cargoMute)
            .addField('<a:latencia:562893011021987852> | **Sistema de Mute Automático**', server.warnTag)
            .addField('<:lolipolice:669705464447107073> | **Cargo de Moderação**', server.staffRole)
            .addField('<:MotivosparaViver:572157111471964200> | **Categoria para Monitoramentos**', '<#' + server.monitorCategory + '>')
            .setThumbnail(message.guild.iconURL)
            .setTimestamp();

            message.channel.send(embedv).then( msg =>{
            msg.react('563100784711958528')
            msg.react('573934199862722562')
            msg.react('572627076948164608')
            msg.react('562893011021987852')
            msg.react('669705464447107073')
            msg.react('572157111471964200')


            let filtro1 = (reaction, usuario) => reaction.emoji.name === "berror" && usuario.id === message.author.id;
            const coletor1 = msg.createReactionCollector(filtro1, {max: 1, time: 360000});
              
              
            let filtro2 = (reaction, usuario) => reaction.emoji.name === "clipe" && usuario.id === message.author.id;
            const coletor2 = msg.createReactionCollector(filtro2, {max: 1, time: 360000});

            let filtro3 = (reaction, usuario) => reaction.emoji.name === "muted" && usuario.id === message.author.id;
            const coletor3 = msg.createReactionCollector(filtro3, {max: 1, time: 360000});

            let filtro4 = (reaction, usuario) => reaction.emoji.name === "latencia" && usuario.id === message.author.id;
            const coletor4 = msg.createReactionCollector(filtro4, {max: 1, time: 360000});

            let filtro5 = (reaction, usuario) => reaction.emoji.name === "lolipolice" && usuario.id === message.author.id;
            const coletor5 = msg.createReactionCollector(filtro5, {max: 1, time: 360000});

            let filtro6 = (reaction, usuario) => reaction.emoji.name === 'MotivosparaViver' && usuario.id === message.author.id;
            const coletor6 = msg.createReactionCollector(filtro6, {max: 1,  time: 360000});

        coletor1.on("collect", em =>{
          message.channel.send('***Mencione o novo canal de punições***')
              const f1 = m => m.author.id === message.author.id
              const collector31 = message.channel.awaitMessages(f1, { time: 20000}).then(collected => {
                let nc = message.mentions.channels.first() || message.guild.channels.cache.get(args.slice(0).join)
                let cf1 = collected.first()
         
                nc = cf1
                server.cPunicoes = nc
                server.save()
                  if(!nc) nc = '``padrão``.';
                message.channel.send(`**Canal de punições alterado para \`${nc}\`**`)
                
              });
            }); 
              
          coletor2.on("collect", em => {
            message.channel.send('***Digite o novo prefix do servidor***')
              const f2 = m => m.author.id === message.author.id
              const collector32 = message.channel.awaitMessages(f2, { time: 20000}).then(collected => {
                let newPrefix = collected.first()
                
                server.prefix = newPrefix
                server.save()
                
                if(!newPrefix) newPrefix = 'g!'
                
                message.channel.send(`**Prefixo do bot alterado para \`${newPrefix}\`**`)
                
              })
          })

          coletor3.on("collect", em => {
            message.channel.send('**Mencione o novo cargo de mute**')
              const f3 = m => m.author.id === message.author.id 
              const collector32 = message.channel.awaitMessages(f3, {time:20000}).then(collected => {
                let novoCargo = message.mentions.roles.first() || message.guild.roles.cache.get(args.slice(0).join(" "))
                let cargo = collected.first()

                novoCargo = cargo
                server.cargoMute = novoCargo
                server.save()
                  if(!novoCargo) novoCargo = '``padrão``'
                  message.channel.send(`**Cargo de mute alterado para ${novoCargo}`)
              })
          })

          coletor4.on("collect", em => {
            const helpAutoMute = new Discord.MessageEmbed()
            .setTitle('<:notificacaopwp:566085275323727893> | **Configuração do Sistema de Auto Silenciamento** | <:notificacaopwp:566085275323727893>>')
            .setColor('RANDOM')

          if(server.warnTag.includes === 'Desativado') {

            helpAutoMute.setDescription(`O sistema de Auto Silenciamento acontece aplicando um mute automático após um número x de warns/avisos, sendo configuravél para ativar ou desativar e também o número de avisos necessários. \n \n <:dnd:572210462993940482> | Status Desativado. \n \n Reaja com "<:StatusOn:572210002039668818>" para **Ativar** o sistema.`)

            message.channel.send(helpAutoMute).then(msg2 => {
              msg2.react('572210002039668818')

            let emojiAtivar = (reaction, usuario) => reaction.emoji.name === "StatusOn" && usuario.id === message.author.id;
            const coletorAtivar = msg2.createReactionCollector(emojiAtivar, {max: 1, time: 360000});   

            coletorAtivar.on("collect", emm => {
              msg2.delete()

              server.warnTag = 'Ativado'
              server.save()

              message.channel.send(`**O sistema de auto Silenciamento foi ativado com o máximo de \`${server.warnNumber} warns\`. Reaja com "<a:a:moderacao:569064320156172299>" para alterar este valor.`).then(ms => {
                ms.react('569064320156172299')
                
                const emojiWarnNumber = (reaction, usuario) => reaction.emoji.name === "moderacao" && usuario.id === message.author.id;
                const coletorWarnNumber = ms.createReactionCollector(emojiWarnNumber, {max: 1, time: 360000})

                coletorWarnNumber.on("collect", em => {
                  message.channel.send('**Envie o novo número de warns máximos(Apenas números)**').then(m => {
                    const fWN = m => m.author.id === message.author.id 
                     const coletorWN = message.channel.awaitMessages(fWN, {time:20000}).then(collected => {
                      
                      let numberFirst = collected.first()
                      if(!numberFirst) return message.channel.send('Alterado para padrão.')

                      server.warnNumber = numberFirst
                      server.save()

                      message.channel.send(`**Número máximo de warns alterado para \`${numberFirst}\`**`)

                     })
                  })
                })
              })  
            })          
          })

          }else {

            helpAutoMute.setDescription(`O sistema de Auto Silenciamento acontece aplicando um mute automático após um número x de warns/avisos, sendo configuravél para ativar ou desativar e também o número de avisos necessários. \n \n <:StatusOn:572210002039668818> | Status Ativado. \n Número Máximo de warns atual: \`${server.warnNumber}\` \n \n Reaja com "<a:negativo:563096795907883010>" para **desativar** o sistema. \n Reaja com "<a:moderacao:569064320156172299>" para **Editar** o número de avisos para mutar. `)

            message.channel.send(helpAutoMute).then(m => {
              m.react('563096795907883010')
              m.react('569064320156172299')

            let emojiDesativar = (reaction, usuario) => reaction.emoji.name === "negativo" && usuario.id === message.author.id;
            const coletorDesativar = m.createReactionCollector(emojiDesativar, {max: 1, time: 360000});
            
            let emojiEdit = (reaction, usuario) => reaction.emoji.name === "moderacao" && usuario.id === message.author.id;
            const coletorEdit = m.createReactionCollector(emojiEdit, {max: 1, time: 360000}); 

            coletorDesativar.on("collect", em => {
              m.delete()

              server.warnTag = 'Desativado'
              server.save()

              message.channel.send('**Sistema de auto Silenciamento desativado.**')

            })

            coletorEdit.on("collect", em => {
              m.react('569064320156172299')
                  message.channel.send('**Envie o novo número de warns máximos(Apenas números)**').then(m => {
                    const fWN2 = m => m.author.id === message.author.id 
                     const coletorWN2 = message.channel.awaitMessages(fWN2, {time:20000}).then(collected => {
                      
                      let numberFirst2 = collected.first()
                      if(!numberFirst2) return message.channel.send('Alterado para padrão.')

                      server.warnNumber = numberFirst2
                      server.save()

                      message.channel.send(`**Número máximo de warns alterado para \`${numberFirst2}\`**`)

            })
          })
        })
      })  

                

          }


}) //fim coletor4

coletor5.on("collect", em => {
  const embedInit = new Discord.MessageEmbed()
  .setTitle('**Cargo de Moderação**')
  .setDescription(`Aquele que possuir este cargo terá permissões em vários comandos exclusivos e configurações automáticas do bot. \n \n **Cargo Atual:** ${server.staffRole} \n \n Reaja com "<:lolipolice:669705464447107073>" para alterar. `)

  message.channel.send(embedInit).then(msg => {
    msg.react('669705464447107073')

      let reactSR = (reaction, usuario) => reaction.emoji.name === "lolipolice" && usuario.id === message.author.id;
      const coletorReactSF = msg.createReactionCollector(reactSR, {max: 1, time: 360000}); 

      coletorReactSF.on("collect", em => {
        msg.delete()
        message.channel.send('**Mencione o novo cargo de Moderação**').then(msg2 => {
          const filtrostaffRole = m => m.author.id === message.author.id 
          const coletorstaffRole = message.channel.awaitMessages(filtrostaffRole, {time:20000}).then(collected => {
            let newStaffRole = collected.first()
            let staffRoleFind = message.mentions.roles.first() || message.guild.roles.cache.get(args.slice(0).join(" ")) 
            staffRoleFind = newStaffRole

            server.staffRole = staffRoleFind
            server.save()
            msg2.delete()
            message.channel.send(`**Cargo de moderação alterado para ${staffRoleFind} com sucesso!**`)

        })
      })
    })
  })



})

coletor6.on("collect", em => {
  const embedHelpC = new Discord.MessageEmbed()
  .setTitle('**Categoria de Monitoramento**')
  .setDescription(`Definirá a categoria onde serão criados os canais de Monitoramento. Digite \`${server.prefix}monitor\` para saber mais. \n \n Reaja com "<:MotivosparaViver:572157111471964200>" para modificar a categoria.`)

  message.channel.send(embedHelpC).then(msg => {
    msg.react('572157111471964200')

    let reactNC = (reaction, usuario) => reaction.emoji.name === "MotivosparaViver" && usuario.id === message.author.id;
   const coletorReactNC = msg.createReactionCollector(reactNC, {max: 1, time: 360000}); 

   coletorReactNC.on("collect", em => {
     msg.delete()
     message.channel.send('**Digite o nome ou ID da nova categoria. Inclua espaçamentos, acentos, pontuações e outros caracteres especiais. \n \n AVISO: Pode demorar até 15s para confirmação**').then(msg2 => {
        const filtronewCategory = m => m.author.id === message.author.id 
        const coletornewCategory = message.channel.awaitMessages(filtronewCategory, {time:20000}).then(collected => {
          let colectF = collected.first()
          let newCategory = message.guild.channels.cache.find(c => c.name == "Text Channels" && c.type == "category")  || message.guild.channels.cache.find(c => c.id == args[0] && c.type == "category")
          newCategory = colectF

          if(!newCategory) { 
            
            message.channel.send('**Categoria não existente, verifique a ortografia e tente novamente.**')
          }

          server.monitorCategory = newCategory
          server.save()

          message.channel.send(`**Categoria de Monitoramento alterada para ${message.guild.channels.cache.find(c => c.id == server.monitorCategory && c.type == "category").name}**`)


       })       
     })
   })
  })

})
              
})


        break;
        default: 
            const embedd = new Discord.MessageEmbed()
            .setTitle('<:engrenagem:564590880707837991> | ***Painel do Servidor***')
            .setDescription(`<:dnd:572210462993940482> | Utilize \`${server.prefix}painel ver\` para editar o painel.`)
            .addField('**Padrões**','Os canais são definidos por padrões. \n ⠀\n **Exemplo:** `#avisos`, `#sugestões`, e assim por diante. \n Você pode editar isso através do painel. \n ⠀ \n Caso apareça a mensagem "***Canal de `xxxxx` alterado para `padrão`.***", é porque o canal foi definido com o padrão a cima.')
            .setThumbnail(message.guild.iconURL)
            .setTimestamp();

            message.channel.send(embedd);
        


    }
}

exports.config = {
    name: 'painel',
    aliases: [],
    category: 'moderation'
}