import type { AmortizationRow, ScheduleView } from './types';

export const VIEW_OPTIONS: { value: ScheduleView; label: string; hint: string }[] = [
  { value: 'monthly', label: 'Monthly', hint: 'per-payment breakdown' },
  { value: 'yearly', label: 'Yearly', hint: 'aggregated per calendar year' },
];

/** Group monthly rows into yearly aggregates. */
export function yearlyRows(rows: AmortizationRow[]): {
  year: number;
  principal: number;
  interest: number;
  extra: number;
  balance: number;
  totalInterest: number;
}[] {
  const out: {
    year: number;
    principal: number;
    interest: number;
    extra: number;
    balance: number;
    totalInterest: number;
  }[] = [];
  for (const row of rows) {
    const year = Math.ceil(row.index / 12);
    const last = out[out.length - 1];
    if (last && last.year === year) {
      last.principal += row.principal;
      last.interest += row.interest;
      last.extra += row.extra;
      last.balance = row.balance;
      last.totalInterest = row.totalInterest;
    } else {
      out.push({
        year,
        principal: row.principal,
        interest: row.interest,
        extra: row.extra,
        balance: row.balance,
        totalInterest: row.totalInterest,
      });
    }
  }
  return out;
}
