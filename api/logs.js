const Discord = require("discord.js");
const color = require('../api/colors.json')

module.exports.AparenciaRegistrada = (message, userDb, pName, pUniverso, apImg, sChannel) => {

    let embed = new Discord.EmbedBuilder()
        .setColor(color.moderation)
        .setTitle(`<:lolipolice:1406837917527183493> | SISTEMA DE MODERAÇÃO`)
        .setDescription(`O jogador ${userDb.jogador}(${message.author.username} | ${message.author.id}) registrou a aparência de ${pName} do universo de ${pUniverso}.`)
        .setImage(`${apImg}`)
        .setTimestamp()

    sChannel.send({embeds: [embed] })

}