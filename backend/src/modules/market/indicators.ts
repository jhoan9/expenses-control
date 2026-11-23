/**
 * Indicadores técnicos calculados localmente a partir de velas diarias (OHLCV).
 * No dependen del proveedor de datos: cualquier fuente que entregue velas sirve.
 */

export interface Candle {
  /** Fecha YYYY-MM-DD */
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

const round = (n: number | null, d = 2): number | null =>
  n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d;

const last = <T>(arr: T[]): T | undefined => arr[arr.length - 1];

export const sma = (values: number[], period: number): (number | null)[] => {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
};

export const ema = (values: number[], period: number): (number | null)[] => {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
};

/** RSI de Wilder. */
export const rsi = (closes: number[], period = 14): (number | null)[] => {
  const out: (number | null)[] = [null];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
      out.push(i === period ? (avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)) : null);
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      out.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
    }
  }
  return out;
};

export const macd = (closes: number[], fast = 12, slow = 26, signal = 9) => {
  const ef = ema(closes, fast);
  const es = ema(closes, slow);
  const line = closes.map((_, i) => (ef[i] != null && es[i] != null ? ef[i]! - es[i]! : null));
  const start = line.findIndex((v) => v != null);
  const sig = start < 0 ? line.map(() => null) : [...line.slice(0, start).map(() => null), ...ema(line.slice(start) as number[], signal)];
  const hist = line.map((v, i) => (v != null && sig[i] != null ? v - sig[i]! : null));
  return { line, signal: sig, hist };
};

export const bollinger = (closes: number[], period = 20, mult = 2) => {
  const mid = sma(closes, period);
  return mid.map((m, i) => {
    if (m == null) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    const sd = Math.sqrt(slice.reduce((a, x) => a + (x - m) ** 2, 0) / period);
    return { mid: m, upper: m + mult * sd, lower: m - mult * sd };
  });
};

/** Average True Range (Wilder). */
export const atr = (candles: Candle[], period = 14): (number | null)[] => {
  const tr = candles.map((c, i) =>
    i === 0 ? c.h - c.l : Math.max(c.h - c.l, Math.abs(c.h - candles[i - 1].c), Math.abs(c.l - candles[i - 1].c))
  );
  const out: (number | null)[] = [];
  let prev: number | null = null;
  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    prev = prev === null ? tr.slice(0, period).reduce((a, b) => a + b, 0) / period : (prev * (period - 1) + tr[i]) / period;
    out.push(prev);
  }
  return out;
};

export const maxDrawdown = (closes: number[]): number => {
  let peak = -Infinity;
  let mdd = 0;
  for (const c of closes) {
    peak = Math.max(peak, c);
    mdd = Math.min(mdd, (c - peak) / peak);
  }
  return mdd;
};

/** Volatilidad anualizada de retornos diarios logarítmicos. */
export const annualizedVolatility = (closes: number[]): number | null => {
  if (closes.length < 3) return null;
  const rets = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
};

/**
 * Soportes y resistencias: mínimos/máximos locales (pivotes de ventana `w`)
 * agrupados cuando están a menos de `tolerance` (fracción) entre sí.
 */
export const supportResistance = (candles: Candle[], w = 5, tolerance = 0.02) => {
  const price = last(candles)!.c;
  const pivots: { level: number; type: 'low' | 'high' }[] = [];
  for (let i = w; i < candles.length - w; i++) {
    const win = candles.slice(i - w, i + w + 1);
    if (candles[i].l === Math.min(...win.map((c) => c.l))) pivots.push({ level: candles[i].l, type: 'low' });
    if (candles[i].h === Math.max(...win.map((c) => c.h))) pivots.push({ level: candles[i].h, type: 'high' });
  }
  const clusters: { level: number; touches: number }[] = [];
  for (const p of pivots.sort((a, b) => a.level - b.level)) {
    const c = clusters.find((x) => Math.abs(x.level - p.level) / x.level < tolerance);
    if (c) {
      c.level = (c.level * c.touches + p.level) / (c.touches + 1);
      c.touches++;
    } else {
      clusters.push({ level: p.level, touches: 1 });
    }
  }
  const supports = clusters.filter((c) => c.level < price).sort((a, b) => b.level - a.level).slice(0, 3);
  const resistances = clusters.filter((c) => c.level > price).sort((a, b) => a.level - b.level).slice(0, 3);
  return {
    supports: supports.map((s) => ({ level: round(s.level)!, touches: s.touches })),
    resistances: resistances.map((r) => ({ level: round(r.level)!, touches: r.touches })),
  };
};

const changePct = (closes: number[], sessionsAgo: number): number | null => {
  if (closes.length <= sessionsAgo) return null;
  const then = closes[closes.length - 1 - sessionsAgo];
  return round(((last(closes)! - then) / then) * 100);
};

export interface Signal {
  indicator: string;
  bias: 'alcista' | 'bajista' | 'neutral';
  detail: string;
}

