import { env } from '../../config/env';
import { chatCompletion } from '../ai/llm.client';
import { Draft, EntryKind, ParserContext } from './parser';

/**
 * Respaldo con IA: solo se usa cuando el parser por reglas no logró determinar
 * el tipo, el monto o la categoría, y si hay una clave de IA configurada.
 * La IA solo puede elegir ids de las listas que se le dan; todo lo demás se descarta.
 */
export const aiAvailable = (): boolean => Boolean(env.AI_API_KEY);

const SYSTEM = `Eres un extractor de datos para una app de finanzas personales en Colombia (moneda COP).
Recibes un mensaje corto de un usuario que quiere registrar un gasto o un ingreso.
Responde SOLO con un objeto JSON, sin texto adicional ni bloques de código, con esta forma:
{"kind":"expense"|"income"|null,"amount":number|null,"account_id":number|null,"category_id":number|null,"subcategory_id":number|null,"date":"YYYY-MM-DD"|null,"description":string}
Reglas:
- "mil" = 1.000, "lucas" = 1.000, "palo"/"millón" = 1.000.000. Los puntos son separadores de miles.
- Usa únicamente ids que aparezcan en las listas. Si no estás seguro, usa null.
- description: 2 a 6 palabras que describan el movimiento, sin el monto ni la fecha.
- Si el mensaje no es un gasto ni un ingreso, devuelve kind null y amount null.`;

export const aiParse = async (text: string, ctx: ParserContext): Promise<Partial<Draft> | null> => {
  if (!aiAvailable()) return null;

  const lists = {
    hoy: ctx.today,
    cuentas: ctx.accounts.map((a) => ({ id: a.id, nombre: a.name, tipo: a.type })),
    categorias: ctx.categories.map((c) => ({
      id: c.id,
      nombre: c.name,
      tipo: c.type,
      subcategorias: (c.subcategories ?? []).map((s) => ({ id: s.id, nombre: s.name })),
    })),
  };

  let raw: string;
  try {
    raw = await chatCompletion(
      SYSTEM,
      [{ role: 'user', text: `Datos del usuario: ${JSON.stringify(lists)}\n\nMensaje: ${text.slice(0, 500)}` }],
      0
    );
  } catch {
    return null; // la IA es opcional: si falla, seguimos con lo que dio el parser
  }

  const json = /\{[\s\S]*\}/.exec(raw);
  if (!json) return null;

  let data: any;
  try {
    data = JSON.parse(json[0]);
  } catch {
    return null;
  }

  const accountIds = new Set(ctx.accounts.map((a) => a.id));
  const category = ctx.categories.find((c) => c.id === Number(data.category_id));
  const subIds = new Set((category?.subcategories ?? []).map((s) => s.id));
  const kind: EntryKind | null = data.kind === 'expense' || data.kind === 'income' ? data.kind : null;
  const amount = Number(data.amount);

  return {
    kind,
    amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null,
    account_id: accountIds.has(Number(data.account_id)) ? Number(data.account_id) : null,
    category_id: category ? category.id : null,
    subcategory_id: category && subIds.has(Number(data.subcategory_id)) ? Number(data.subcategory_id) : null,
    date: typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) && data.date <= ctx.today ? data.date : undefined,
    description: typeof data.description === 'string' ? data.description.slice(0, 200) : undefined,
  };
};
