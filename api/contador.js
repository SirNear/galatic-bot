
// Função de inicializar o contador
async function iniciarContador(sujeito, msgNavegacao, message, acao) {
    
                    let tempoRestante = 15; // Tempo em segundos, genérico, pode ser alterado de forma global
                    let contador = await message.reply({ content: `<a:AmongUs3D:1407001955699785831> | Você tem ${tempoRestante} segundos para ${acao} ${sujeito}... ` });
                    let intervalo = setInterval(() => {
                        tempoRestante--; // decrementar o tempo restante


                        if (tempoRestante <= 0) {
                            clearInterval(intervalo);
                            msgNavegacao.delete().catch(() => { });
                            contador.edit({ content: 'Tempo esgotado.' }).catch(() => { });
                        } else {
                            contador.edit({ content: `<a:AmongUs3D:1407001955699785831> | Você tem ${tempoRestante} segundos para ${acao} ${sujeito}...` }).catch(() => { });

                        }
                    }, 1000);
                        return{intervalo, contador}; 
 /* 
Deve receber os parâmetros sujeito (verso ou aparencia), msgNavegacao (Mensagem genérica de nav) e message (mensagem enviada pelo usuário)
Retornar o intervalo restante e o contador
*/
                }


// Função de parar o contador
async function pararContador(m, intervalo, contador) {

    clearInterval(intervalo); // Parar o contador
                contador.edit({ content: '<a:AmongUs3D:1407001955699785831>  | Resposta recebida.' }).catch(() => {});
    return m.content; 
/* 
Deve receber os parâmetros m (mensagem enviada pelo usuario), intervalo (intervalo atual do contador) e contador (mensagem do contador)
Retorna o nome da aparencia capturada na mensagem do usuario
*/
}

module.exports = { iniciarContador, pararContador };