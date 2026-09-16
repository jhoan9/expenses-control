import { query, queryOne } from '../../config/database';
import { investmentsService } from '../investments/investments.service';

interface AccountRow {
  name: string;
  type: string;
  currency: string;
  balance: string;
  credit_limit: string;
}

interface TotalsRow {
  total: string;
}

interface ObligationRow {
  name: string;
  amount: string;
  due_date: string;
}

interface MovementRow {
  account: string;
  description: string;
  amount: string;
  status: string;
  date: string;
}

interface LoanRow {
  id: number;
  amount: string;
  paid: string;
  role: 'dado' | 'recibido';
  borrower_name: string | null;
  date: string;
}

interface CreditRow {
  institution: string;
  balance: string;
  credit_limit: string;
  due_date: string | null;
}

interface ThirdPartyRow {
  person_name: string;
  total_invested: string;
  total_available: string;
  total_gains: string;
}

const money = (value: unknown): string => {
  const n = Number(value ?? 0);
  return n.toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const buildFinancialContext = async (userId: number): Promise<string> => {
  const [
    accounts,
    monthIncome,
    monthExpenses,
    totalBalance,
    obligations,
    recentExpenses,
    loans,
    credits,
    thirdParties,
  ] = await Promise.all([
    query<AccountRow>(
      `SELECT name, type, currency, balance, credit_limit
       FROM accounts
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY name`,
      [userId]
    ),
    queryOne<TotalsRow>(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM income
       WHERE user_id = $1 AND deleted_at IS NULL
         AND date >= date_trunc('month', CURRENT_DATE)`,
      [userId]
    ),
    queryOne<TotalsRow>(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM expenses
       WHERE user_id = $1 AND deleted_at IS NULL
         AND status = 'completed'
         AND date >= date_trunc('month', CURRENT_DATE)`,
      [userId]
    ),
    queryOne<TotalsRow>(
      `SELECT COALESCE(SUM(balance), 0)::numeric AS total
       FROM accounts
       WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    ),
    query<ObligationRow>(
      `SELECT bi.name, bi.amount, bi.due_date
       FROM budget_items bi
       JOIN budgets b ON b.id = bi.budget_id
       WHERE b.user_id = $1 AND bi.deleted_at IS NULL
         AND bi.status = 'pending'
         AND bi.due_date >= CURRENT_DATE
       ORDER BY bi.due_date
       LIMIT 15`,
      [userId]
    ),
    query<MovementRow>(
      `SELECT e.description, e.amount, e.status, e.date, a.name AS account
       FROM expenses e
       JOIN accounts a ON a.id = e.account_id
       WHERE e.user_id = $1 AND e.deleted_at IS NULL
       ORDER BY e.date DESC, e.id DESC
       LIMIT 8`,
      [userId]
    ),
    query<LoanRow>(
      `SELECT l.id,
              l.amount::numeric AS amount,
              COALESCE((SELECT SUM(lp.amount) FROM loan_payments lp WHERE lp.loan_id = l.id), 0)::numeric AS paid,
              CASE WHEN l.lender_id = $1 THEN 'dado' ELSE 'recibido' END AS role,
              l.borrower_name,
              l.date
       FROM loans l
       WHERE l.deleted_at IS NULL
         AND l.status = 'active'
         AND (l.lender_id = $1 OR l.borrower_id = $1)
       ORDER BY l.date
       LIMIT 15`,
      [userId]
    ),
    query<CreditRow>(
      `SELECT institution, balance::numeric AS balance,
              credit_limit::numeric AS credit_limit, due_date
       FROM credits
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY institution`,
      [userId]
    ),
    query<ThirdPartyRow>(
      `SELECT person_name,
              total_invested::numeric AS total_invested,
              total_available::numeric AS total_available,
              total_gains::numeric AS total_gains
       FROM third_party_accounts
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY person_name`,
      [userId]
    ),
  ]);

  const openInvestments = await investmentsService.getOpenPositions(userId);
  const totalInvested = openInvestments.reduce(
    (sum, inv) => sum + Number(inv.total_cost || 0),
    0
  );

  const income = Number(monthIncome?.total || 0);
  const expenses = Number(monthExpenses?.total || 0);
  const margin = income - expenses;

  const lines: string[] = [];
  lines.push('## DATOS FINANCIEROS ACTUALES DEL USUARIO (FUENTE CONFIABLE)');
  lines.push(`- Fecha de consulta: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`- SALDO TOTAL EN CUENTAS: $${money(totalBalance?.total)}`);
  lines.push(`- INGRESOS DEL MES: $${money(income)}`);
  lines.push(`- GASTOS DEL MES (completados): $${money(expenses)}`);
  lines.push(`- MARGEN DEL MES (ingresos - gastos): $${money(margin)}`);
  lines.push(`- INVERSIÓN TOTAL EN POSICIONES ABIERTAS: $${money(totalInvested)}`);

  lines.push('');
  lines.push('### CUENTAS');
  if (accounts.length === 0) {
    lines.push('- (Sin cuentas registradas)');
  } else {
    for (const a of accounts) {
      const credit =
        Number(a.credit_limit) > 0 ? ` / cupo $${money(a.credit_limit)}` : '';
      lines.push(
        `- ${a.name} (${a.type}) [${a.currency}]: $${money(a.balance)}${credit}`
      );
    }
  }

  lines.push('');
  lines.push('### OBLIGACIONES PENDIENTES (presupuesto)');
  if (obligations.length === 0) {
    lines.push('- (Sin obligaciones pendientes próximas)');
  } else {
    for (const o of obligations) {
      lines.push(`- ${o.name}: $${money(o.amount)} (vence ${o.due_date})`);
    }
  }

  lines.push('');
  lines.push('### INVERSIONES ABIERTAS');
  if (openInvestments.length === 0) {
    lines.push('- (Sin inversiones abiertas)');
  } else {
    for (const inv of openInvestments) {
      lines.push(
        `- ${inv.name}${inv.ticker ? ` (${inv.ticker})` : ''}: ${inv.open_quantity} uds, costo total $${money(inv.total_cost)}`
      );
    }
  }

  lines.push('');
  lines.push('### PRÉSTAMOS ACTIVOS');
  if (loans.length === 0) {
    lines.push('- (Sin préstamos activos)');
  } else {
    for (const l of loans) {
      const remaining = Number(l.amount) - Number(l.paid);
      const other =
        l.role === 'dado'
          ? `a ${l.borrower_name || 'tercero'}`
          : 'a mi favor';
      lines.push(
        `- ${l.role === 'dado' ? 'Préstamo dado' : 'Préstamo recibido'} ${other}: pendiente $${money(remaining)} (original $${money(l.amount)}, fecha ${l.date})`
      );
    }
  }

  lines.push('');
  lines.push('### CRÉDITOS');
  if (credits.length === 0) {
    lines.push('- (Sin créditos registrados)');
  } else {
    for (const c of credits) {
      lines.push(
        `- ${c.institution}: saldo $${money(c.balance)} / cupo $${money(c.credit_limit)}${c.due_date ? ` (vence ${c.due_date})` : ''}`
      );
    }
  }

  lines.push('');
  lines.push('### CUENTAS DE TERCEROS');
  if (thirdParties.length === 0) {
    lines.push('- (Sin cuentas de terceros)');
  } else {
    for (const tp of thirdParties) {
      lines.push(
        `- ${tp.person_name}: disponible $${money(tp.total_available)}, invertido $${money(tp.total_invested)}, ganancias $${money(tp.total_gains)}`
      );
    }
  }

  lines.push('');
  lines.push('### ÚLTIMOS MOVIMIENTOS DE GASTOS');
  if (recentExpenses.length === 0) {
    lines.push('- (Sin gastos registrados)');
  } else {
    for (const e of recentExpenses) {
      lines.push(
        `- ${e.date} | ${e.account} | ${e.description || 'sin descripción'} | $${money(e.amount)} [${e.status}]`
      );
    }
  }

  return lines.join('\n');
};

export const buildSystemPrompt = (context: string, userName: string): string => {
  return [
    'Eres "C", un asesor financiero personal inteligente y experto integrado en una app de control de gastos.',
    `Estás asistiendo a ${userName}.`,
    '',
    'CONTEXTO FINANCIERO DEL USUARIO (datos reales, no inventes cifras):',
    context,
    '',
    'REGLAS DE COMPORTAMIENTO:',
    '1. Responde SIEMPRE en español, de forma clara, directa y bien estructurada.',
    '2. Usa ÚNICAMENTE la información del contexto para hablar de cifras, cuentas o movimientos.',
    '3. Si no tienes un dato, identifícalo explícitamente y sugiere dónde consultarlo en la app.',
    '4. NUNCA inventes montos, movimientos, cuentas o inversiones. Ante la duda, dilo.',
    '5. Para resumir el estado financiero: menciona saldo total, ingresos, gastos del mes, obligaciones pendientes, posiciones abiertas, préstamos activos, créditos y cuentas de terceros según existan.',
    '6. Propón mejoras concretas de ahorro o eficiencia solo cuando los datos lo respalden.',
    '7. No prometas rendimientos ni garantices resultados de inversión.',
    '8. Da consejo amistoso pero sin sustituir a un asesor financiero profesional certificado.',
    '9. Si te piden algo ajeno a finanzas personales o a esta app, redirige con amabilidad.',
    '10. Mantén las respuestas útiles, ordenadas y de longitud moderada a menos que te pidan más detalle.',
    '11. Puedes sugerir acciones que el usuario puede hacer en la app: crear presupuesto, registrar gastos, transferir entre cuentas, hacer abono a tarjeta, pagar préstamos o créditos, etc.',
    '12. IMPORTANTE: solo habla de préstamos, créditos, movimientos o cuentas que aparezcan en el contexto. Si un dato no está en el contexto, di claramente que no tienes esa información y sugiere revisarla en la app.',
    '',
    'Saluda al inicio de cada nueva conversación de forma breve y natural.',
  ].join('\n');
};