/** Análisis técnico completo y lista de señales con su sesgo. */
export const analyzeCandles = (candles: Candle[]) => {
  if (candles.length < 30) {
    throw new Error('Se necesitan al menos 30 sesiones de historial para el análisis.');
  }
  const closes = candles.map((c) => c.c);
  const vols = candles.map((c) => c.v);
  const price = last(closes)!;

  const s20 = last(sma(closes, 20)) ?? null;
  const s50 = last(sma(closes, 50)) ?? null;
  const s200 = last(sma(closes, 200)) ?? null;
  const s50series = sma(closes, 50);
  const s200series = sma(closes, 200);
  const r = last(rsi(closes, 14)) ?? null;
  const m = macd(closes);
  const mLine = last(m.line) ?? null;
  const mSig = last(m.signal) ?? null;
  const mHist = last(m.hist) ?? null;
  const prevHist = m.hist[m.hist.length - 2] ?? null;
  const bb = last(bollinger(closes)) ?? null;
  const a = last(atr(candles, 14)) ?? null;
  const yearSlice = candles.slice(-252);
  const high52 = Math.max(...yearSlice.map((c) => c.h));
  const low52 = Math.min(...yearSlice.map((c) => c.l));
  const avgVol20 = vols.slice(-20).reduce((x, y) => x + y, 0) / Math.min(20, vols.length);
  const relVol = avgVol20 ? vols[vols.length - 1] / avgVol20 : null;
  const upDays = candles.slice(-20).filter((c, i, arr) => i > 0 && c.c > arr[i - 1].c);
  const upVolume = upDays.reduce((x, c) => x + c.v, 0);
  const totalVolume20 = candles.slice(-20).reduce((x, c) => x + c.v, 0);
  const sr = supportResistance(candles);
  const vol = annualizedVolatility(closes.slice(-252));
  const mdd = maxDrawdown(closes.slice(-252));

  const signals: Signal[] = [];
  if (s50 != null && s200 != null) {
    const crossedUp = s50series.slice(-20).some((v, i, arr) => {
      const j = s50series.length - 20 + i;
      return i > 0 && v != null && s200series[j] != null && arr[i - 1] != null && s200series[j - 1] != null &&
        arr[i - 1]! <= s200series[j - 1]! && v > s200series[j]!;
    });
    const crossedDown = s50series.slice(-20).some((v, i, arr) => {
      const j = s50series.length - 20 + i;
      return i > 0 && v != null && s200series[j] != null && arr[i - 1] != null && s200series[j - 1] != null &&
        arr[i - 1]! >= s200series[j - 1]! && v < s200series[j]!;
    });
    if (crossedUp) signals.push({ indicator: 'Cruce dorado', bias: 'alcista', detail: 'La media de 50 cruzó por encima de la de 200 en las últimas 20 sesiones.' });
    if (crossedDown) signals.push({ indicator: 'Cruce de la muerte', bias: 'bajista', detail: 'La media de 50 cruzó por debajo de la de 200 en las últimas 20 sesiones.' });
    signals.push(
      price > s200
        ? { indicator: 'Tendencia de largo plazo', bias: 'alcista', detail: `Precio por encima de la media de 200 (${round(s200)}).` }
        : { indicator: 'Tendencia de largo plazo', bias: 'bajista', detail: `Precio por debajo de la media de 200 (${round(s200)}).` }
    );
  }
  if (s20 != null && s50 != null) {
    signals.push(
      price > s20 && s20 > s50
        ? { indicator: 'Tendencia de corto plazo', bias: 'alcista', detail: 'Precio > media 20 > media 50.' }
        : price < s20 && s20 < s50
          ? { indicator: 'Tendencia de corto plazo', bias: 'bajista', detail: 'Precio < media 20 < media 50.' }
          : { indicator: 'Tendencia de corto plazo', bias: 'neutral', detail: 'Medias cortas entrelazadas: sin tendencia clara.' }
    );
  }
  if (r != null) {
    signals.push(
      r >= 70
        ? { indicator: 'RSI(14)', bias: 'bajista', detail: `RSI ${round(r, 1)}: sobrecompra, riesgo de corrección.` }
        : r <= 30
          ? { indicator: 'RSI(14)', bias: 'alcista', detail: `RSI ${round(r, 1)}: sobreventa, posible rebote (confirmar).` }
          : { indicator: 'RSI(14)', bias: 'neutral', detail: `RSI ${round(r, 1)}: zona neutral.` }
    );
  }
  if (mHist != null && prevHist != null) {
    const turnedUp = prevHist < 0 && mHist > 0;
    const turnedDown = prevHist > 0 && mHist < 0;
    signals.push(
      turnedUp
        ? { indicator: 'MACD', bias: 'alcista', detail: 'El MACD acaba de cruzar por encima de su señal.' }
        : turnedDown
          ? { indicator: 'MACD', bias: 'bajista', detail: 'El MACD acaba de cruzar por debajo de su señal.' }
          : { indicator: 'MACD', bias: mHist > 0 ? 'alcista' : 'bajista', detail: `Histograma ${mHist > 0 ? 'positivo' : 'negativo'} (${round(mHist, 3)}).` }
    );
  }
  if (bb) {
    if (price > bb.upper) signals.push({ indicator: 'Bollinger', bias: 'bajista', detail: 'Precio por encima de la banda superior: extendido.' });
    else if (price < bb.lower) signals.push({ indicator: 'Bollinger', bias: 'alcista', detail: 'Precio por debajo de la banda inferior: extendido a la baja.' });
  }
  if (relVol != null && relVol >= 1.5) {
    const lastUp = closes[closes.length - 1] >= closes[closes.length - 2];
    signals.push({
      indicator: 'Volumen',
      bias: lastUp ? 'alcista' : 'bajista',
      detail: `Volumen de la última sesión ${round(relVol, 1)}x el promedio de 20 días, con cierre ${lastUp ? 'al alza' : 'a la baja'}.`,
    });
  }

  const bull = signals.filter((s) => s.bias === 'alcista').length;
  const bear = signals.filter((s) => s.bias === 'bajista').length;

  return {
    last_date: last(candles)!.t,
    price: round(price),
    change_pct: {
      d1: changePct(closes, 1),
      w1: changePct(closes, 5),
      m1: changePct(closes, 21),
      m3: changePct(closes, 63),
      m6: changePct(closes, 126),
      y1: changePct(closes, 252),
    },
    range_52w: { high: round(high52), low: round(low52), from_high_pct: round(((price - high52) / high52) * 100) },
    moving_averages: { sma20: round(s20), sma50: round(s50), sma200: round(s200) },
    rsi14: round(r, 1),
    macd: { line: round(mLine, 3), signal: round(mSig, 3), histogram: round(mHist, 3) },
    bollinger20: bb ? { upper: round(bb.upper), mid: round(bb.mid), lower: round(bb.lower) } : null,
    atr14: round(a),
    atr_pct: a ? round((a / price) * 100) : null,
    volume: {
      last: vols[vols.length - 1],
      avg20: Math.round(avgVol20),
      relative: round(relVol),
      up_volume_share_20d_pct: totalVolume20 ? round((upVolume / totalVolume20) * 100, 1) : null,
    },
    risk: {
      annualized_volatility_pct: vol != null ? round(vol * 100, 1) : null,
      max_drawdown_1y_pct: round(mdd * 100, 1),
    },
    levels: sr,
    signals,
    signal_balance: { alcistas: bull, bajistas: bear, neutrales: signals.length - bull - bear },
    sessions_analyzed: candles.length,
  };
};

