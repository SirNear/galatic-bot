
// Função de inicializar o contador
async function iniciarContador(tempoRestante, sujeito, msgAlvo, message) {
    
    let contador = await msgAlvo.reply({ content: `<a:AmongUs3D:1407001955699785831> | Você tem ${tempoRestante} segundos para ${sujeito}... ` });
    let intervalo = setInterval(() => {
        tempoRestante--; // decrementar o tempo restante

        if (tempoRestante <= 0) {
            clearInterval(intervalo);
            msgAlvo.delete().catch(() => { });
            
            if (contador && typeof contador.edit === 'function') {
                contador.edit({ content: 'Tempo esgotado.' }).catch(() => { });
            }
        } else {
            if (contador && typeof contador.edit === 'function') {
                contador.edit({ content: `<a:AmongUs3D:1407001955699785831> | Você tem ${tempoRestante} segundos para ${sujeito}...` }).catch(() => { });
            }
        }
    }, 1000);
    
    return {intervalo, contador}; 
    /* 
    Deve receber os parâmetros a acao (ação a ser feita pelo usuário no tempo do contador), sujeito (com oque deve ser feito), msgNavegacao (Mensagem genérica de nav) e message (mensagem enviada pelo usuário)
    Retornar o intervalo restante e o contador
    */
}


// Função de parar o contador
async function pararContador(m, intervalo, contador) {

    clearInterval(intervalo); // Parar o contador
    
    if (contador && typeof contador.edit === 'function') {
        await contador.edit({ content: '<a:AmongUs3D:1407001955699785831>  | Resposta recebida.' }).catch(() => {});
    }
    
    return m; 
/* 
Deve receber os parâmetros m (mensagem enviada pelo usuario), intervalo (intervalo atual do contador) e contador (mensagem do contador)
Retorna o nome da aparencia capturada na mensagem do usuario
*/
}

module.exports = { iniciarContador, pararContador };