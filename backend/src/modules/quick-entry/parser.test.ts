import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAmount, parseNumberString } from './amount';
import { parseEntry, ParserContext, extractDate, detectKind } from './parser';

const ctx: ParserContext = {
  today: '2026-11-21',
  accounts: [
    { id: 1, name: 'Bancolombia Ahorros', type: 'savings' },
    { id: 2, name: 'Nequi', type: 'savings' },
    { id: 3, name: 'Efectivo', type: 'cash' },
    { id: 4, name: 'Visa Davivienda', type: 'credit_card' },
  ],
  categories: [
    { id: 10, name: 'Mercado', type: 'expense' },
    { id: 11, name: 'Transporte', type: 'expense' },
    { id: 12, name: 'Restaurantes', type: 'expense' },
    { id: 13, name: 'Servicios', type: 'expense', subcategories: [{ id: 131, name: 'Internet' }] },
    { id: 14, name: 'Salario', type: 'income' },
    { id: 15, name: 'Freelance', type: 'income' },
    { id: 16, name: 'Ocio', type: 'expense' },
  ],
};

const amount = (s: string) => extractAmount(s)?.amount ?? null;

test('montos en formatos colombianos', () => {
  assert.equal(amount('45000'), 45000);
  assert.equal(amount('45.000'), 45000);
  assert.equal(amount('$45.000'), 45000);
  assert.equal(amount('$ 1.200.000'), 1200000);
  assert.equal(amount('45 mil'), 45000);
  assert.equal(amount('45mil'), 45000);
  assert.equal(amount('45k'), 45000);
  assert.equal(amount('30 lucas'), 30000);
  assert.equal(amount('1,2 millones'), 1200000);
  assert.equal(amount('1.5m'), 1500000);
  assert.equal(amount('2 palos'), 2000000);
  assert.equal(amount('un millon'), 1000000);
  assert.equal(amount('1 millon 200 mil'), 1200000);
  assert.equal(amount('1 millon 200'), 1200000);
  assert.equal(amount('2 palos y medio'), 2500000);
  assert.equal(amount('medio millon'), 500000);
  assert.equal(amount('18.500,50'), 18500.5);
  assert.equal(amount('sin numeros'), null);
});

test('prefiere el monto con multiplicador o $ frente a cantidades', () => {
  assert.equal(amount('compre 2 empanadas por 6 mil'), 6000);
  assert.equal(amount('3 cervezas $15.000'), 15000);
});

test('parseNumberString', () => {
  assert.equal(parseNumberString('1,2', true), 1.2);
  assert.equal(parseNumberString('1.200.000'), 1200000);
  assert.equal(parseNumberString('45,000'), 45000);
});

test('fechas relativas y explicitas', () => {
  assert.equal(extractDate('ayer', '2026-11-21')?.date, '2026-11-20');
  assert.equal(extractDate('antier', '2026-11-21')?.date, '2026-11-19');
  assert.equal(extractDate('el 15', '2026-11-21')?.date, '2026-11-15');
  assert.equal(extractDate('el 28', '2026-11-21')?.date, '2026-10-28');
  assert.equal(extractDate('3 de enero', '2026-11-21')?.date, '2026-01-03');
  assert.equal(extractDate('15/11', '2026-11-21')?.date, '2026-11-15');
  // 31 de febrero no existe: no se inventa una fecha
  assert.equal(extractDate('el 31', '2026-03-05'), null);
});

test('tipo de movimiento', () => {
  assert.equal(detectKind('gaste 20 mil'), 'expense');
  assert.equal(detectKind('pague el arriendo'), 'expense');
  assert.equal(detectKind('me pagaron 1 millon'), 'income');
  assert.equal(detectKind('recibi 300 mil'), 'income');
  assert.equal(detectKind('+50000'), 'income');
  assert.equal(detectKind('-50000'), 'expense');
  assert.equal(detectKind('uber 18 mil'), null);
});

test('gasto completo con cuenta y categoria', () => {
  const d = parseEntry('Gasté 45 mil en mercado con Nequi', ctx);
  assert.equal(d.kind, 'expense');
  assert.equal(d.amount, 45000);
  assert.equal(d.account_id, 2);
  assert.equal(d.category_id, 10);
  assert.equal(d.date, '2026-11-21');
  assert.match(d.description, /mercado/i);
  assert.doesNotMatch(d.description, /45|gast/i);
});

test('sinonimo de categoria e inferencia de tipo por categoria', () => {
  const d = parseEntry('uber 18.500 ayer', ctx);
  // 'uber' no es un verbo, pero la categoría Transporte solo admite gastos
  assert.equal(d.kind, 'expense');
  assert.equal(d.category_id, 11);
  assert.equal(d.amount, 18500);
  assert.equal(d.date, '2026-11-20');
});

test('el tipo se infiere de una categoria exclusiva', () => {
  const d = parseEntry('restaurantes 80 mil', ctx);
  assert.equal(d.kind, 'expense');
  assert.equal(d.category_id, 12);
});

test('ingreso por freelance', () => {
  const d = parseEntry('me pagaron 1,2 millones del proyecto freelance', ctx);
  assert.equal(d.kind, 'income');
  assert.equal(d.amount, 1200000);
  assert.equal(d.category_id, 15);
});

test('subcategoria mas especifica que la categoria', () => {
  const d = parseEntry('pague internet 95 mil con bancolombia', ctx);
  assert.equal(d.category_id, 13);
  assert.equal(d.subcategory_id, 131);
  assert.equal(d.account_id, 1);
});

test('cuenta por tipo: efectivo y tarjeta', () => {
  assert.equal(parseEntry('almuerzo 20 mil en efectivo', ctx).account_id, 3);
  assert.equal(parseEntry('compre zapatos 150 mil con tarjeta', ctx).account_id, 4);
});

test('el dia de la fecha no se toma como monto', () => {
  const d = parseEntry('pague 60 mil de luz el 15', ctx);
  assert.equal(d.amount, 60000);
  assert.equal(d.date, '2026-11-15');
});

test('texto con emoji conserva la descripcion', () => {
  const d = parseEntry('🍕 pizza 32 mil', ctx);
  assert.equal(d.amount, 32000);
  assert.match(d.description, /pizza/i);
});

test('la mencion de la cuenta no queda en la descripcion', () => {
  assert.equal(parseEntry('compre pan 8 mil con nequi', ctx).description, 'Pan');
  assert.equal(parseEntry('gasté 45 mil en mercado con la cuenta de Bancolombia', ctx).description, 'Mercado');
  assert.equal(parseEntry('almuerzo 20 mil en efectivo', ctx).description, 'Almuerzo');
  assert.equal(parseEntry('zapatos 150 mil con tarjeta', ctx).description, 'Zapatos');
});

test('palabras de mercado se asignan a la categoria Mercado', () => {
  assert.equal(parseEntry('compre pan 8 mil', ctx).category_id, 10);
});

test('notificaciones bancarias reenviadas por una automatizacion', () => {
  const compra = parseEntry('Bancolombia: Compraste $45.000,00 en EXITO CALLE 80 con tu T.Deb *1234, el 20/11/2026 a las 10:15', ctx);
  assert.equal(compra.kind, 'expense');
  assert.equal(compra.amount, 45000);
  assert.equal(compra.account_id, 1);
  assert.equal(compra.category_id, 10);
  assert.equal(compra.date, '2026-11-20');

  const recibo = parseEntry('Nequi: Recibiste $50.000 de JUAN PEREZ', ctx);
  assert.equal(recibo.kind, 'income');
  assert.equal(recibo.amount, 50000);
  assert.equal(recibo.account_id, 2);
});
