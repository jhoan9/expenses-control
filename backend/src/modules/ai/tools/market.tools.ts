import { query } from '../../../config/database';
import { analyzeCandles, positionSizing } from '../../market/indicators';
import { marketData, Range } from '../../market/market.provider';
import { investmentsService } from '../../investments/investments.service';
import { ReadTool } from '../agent/types';

const RANGES: Range[] = ['3mo', '6mo', '1y', '2y', '5y'];

export const searchSymbolTool: ReadTool = {
  kind: 'read',
  name: 'search_symbol',
  label: 'Buscó el símbolo bursátil',
  description:
    'Busca el símbolo (ticker) de una empresa, ETF o cripto por nombre. Úsala cuando el usuario nombra una empresa ' +
    '("Ecopetrol", "Apple") y no conoces el ticker exacto. Devuelve coincidencias con bolsa y tipo.',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string', description: 'Nombre de la empresa o símbolo aproximado.' } },
    required: ['query'],
  },
  async run(_ctx, args) {
    return { provider: marketData.providerName, matches: await marketData.search(args.query) };
  },
};

export const analyzeStockTool: ReadTool = {
  kind: 'read',
  name: 'analyze_stock',
  label: 'Analizó datos de mercado',
  description:
    'Análisis técnico y de riesgo de una acción, ETF o cripto con datos reales del mercado: precio, variación (1d a 1 año), ' +
    'rango de 52 semanas, medias móviles 20/50/200, RSI, MACD, Bollinger, ATR, volumen relativo, soportes y resistencias, ' +
    'volatilidad anualizada, drawdown máximo, señales alcistas/bajistas, y un tamaño de posición sugerido según el capital ' +
    'líquido del usuario y el riesgo máximo por operación. Incluye la posición actual del usuario en ese activo si la tiene.',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'Ticker exacto (p. ej. AAPL, EC, VOO, BTC-USD, ECOPETROL.CL según el proveedor).' },
      range: { type: 'string', enum: RANGES, description: 'Historial a analizar. Por defecto 1y (2y si se requiere media de 200 confiable).' },
      risk_pct: { type: 'number', description: 'Porcentaje máximo del capital a arriesgar en la operación (0.25-3, por defecto 1).' },
      max_position_pct: { type: 'number', description: 'Porcentaje máximo del capital en esta sola posición (5-50, por defecto 20).' },
    },
    required: ['symbol'],
  },
  async run(ctx, args) {
    const range: Range = RANGES.includes(args.range) ? args.range : '1y';
    const series = await marketData.history(args.symbol, range);
    const analysis = analyzeCandles(series.candles);

    // Capital líquido del usuario (cuentas que no son tarjeta de crédito), en COP
    const [{ liquid }] = await query<{ liquid: string }>(
      `SELECT COALESCE(SUM(balance), 0) AS liquid FROM accounts
        WHERE user_id = $1 AND deleted_at IS NULL AND type NOT IN ('credit_card') AND balance > 0`,
      [ctx.userId]
    );
    const capitalCop = Number(liquid);
    const currency = series.currency ?? 'USD';
    const fx = currency === 'COP' ? 1 : await marketData.fxRate(currency, 'COP');
    const riskPct = Math.min(Math.max(Number(args.risk_pct) || 1, 0.25), 3);

    const sizing =
      fx && analysis.price
        ? {
            capital_liquido_cop: Math.round(capitalCop),
            tasa_cambio: currency === 'COP' ? null : { par: `${currency}/COP`, valor: fx },
            ...positionSizing({
              price: analysis.price,
              atr: analysis.atr14,
              nearestSupport: analysis.levels.supports[0]?.level ?? null,
              capital: capitalCop / fx,
              riskPct,
              maxPositionPct: Math.min(Math.max(Number(args.max_position_pct) || 20, 5), 50),
            }),
            moneda_de_los_montos: currency,
          }
        : { nota: `No pude obtener la tasa ${currency}/COP; calcula el tamaño de posición con el usuario.` };

    let myPosition: unknown = null;
    try {
      const open = await investmentsService.getOpenPositions(ctx.userId);
      const sym = series.symbol.toUpperCase();
      myPosition = open.filter((p: any) => String(p.ticker ?? '').toUpperCase() === sym) || null;
      if (Array.isArray(myPosition) && !myPosition.length) myPosition = null;
    } catch {
      myPosition = null;
    }

    return {
      symbol: series.symbol,
      name: series.name,
      exchange: series.exchange,
      type: series.type,
      currency,
      provider: series.provider,
      data_note: 'Datos diarios de cierre; pueden tener retraso. No incluyen fundamentales ni noticias.',
      analysis,
      position_sizing: sizing,
      my_position: myPosition,
    };
  },
};

export const myInvestmentsTool: ReadTool = {
  kind: 'read',
  name: 'get_my_investments',
  label: 'Revisó tus inversiones',
  description: 'Posiciones abiertas del usuario registradas en la app (activo, ticker, cantidad, costo promedio).',
  parameters: { type: 'object', properties: {} },
  async run(ctx) {
    return { positions: await investmentsService.getOpenPositions(ctx.userId) };
  },
};

export const marketTools: ReadTool[] = [searchSymbolTool, analyzeStockTool, myInvestmentsTool];