/**
 * Tamaño de posición por riesgo: cuánto comprar para que, si el precio toca el
 * stop, la pérdida no supere `riskPct` del capital disponible.
 */
export const positionSizing = (opts: {
  price: number;
  atr: number | null;
  nearestSupport: number | null;
  capital: number;
  riskPct?: number;
  /** Tope de concentración: % máximo del capital en una sola posición (por defecto 20). */
  maxPositionPct?: number;
}) => {
  const riskPct = opts.riskPct ?? 1;
  const maxPositionPct = opts.maxPositionPct ?? 20;
  const atrStop = opts.atr ? opts.price - 2 * opts.atr : opts.price * 0.92;
  const supportStop = opts.nearestSupport ? opts.nearestSupport * 0.99 : null;
  // El stop más cercano que respete la volatilidad (no más ajustado que 1 ATR)
  let stop = supportStop && supportStop > atrStop ? supportStop : atrStop;
  if (opts.atr && opts.price - stop < opts.atr) stop = opts.price - opts.atr;
  const riskPerUnit = opts.price - stop;
  const maxLoss = (opts.capital * riskPct) / 100;
  const unitsByRisk = riskPerUnit > 0 ? Math.floor(maxLoss / riskPerUnit) : 0;
  const unitsByConcentration = Math.floor((opts.capital * maxPositionPct) / 100 / opts.price);
  const units = Math.min(unitsByRisk, unitsByConcentration);
  return {
    limited_by: units === unitsByConcentration && unitsByConcentration < unitsByRisk ? 'concentración máxima' : 'riesgo por operación',
    max_position_pct_of_capital: maxPositionPct,
    suggested_stop: round(stop),
    stop_distance_pct: round((riskPerUnit / opts.price) * 100),
    risk_pct_of_capital: riskPct,
    max_loss: round(maxLoss),
    loss_at_stop: round(units * riskPerUnit),
    max_units: units,
    max_position_value: round(units * opts.price),
    position_pct_of_capital: opts.capital ? round(((units * opts.price) / opts.capital) * 100, 1) : null,
  };
};
