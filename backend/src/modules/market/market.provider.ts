import { env } from '../../config/env';
import { AppError } from '../../shared/errors/AppError';
import { Candle } from './indicators';

/**
 * Proveedores de datos de mercado. Se elige con MARKET_DATA_PROVIDER:
 *  - yahoo (por defecto, sin clave; API no oficial, puede limitar o cambiar)
 *  - twelvedata (TWELVE_DATA_API_KEY; plan gratis ~800 créditos/día)
 *  - alphavantage (ALPHA_VANTAGE_API_KEY; plan gratis ~25 llamadas/día, 100 sesiones)
 * Si el elegido no tiene clave, se usa yahoo.
 */

export interface Series {
  symbol: string;
  name: string | null;
  currency: string | null;
  exchange: string | null;
  type: string | null;
  provider: string;
  candles: Candle[];
}

export interface SymbolMatch {
  symbol: string;
  name: string;
  exchange: string | null;
  type: string | null;
  currency?: string | null;
}

export type Range = '3mo' | '6mo' | '1y' | '2y' | '5y';
const RANGE_SESSIONS: Record<Range, number> = { '3mo': 63, '6mo': 126, '1y': 252, '2y': 504, '5y': 1260 };

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

const cached = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return value;
};

/** Solo para pruebas */
export const _clearMarketCache = () => cache.clear();

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export const marketHttp: { fetch: Fetcher } = { fetch: (url, init) => fetch(url, init) };

const getJson = async (url: string): Promise<any> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await marketHttp.fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Controla/1.0)', Accept: 'application/json' },
    });
    if (res.status === 429) throw new AppError('El proveedor de datos de mercado limitó las consultas. Intenta en unos minutos.', 429);
    const data = await res.json().catch(() => null);
    if (!res.ok && !data) throw new AppError(`El proveedor de datos respondió ${res.status}.`, 502);
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('No pude conectarme al proveedor de datos de mercado.', 502);
  } finally {
    clearTimeout(timer);
  }
};

const cleanSymbol = (s: string) => {
  const sym = String(s ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9.\-^=/:]{1,20}$/.test(sym)) throw AppError.badRequest(`Símbolo inválido: "${s}".`);
  return sym;
};

// ---------------- Yahoo ----------------
export const parseYahooChart = (data: any, symbol: string): Series => {
  const r = data?.chart?.result?.[0];
  if (!r) {
    const msg = data?.chart?.error?.description;
    throw AppError.badRequest(msg ? `Yahoo: ${msg}` : `No encontré datos para "${symbol}".`);
  }
  const q = r.indicators?.quote?.[0] ?? {};
  const ts: number[] = r.timestamp ?? [];
  const candles: Candle[] = [];
  ts.forEach((t, i) => {
    const c = q.close?.[i];
    if (c == null || q.open?.[i] == null || q.high?.[i] == null || q.low?.[i] == null) return;
    candles.push({
      t: new Date(t * 1000).toISOString().slice(0, 10),
      o: q.open[i],
      h: q.high[i],
      l: q.low[i],
      c,
      v: q.volume?.[i] ?? 0,
    });
  });
  return {
    symbol: r.meta?.symbol ?? symbol,
    name: r.meta?.longName ?? r.meta?.shortName ?? null,
    currency: r.meta?.currency ?? null,
    exchange: r.meta?.fullExchangeName ?? r.meta?.exchangeName ?? null,
    type: r.meta?.instrumentType ?? null,
    provider: 'yahoo',
    candles,
  };
};

const yahoo = {
  async history(symbol: string, range: Range): Promise<Series> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false`;
    return parseYahooChart(await getJson(url), symbol);
  },
  async search(q: string): Promise<SymbolMatch[]> {
    const data = await getJson(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`);
    return (data?.quotes ?? [])
      .filter((x: any) => x.symbol)
      .map((x: any) => ({ symbol: x.symbol, name: x.longname ?? x.shortname ?? x.symbol, exchange: x.exchDisp ?? x.exchange ?? null, type: x.quoteType ?? null }));
  },
  fxSymbol: (from: string, to: string) => `${from}${to}=X`,
};

