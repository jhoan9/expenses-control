import { extractAmount } from './amount';

/**
 * Parser por reglas para mensajes cortos como
 *   "gasté 45 mil en mercado con nequi"
 *   "me pagaron 1,2 millones de freelance"
 *   "uber 18.500 ayer"
 * No depende de la base de datos ni de la IA: recibe las cuentas y categorías
 * del usuario y devuelve un borrador. Es determinista y se puede probar.
 */

export type EntryKind = 'expense' | 'income';

export interface ParserAccount {
  id: number;
  name: string;
  type: string;
}

export interface ParserCategory {
  id: number;
  name: string;
  type: 'expense' | 'income' | 'both';
  subcategories?: { id: number; name: string }[];
}

export interface ParserContext {
  accounts: ParserAccount[];
  categories: ParserCategory[];
  /** Fecha local de hoy en formato YYYY-MM-DD */
  today: string;
}

export interface Draft {
  kind: EntryKind | null;
  amount: number | null;
  account_id: number | null;
  category_id: number | null;
  subcategory_id: number | null;
  description: string;
  date: string;
}

export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ¿Aparece la frase completa como palabra(s) dentro del texto? Acepta plural simple. */
const containsPhrase = (text: string, phrase: string): boolean => {
  const p = normalize(phrase);
  if (p.length < 3) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRe(p)}(e?s)?($|[^a-z0-9])`).test(text);
};

const INCOME_HINTS = [
  'recibi', 'me pagaron', 'me pago', 'me consignaron', 'me consigno', 'me transfirieron',
  'me transfirio', 'me giraron', 'me entro', 'me llego', 'ingreso', 'cobre', 'gane',
  'entraron', 'entro', 'salario', 'sueldo', 'nomina', 'quincena', 'prima', 'reembolso',
  'me devolvieron', 'venta', 'vendi',
  // notificaciones bancarias
  'recibiste', 'te consignaron', 'te enviaron', 'te transfirieron', 'abono a tu cuenta', 'deposito',
];

const EXPENSE_HINTS = [
  'gaste', 'gasto', 'pague', 'pago', 'compre', 'compra', 'egreso', 'salio', 'costo',
  'me cobraron', 'pedi', 'tanquee', 'recargue', 'recarga', 'transferi', 'di ',
  // notificaciones bancarias
  'compraste', 'pagaste', 'retiraste', 'transferiste', 'enviaste', 'compra aprobada', 'pago exitoso',
  'retiro', 'debito',
];

/**
 * Sinónimos frecuentes → nombres de categoría habituales. Solo se usan si el
 * usuario tiene una categoría con alguno de esos nombres.
 */
export const CATEGORY_SYNONYMS: { words: string[]; categories: string[] }[] = [
  {
    words: ['uber', 'didi', 'taxi', 'bus', 'buseta', 'metro', 'transmilenio', 'tullave', 'sitp', 'pasaje', 'peaje', 'gasolina', 'tanquee', 'parqueadero', 'indriver', 'cabify', 'moto'],
    categories: ['transporte', 'movilidad', 'gasolina', 'carro', 'vehiculo'],
  },
  {
    words: ['almuerzo', 'desayuno', 'cena', 'comida', 'restaurante', 'domicilio', 'rappi', 'ifood', 'pizza', 'hamburguesa', 'corrientazo', 'cafe', 'onces'],
    categories: ['restaurantes', 'restaurante', 'comida', 'alimentacion', 'comidas'],
  },
  {
    words: ['mercado', 'supermercado', 'exito', 'carulla', 'd1', 'ara', 'olimpica', 'jumbo', 'tienda', 'plaza', 'pan', 'panaderia', 'fruta', 'frutas', 'verduras', 'carne', 'huevos', 'leche'],
    categories: ['mercado', 'supermercado', 'alimentacion', 'hogar'],
  },
  {
    words: ['arriendo', 'arrendamiento', 'alquiler', 'administracion', 'hipoteca'],
    categories: ['vivienda', 'arriendo', 'hogar', 'casa'],
  },
  {
    words: ['luz', 'energia', 'agua', 'gas', 'internet', 'celular', 'plan', 'telefono', 'claro', 'movistar', 'tigo', 'epm', 'codensa', 'enel'],
    categories: ['servicios', 'servicios publicos', 'hogar'],
  },
  {
    words: ['netflix', 'spotify', 'disney', 'hbo', 'max', 'prime', 'youtube', 'cine', 'concierto', 'fiesta', 'rumba', 'salida', 'juego'],
    categories: ['ocio', 'entretenimiento', 'suscripciones', 'diversion'],
  },
  {
    words: ['medico', 'medicina', 'farmacia', 'drogueria', 'eps', 'odontologo', 'odontologia', 'cita', 'examen', 'gimnasio', 'gym'],
    categories: ['salud', 'bienestar'],
  },
  {
    words: ['colegio', 'universidad', 'curso', 'matricula', 'libro', 'libros', 'semestre'],
    categories: ['educacion', 'estudio'],
  },
  {
    words: ['salario', 'sueldo', 'nomina', 'quincena', 'prima'],
    categories: ['salario', 'sueldo', 'nomina'],
  },
  {
    words: ['freelance', 'proyecto', 'cliente', 'honorarios'],
    categories: ['freelance', 'honorarios', 'independiente'],
  },
];

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

const addDays = (isoDate: string, days: number): string => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

interface DateMatch {
  date: string;
  start: number;
  end: number;
}

/** Fechas relativas y explícitas: hoy, ayer, antier, "el 15", "15 de noviembre", "15/11". */
export const extractDate = (text: string, today: string): DateMatch | null => {
  const rel: [RegExp, number][] = [
    [/\b(anteayer|antier|antes de ayer)\b/, -2],
    [/\bayer\b/, -1],
    [/\bhoy\b/, 0],
  ];
  for (const [re, offset] of rel) {
    const m = re.exec(text);
    if (m) return { date: addDays(today, offset), start: m.index, end: m.index + m[0].length };
  }

  const [ty, tm] = today.split('-').map(Number);
  const build = (day: number, month: number | null): string | null => {
    let year = ty;
    let mon = month ?? tm;
    if (day < 1 || day > 31 || mon < 1 || mon > 12) return null;
    let iso = `${year}-${pad(mon)}-${pad(day)}`;
    // Una fecha "futura" sin año se entiende como del mes/año anterior
    if (iso > today) {
      if (month === null) {
        mon -= 1;
        if (mon === 0) { mon = 12; year -= 1; }
      } else {
        year -= 1;
      }
      iso = `${year}-${pad(mon)}-${pad(day)}`;
    }
    const check = new Date(`${iso}T12:00:00Z`);
    return check.getUTCDate() === day ? iso : null;
  };

  const named = new RegExp(`\\b(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${Object.keys(MONTHS).join('|')})\\b`).exec(text);
  if (named) {
    const iso = build(Number(named[1]), MONTHS[named[2]]);
    if (iso) return { date: iso, start: named.index, end: named.index + named[0].length };
  }

  const slash = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/.exec(text);
  if (slash) {
    const iso = build(Number(slash[1]), Number(slash[2]));
    if (iso) return { date: iso, start: slash.index, end: slash.index + slash[0].length };
  }

  const dayOnly = /\bel\s+(\d{1,2})\b(?!\s*(?:mil|millon|millones|k|lucas?|palos?))/.exec(text);
  if (dayOnly) {
    const iso = build(Number(dayOnly[1]), null);
    if (iso) return { date: iso, start: dayOnly.index, end: dayOnly.index + dayOnly[0].length };
  }

  return null;
};

export const detectKind = (text: string): EntryKind | null => {
  const t = ` ${text} `;
  if (/^\s*\+/.test(text)) return 'income';
  if (/^\s*-/.test(text)) return 'expense';
  const hit = (words: string[]) =>
    words.some((w) => new RegExp(`(^|[^a-z])${escapeRe(w.trim())}([^a-z]|$)`).test(t));
  const income = hit(INCOME_HINTS);
  const expense = hit(EXPENSE_HINTS);
  if (income && !expense) return 'income';
  if (expense && !income) return 'expense';
  // "me pagaron" contiene "pago": la frase de ingreso es más específica
  if (income && expense && /\bme (pagaron|pago|consignaron|transfirieron|giraron)\b/.test(text)) {
    return 'income';
  }
  return null;
};

/** Posición de la mención de la cuenta (con su preposición) para quitarla de la descripción. */
const accountPhraseRange = (text: string, acc: ParserAccount): [number, number] | null => {
  const name = normalize(acc.name);
  const options = [name, ...name.split(' ').filter((w) => w.length >= 4)];
  if (acc.type === 'cash') options.push('efectivo');
  if (acc.type === 'credit_card') options.push('tarjeta de credito', 'tarjeta', 'tc');
  for (const o of options.sort((a, b) => b.length - a.length)) {
    const re = new RegExp(
      `(?:^|\\s)((?:(?:con|en|de|desde|por|a)\\s+)?(?:(?:la|mi|el)\\s+)?(?:(?:cuenta|tarjeta)\\s+(?:de\\s+)?)?${escapeRe(o)}(?:e?s)?)(?=$|[^a-z0-9])`
    );
    const m = re.exec(text);
    if (m) {
      const start = m.index + m[0].length - m[1].length;
      return [start, start + m[1].length];
    }
  }
  return null;
};

export const matchAccount = (text: string, accounts: ParserAccount[]): ParserAccount | null => {
  let best: { acc: ParserAccount; len: number } | null = null;
  for (const acc of accounts) {
    const name = normalize(acc.name);
    const candidates = [name, ...name.split(' ').filter((w) => w.length >= 4)];
    for (const c of candidates) {
      if (containsPhrase(text, c) && (!best || c.length > best.len)) {
        best = { acc, len: c.length };
      }
    }
  }
  if (best) return best.acc;

  // Por tipo: "en efectivo", "con la tarjeta" (solo si hay una sola de ese tipo)
  const byType = (type: string) => {
    const list = accounts.filter((a) => a.type === type);
    return list.length === 1 ? list[0] : null;
  };
  if (/\befectivo\b/.test(text)) return byType('cash');
  if (/\b(tarjeta|tc|credito)\b/.test(text)) return byType('credit_card');
  return null;
};

interface CategoryMatch {
  category: ParserCategory;
  subcategoryId: number | null;
}

export const matchCategory = (
  text: string,
  categories: ParserCategory[],
  kind: EntryKind | null
): CategoryMatch | null => {
  const allowed = categories.filter(
    (c) => !kind || c.type === 'both' || c.type === kind
  );

  // 1) Subcategoría por nombre (más específica)
  let best: { m: CategoryMatch; len: number } | null = null;
  for (const cat of allowed) {
    for (const sub of cat.subcategories ?? []) {
      const n = normalize(sub.name);
      if (containsPhrase(text, n) && (!best || n.length > best.len)) {
        best = { m: { category: cat, subcategoryId: sub.id }, len: n.length };
      }
    }
  }
  // 2) Categoría por nombre
  for (const cat of allowed) {
    const n = normalize(cat.name);
    if (containsPhrase(text, n) && (!best || n.length > best.len)) {
      best = { m: { category: cat, subcategoryId: null }, len: n.length };
    }
  }
  if (best) return best.m;

  // 3) Sinónimos → nombres de categoría habituales
  for (const group of CATEGORY_SYNONYMS) {
    if (!group.words.some((w) => containsPhrase(text, w))) continue;
    for (const wanted of group.categories) {
      const cat = allowed.find((c) => normalize(c.name) === wanted);
      if (cat) return { category: cat, subcategoryId: null };
    }
  }
  return null;
};

const FILLER = /^(?:(?:yo|hoy|ayer|me|le|les|se|un|una|el|la|los|las|de|del|en|por|para|con|y|a|al|que)\s+)+/;

const buildDescription = (original: string, removeRanges: [number, number][]): string => {
  // Quita monto y fecha usando las posiciones (UTF-16) del texto normalizado,
  // que tiene exactamente la misma longitud que el original.
  let out = original;
  for (const [s, e] of [...removeRanges].sort((a, b) => b[0] - a[0])) {
    out = out.slice(0, s) + ' ' + out.slice(e);
  }
  out = out.replace(/\s+/g, ' ').trim();
  // Quita el verbo inicial ("gasté", "pagué", "me pagaron") y relleno
  out = out.replace(
    /^(?:[+-]\s*)?(?:gast[eé]|pagu[eé]|compr[eé]|recib[ií]|cobr[eé]|gan[eé]|ped[ií]|me\s+(?:pagaron|pag[oó]|consignaron|transfirieron|giraron|lleg[oó]|entr[oó]|cobraron))(?=\s|$|[,.])\s*/i,
    ''
  );
  out = out.replace(/\$\s*$/, '').trim();
  const lower = normalize(out);
  const filler = FILLER.exec(lower);
  if (filler) out = out.slice(filler[0].length);
  out = out.replace(/^[,.;:\s-]+|[,.;:\s-]+$/g, '');
  if (!out) return '';
  return (out.charAt(0).toUpperCase() + out.slice(1)).slice(0, 200);
};

/** Normaliza conservando la longitud (para mapear posiciones al texto original). */
const normalizeSameLength = (s: string): string => {
  let out = '';
  // Recorre unidades UTF-16 para que las posiciones coincidan con el original.
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    out += base.length === 1 ? base : ch.toLowerCase().length === 1 ? ch.toLowerCase() : ch;
  }
  return out;
};

export const parseEntry = (input: string, ctx: ParserContext): Draft => {
  const original = input.trim().replace(/\s+/g, ' ');
  const text = normalizeSameLength(original);

  const remove: [number, number][] = [];

  const date = extractDate(text, ctx.today);
  let amountText = text;
  if (date) {
    remove.push([date.start, date.end]);
    // Evita que el día de la fecha se tome como monto
    amountText = text.slice(0, date.start) + ' '.repeat(date.end - date.start) + text.slice(date.end);
  }

  const amount = extractAmount(amountText);
  if (amount) remove.push([amount.start, amount.end]);

  let kind = detectKind(text);
  const category = matchCategory(text, ctx.categories, kind);
  if (!kind && category && category.category.type !== 'both') {
    kind = category.category.type;
  }
  const account = matchAccount(text, ctx.accounts);
  if (account) {
    const range = accountPhraseRange(text, account);
    if (range) remove.push(range);
  }

  return {
    kind,
    amount: amount ? amount.amount : null,
    account_id: account ? account.id : null,
    category_id: category ? category.category.id : null,
    subcategory_id: category ? category.subcategoryId : null,
    description: buildDescription(original, remove),
    date: date ? date.date : ctx.today,
  };
};
