export function formatCurrency(value: number): string {
  if (value === undefined || value === null) return '$0';

  let role = '';
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    role = user.role || '';
  } catch {}

  if (role === 'ji01') {
    const hasDecimals = value % 1 !== 0;
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

export function todayLocal(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const raw = String(date);
  // Date-only 'YYYY-MM-DD' → build from components (avoids UTC/local off-by-one)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-CO');
  }
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? raw : parsed.toLocaleDateString('es-CO');
}
