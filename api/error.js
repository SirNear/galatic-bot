const Discord = require("discord.js");
const color = require('../api/colors.json')


//permissões


module.exports.Ban = (message) => { //ban
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription(`Você não tem a permissão \`Banir Membros\` para executar este comando.`)
  
  
  message.channel.send(embed)
}


module.exports.botLow = (message) => { 
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription(`Não posso punir este usuário, meu cargo é menor que o dele.`)
  
  
  message.channel.send(embed)
}


module.exports.Mute = (message) => {
  let embed = new Discord.MessageEmbed()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Silenciar Membros` para executar este comando.')
  
  message.channel.send(embed)
}

module.exports.Kick = (message) => {
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Expulsar Membros` para executar este comando.')
  
  message.channel.send(embed)
}

module.exports.mngMsg= (message) => { //gerenciar msgs
  let embed = new Discord.MessageEmbed()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Gerenciar Mensagens` para executar este comando.')
  
  message.channel.send(embed)
}

module.exports.mngCh = (message) => { //Gerenciar Canal
  let embed = new Discord.MessageEmbed()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Gerenciar Canal` para executar este comando.')
  
  message.channel.send(embed)
}

module.exports.Adm = (message) => {
  let embed = new Discord.MessageEmbed()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Administrador` para executar este comando.')
  
  message.channel.send(embed)
}

module.exports.Mute = (message) => {
  let embed = new Discord.MessageEmbed()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Silenciar Membros` para executar este comando.')
  
  message.channel.send(embed)
}

module.exports.mngRole = (message) => { //Gerenciar Cargos
  let embed = new Discord.MessageEmbed()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Gerenciar Cargos` para executar este comando.')
  
  message.channel.send(embed)
}

module.exports.mngEmoji = (message) => { //Gerenciar Emojis
  let embed = new Discord.MessageEmbed()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Gerenciar Emojis` para executar este comando.')
  
  message.channel.send(embed)
}

//Dm

module.exports.dmClose = (message) => { // DM Fechada
  let embed = new Discord.MessageEmbed()
  .setColor(color.blue)
  .setTitle('<:error_2:676239899065843722> | **Erro do Usuário**')
  .setDescription('Não pude enviar mensagem a DM do usuário, pois sua DM está fechada')
  
  message.channel.send(embed)
}

//cargo

module.exports.highRole = (message, args) => {
  
let member = message.mentions.members.first() || message.guild.members.get(args[0]);  
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722 | **Erro de Cargo**')
  .setDescription(`Seu cargo é menor que o de ${member}.`)
  
  message.channel.send(embed)
}

module.exports.equalRole = (message, member) => {
  
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722 | **Erro de Cargo**')
  .setDescription(`Seu cargo é o mesmo que o do ${member}`)
  
  message.channel.send(embed)
}

module.exports.autoPuni = (message) => {
    
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Cargo**')
  .setDescription(`Você não pode se punir.`);
  
    message.channel.send(embed)
  
}

//args

module.exports.noUser = (message) => {
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription(`**Usuário não encontrado**`)
  
  message.channel.send(embed)
  
}

module.exports.noReason = (message) => {
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Você não deu um motivo.**')
  
  message.channel.send(embed)
  
}

module.exports.noTime = (message) => {
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Você não deu o tempo de mute**')
  
  message.channel.send(embed)
  
}

module.exports.noEmoji = (message) => {
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Você não deu um motivo.**')
  
  message.channel.send(embed)
  
}

module.exports.noRole = (message) => {
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Você não mencionou um cargo.**')
  
  message.channel.send(embed)  
  
}

module.exports.outRole = (message) => {
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Cargo não encontrado**')
  
  message.channel.send(embed)  
  
}

module.exports.noEmoji = (message) => {
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Digite o nome do emoji**')
  
  message.channel.send(embed)  
  
}

module.exports.noResponse = (message) => {
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Digite uma resposta**')
  
  message.channel.send(embed)  
  
}

//existente

module.exports.withRole = (message) => {
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Presença**')
  .setDescription('**Esse usuário já tem este cargo**')
  
  message.channel.send(embed)  
  
}

module.exports.noWarn = (message) => {
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Presença**')
  .setDescription('**Esse usuário não tem avisos**')
  
  message.channel.send(embed)  
  
}

module.exports.hasnotRole = (message) => {
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Presença**')
  .setDescription('**Esse usuário não tem esse cargo**')
  
  message.channel.send(embed)  
  
}

module.exports.autoClerWarn = (message) => {
  
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Cargo**')
  .setDescription('**Você não pode limpar os próprios avisos!**')
  
  message.channel.send(embed)

}

module.exports.noStaffRole = (message) => {
    
  let embed = new Discord.MessageEmbed()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Cargo**')
  .setDescription(`**Você não possui o cargo da staff e não tem autorização para este processo.**)

  message.channel.send(embed)

}
