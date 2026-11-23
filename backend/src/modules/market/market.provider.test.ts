import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAlphaVantage, parseTwelveData, parseYahooChart } from './market.provider';

test('Yahoo: convierte la respuesta de chart y descarta velas incompletas', () => {
  const data = {
    chart: {
      result: [
        {
          meta: { symbol: 'AAPL', currency: 'USD', fullExchangeName: 'NasdaqGS', instrumentType: 'EQUITY', longName: 'Apple Inc.' },
          timestamp: [1735776000, 1735862400, 1735948800],
          indicators: {
            quote: [{ open: [100, null, 102], high: [101, 103, 104], low: [99, 100, 101], close: [100.5, 102, 103.5], volume: [10, 20, 30] }],
          },
        },
      ],
    },
  };
  const s = parseYahooChart(data, 'AAPL');
  assert.equal(s.currency, 'USD');
  assert.equal(s.name, 'Apple Inc.');
  assert.equal(s.candles.length, 2);
  assert.deepEqual(s.candles[1], { t: '2025-01-04', o: 102, h: 104, l: 101, c: 103.5, v: 30 });
});

test('Yahoo: error de símbolo', () => {
  assert.throws(() => parseYahooChart({ chart: { result: null, error: { description: 'No data found' } } }, 'XXXX'), /No data found/);
});

test('Twelve Data: ordena de la más antigua a la más reciente', () => {
  const s = parseTwelveData(
    {
      status: 'ok',
      meta: { symbol: 'EC', currency: 'USD', exchange: 'NYSE', type: 'Depositary Receipt' },
      values: [
        { datetime: '2025-01-03', open: '10', high: '11', low: '9', close: '10.5', volume: '500' },
        { datetime: '2025-01-02', open: '9', high: '10', low: '8', close: '9.5', volume: '400' },
      ],
    },
    'EC'
  );
  assert.equal(s.candles[0].t, '2025-01-02');
  assert.equal(s.candles[1].c, 10.5);
  assert.throws(() => parseTwelveData({ status: 'error', message: 'invalid api key' }, 'EC'), /invalid api key/);
});

test('Alpha Vantage: serie diaria y aviso de límite', () => {
  const s = parseAlphaVantage(
    { 'Time Series (Daily)': { '2025-01-03': { '1. open': '1', '2. high': '2', '3. low': '0.5', '4. close': '1.5', '5. volume': '7' }, '2025-01-02': { '1. open': '1', '2. high': '1', '3. low': '1', '4. close': '1', '5. volume': '1' } } },
    'IBM'
  );
  assert.equal(s.candles[0].t, '2025-01-02');
  assert.throws(() => parseAlphaVantage({ Note: 'API call frequency exceeded' }, 'IBM'), /frequency/);
});
