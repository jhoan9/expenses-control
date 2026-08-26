export function formatCurrency(value: number): string {
  if (value === undefined || value === null) return '$0';

  let role = '';
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    role = user.role || '';
  } catch {}

  const hasDecimals = value % 1 !== 0;

  if (role === 'jh01') {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: hasDecimals ? 5 : 0,
      maximumFractionDigits: 5,
    }).format(value);
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
