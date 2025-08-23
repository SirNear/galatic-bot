const tempoLimite = 15; // Tempo de resposta em segundos, padrão para a espera;



async function iniciarContador(sujeito) {

    let tempoRestante = tempoLimite;
    let contador = await message.reply({ content: `<a:AmongUs3D:1407001955699785831> | Você tem ${tempoRestante} segundos para enviar o verso... ` });
    let intervalo = setInterval(() => {
        tempoRestante--;
    

    if (tempoRestante <= 0) {
        clearInterval(intervalo);
        msgNavegacao.delete().catch(() => { });
        contador.edit({ content: 'Tempo esgotado.' }).catch(() => { });
    } else {
        contador.edit({ content: `<a:AmongUs3D:1407001955699785831> | Você tem ${tempoRestante} segundos para responder...` }).catch(() => { });

}}, 1000);

}

