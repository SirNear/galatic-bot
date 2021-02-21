const Discord = require('discord.js')
const client = new Discord.Client();
client.commands = new Discord.Collection()
client.aliases = new Discord.Collection()
const Util = require('.structures/Utils.js')
const config = require('./config.json')
client.owners = config.owners
const active = new Map ();
const fs = require('fs')
let guildCf = require('./mongoose')
const { readdirSync } = require('fs')
client.database = guildCf

fs.readdir('./commands', function (err, file) { 
    if (err) console.log(err) 
    let jsfile = file.filter(f => f.split('.')
    .pop() === 'js') 
    if (jsfile.length < 0) {
        console.log("Não foi encontrado nenhum comando") 

    }
    jsfile.forEach(async function (f, i) {
      
      let ops = {
        active: active 
    }
        let pull = require(`./commands/${f}`)
        client.commands.set(pull.config.name, pull, ops) 
        pull.config.aliases.forEach(function (alias) { 
            client.aliases.set(alias, pull.config.name) 

        })
    })
});

fs.readdir('./events', function (err, file) {
    if (err) console.log(err)
    let jsfile = file.filter(f=> f.split('.').pop() === 'js')
    if(jsfile.length < 0) {
        console.log("Não foram encontrados nenhum comando")
    }
   })

module.exports = class MenuDocsClient extends Client {

    constructor(options = {}) {
     super({
       disableMentions: 'everyone'  
     })
     this.utils = new Util(this);
      
     this.events = new Collection()
        
    }
    
}



client.on("ready", async () => {
  let status = [
    {name:`Meu poder a ${client.users.size} pessoas em todo o Galatic Coffe!`, type: 'STREAMING', url: 'https://twitch.tv/galatic'},
    {name:'Pó de café na pia', type: 'PLAYING'},
    {name:`Alegria para os meus filhos`, type: 'STREAMING', url: 'https://twitch.tv/galatic'},
    {name:`Observando ${client.channels.size} mundos diferentes!`, type: 'PLAYING'}
   
  ];
  
  
  function setStatus() {
    let altstatus = status[Math.floor(Math.random()*status.length)]
     client.user.setPresence({game: altstatus})
    }

  setStatus();
  setInterval(() => setStatus(), 7000)
})

client.on("message", async message => {    
 
   
    if(message.author.bot) return;
   
  
  let server = await client.database.Guilds.findById(message.guild.id)
  let userData = await client.database.userData.findById(message.author.id)
  
  /*
  
    if (!server) {
    server = client.database.Guilds({
      _id: message.guild.id
    })
    
    server.save()
  }

  if(!userData) {
    uD = client.database.userData({
      _id: message.author.id,
      uid: message.author.id,
      uName: message.author.username,
      uServer: message.guild.id
    })

    uD.save()

  }

  if(userData.monitor == 'ativado') {

    if(!message.guild.channels.cache.get(`${userData.monitorChannelId}`)) {
      userData.monitor = 'desativado'
      userData.save()

    }else {


      let embedMonitor = new Discord.MessageEmbed()
      .setTitle(`<:nani:572425789178642472> | **Nova mensagem de ${message.author.username}** | <:nani:572425789178642472>`)
      .setDescription(message.content)
      .addField(`**Canal:**`, message.channel)
      .setTimestamp()


    message.guild.channels.cache.get(`${userData.monitorChannelId}`).send(embedMonitor)

  }

  }
  
    */
  
  
if(message.mentions.has(client.user.id)) {
    message.channel.send(` **Hey ${message.author}, Tudo bom? Meu nome é Galatic, sou o Deus deste universo, para me pedir algo, utilize meu prefix que é** \`\`${server.prefix}\`\`**, Caso queira saber mais comandos meus, basta usar o comando \`\`${server.prefix}ajuda\`\`, espero que se divirta comigo!**`) 
  }

  
  var options = {
    active: active
  }
  
  if (!message.content.startsWith(server.prefix)) return; 
  
  let args = message.content.slice(server.prefix.length).trim().split(" ")
 
  
  let cmd = args.shift().toLowerCase()
  let commandFile = client.commands.get(cmd) || client.commands.get(client.aliases.get(cmd))
  if (!commandFile) return
  new Promise((res, rej) => {
   
    
    message.channel.startTyping()
    res(commandFile.run(client, message, args, options))
  }).then(() => {
    message.channel.stopTyping()
  }).catch(err => {
    
    const bt = message.guild.member(message.guild.members.cache.get(client.user.id))
    
    if(!bt.hasPermission("ADMINISTRATOR")) {
      
      let dono = message.guild.owner
      
      const embed = new Discord.MessageEmbed()
      .setColor('RANDOM')
      .setTitle(`<:error_2:676239899065843722> | Sem Permissão | <:error_2:676239899065843722>`)
      .setDescription(`Olá ${dono.user}, estou no seu servidor ${message.guild.name} porém meu cargo está sem a permissão \`ADMINISTRADOR\` e preciso dela para funcionar.`)
      
      dono.send(embed)
        
    }
    
    message.channel.stopTyping()
    console.error(err.stack)
    message.channel.send(`Ocorreu um erro \`${err}\``)
  })

  
  
})

client.login(config.token).then(() => {
    
  this.utils.loadEvents()  
    
  console.log("Acordei!!")
})
