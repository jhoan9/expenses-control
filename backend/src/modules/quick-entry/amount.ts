/**
 * Extracción de montos escritos en español (Colombia).
 *
 * Soporta: "45000", "45.000", "$45.000", "45 mil", "45k", "30 lucas",
 * "1,2 millones", "1.5M", "2 palos", "un millón", "1 millón 200 mil",
 * "medio millón". Devuelve el monto y el fragmento del texto que lo contiene,
 * para poder quitarlo de la descripción.
 */

export interface AmountMatch {
  amount: number;
  start: number;
  end: number;
}

const MULTIPLIERS: Record<string, number> = {
  millones: 1_000_000,
  millon: 1_000_000,
  palos: 1_000_000,
  palo: 1_000_000,
  m: 1_000_000,
  mm: 1_000_000,
  mil: 1_000,
  lucas: 1_000,
  luca: 1_000,
  k: 1_000,
};

const WORD_NUMBERS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  medio: 0.5,
  media: 0.5,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  veinte: 20,
  cincuenta: 50,
  cien: 100,
};

/**
 * Convierte "45.000", "1,2", "1.200.000", "45,50" en número.
 * Un separador seguido de grupos de exactamente 3 dígitos se toma como miles;
 * en otro caso, como decimal.
 */
export const parseNumberString = (raw: string, hasMultiplier = false): number => {
  const s = raw.trim();
  if (/^\d+$/.test(s)) return Number(s);

  const thousandsDot = /^\d{1,3}(\.\d{3})+$/;
  const thousandsComma = /^\d{1,3}(,\d{3})+$/;
  // Con multiplicador ("1.500 millones" es raro; "1,5 millones" es común) un
  // único separador seguido de 3 dígitos sigue siendo miles: "1.500 mil" = 1.500.000.
  if (thousandsDot.test(s)) return Number(s.replace(/\./g, ''));
  if (thousandsComma.test(s) && !hasMultiplier) return Number(s.replace(/,/g, ''));
  if (thousandsComma.test(s) && hasMultiplier) {
    // "1,500 millones" → ambiguo; lo tratamos como miles igual que el punto.
    return Number(s.replace(/,/g, ''));
  }

  // Formato mixto "1.234,56" (miles con punto, decimales con coma)
  const mixed = /^(\d{1,3}(?:\.\d{3})+),(\d{1,2})$/.exec(s);
  if (mixed) return Number(mixed[1].replace(/\./g, '') + '.' + mixed[2]);
  const mixedUs = /^(\d{1,3}(?:,\d{3})+)\.(\d{1,2})$/.exec(s);
  if (mixedUs) return Number(mixedUs[1].replace(/,/g, '') + '.' + mixedUs[2]);

  // Decimal simple: "1,2" o "1.5"
  return Number(s.replace(',', '.'));
};

const NUMBER = String.raw`\d+(?:[.,]\d+)*`;
const WORD = Object.keys(WORD_NUMBERS).join('|');
const MULT = String.raw`millones|millon|palos?|mil|lucas?|mm|m|k`;

// número (o palabra numérica) + multiplicador opcional, con "$" opcional antes
const TOKEN = new RegExp(
  String.raw`(\$\s*)?(?:(${NUMBER})|\b(${WORD})\b)\s*(?:(${MULT})\b)?`,
  'gi'
);

// Continuación de un monto en millones: "1 millón 200 mil", "2 palos y medio"
const CONTINUATION = new RegExp(
  String.raw`^\s*(?:y\s+)?(?:(${NUMBER})\s*(mil|lucas?|k)?\b|(medio)\b)`,
  'i'
);

interface Candidate extends AmountMatch {
  score: number;
}

/**
 * Busca el monto más probable dentro de un texto ya normalizado
 * (minúsculas, sin tildes). Prefiere montos con "$" o multiplicador.
 */
export const extractAmount = (text: string): AmountMatch | null => {
  const candidates: Candidate[] = [];
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = TOKEN.exec(text)) !== null) {
    const [full, dollar, digits, word, multRaw] = m;
    if (!digits && !word) continue;
    // Palabras numéricas solo cuentan con multiplicador ("un millón", "dos palos")
    if (word && !multRaw) continue;

    const mult = multRaw ? MULTIPLIERS[multRaw.toLowerCase()] : 1;
    const base = digits
      ? parseNumberString(digits, Boolean(multRaw))
      : WORD_NUMBERS[word.toLowerCase()];
    if (!Number.isFinite(base)) continue;

    let amount = base * mult;
    let end = m.index + full.length;

    if (mult === 1_000_000) {
      const rest = text.slice(end);
      const c = CONTINUATION.exec(rest);
      if (c) {
        if (c[3]) {
          amount += 500_000;
        } else if (c[1]) {
          const n = parseNumberString(c[1]);
          // "1 millón 200 mil" o "1 millón 200" (se entiende en miles)
          amount += c[2] || n < 1000 ? n * 1000 : n;
        }
        end += c[0].length;
      }
    }

    let score = 0;
    if (dollar) score += 3;
    if (multRaw) score += 3;
    if (digits && digits.replace(/\D/g, '').length >= 4) score += 1;

    candidates.push({ amount, start: m.index, end, score });
  }

  const valid = candidates.filter((c) => c.amount > 0);
  if (!valid.length) return null;
  valid.sort((a, b) => b.score - a.score || a.start - b.start);
  const best = valid[0];
  return { amount: Math.round(best.amount * 100) / 100, start: best.start, end: best.end };
};
