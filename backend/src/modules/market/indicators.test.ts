import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCandles, atr, bollinger, Candle, ema, maxDrawdown, positionSizing, rsi, sma, supportResistance } from './indicators';

const near = (a: number | null | undefined, b: number, eps = 1e-6) =>
  assert.ok(a != null && Math.abs(a - b) < eps, `${a} ≈ ${b}`);

/** Serie sintética: tendencia + onda, para tener pivotes y volumen variable. */
const synthetic = (n: number, slope: number, start = 100): Candle[] =>
  Array.from({ length: n }, (_, i) => {
    const c = start + slope * i + 3 * Math.sin(i / 4);
    const d = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
    return { t: d, o: c - 0.5, h: c + 1, l: c - 1, c, v: 1000 + (i % 10) * 100 };
  });

test('SMA y EMA', () => {
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  const e = ema([1, 2, 3, 4, 5], 3);
  assert.equal(e[1], null);
  near(e[2], 2); // semilla = SMA
  near(e[3], 3); // 4*0.5 + 2*0.5
  near(e[4], 4);
});

test('RSI: serie solo al alza = 100, solo a la baja = 0', () => {
  const up = Array.from({ length: 30 }, (_, i) => 10 + i);
  const down = Array.from({ length: 30 }, (_, i) => 50 - i);
  near(rsi(up)[29], 100);
  near(rsi(down)[29], 0);
  assert.equal(rsi(up)[5], null);
});

test('Bollinger en serie constante colapsa a la media', () => {
  const b = bollinger(Array(25).fill(10))[24]!;
  near(b.mid, 10);
  near(b.upper, 10);
  near(b.lower, 10);
});

test('ATR de velas con rango fijo es ese rango', () => {
  const c: Candle[] = Array.from({ length: 20 }, (_, i) => ({ t: String(i), o: 10, h: 11, l: 9, c: 10, v: 1 }));
  near(atr(c, 14)[19], 2);
});

test('Drawdown máximo', () => {
  near(maxDrawdown([100, 120, 90, 130, 65]), -0.5);
  near(maxDrawdown([1, 2, 3]), 0);
});

test('Soportes por debajo y resistencias por encima del precio', () => {
  const c = synthetic(120, 0);
  const sr = supportResistance(c);
  const price = c[c.length - 1].c;
  assert.ok(sr.supports.every((s) => s.level < price));
  assert.ok(sr.resistances.every((r) => r.level > price));
});

test('Análisis de una tendencia alcista marca sesgo alcista de largo plazo', () => {
  const a = analyzeCandles(synthetic(260, 0.5));
  const lt = a.signals.find((s) => s.indicator === 'Tendencia de largo plazo');
  assert.equal(lt?.bias, 'alcista');
  assert.ok(a.moving_averages.sma200! < a.price!);
  assert.ok(a.change_pct.y1! > 0);
  assert.ok(a.signal_balance.alcistas >= a.signal_balance.bajistas);
});

test('Análisis de una tendencia bajista marca sesgo bajista de largo plazo', () => {
  const a = analyzeCandles(synthetic(260, -0.3, 200));
  assert.equal(a.signals.find((s) => s.indicator === 'Tendencia de largo plazo')?.bias, 'bajista');
  assert.ok(a.risk.max_drawdown_1y_pct! < 0);
});

test('Historial insuficiente', () => {
  assert.throws(() => analyzeCandles(synthetic(10, 1)));
});

test('Tamaño de posición limita la pérdida al % de riesgo', () => {
  const p = positionSizing({ price: 100, atr: 2, nearestSupport: 97, capital: 10_000_000, riskPct: 1 });
  // stop: soporte*0.99 = 96.03 > atrStop 96 → 96.03; distancia 3.97 ≥ 1 ATR
  near(p.suggested_stop!, 96.03, 0.01);
  assert.ok(p.max_units * (100 - p.suggested_stop!) <= 100_000 + 1e-6);
  assert.equal(p.max_loss, 100_000);
});

test('El tamaño de posición nunca supera el tope de concentración', () => {
  // Stop muy cercano: por riesgo saldrían muchas unidades; el tope de 20% lo limita
  const p = positionSizing({ price: 100, atr: 0.5, nearestSupport: 99.6, capital: 10_000, riskPct: 2 });
  assert.equal(p.limited_by, 'concentración máxima');
  assert.ok(p.max_position_value! <= 2_000);
  assert.ok(p.position_pct_of_capital! <= 20);
});