// ---------------- Twelve Data ----------------
export const parseTwelveData = (data: any, symbol: string): Series => {
  if (data?.status === 'error' || !Array.isArray(data?.values)) {
    throw AppError.badRequest(`Twelve Data: ${data?.message ?? `sin datos para "${symbol}"`}`);
  }
  const candles: Candle[] = data.values
    .map((v: any) => ({ t: String(v.datetime).slice(0, 10), o: +v.open, h: +v.high, l: +v.low, c: +v.close, v: +(v.volume ?? 0) }))
    .filter((c: Candle) => Number.isFinite(c.c))
    .reverse();
  return {
    symbol: data.meta?.symbol ?? symbol,
    name: null,
    currency: data.meta?.currency ?? null,
    exchange: data.meta?.exchange ?? null,
    type: data.meta?.type ?? null,
    provider: 'twelvedata',
    candles,
  };
};

const twelve = {
  async history(symbol: string, range: Range): Promise<Series> {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${Math.min(RANGE_SESSIONS[range] + 5, 5000)}&apikey=${encodeURIComponent(env.TWELVE_DATA_API_KEY)}`;
    return parseTwelveData(await getJson(url), symbol);
  },
  async search(q: string): Promise<SymbolMatch[]> {
    const data = await getJson(`https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&outputsize=8`);
    return (data?.data ?? []).map((x: any) => ({
      symbol: x.symbol, name: x.instrument_name, exchange: x.exchange ?? null, type: x.instrument_type ?? null, currency: x.currency ?? null,
    }));
  },
  fxSymbol: (from: string, to: string) => `${from}/${to}`,
};

// ---------------- Alpha Vantage ----------------
export const parseAlphaVantage = (data: any, symbol: string): Series => {
  const series = data?.['Time Series (Daily)'];
  if (!series) {
    const msg = data?.['Error Message'] ?? data?.Note ?? data?.Information;
    throw AppError.badRequest(`Alpha Vantage: ${msg ?? `sin datos para "${symbol}"`}`);
  }
  const candles: Candle[] = Object.entries<any>(series)
    .map(([t, v]) => ({ t, o: +v['1. open'], h: +v['2. high'], l: +v['3. low'], c: +v['4. close'], v: +v['5. volume'] }))
    .sort((a, b) => a.t.localeCompare(b.t));
  return { symbol, name: null, currency: null, exchange: null, type: null, provider: 'alphavantage', candles };
};

const alpha = {
  async history(symbol: string): Promise<Series> {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${encodeURIComponent(env.ALPHA_VANTAGE_API_KEY)}`;
    return parseAlphaVantage(await getJson(url), symbol);
  },
  async search(q: string): Promise<SymbolMatch[]> {
    const data = await getJson(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(q)}&apikey=${encodeURIComponent(env.ALPHA_VANTAGE_API_KEY)}`);
    return (data?.bestMatches ?? []).map((x: any) => ({
      symbol: x['1. symbol'], name: x['2. name'], exchange: x['4. region'] ?? null, type: x['3. type'] ?? null, currency: x['8. currency'] ?? null,
    }));
  },
  fxSymbol: () => null,
};

const pick = () => {
  if (env.MARKET_DATA_PROVIDER === 'twelvedata' && env.TWELVE_DATA_API_KEY) return { name: 'twelvedata', p: twelve };
  if (env.MARKET_DATA_PROVIDER === 'alphavantage' && env.ALPHA_VANTAGE_API_KEY) return { name: 'alphavantage', p: alpha };
  return { name: 'yahoo', p: yahoo };
};

export const marketData = {
  get providerName(): string {
    return pick().name;
  },

  async history(symbol: string, range: Range = '1y'): Promise<Series> {
    const sym = cleanSymbol(symbol);
    const { name, p } = pick();
    const series = await cached(`h:${name}:${sym}:${range}`, () => p.history(sym, range));
    if (!series.candles.length) throw AppError.badRequest(`No hay historial disponible para "${sym}".`);
    return { ...series, candles: series.candles.slice(-RANGE_SESSIONS[range]) };
  },

  async search(q: string): Promise<SymbolMatch[]> {
    const term = String(q ?? '').trim().slice(0, 60);
    if (!term) throw AppError.badRequest('Indica el nombre de la empresa o el símbolo a buscar.');
    const { name, p } = pick();
    return cached(`s:${name}:${term.toLowerCase()}`, () => p.search(term));
  },

  /** Tasa de cambio (1 unidad de `from` en `to`), o null si no se pudo obtener. */
  async fxRate(from: string, to: string): Promise<number | null> {
    if (!from || !to || from === to) return 1;
    const { name, p } = pick();
    const sym = p.fxSymbol(from, to);
    if (!sym) return null;
    try {
      const s = await cached(`fx:${name}:${sym}`, () => p.history(sym, '3mo'));
      return s.candles.length ? s.candles[s.candles.length - 1].c : null;
    } catch {
      return null;
    }
  },
};
