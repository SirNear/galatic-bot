/**
 * ============================================================================
 * SISTEMA PARALELO DE TRANSIÇÃO DE FICHAS: STATUS EVOLUTION V2 (PROJETO GENESIS)
 * ============================================================================
 * Módulo central do Projeto Genesis contendo:
 * 1. Tabela oficial completa das 54 Estrelas (Ouros, Diamante e Radiante) extraída do PDF.
 * 2. Captura alternativa silenciosa de upgrades de status (Força, Velocidade, Resistência, Mana e Cristais do Tempo).
 * 3. Auto-injeção do upgrade de "Cristais do Tempo" ao final do treino caso o jogador não tenha solicitado.
 * 4. Menu exclusivo de avaliação para o Dono/Dev (com suporte a Força, Resistência, Velocidade, Mana e Cristais).
 * 5. Conversão automática de unidades (kgf -> Tf a partir de 1000 kgf; Velocidade em km/h).
 * 6. Contabilização automática de evolução de Estrelas e envio de proposta interativa no PV
 *    (com suporte a 1 passo ou múltiplos passos, custo em cristais, saldo restante e Modo de Teste para o PV do Dev).
 */

const {
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const SYSTEM_NAME = "StatusEvolutionV2 (Projeto Genesis)";
const DEV_OWNER_ID = "540725346241216534";

/**
 * TABELA OFICIAL DAS 54 ESTRELAS (PROJETO GENESIS)
 * - Grupo 1: Ouros (Iniciantes) -> Azul, Rosa, Amarela (Passos 1 a 18) | Custo: 0 cristais
 * - Grupo 2: Diamante (Intermediárias) -> Vermelha, Verde, Preta (Passos 19 a 36) | Custo: 20 cristais/passo
 * - Grupo 3: Radiante (Campeão) -> Branca, Dourada, Multicolorida (Passos 37 a 54) | Custo: 99 cristais/passo (6ª Multicolorida = 0 / livre)
 */
const STAR_TABLE = [
    // ==================== 《 ESTRELAS INICIANTES — OUROS 》 ====================
    // [ESTRELAS AZUIS] (Passos 1 a 6)
    { passo: 1, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Azul', emoji: '🔵', nivel: 1, nomeEstrela: '1ª Estrela Azul', forcaKgf: 0, velocidadeKmh: 0, multiplicador: 100, mana: 100, custoCristais: 0, obs: 'Base Racial / Mana Inicial' },
    { passo: 2, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Azul', emoji: '🔵', nivel: 2, nomeEstrela: '2ª Estrela Azul', forcaKgf: 500, velocidadeKmh: 230, multiplicador: 130, mana: 130, custoCristais: 0 },
    { passo: 3, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Azul', emoji: '🔵', nivel: 3, nomeEstrela: '3ª Estrela Azul', forcaKgf: 810, velocidadeKmh: 250, multiplicador: 150, mana: 150, custoCristais: 0 },
    { passo: 4, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Azul', emoji: '🔵', nivel: 4, nomeEstrela: '4ª Estrela Azul', forcaKgf: 870, velocidadeKmh: 270, multiplicador: 170, mana: 160, custoCristais: 0 },
    { passo: 5, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Azul', emoji: '🔵', nivel: 5, nomeEstrela: '5ª Estrela Azul', forcaKgf: 890, velocidadeKmh: 285, multiplicador: 180, mana: 170, custoCristais: 0 },
    { passo: 6, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Azul', emoji: '🔵', nivel: 6, nomeEstrela: '6ª Estrela Azul', forcaKgf: 1500, velocidadeKmh: 300, multiplicador: 200, mana: 200, custoCristais: 0 },

    // [ESTRELAS ROSAS] (Passos 7 a 12)
    { passo: 7, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Rosa', emoji: '🩷', nivel: 1, nomeEstrela: '1ª Estrela Rosa', forcaKgf: 1600, velocidadeKmh: 315, multiplicador: 215, mana: 215, custoCristais: 0 },
    { passo: 8, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Rosa', emoji: '🩷', nivel: 2, nomeEstrela: '2ª Estrela Rosa', forcaKgf: 1800, velocidadeKmh: 330, multiplicador: 230, mana: 225, custoCristais: 0 },
    { passo: 9, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Rosa', emoji: '🩷', nivel: 3, nomeEstrela: '3ª Estrela Rosa', forcaKgf: 2000, velocidadeKmh: 340, multiplicador: 245, mana: 235, custoCristais: 0 },
    { passo: 10, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Rosa', emoji: '🩷', nivel: 4, nomeEstrela: '4ª Estrela Rosa', forcaKgf: 2100, velocidadeKmh: 355, multiplicador: 250, mana: 245, custoCristais: 0 },
    { passo: 11, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Rosa', emoji: '🩷', nivel: 5, nomeEstrela: '5ª Estrela Rosa', forcaKgf: 2500, velocidadeKmh: 390, multiplicador: 260, mana: 270, custoCristais: 0 },
    { passo: 12, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Rosa', emoji: '🩷', nivel: 6, nomeEstrela: '6ª Estrela Rosa', forcaKgf: 5000, velocidadeKmh: 450, multiplicador: 300, mana: 300, custoCristais: 0 },

    // [ESTRELAS AMARELAS] (Passos 13 a 18)
    { passo: 13, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Amarela', emoji: '🟡', nivel: 1, nomeEstrela: '1ª Estrela Amarela', forcaKgf: 5500, velocidadeKmh: 475, multiplicador: 320, mana: 320, custoCristais: 0 },
    { passo: 14, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Amarela', emoji: '🟡', nivel: 2, nomeEstrela: '2ª Estrela Amarela', forcaKgf: 6000, velocidadeKmh: 490, multiplicador: 340, mana: 345, custoCristais: 0 },
    { passo: 15, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Amarela', emoji: '🟡', nivel: 3, nomeEstrela: '3ª Estrela Amarela', forcaKgf: 7000, velocidadeKmh: 500, multiplicador: 360, mana: 360, custoCristais: 0 },
    { passo: 16, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Amarela', emoji: '🟡', nivel: 4, nomeEstrela: '4ª Estrela Amarela', forcaKgf: 8100, velocidadeKmh: 520, multiplicador: 375, mana: 375, custoCristais: 0 },
    { passo: 17, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Amarela', emoji: '🟡', nivel: 5, nomeEstrela: '5ª Estrela Amarela', forcaKgf: 10000, velocidadeKmh: 550, multiplicador: 400, mana: 400, custoCristais: 0 },
    { passo: 18, grupo: 'Ouros (Iniciantes)', grupoKey: 'ouros', cor: 'Amarela', emoji: '🟡', nivel: 6, nomeEstrela: '6ª Estrela Amarela', forcaKgf: 15000, velocidadeKmh: 600, multiplicador: 450, mana: 450, custoCristais: 0 },

    // ==================== 《 ESTRELAS INTERMEDIÁRIAS — DIAMANTE 》 (20 Cristais/passo) ====================
    // [ESTRELAS VERMELHAS] (Passos 19 a 24)
    { passo: 19, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Vermelha', emoji: '🔴', nivel: 1, nomeEstrela: '1ª Estrela Vermelha', forcaKgf: 16000, velocidadeKmh: 625, multiplicador: 470, mana: 470, custoCristais: 20 },
    { passo: 20, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Vermelha', emoji: '🔴', nivel: 2, nomeEstrela: '2ª Estrela Vermelha', forcaKgf: 16800, velocidadeKmh: 650, multiplicador: 500, mana: 500, custoCristais: 20 },
    { passo: 21, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Vermelha', emoji: '🔴', nivel: 3, nomeEstrela: '3ª Estrela Vermelha', forcaKgf: 17500, velocidadeKmh: 670, multiplicador: 530, mana: 520, custoCristais: 20 },
    { passo: 22, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Vermelha', emoji: '🔴', nivel: 4, nomeEstrela: '4ª Estrela Vermelha', forcaKgf: 18300, velocidadeKmh: 700, multiplicador: 550, mana: 550, custoCristais: 20 },
    { passo: 23, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Vermelha', emoji: '🔴', nivel: 5, nomeEstrela: '5ª Estrela Vermelha', forcaKgf: 20000, velocidadeKmh: 725, multiplicador: 600, mana: 570, custoCristais: 20 },
    { passo: 24, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Vermelha', emoji: '🔴', nivel: 6, nomeEstrela: '6ª Estrela Vermelha', forcaKgf: 30000, velocidadeKmh: 850, multiplicador: 630, mana: 600, custoCristais: 20 },

    // [ESTRELAS VERDES] (Passos 25 a 30)
    { passo: 25, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Verde', emoji: '🟢', nivel: 1, nomeEstrela: '1ª Estrela Verde', forcaKgf: 33000, velocidadeKmh: 880, multiplicador: 680, mana: 650, custoCristais: 20 },
    { passo: 26, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Verde', emoji: '🟢', nivel: 2, nomeEstrela: '2ª Estrela Verde', forcaKgf: 38000, velocidadeKmh: 910, multiplicador: 750, mana: 680, custoCristais: 20 },
    { passo: 27, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Verde', emoji: '🟢', nivel: 3, nomeEstrela: '3ª Estrela Verde', forcaKgf: 40000, velocidadeKmh: 1000, multiplicador: 780, mana: 700, custoCristais: 20 },
    { passo: 28, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Verde', emoji: '🟢', nivel: 4, nomeEstrela: '4ª Estrela Verde', forcaKgf: 45000, velocidadeKmh: 1100, multiplicador: 820, mana: 750, custoCristais: 20 },
    { passo: 29, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Verde', emoji: '🟢', nivel: 5, nomeEstrela: '5ª Estrela Verde', forcaKgf: 55000, velocidadeKmh: 1200, multiplicador: 870, mana: 800, custoCristais: 20 },
    { passo: 30, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Verde', emoji: '🟢', nivel: 6, nomeEstrela: '6ª Estrela Verde', forcaKgf: 60000, velocidadeKmh: 1350, multiplicador: 900, mana: 1000, custoCristais: 20 },

    // [ESTRELAS PRETAS] (Passos 31 a 36)
    { passo: 31, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Preta', emoji: '⚫', nivel: 1, nomeEstrela: '1ª Estrela Preta', forcaKgf: 65000, velocidadeKmh: 1500, multiplicador: 950, mana: 1150, custoCristais: 20 },
    { passo: 32, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Preta', emoji: '⚫', nivel: 2, nomeEstrela: '2ª Estrela Preta', forcaKgf: 70000, velocidadeKmh: 1650, multiplicador: 1000, mana: 1300, custoCristais: 20 },
    { passo: 33, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Preta', emoji: '⚫', nivel: 3, nomeEstrela: '3ª Estrela Preta', forcaKgf: 100000, velocidadeKmh: 1750, multiplicador: 1050, mana: 1500, custoCristais: 20 },
    { passo: 34, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Preta', emoji: '⚫', nivel: 4, nomeEstrela: '4ª Estrela Preta', forcaKgf: 115000, velocidadeKmh: 1800, multiplicador: 1100, mana: 1600, custoCristais: 20 },
    { passo: 35, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Preta', emoji: '⚫', nivel: 5, nomeEstrela: '5ª Estrela Preta', forcaKgf: 125000, velocidadeKmh: 1950, multiplicador: 1150, mana: 1750, custoCristais: 20 },
    { passo: 36, grupo: 'Diamante (Intermediárias)', grupoKey: 'diamante', cor: 'Preta', emoji: '⚫', nivel: 6, nomeEstrela: '6ª Estrela Preta', forcaKgf: 175000, velocidadeKmh: 2200, multiplicador: 1300, mana: 2000, custoCristais: 20 },

    // ==================== 《 ESTRELAS CAMPEÃO — RADIANTE 》 (99 Cristais/passo) ====================
    // [ESTRELAS BRANCAS] (Passos 37 a 42)
    { passo: 37, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Branca', emoji: '⚪', nivel: 1, nomeEstrela: '1ª Estrela Branca', forcaKgf: 200000, velocidadeKmh: 2500, multiplicador: 1350, mana: 2150, custoCristais: 99 },
    { passo: 38, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Branca', emoji: '⚪', nivel: 2, nomeEstrela: '2ª Estrela Branca', forcaKgf: 225000, velocidadeKmh: 2700, multiplicador: 1400, mana: 2200, custoCristais: 99 },
    { passo: 39, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Branca', emoji: '⚪', nivel: 3, nomeEstrela: '3ª Estrela Branca', forcaKgf: 255000, velocidadeKmh: 2800, multiplicador: 1500, mana: 2350, custoCristais: 99 },
    { passo: 40, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Branca', emoji: '⚪', nivel: 4, nomeEstrela: '4ª Estrela Branca', forcaKgf: 280000, velocidadeKmh: 2950, multiplicador: 1550, mana: 2450, custoCristais: 99 },
    { passo: 41, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Branca', emoji: '⚪', nivel: 5, nomeEstrela: '5ª Estrela Branca', forcaKgf: 350000, velocidadeKmh: 3150, multiplicador: 1600, mana: 2500, custoCristais: 99 },
    { passo: 42, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Branca', emoji: '⚪', nivel: 6, nomeEstrela: '6ª Estrela Branca', forcaKgf: 460000, velocidadeKmh: 3500, multiplicador: 1650, mana: 2650, custoCristais: 99 },

    // [ESTRELAS DOURADAS] (Passos 43 a 48)
    { passo: 43, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Dourada', emoji: '🌟', nivel: 1, nomeEstrela: '1ª Estrela Dourada', forcaKgf: 510000, velocidadeKmh: 4000, multiplicador: 1700, mana: 2800, custoCristais: 99 },
    { passo: 44, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Dourada', emoji: '🌟', nivel: 2, nomeEstrela: '2ª Estrela Dourada', forcaKgf: 700000, velocidadeKmh: 4500, multiplicador: 1775, mana: 3000, custoCristais: 99 },
    { passo: 45, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Dourada', emoji: '🌟', nivel: 3, nomeEstrela: '3ª Estrela Dourada', forcaKgf: 860000, velocidadeKmh: 4800, multiplicador: 1840, mana: 3150, custoCristais: 99 },
    { passo: 46, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Dourada', emoji: '🌟', nivel: 4, nomeEstrela: '4ª Estrela Dourada', forcaKgf: 930000, velocidadeKmh: 5100, multiplicador: 1890, mana: 3240, custoCristais: 99 },
    { passo: 47, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Dourada', emoji: '🌟', nivel: 5, nomeEstrela: '5ª Estrela Dourada', forcaKgf: 1200000, velocidadeKmh: 5300, multiplicador: 1930, mana: 3400, custoCristais: 99 },
    { passo: 48, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Dourada', emoji: '🌟', nivel: 6, nomeEstrela: '6ª Estrela Dourada', forcaKgf: 1500000, velocidadeKmh: 8750, multiplicador: 2100, mana: 3700, custoCristais: 99 },

    // [ESTRELAS MULTICOLORIDAS — CALEIDOSCÓPIO] (Passos 49 a 54)
    { passo: 49, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Multicolorida', emoji: '🌈', nivel: 1, nomeEstrela: '1ª Estrela Multicolorida', forcaKgf: 2800000, velocidadeKmh: 14000, multiplicador: 2400, mana: 4000, custoCristais: 99 },
    { passo: 50, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Multicolorida', emoji: '🌈', nivel: 2, nomeEstrela: '2ª Estrela Multicolorida', forcaKgf: 6000000, velocidadeKmh: 16000, multiplicador: 2700, mana: 4500, custoCristais: 99 },
    { passo: 51, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Multicolorida', emoji: '🌈', nivel: 3, nomeEstrela: '3ª Estrela Multicolorida', forcaKgf: 10000000, velocidadeKmh: 18000, multiplicador: 3000, mana: 5000, custoCristais: 99 },
    { passo: 52, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Multicolorida', emoji: '🌈', nivel: 4, nomeEstrela: '4ª Estrela Multicolorida', forcaKgf: 25000000, velocidadeKmh: 21000, multiplicador: 3200, mana: 5400, custoCristais: 99 },
    { passo: 53, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Multicolorida', emoji: '🌈', nivel: 5, nomeEstrela: '5ª Estrela Multicolorida', forcaKgf: 50000000, velocidadeKmh: 24000, multiplicador: 5000, mana: 10000, custoCristais: 99 },
    { passo: 54, grupo: 'Radiante (Campeão)', grupoKey: 'radiante', cor: 'Multicolorida', emoji: '🌈', nivel: 6, nomeEstrela: '6ª Estrela Multicolorida (Ápice)', forcaKgf: Infinity, velocidadeKmh: Infinity, multiplicador: Infinity, mana: Infinity, custoCristais: 0, infinito: true, obs: 'A última de todas não precisa mais de condições, pode evoluir normalmente.' }
];

/**
 * Obtém os dados de uma estrela pelo número do passo (1 a 54).
 */
function getStarByStep(passo) {
    const safeStep = Math.max(1, Math.min(54, Number(passo) || 1));
    return STAR_TABLE[safeStep - 1];
}

/**
 * Calcula qual seria o passo de estrela correspondente apenas pelos status brutos.
 */
function findHighestStarByStatsOnly(forcaKgf, velocidadeKmh, mana) {
    let bestStep = 1;
    for (const star of STAR_TABLE) {
        if (star.infinito) continue;
        if (forcaKgf >= star.forcaKgf && velocidadeKmh >= star.velocidadeKmh && mana >= star.mana) {
            bestStep = star.passo;
        } else {
            break;
        }
    }
    return bestStep;
}

/**
 * Normaliza texto para comparação segura (sem acentos, lowercase).
 */
function normalizeStr(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

/**
 * Converte uma string de entrada de Força ou Resistência para o valor base em kgf.
 * Aceita formatos como: "500", "500 kgf", "1.5 Tf", "2,5 tf", "10.000T", "1200kgf", "+300 kgf".
 */
function parseForceOrResistanceToKgf(input) {
    if (input === null || input === undefined) return 0;
    const raw = String(input).trim().toLowerCase();
    if (!raw || raw === '0') return 0;
    if (raw.includes('infinito') || raw === 'inf') return Infinity;

    let cleaned = raw;
    if (/\d+\.\d{3}\b/.test(cleaned) && !cleaned.includes(',')) {
        cleaned = cleaned.replace(/\./g, '');
    } else {
        cleaned = cleaned.replace(',', '.');
    }

    const numMatch = cleaned.match(/[-+]?\d+(?:\.\d+)?/);
    if (!numMatch) return 0;

    const numVal = parseFloat(numMatch[0]);
    if (isNaN(numVal)) return 0;

    if (/\b(tf|tonelada|toneladas|ton|t)\b/i.test(raw) || /\d\s*(tf|t)\b/i.test(raw)) {
        return numVal * 1000;
    }

    return numVal;
}

/**
 * Formata um valor em kgf para exibição:
 * - Se < 1000 kgf: exibe em kgf (ex: "500 kgf")
 * - Se >= 1000 kgf: converte automaticamente para Tf (ex: "1.5 Tf")
 */
function formatForceOrResistance(kgfValue) {
    if (kgfValue === Infinity || kgfValue === 'Infinito') return '♾️ Infinito';
    const val = Number(kgfValue) || 0;
    if (Math.abs(val) >= 1000) {
        const tf = Number((val / 1000).toFixed(3));
        return `${tf} Tf`;
    }
    return `${Number(val.toFixed(2))} kgf`;
}

/**
 * Converte uma string de entrada de Velocidade para o valor base em km/h.
 */
function parseSpeedToKmh(input) {
    if (input === null || input === undefined) return 0;
    const raw = String(input).trim().toLowerCase();
    if (!raw || raw === '0') return 0;
    if (raw.includes('infinito') || raw === 'inf') return Infinity;

    let cleaned = raw;
    if (/\d+\.\d{3}\b/.test(cleaned) && !cleaned.includes(',')) {
        cleaned = cleaned.replace(/\./g, '');
    } else {
        cleaned = cleaned.replace(',', '.');
    }

    const numMatch = cleaned.match(/[-+]?\d+(?:\.\d+)?/);
    if (!numMatch) return 0;

    const numVal = parseFloat(numMatch[0]);
    if (isNaN(numVal)) return 0;

    if (/\bmach\b/i.test(raw)) {
        return numVal * 1234.8;
    }
    if (/\bm\/s\b/i.test(raw)) {
        return numVal * 3.6;
    }

    return numVal;
}

/**
 * Formata um valor em km/h para exibição.
 */
function formatSpeed(kmhValue) {
    if (kmhValue === Infinity || kmhValue === 'Infinito') return '♾️ Infinito';
    const val = Number(kmhValue) || 0;
    return `${Number(val.toFixed(2))} km/h`;
}

/**
 * Converte uma string de entrada de Mana ou Cristais para número.
 */
function parseMana(input) {
    if (input === null || input === undefined) return 0;
    const raw = String(input).trim().toLowerCase();
    if (!raw || raw === '0') return 0;
    if (raw.includes('infinito') || raw === 'inf') return Infinity;

    let cleaned = raw;
    if (/\d+\.\d{3}\b/.test(cleaned) && !cleaned.includes(',')) {
        cleaned = cleaned.replace(/\./g, '');
    } else {
        cleaned = cleaned.replace(',', '.');
    }

    const numMatch = cleaned.match(/[-+]?\d+(?:\.\d+)?/);
    if (!numMatch) return 0;

    let numVal = parseFloat(numMatch[0]);
    if (isNaN(numVal)) return 0;

    if (/\b(k|mil)\b/i.test(raw) || /\d\s*k\b/i.test(raw)) {
        numVal *= 1000;
    }

    return numVal;
}

function parseCristais(input) {
    return Math.round(parseMana(input));
}

function formatMana(manaValue) {
    if (manaValue === Infinity || manaValue === 'Infinito') return '♾️ Infinito';
    const val = Number(manaValue) || 0;
    return `${Number(val.toFixed(2))}`;
}

/**
 * Identifica quais atributos de status (forca, velocidade, resistencia, mana, cristais)
 * estão presentes em um objeto de upgrade.
 */
function detectAttributesInUpgrade(upg) {
    if (!upg) return [];
    const nomeNorm = normalizeStr(upg.nome);
    const tipoNorm = normalizeStr(upg.tipo);
    const catNorm = normalizeStr(upg.categoria);
    const descNorm = normalizeStr(upg.descricao);

    const detected = new Set();

    const isStatusTypeOrCat =
        tipoNorm.includes('status') ||
        catNorm.includes('atributo') ||
        catNorm.includes('status') ||
        catNorm.includes('genesis');

    if (/\b(cristal|cristais|cristais do tempo|cristal do tempo|fragmento temporal)\b/.test(`${nomeNorm} ${descNorm}`)) {
        detected.add('cristais');
    }
    if (/\b(forca|forca fisica|fisico|levantamento|potencia muscular)\b/.test(nomeNorm)) detected.add('forca');
    if (/\b(velocidade|agilidade|rapidez|deslocamento|reflexo|reflexos)\b/.test(nomeNorm)) detected.add('velocidade');
    if (/\b(resistencia|durabilidade|vigor|defesa fisica|robustez|constituicao)\b/.test(nomeNorm)) detected.add('resistencia');
    if (/\b(mana|reserva de mana|energia magica|pool de mana|capacidade magica)\b/.test(nomeNorm)) detected.add('mana');

    if (isStatusTypeOrCat || /\b(status|atributos|atributo)\b/.test(nomeNorm)) {
        if (/\b(forca|kgf|tf)\b/.test(`${nomeNorm} ${descNorm}`)) detected.add('forca');
        if (/\b(velocidade|km\/h|kmh|m\/s|mach)\b/.test(`${nomeNorm} ${descNorm}`)) detected.add('velocidade');
        if (/\b(resistencia|durabilidade)\b/.test(`${nomeNorm} ${descNorm}`)) detected.add('resistencia');
        if (/\b(mana)\b/.test(`${nomeNorm} ${descNorm}`)) detected.add('mana');

        if (detected.size === 0) {
            detected.add('status_geral');
        }
    }

    return Array.from(detected);
}

/**
 * Retorna true se o upgrade for de status (Força, Velocidade, Resistência, Mana ou Cristais).
 */
function isStatusUpgrade(upg) {
    return detectAttributesInUpgrade(upg).length > 0;
}

/**
 * Verifica se a lista de upgrades já possui algum pedido de Cristais / Cristais do Tempo.
 * Se não possuir, adiciona automaticamente ao final um upgrade para Cristais do Tempo
 * na mesma base dos status físicos.
 */
function garantirUpgradeCristaisNoFinal(upgradesList) {
    if (!Array.isArray(upgradesList)) return [];
    const hasCrystalUpgrade = upgradesList.some(u => {
        const attrs = detectAttributesInUpgrade(u);
        return attrs.includes('cristais') || u?.autoGeneratedCrystal;
    });

    if (!hasCrystalUpgrade) {
        upgradesList.push({
            tipo: 'Status',
            categoria: 'Atributo (Projeto Genesis)',
            nome: 'Cristais do Tempo',
            descricao: 'Contabilização de Cristais / Cristais do Tempo obtidos ao final do treino.',
            resumo: 'Ganho de Cristais do Tempo referente ao desempenho e esforço narrativo em todo o treinamento.',
            status: 'pendente',
            autoGeneratedCrystal: true
        });
    }
    return upgradesList;
}

/**
 * Extrai valores numéricos sugeridos pela IA ou escritos na descrição do upgrade.
 */
function extractSuggestedStatusValues(upg) {
    const result = {
        forcaKgf: 0,
        resistenciaKgf: 0,
        velocidadeKmh: 0,
        mana: 0,
        cristais: 0,
        textoBrutoValores: ''
    };
    if (!upg) return result;

    if (upg.statusValores && typeof upg.statusValores === 'object') {
        if (upg.statusValores.forca) result.forcaKgf = parseForceOrResistanceToKgf(upg.statusValores.forca);
        if (upg.statusValores.resistencia) result.resistenciaKgf = parseForceOrResistanceToKgf(upg.statusValores.resistencia);
        if (upg.statusValores.velocidade) result.velocidadeKmh = parseSpeedToKmh(upg.statusValores.velocidade);
        if (upg.statusValores.mana) result.mana = parseMana(upg.statusValores.mana);
        if (upg.statusValores.cristais) result.cristais = parseCristais(upg.statusValores.cristais);
    }

    const attrs = detectAttributesInUpgrade(upg);
    const text = `${upg.nome || ''} | ${upg.descricao || ''}`;
    result.textoBrutoValores = text.substring(0, 500);

    const kgfOrTfMatch = text.match(/([+]?\d+(?:[.,]\d+)?\s*(?:kgf|tf|toneladas?|ton)\b)/i);
    const kmhMatch = text.match(/([+]?\d+(?:[.,]\d+)?\s*(?:km\/h|kmh|m\/s|mach)\b)/i);
    const crystalMatch = text.match(/([+]?\d+)\s*(?:cristais|cristal)/i);

    if (attrs.includes('cristais') && !result.cristais) {
        if (crystalMatch) {
            result.cristais = parseCristais(crystalMatch[1]);
        } else if (attrs.length === 1) {
            result.cristais = parseCristais(upg.descricao);
        }
    }

    if (attrs.includes('forca') && !result.forcaKgf) {
        if (kgfOrTfMatch) {
            result.forcaKgf = parseForceOrResistanceToKgf(kgfOrTfMatch[1]);
        } else if (attrs.length === 1) {
            result.forcaKgf = parseForceOrResistanceToKgf(upg.descricao);
        }
    }

    if (attrs.includes('resistencia') && !result.resistenciaKgf) {
        if (kgfOrTfMatch) {
            result.resistenciaKgf = parseForceOrResistanceToKgf(kgfOrTfMatch[1]);
        } else if (attrs.length === 1) {
            result.resistenciaKgf = parseForceOrResistanceToKgf(upg.descricao);
        }
    }

    if (attrs.includes('velocidade') && !result.velocidadeKmh) {
        if (kmhMatch) {
            result.velocidadeKmh = parseSpeedToKmh(kmhMatch[1]);
        } else if (attrs.length === 1) {
            result.velocidadeKmh = parseSpeedToKmh(upg.descricao);
        }
    }

    if (attrs.includes('mana') && !result.mana) {
        if (attrs.length === 1) {
            result.mana = parseMana(upg.descricao);
        }
    }

    return result;
}

/**
 * Executa a captura alternativa silenciosa sempre que um treino contendo upgrades de status é enviado.
 */
async function capturaSilenciosaStatus(client, upgDoc) {
    try {
        if (!client?.database?.SilentStatusCapture || !upgDoc || !Array.isArray(upgDoc.upgrades)) return;

        for (let i = 0; i < upgDoc.upgrades.length; i++) {
            const upg = upgDoc.upgrades[i];
            const attrs = detectAttributesInUpgrade(upg);
            if (attrs.length === 0) continue;

            const valoresSugeridos = extractSuggestedStatusValues(upg);

            await client.database.SilentStatusCapture.findOneAndUpdate(
                { upgradeId: String(upgDoc._id), upgradeIndex: i },
                {
                    upgradeId: String(upgDoc._id),
                    upgradeIndex: i,
                    userId: upgDoc.userId,
                    personagem: upgDoc.personagem || 'Não informado',
                    atributosDetectados: attrs,
                    nomeUpgradeOriginal: upg.nome || 'Sem nome',
                    descricaoOriginal: upg.descricao || '',
                    autoGeneratedCrystal: Boolean(upg.autoGeneratedCrystal),
                    valoresSugeridosIA: valoresSugeridos,
                    status: 'capturado_silenciosamente',
                    createdAt: new Date()
                },
                { upsert: true, new: true }
            );
        }
    } catch (err) {
        console.error(`[${SYSTEM_NAME}] Erro na captura silenciosa de status:`, err);
    }
}

/**
 * Verifica se o Modo de Teste do Projeto Genesis está ativo (default: true).
 * Quando true, as propostas de evolução no PV vão para o Dono/Dev com os dados do jogador.
 */
async function isGenesisTestMode(client) {
    try {
        if (!client?.database?.BotConfig) return true;
        const cfg = await client.database.BotConfig.findById('global').lean();
        if (cfg && typeof cfg.genesisTestMode === 'boolean') {
            return cfg.genesisTestMode;
        }
        return true;
    } catch (_) {
        return true;
    }
}

/**
 * Obtém o documento de status acumulado (CharacterStatusV2) de um personagem.
 */
async function obterStatusPersonagemV2(client, userId, personagem) {
    if (!client?.database?.CharacterStatusV2) return null;
    const persNorm = normalizeStr(personagem || ' padrao ');
    return await client.database.CharacterStatusV2.findOne({
        userId,
        personagemNormalized: persNorm
    }).lean().catch(() => null);
}

/**
 * Obtém a captura silenciosa de um upgrade específico.
 */
async function obterCapturaSilenciosa(client, upgradeId, upgradeIndex) {
    if (!client?.database?.SilentStatusCapture) return null;
    return await client.database.SilentStatusCapture.findOne({
        upgradeId: String(upgradeId),
        upgradeIndex: Number(upgradeIndex)
    }).lean().catch(() => null);
}

/**
 * Analisa quantos passos de Estrela o personagem pode avançar no momento.
 * Regras de evolução do Projeto Genesis:
 * - Passos 2 a 18 (Ouros — Iniciantes): Custo = 0 cristais; requer atingir os status da estrela (Força, Velocidade e Mana).
 * - Passos 19 a 36 (Diamante — Intermediárias): Custo = 20 cristais por passo.
 * - Passos 37 a 53 (Radiante — Campeão): Custo = 99 cristais por passo.
 * - Passo 54 (6ª Estrela Multicolorida): Custo = 0 cristais ("A última de todas não precisa mais de condições, pode evoluir normalmente").
 */
function calcularOpcoesEvolucao(charDoc) {
    if (!charDoc) return { podeEvoluir: false };

    const passoAtual = Math.max(1, Math.min(54, Number(charDoc.estrelaPasso) || 1));
    if (passoAtual >= 54) {
        return { podeEvoluir: false, motivo: 'Personagem já atingiu a 6ª Estrela Multicolorida (Ápice).' };
    }

    const estrelaAtual = getStarByStep(passoAtual);
    const cristaisDisponiveis = Number(charDoc.cristais) || 0;
    const forcaAtual = charDoc.infinito ? Infinity : (Number(charDoc.forcaKgf) || 0);
    const velAtual = charDoc.infinito ? Infinity : (Number(charDoc.velocidadeKmh) || 0);
    const manaAtual = charDoc.infinito ? Infinity : (Number(charDoc.mana) || 0);

    const passosPossiveis = [];
    let custoAcumulado = 0;

    for (let nextStep = passoAtual + 1; nextStep <= 54; nextStep++) {
        const star = getStarByStep(nextStep);
        const custoPasso = star.custoCristais || 0;

        // Nas Estrelas Iniciantes (Ouros: passos 2 a 18), não há gasto de cristais,
        // então a condição para subir de estrela é ter atingido os status daquela estrela.
        if (star.grupoKey === 'ouros') {
            const temStatusOuros =
                forcaAtual >= star.forcaKgf &&
                velAtual >= star.velocidadeKmh &&
                manaAtual >= star.mana;

            if (!temStatusOuros) break;
            passosPossiveis.push({
                passo: nextStep,
                star,
                custoPasso: 0,
                custoAcumulado: 0,
                saldoRestante: cristaisDisponiveis,
                atingiuStatusBase: true
            });
            continue;
        }

        // Na 6ª Estrela Multicolorida (Passo 54), não precisa mais de condições se já está na 5ª Multicolorida (Passo 53)
        if (nextStep === 54) {
            passosPossiveis.push({
                passo: 54,
                star,
                custoPasso: 0,
                custoAcumulado,
                saldoRestante: cristaisDisponiveis - custoAcumulado,
                atingiuStatusBase: true
            });
            break;
        }

        // Nas Estrelas Diamante (20 cristais/passo) e Radiante (99 cristais/passo):
        // Verifica se há saldo de Cristais do Tempo suficiente para este passo
        if (cristaisDisponiveis >= custoAcumulado + custoPasso) {
            custoAcumulado += custoPasso;
            const atingiuStatusBase =
                forcaAtual >= star.forcaKgf &&
                velAtual >= star.velocidadeKmh &&
                manaAtual >= star.mana;

            passosPossiveis.push({
                passo: nextStep,
                star,
                custoPasso,
                custoAcumulado,
                saldoRestante: cristaisDisponiveis - custoAcumulado,
                atingiuStatusBase
            });
        } else {
            break;
        }
    }

    if (passosPossiveis.length === 0) {
        const proxStar = getStarByStep(passoAtual + 1);
        return {
            podeEvoluir: false,
            estrelaAtual,
            proximaEstrela: proxStar,
            cristaisFaltantes: Math.max(0, (proxStar.custoCristais || 0) - cristaisDisponiveis)
        };
    }

    const primeiroPasso = passosPossiveis[0];
    const ultimoPasso = passosPossiveis[passosPossiveis.length - 1];

    return {
        podeEvoluir: true,
        estrelaAtual,
        cristaisAtuais: cristaisDisponiveis,
        quantidadePassosPossiveis: passosPossiveis.length,
        opcaoUmPasso: primeiroPasso,
        opcaoMaxPassos: ultimoPasso,
        todosPassos: passosPossiveis
    };
}

/**
 * Envia uma proposta interativa no PV perguntando se o jogador deseja evoluir de Estrela.
 * Em Modo de Teste (genesisTestMode = true), envia para o PV do Dono/Dev (DEV_OWNER_ID)
 * tratando como se fosse o jogador, mas exibindo todos os dados reais do jogador e personagem.
 */
async function enviarPropostaEvolucaoPV(client, charDoc) {
    try {
        if (!client || !charDoc) return { sent: false, reason: 'Dados inválidos.' };

        const analise = calcularOpcoesEvolucao(charDoc);
        if (!analise.podeEvoluir) {
            return { sent: false, reason: 'Personagem ainda não cumpre os requisitos para evoluir.', analise };
        }

        const testMode = await isGenesisTestMode(client);
        const targetUserId = testMode ? DEV_OWNER_ID : charDoc.userId;
        const targetUser = await client.users.fetch(targetUserId).catch(() => null);
        if (!targetUser) {
            return { sent: false, reason: `Não foi possível encontrar o usuário de destino (${targetUserId}).` };
        }

        const { estrelaAtual, cristaisAtuais, quantidadePassosPossiveis, opcaoUmPasso, opcaoMaxPassos } = analise;
        const proxStar = opcaoUmPasso.star;

        let desc = '';
        if (testMode) {
            desc += `🛠️ **[MODO DE TESTE ATIVO — SIMULAÇÃO DE PV DO JOGADOR]**\n`;
            desc += `👤 **Jogador Original:** <@${charDoc.userId}> (\`${charDoc.userId}\`)\n`;
            desc += `🎭 **Personagem:** **${charDoc.personagem}**\n`;
            desc += `*(Quando o Modo de Teste for desativado em \`/genesis config\`, esta mensagem será enviada diretamente para o jogador)*\n\n`;
        } else {
            desc += `Olá <@${charDoc.userId}>! Seu personagem **${charDoc.personagem}** recebeu novos ganhos e atingiu as condições para **Evoluir de Estrela** no **Projeto Genesis**!\n\n`;
        }

        desc += `🌟 **Estrela Atual:** ${estrelaAtual.emoji} **${estrelaAtual.nomeEstrela}** — *${estrelaAtual.grupo}* (Passo ${estrelaAtual.passo}/54)\n`;
        desc += `⚡ **Multiplicador Atual:** \`${estrelaAtual.multiplicador}%\`\n`;
        desc += `💎 **Saldo Atual de Cristais do Tempo:** \`${cristaisAtuais} Cristais\`\n\n`;

        desc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        desc += `### ⬆️ Opção 1: Avançar 1 Passo\n`;
        desc += `• **Nova Estrela:** ${proxStar.emoji} **${proxStar.nomeEstrela}** (*${proxStar.grupo}*)\n`;
        desc += `• **Gasto em Cristais:** \`${opcaoUmPasso.custoPasso} Cristais\`\n`;
        desc += `• **Saldo Restante:** \`${opcaoUmPasso.saldoRestante} Cristais\`\n`;
        desc += `• **Patamar da Estrela:** Força \`${formatForceOrResistance(proxStar.forcaKgf)}\` | Vel. \`${formatSpeed(proxStar.velocidadeKmh)}\` | Mana \`${formatMana(proxStar.mana)}\` | Mult. \`${proxStar.multiplicador === Infinity ? '♾️ Infinito' : proxStar.multiplicador + '%'}\`\n`;

        if (quantidadePassosPossiveis > 1) {
            const maxStar = opcaoMaxPassos.star;
            desc += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            desc += `### 🚀 Opção 2: Avançar Múltiplos Passos (${quantidadePassosPossiveis} Passos Disponíveis!)\n`;
            desc += `Você possui saldo/requisitos suficientes para avançar **${quantidadePassosPossiveis} passos** de uma só vez!\n`;
            desc += `• **Estrela de Destino Final:** ${maxStar.emoji} **${maxStar.nomeEstrela}** (*${maxStar.grupo}* — Passo ${maxStar.passo}/54)\n`;
            desc += `• **Quantidade de Passos:** \`+${quantidadePassosPossiveis} passos\`\n`;
            desc += `• **Gasto Total em Cristais:** \`${opcaoMaxPassos.custoAcumulado} Cristais\`\n`;
            desc += `• **Saldo Restante Após Evolução Total:** \`${opcaoMaxPassos.saldoRestante} Cristais\`\n`;
            desc += `• **Patamar Final da Estrela:** Força \`${formatForceOrResistance(maxStar.forcaKgf)}\` | Vel. \`${formatSpeed(maxStar.velocidadeKmh)}\` | Mana \`${formatMana(maxStar.mana)}\` | Mult. \`${maxStar.multiplicador === Infinity ? '♾️ Infinito' : maxStar.multiplicador + '%'}\`\n`;
        }

        desc += `\n**Deseja realizar a evolução agora?**`;

        const embed = new EmbedBuilder()
            .setTitle(`🌌 Evolução de Estrela Disponível • ${charDoc.personagem}`)
            .setColor('#f1c40f')
            .setDescription(desc.substring(0, 4096))
            .setFooter({ text: `${SYSTEM_NAME} • ID da Ficha: ${charDoc._id}` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`genesis_evo_step_${charDoc._id}_1`)
                .setLabel(`Evoluir 1 Passo (-${opcaoUmPasso.custoPasso} 💎)`)
                .setEmoji('⬆️')
                .setStyle(ButtonStyle.Success)
        );

        if (quantidadePassosPossiveis > 1) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`genesis_evo_step_${charDoc._id}_${quantidadePassosPossiveis}`)
                    .setLabel(`Evoluir ${quantidadePassosPossiveis} Passos (-${opcaoMaxPassos.custoAcumulado} 💎)`)
                    .setEmoji('🚀')
                    .setStyle(ButtonStyle.Primary)
            );
        }

        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`genesis_evo_cancel_${charDoc._id}`)
                .setLabel('Agora Não (Guardar)')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Secondary)
        );

        await targetUser.send({ embeds: [embed], components: [row] });
        return { sent: true, targetUserId, testMode, analise };
    } catch (err) {
        console.error(`[${SYSTEM_NAME}] Erro ao enviar proposta de evolução no PV:`, err);
        return { sent: false, reason: err.message };
    }
}

/**
 * Executa a evolução de N passos de Estrela para o personagem, descontando os Cristais do Tempo.
 */
async function efetivarEvolucaoEstrela(client, charId, stepsToAdvance = 1, executorUserId = null) {
    const charDoc = await client.database.CharacterStatusV2.findById(charId);
    if (!charDoc) return { ok: false, error: 'Ficha de status do personagem não encontrada no banco de dados.' };

    const analise = calcularOpcoesEvolucao(charDoc);
    if (!analise.podeEvoluir) {
        return { ok: false, error: 'Este personagem não cumpre mais os requisitos ou saldo de cristais para evoluir.' };
    }

    const chosenOption = analise.todosPassos.find(p => p.passo === charDoc.estrelaPasso + stepsToAdvance)
        || analise.todosPassos[Math.min(stepsToAdvance - 1, analise.todosPassos.length - 1)];

    if (!chosenOption) {
        return { ok: false, error: 'Opção de evolução inválida.' };
    }

    const oldStar = getStarByStep(charDoc.estrelaPasso);
    const newStar = chosenOption.star;
    const custoTotal = chosenOption.custoAcumulado;

    if ((charDoc.cristais || 0) < custoTotal) {
        return { ok: false, error: `Saldo de cristais insuficiente. Necessário: ${custoTotal}, Saldo atual: ${charDoc.cristais || 0}.` };
    }

    charDoc.cristais = (charDoc.cristais || 0) - custoTotal;
    charDoc.cristaisGastosTotal = (charDoc.cristaisGastosTotal || 0) + custoTotal;
    charDoc.estrelaPasso = newStar.passo;
    charDoc.multiplicadorPoder = newStar.multiplicador === Infinity ? 999999 : newStar.multiplicador;

    if (newStar.infinito) {
        charDoc.infinito = true;
    } else {
        if (charDoc.forcaKgf < newStar.forcaKgf) charDoc.forcaKgf = newStar.forcaKgf;
        if (charDoc.velocidadeKmh < newStar.velocidadeKmh) charDoc.velocidadeKmh = newStar.velocidadeKmh;
        if (charDoc.mana < newStar.mana) charDoc.mana = newStar.mana;
    }

    charDoc.updatedAt = new Date();
    charDoc.historicoUpgrades.push({
        upgradeId: 'evolucao_estrela',
        upgradeIndex: 0,
        nomeUpgrade: `Evolução: ${oldStar.nomeEstrela} ➔ ${newStar.nomeEstrela}`,
        addedForcaKgf: 0,
        addedResistenciaKgf: 0,
        addedVelocidadeKmh: 0,
        addedMana: 0,
        addedCristais: -custoTotal,
        tipoRegistro: 'evolucao_estrela',
        feedbackPublico: `Avançou ${newStar.passo - oldStar.passo} passo(s) gastando ${custoTotal} Cristais do Tempo.`,
        avaliadoPor: executorUserId || charDoc.userId,
        data: new Date()
    });

    await charDoc.save();

    return {
        ok: true,
        charDoc,
        oldStar,
        newStar,
        stepsAdvanced: newStar.passo - oldStar.passo,
        custoTotal,
        saldoRestante: charDoc.cristais
    };
}

/**
 * Trata os cliques nos botões de evolução enviados no PV (`genesis_evo_...`)
 * e também interações de gerenciamento da ficha (`/genesis`).
 */
async function handleGenesisInteraction(interaction, client) {
    const customId = interaction.customId;

    if (customId.startsWith('genesis_evo_cancel_')) {
        const charId = customId.replace('genesis_evo_cancel_', '');
        const charDoc = await client.database.CharacterStatusV2.findById(charId).lean().catch(() => null);
        return interaction.update({
            content: `⏸️ Evolução de **${charDoc?.personagem || 'Personagem'}** adiada. Seus **${charDoc?.cristais || 0} Cristais do Tempo** foram mantidos no saldo!`,
            components: []
        }).catch(() => {});
    }

    if (customId.startsWith('genesis_evo_step_')) {
        await interaction.deferUpdate().catch(() => {});
        const parts = customId.replace('genesis_evo_step_', '').split('_');
        const charId = parts[0];
        const steps = parseInt(parts[1] || '1', 10);

        const res = await efetivarEvolucaoEstrela(client, charId, steps, interaction.user.id);
        if (!res.ok) {
            return interaction.editReply({
                content: `❌ Não foi possível concluir a evolução: ${res.error}`,
                components: []
            }).catch(() => {});
        }

        const { charDoc, oldStar, newStar, stepsAdvanced, custoTotal, saldoRestante } = res;

        const confirmEmbed = new EmbedBuilder()
            .setTitle(`🌟 Evolução Concluída com Sucesso! • ${charDoc.personagem}`)
            .setColor('#2ecc71')
            .setDescription(
                `👤 **Jogador:** <@${charDoc.userId}>\n` +
                `🎭 **Personagem:** **${charDoc.personagem}**\n\n` +
                `✨ **Evolução Realizada (+${stepsAdvanced} passo${stepsAdvanced > 1 ? 's' : ''}):**\n` +
                `${oldStar.emoji} ~~${oldStar.nomeEstrela}~~ ➔ ${newStar.emoji} **${newStar.nomeEstrela}** (*${newStar.grupo}*)\n\n` +
                `💎 **Gasto em Cristais:** \`-${custoTotal} Cristais\`\n` +
                `💰 **Saldo Restante:** \`${saldoRestante} Cristais\`\n\n` +
                `📊 **Status Atuais na Nova Estrela:**\n` +
                `• ⚡ **Multiplicador de Poder:** \`${charDoc.infinito ? '♾️ Infinito' : newStar.multiplicador + '%'}\`\n` +
                `• 💪 **Força:** \`${charDoc.infinito ? '♾️ Infinito' : formatForceOrResistance(charDoc.forcaKgf)}\`\n` +
                `• 🛡️ **Resistência:** \`${charDoc.infinito ? '♾️ Infinito' : formatForceOrResistance(charDoc.resistenciaKgf)}\`\n` +
                `• 💨 **Velocidade:** \`${charDoc.infinito ? '♾️ Infinito' : formatSpeed(charDoc.velocidadeKmh)}\`\n` +
                `• 💧 **Mana:** \`${charDoc.infinito ? '♾️ Infinito' : formatMana(charDoc.mana)}\``
            )
            .setFooter({ text: `${SYSTEM_NAME} • Passo ${newStar.passo}/54` })
            .setTimestamp();

        return interaction.editReply({
            content: null,
            embeds: [confirmEmbed],
            components: []
        }).catch(() => {});
    }

    if (customId.startsWith('genesis_panel_')) {
        const genesisCmd = client.commands.get('genesis');
        if (genesisCmd && typeof genesisCmd.handlePanelInteraction === 'function') {
            return genesisCmd.handlePanelInteraction(interaction, client);
        }
    }
}

/**
 * Soma e salva os valores de status e Cristais do Tempo aprovados pelo Dono/Dev para o personagem.
 * Caso o personagem atinja condições para evoluir de Estrela, dispara automaticamente a proposta no PV!
 */
async function aplicarSomaStatusV2(client, {
    userId,
    personagem,
    upgradeId,
    upgradeIndex,
    nomeUpgrade,
    addedForcaKgf = 0,
    addedResistenciaKgf = 0,
    addedVelocidadeKmh = 0,
    addedMana = 0,
    addedCristais = 0,
    avaliadoPor,
    feedbackPublico = '',
    dispararCheckEvolucao = true
}) {
    const persName = personagem || 'Não informado';
    const persNorm = normalizeStr(persName);

    let charDoc = await client.database.CharacterStatusV2.findOne({
        userId,
        personagemNormalized: persNorm
    });

    if (!charDoc) {
        charDoc = new client.database.CharacterStatusV2({
            userId,
            personagem: persName,
            personagemNormalized: persNorm,
            forcaKgf: 0,
            resistenciaKgf: 0,
            velocidadeKmh: 0,
            mana: 0,
            cristais: 0,
            cristaisGastosTotal: 0,
            estrelaPasso: 1,
            multiplicadorPoder: 100,
            historicoUpgrades: []
        });
    }

    charDoc.forcaKgf = (charDoc.forcaKgf || 0) + (Number(addedForcaKgf) || 0);
    charDoc.resistenciaKgf = (charDoc.resistenciaKgf || 0) + (Number(addedResistenciaKgf) || 0);
    charDoc.velocidadeKmh = (charDoc.velocidadeKmh || 0) + (Number(addedVelocidadeKmh) || 0);
    charDoc.mana = (charDoc.mana || 0) + (Number(addedMana) || 0);
    charDoc.cristais = (charDoc.cristais || 0) + (Number(addedCristais) || 0);
    charDoc.updatedAt = new Date();

    charDoc.historicoUpgrades.push({
        upgradeId: String(upgradeId || 'manual'),
        upgradeIndex: Number(upgradeIndex) || 0,
        nomeUpgrade: nomeUpgrade || 'Upgrade de Status',
        addedForcaKgf: Number(addedForcaKgf) || 0,
        addedResistenciaKgf: Number(addedResistenciaKgf) || 0,
        addedVelocidadeKmh: Number(addedVelocidadeKmh) || 0,
        addedMana: Number(addedMana) || 0,
        addedCristais: Number(addedCristais) || 0,
        tipoRegistro: 'upgrade',
        feedbackPublico,
        avaliadoPor,
        data: new Date()
    });

    await charDoc.save();

    if (client.database.SilentStatusCapture && upgradeId && upgradeId !== 'manual') {
        await client.database.SilentStatusCapture.findOneAndUpdate(
            { upgradeId: String(upgradeId), upgradeIndex: Number(upgradeIndex) },
            {
                $set: {
                    userId,
                    personagem: persName,
                    valoresAprovadosDev: {
                        forcaKgf: Number(addedForcaKgf) || 0,
                        resistenciaKgf: Number(addedResistenciaKgf) || 0,
                        velocidadeKmh: Number(addedVelocidadeKmh) || 0,
                        mana: Number(addedMana) || 0,
                        cristais: Number(addedCristais) || 0,
                        avaliadoPor,
                        avaliadoEm: new Date()
                    },
                    status: 'confirmado_dev'
                }
            },
            { upsert: true }
        ).catch(() => {});
    }

    // Verifica automaticamente se os novos ganhos permitem evoluir de Estrela e envia mensagem no PV
    let evoResult = null;
    if (dispararCheckEvolucao) {
        const analise = calcularOpcoesEvolucao(charDoc);
        if (analise.podeEvoluir) {
            evoResult = await enviarPropostaEvolucaoPV(client, charDoc);
        }
    }

    return { charDoc, evoResult };
}

/**
 * Constrói o Modal exclusivo do Dono/Dev para avaliação de upgrades de status e Cristais do Tempo.
 */
function buildStatusV2Modal(upgDoc, upgIndex, escopo, captureDoc = null) {
    const upg = upgDoc.upgrades[upgIndex] || {};
    const sug = captureDoc?.valoresSugeridosIA || extractSuggestedStatusValues(upg);
    const attrs = detectAttributesInUpgrade(upg);
    const isCrystalFocused = attrs.includes('cristais') || Boolean(upg.autoGeneratedCrystal);

    const modal = new ModalBuilder()
        .setCustomId(`upgrade_adm_modal_statusv2_${escopo}_${upgDoc._id}_${upgIndex}`)
        .setTitle(`🧬 Genesis V2: ${(upgDoc.personagem || 'Personagem').substring(0, 24)}`);

    const forcaInput = new TextInputBuilder()
        .setCustomId('statusv2_forca')
        .setLabel('Força ganha (kgf ou Tf | >=1000kgf -> Tf)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 500 kgf, 1.5 Tf (Deixe 0 se não houver)')
        .setValue(sug.forcaKgf ? formatForceOrResistance(sug.forcaKgf) : '0')
        .setRequired(false);

    const resistenciaInput = new TextInputBuilder()
        .setCustomId('statusv2_resistencia')
        .setLabel('Resistência ganha (kgf ou Tf | >=1000 -> Tf)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 300 kgf, 2 Tf (Deixe 0 se não houver)')
        .setValue(sug.resistenciaKgf ? formatForceOrResistance(sug.resistenciaKgf) : '0')
        .setRequired(false);

    const velocidadeInput = new TextInputBuilder()
        .setCustomId('statusv2_velocidade')
        .setLabel('Velocidade ganha (em km/h)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 80 km/h (Deixe 0 se não houver)')
        .setValue(sug.velocidadeKmh ? `${sug.velocidadeKmh} km/h` : '0')
        .setRequired(false);

    const manaAndCrystalsDefault = isCrystalFocused
        ? `0 | ${sug.cristais || 0}`
        : `${sug.mana || 0} | ${sug.cristais || 0}`;

    const manaCristaisInput = new TextInputBuilder()
        .setCustomId('statusv2_mana_cristais')
        .setLabel('Mana | Cristais do Tempo (Separe por | )')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Formato: Mana | Cristais (Ex: 150 | 20 ou apenas 0 | 20)')
        .setValue(manaAndCrystalsDefault)
        .setRequired(false);

    const feedbackInput = new TextInputBuilder()
        .setCustomId('upgrade_adm_modal_accept_input_motif')
        .setLabel('Resultado / Feedback Público p/ Jogador')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Descreva o ganho visível para o jogador ou digite "Aprovado"')
        .setValue('Aprovado')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(forcaInput),
        new ActionRowBuilder().addComponents(resistenciaInput),
        new ActionRowBuilder().addComponents(velocidadeInput),
        new ActionRowBuilder().addComponents(manaCristaisInput),
        new ActionRowBuilder().addComponents(feedbackInput)
    );

    return modal;
}

/**
 * Extrai Mana e Cristais do campo combinado "Mana | Cristais" do Modal.
 */
function parseManaAndCristaisField(rawField, isCrystalOnlyUpgrade = false) {
    if (!rawField) return { mana: 0, cristais: 0 };
    const str = String(rawField).trim();
    if (str.includes('|') || str.includes('/')) {
        const parts = str.split(/[|/]/);
        return {
            mana: parseMana(parts[0]),
            cristais: parseCristais(parts[1])
        };
    }
    if (isCrystalOnlyUpgrade || /crista/i.test(str)) {
        return { mana: 0, cristais: parseCristais(str) };
    }
    return { mana: parseMana(str), cristais: 0 };
}

/**
 * Formata um bloco de texto resumindo o Status V2 atual do personagem e sua Estrela para exibição ao Dev.
 */
function formatCharacterStatusV2Summary(charStatus, captureDoc = null, upg = null) {
    const sug = captureDoc?.valoresSugeridosIA || (upg ? extractSuggestedStatusValues(upg) : null);
    const attrs = captureDoc?.atributosDetectados || (upg ? detectAttributesInUpgrade(upg) : []);
    const star = getStarByStep(charStatus?.estrelaPasso || 1);

    let text = `**Atributos Detectados:** \`${attrs.length > 0 ? attrs.join(', ').toUpperCase() : 'Manual'}\`\n`;
    if (sug && (sug.forcaKgf || sug.resistenciaKgf || sug.velocidadeKmh || sug.mana || sug.cristais)) {
        const parts = [];
        if (sug.forcaKgf) parts.push(`Força: \`+${formatForceOrResistance(sug.forcaKgf)}\``);
        if (sug.resistenciaKgf) parts.push(`Resistência: \`+${formatForceOrResistance(sug.resistenciaKgf)}\``);
        if (sug.velocidadeKmh) parts.push(`Velocidade: \`+${formatSpeed(sug.velocidadeKmh)}\``);
        if (sug.mana) parts.push(`Mana: \`+${formatMana(sug.mana)}\``);
        if (sug.cristais) parts.push(`Cristais: \`+${sug.cristais} 💎\``);
        text += `**Sugestão Extraída da IA:** ${parts.join(' • ')}\n`;
    }

    text += `\n🌟 **Estrela Atual:** ${star.emoji} **${star.nomeEstrela}** (*${star.grupo}* — Passo ${star.passo}/54 | Mult: \`${star.multiplicador === Infinity ? '♾️' : star.multiplicador + '%'}\`)\n`;
    text += `📊 **Status Acumulado Atual (${charStatus?.personagem || 'Novo Registro'}):**\n`;
    text += `• 💪 **Força:** \`${formatForceOrResistance(charStatus?.forcaKgf || 0)}\`  •  🛡️ **Resistência:** \`${formatForceOrResistance(charStatus?.resistenciaKgf || 0)}\`\n`;
    text += `• ⚡ **Velocidade:** \`${formatSpeed(charStatus?.velocidadeKmh || 0)}\`  •  💧 **Mana:** \`${formatMana(charStatus?.mana || 0)}\`\n`;
    text += `• 💎 **Cristais do Tempo:** \`${charStatus?.cristais || 0} Cristais\` (Gastos: \`${charStatus?.cristaisGastosTotal || 0}\`)`;

    return text;
}

module.exports = {
    SYSTEM_NAME,
    DEV_OWNER_ID,
    STAR_TABLE,
    getStarByStep,
    findHighestStarByStatsOnly,
    normalizeStr,
    parseForceOrResistanceToKgf,
    formatForceOrResistance,
    parseSpeedToKmh,
    formatSpeed,
    parseMana,
    parseCristais,
    formatMana,
    parseManaAndCristaisField,
    detectAttributesInUpgrade,
    isStatusUpgrade,
    garantirUpgradeCristaisNoFinal,
    extractSuggestedStatusValues,
    capturaSilenciosaStatus,
    isGenesisTestMode,
    obterStatusPersonagemV2,
    obterCapturaSilenciosa,
    calcularOpcoesEvolucao,
    enviarPropostaEvolucaoPV,
    efetivarEvolucaoEstrela,
    handleGenesisInteraction,
    aplicarSomaStatusV2,
    buildStatusV2Modal,
    formatCharacterStatusV2Summary
};
