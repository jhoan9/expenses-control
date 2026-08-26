export function formatCurrency(value: number): string {
  if (value === undefined || value === null) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  }).format(value);
}
