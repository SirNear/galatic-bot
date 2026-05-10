async function formatarTempo(ms) {
    let segundos = Math.floor(ms / 1000);
    
    const anos = Math.floor(segundos / 31536000);
    segundos %= 31536000;
    const meses = Math.floor(segundos / 2592000);
    segundos %= 2592000;
    const semanas = Math.floor(segundos / 604800);
    segundos %= 604800;
    const dias = Math.floor(segundos / 86400);
    segundos %= 86400;
    const horas = Math.floor(segundos / 3600);
    segundos %= 3600;
    const minutos = Math.floor(segundos / 60);

    const partes = [];
    if (anos > 0) partes.push(`${anos} ano${anos > 1 ? 's' : ''}`);
    if (meses > 0) partes.push(`${meses} mês${meses > 1 ? 'es' : ''}`);
    if (semanas > 0) partes.push(`${semanas} semana${semanas > 1 ? 's' : ''}`);
    if (dias > 0) partes.push(`${dias} dia${dias > 1 ? 's' : ''}`);
    if (horas > 0) partes.push(`${horas} hora${horas > 1 ? 's' : ''}`);
    if (minutos > 0) partes.push(`${minutos} minuto${minutos > 1 ? 's' : ''}`);
    
    return partes.length > 0 ? partes.join(', ') : "Menos de 1 minuto";
}

module.exports = { formatarTempo };