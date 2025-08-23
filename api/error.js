const Discord = require("discord.js");
const color = require('../api/colors.json')


//permissões


module.exports.Ban = (message) => { //ban
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription(`Você não tem a permissão \`Banir Membros\` para executar este comando.`)
  
  
  message.channel.send({ embeds: [embed] })
}

module.exports.cancelMsg = (message) => { message.edit({content: '<a:cdfpatpat:1407135944456536186> AÇÃO CANCELADA | Tudo bem! Você pode refazer mais tarde!', components: [], embeds: []})}

module.exports.helpCmd = (server, config, message) => {

  let aliases = config.aliases

  const embedHelp = new Discord.EmbedBuilder()
		.setTitle(` <:MotivosparaViver:1406837922401091735> | AJUDA | Comando \`\`${server.prefix}${config.name}\`\``)
		.setDescription(`Você digitou o comando incorretamente! Use uma das opções abaixo. 
			${aliases.map(alias => `\`\`${server.prefix}${alias} ${config.structure.toUpperCase()}\`\``).join('\n')}
			`)
		.setColor(color.purple)

    message.channel.send({ embeds: [embedHelp]})

}


module.exports.botLow = (message) => { 
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription(`Não posso punir este usuário, meu cargo é menor que o dele.`)
  
  
  message.channel.send({ embeds: [embed] })
}


module.exports.Mute = (message) => {
  let embed = new Discord.EmbedBuilder()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Silenciar Membros` para executar este comando.')
  
  message.channel.send({ embeds: [embed] })
}

module.exports.Kick = (message) => {
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Expulsar Membros` para executar este comando.')
  
  message.channel.send({ embeds: [embed] })
}

module.exports.mngMsg= (message) => { //gerenciar msgs
  let embed = new Discord.EmbedBuilder()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Gerenciar Mensagens` para executar este comando.')
  
  message.channel.send({ embeds: [embed] })
}

module.exports.mngCh = (message) => { //Gerenciar Canal
  let embed = new Discord.EmbedBuilder()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Gerenciar Canal` para executar este comando.')
  
  message.channel.send({ embeds: [embed] })
}

module.exports.Adm = (message) => {
  let embed = new Discord.EmbedBuilder()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Administrador` para executar este comando.')
  
  message.channel.send({ embeds: [embed] })
}

module.exports.Mute = (message) => {
  let embed = new Discord.EmbedBuilder()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Silenciar Membros` para executar este comando.')
  
  message.channel.send({ embeds: [embed] })
}

module.exports.mngRole = (message) => { //Gerenciar Cargos
  let embed = new Discord.EmbedBuilder()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Gerenciar Cargos` para executar este comando.')
  
  message.channel.send({ embeds: [embed] })
}

module.exports.mngEmoji = (message) => { //Gerenciar Emojis
  let embed = new Discord.EmbedBuilder()
  .setColor(color.red)
  .setTitle('<:error_2:676239899065843722> | **Erro de Permissão**')
  .setDescription('Você não tem a permissão `Gerenciar Emojis` para executar este comando.')
  
  message.channel.send({ embeds: [embed] })
}

//Dm

module.exports.dmClose = (message) => { // DM Fechada
  let embed = new Discord.EmbedBuilder()
  .setColor(color.blue)
  .setTitle('<:error_2:676239899065843722> | **Erro do Usuário**')
  .setDescription('Não pude enviar mensagem a DM do usuário, pois sua DM está fechada')
  
  message.channel.send({ embeds: [embed] })
}

//cargo

module.exports.highRole = (message, args) => {
  
let member = message.mentions.members.first() || message.guild.members.get(args[0]);  
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722 | **Erro de Cargo**')
  .setDescription(`Seu cargo é menor que o de ${member}.`)
  
  message.channel.send({ embeds: [embed] })
}

module.exports.equalRole = (message, member) => {
  
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722 | **Erro de Cargo**')
  .setDescription(`Seu cargo é o mesmo que o do ${member}`)
  
  message.channel.send({ embeds: [embed] })
}

module.exports.autoPuni = (message) => {
    
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Cargo**')
  .setDescription(`Você não pode se punir.`);
  
    message.channel.send({ embeds: [embed] })
  
}

//args

module.exports.noUser = (message) => {
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription(`**Usuário não encontrado**`)
  
  message.channel.send({ embeds: [embed] })
  
}

module.exports.noReason = (message) => {
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Você não deu um motivo.**')
  
  message.channel.send({ embeds: [embed] })
  
}

module.exports.noTime = (message) => {
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Você não deu o tempo de mute**')
  
  message.channel.send({ embeds: [embed] })
  
}

module.exports.noEmoji = (message) => {
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Você não deu um motivo.**')
  
  message.channel.send({ embeds: [embed] })
  
}

module.exports.noRole = (message) => {
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Você não mencionou um cargo.**')
  
  message.channel.send({ embeds: [embed] })  
  
}

module.exports.outRole = (message) => {
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Cargo não encontrado**')
  
  message.channel.send({ embeds: [embed] })  
  
}

module.exports.noEmoji = (message) => {
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Digite o nome do emoji**')
  
  message.channel.send({ embeds: [embed] })  
  
}

module.exports.noResponse = (message) => {
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Argumento**')
  .setDescription('**Digite uma resposta**')
  
  message.channel.send({ embeds: [embed] })  
  
}

//existente

module.exports.withRole = (message) => {
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Presença**')
  .setDescription('**Esse usuário já tem este cargo**')
  
  message.channel.send({ embeds: [embed] })  
  
}

module.exports.noWarn = (message) => {
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Presença**')
  .setDescription('**Esse usuário não tem avisos**')
  
  message.channel.send({ embeds: [embed] })  
  
}

module.exports.hasnotRole = (message) => {
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Presença**')
  .setDescription('**Esse usuário não tem esse cargo**')
  
  message.channel.send({ embeds: [embed] })  
  
}

module.exports.autoClearWarn = (message) => {
  
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Cargo**')
  .setDescription('**Você não pode limpar os próprios avisos!**')
  
  message.channel.send({ embeds: [embed] })

}

module.exports.noStaffRole = (message) => {
    
  let embed = new Discord.EmbedBuilder()
  .setColor(color.green)
  .setTitle('<:error_2:676239899065843722> | **Erro de Cargo**')
  .setDescription(`**Você não possui o cargo da staff e não tem autorização para este processo.**`)

  message.channel.send({ embeds: [embed] })

}
