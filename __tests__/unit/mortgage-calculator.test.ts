import { describe, it, expect } from 'vitest';
import {
  parseNumber,
  monthlyPayment,
  amortize,
  computeMortgage,
  resultText,
  summaryText,
  formatCurrency,
  validateLoan,
} from '@/tool/types';
import { serializeState, deserializeState, roundTrips, withHistory } from '@/tool/tool-definition';
import { DEFAULT_STATE, MAX_HISTORY, type ToolState } from '@/tool/types';
import { mortgageCalculatorTool } from '@/tool/tool-definition';
import { yearlyRows } from '@/tool/ui-shared';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('parseNumber', () => {
  it('parses integers, decimals and rejects junk', () => {
    expect(parseNumber('300000')).toBe(300000);
    expect(parseNumber('6.5')).toBeCloseTo(6.5);
    expect(parseNumber('.5')).toBeCloseTo(0.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('1e3')).toBe(1000);
  });
});

describe('monthlyPayment', () => {
  it('computes the standard 30-year fixed payment correctly', () => {
    // $300,000 at 6.5% for 30 years -> $1,896.20
    expect(monthlyPayment(300000, 6.5, 30)).toBeCloseTo(1896.2, 1);
    // $200,000 at 6% for 30 years -> $1,199.10
    expect(monthlyPayment(200000, 6, 30)).toBeCloseTo(1199.1, 1);
    // $100,000 at 0% for 10 years -> simple split
    expect(monthlyPayment(100000, 0, 10)).toBeCloseTo(833.3333, 3);
  });

  it('returns 0 for a non-positive term', () => {
    expect(monthlyPayment(100000, 5, 0)).toBe(0);
  });

  it('grows the payment with a higher rate for the same term', () => {
    expect(monthlyPayment(100000, 7, 30)).toBeGreaterThan(monthlyPayment(100000, 5, 30));
  });
});

describe('amortize', () => {
  it('ends at zero balance and splits principal and interest correctly', () => {
    const { rows, totalInterest } = amortize(300000, 6.5, 30, 0);
    expect(rows.length).toBe(360);
    expect(rows[rows.length - 1]?.balance).toBe(0);
    const sumPrincipal = rows.reduce((acc, r) => acc + r.principal, 0);
    const sumInterest = rows.reduce((acc, r) => acc + r.interest, 0);
    expect(sumPrincipal).toBeCloseTo(300000, 0);
    expect(totalInterest).toBeCloseTo(sumInterest, 0);
    // Per-row invariants: principal + interest = payment (no extras).
    for (const row of rows) {
      expect(row.principal + row.interest).toBeCloseTo(row.payment, 6);
      expect(row.extra).toBe(0);
    }
    const firstRow = rows[0];
    expect(firstRow).toBeDefined();
  });

  it('monotonically decreases balance and shifts split toward principal', () => {
    const { rows } = amortize(300000, 6.5, 30, 0);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]?.balance ?? 0).toBeLessThanOrEqual((rows[i - 1]?.balance ?? 0) + 1e-9);
    }
    const first = rows[0];
    const last = rows[rows.length - 1];
    if (!first || !last) throw new Error('missing rows');
    expect(last.principal).toBeGreaterThan(first.principal);
    expect(first.interest).toBeGreaterThan(last.interest);
  });

  it('computes baseline interest matching the no-extra schedule', () => {
    const { rows, totalInterest, baseInterest } = amortize(300000, 6.5, 30, 0);
    expect(baseInterest).toBeCloseTo(totalInterest, 6);
    expect(rows.length).toBe(360);
  });
});

describe('extra payments', () => {
  it('reduce total interest and shorten the term', () => {
    const plain = computeMortgage(state());
    const accelerated = computeMortgage(state({ extraPayment: '200' }));
    expect(plain).not.toBeNull();
    expect(accelerated).not.toBeNull();
    if (!plain || !accelerated) return;
    expect(accelerated.totalInterest).toBeLessThan(plain.totalInterest);
    expect(accelerated.payments.length).toBeLessThan(plain.payments.length);
    expect(accelerated.interestSaved).toBeGreaterThan(0);
    expect(accelerated.monthsSaved).toBeGreaterThan(0);
    const accelLast = accelerated.payments[accelerated.payments.length - 1];
    expect(accelLast?.balance).toBe(0);
    // Monthly payment includes the extra.
    expect(accelerated.monthlyPayment).toBeCloseTo(plain.baseMonthlyPayment + 200, 6);
  });

  it('large extras pay off in far fewer payments', () => {
    const big = computeMortgage(state({ extraPayment: '1000' }));
    expect(big).not.toBeNull();
    if (!big) return;
    expect(big.payments.length).toBeLessThan(240);
    expect(big.payments[big.payments.length - 1]?.balance).toBe(0);
  });

  it('zero extra produces no savings', () => {
    const result = computeMortgage(state({ extraPayment: '0' }));
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.interestSaved).toBe(0);
    expect(result.monthsSaved).toBe(0);
  });
});

describe('down payment', () => {
  it('reduces the financed amount', () => {
    const full = computeMortgage(state());
    const partial = computeMortgage(state({ downPayment: '60000' }));
    expect(full).not.toBeNull();
    expect(partial).not.toBeNull();
    if (!full || !partial) return;
    expect(partial.loanAmount).toBe(240000);
    expect(partial.monthlyPayment).toBeLessThan(full.monthlyPayment);
  });
});

describe('validateLoan rejects invalid inputs cleanly', () => {
  it('rejects zero, negative and missing amounts', () => {
    expect(validateLoan(state({ loanAmount: '0' })).error).toMatch(/greater than zero/i);
    expect(validateLoan(state({ loanAmount: '-5' })).error).toMatch(/greater than zero/i);
    expect(validateLoan(state({ loanAmount: '' })).error).toMatch(/required/i);
    expect(validateLoan(state({ loanAmount: 'abc' })).error).toMatch(/number/i);
  });

  it('rejects bad rates, terms, down payments and extras', () => {
    expect(validateLoan(state({ interestRate: '' })).error).toMatch(/required/i);
    expect(validateLoan(state({ interestRate: '-1' })).error).toMatch(/negative/i);
    expect(validateLoan(state({ termYears: '0' })).error).toMatch(/greater than zero/i);
    expect(validateLoan(state({ termYears: '' })).error).toMatch(/required/i);
    expect(validateLoan(state({ downPayment: '-10' })).error).toMatch(/negative/i);
    expect(validateLoan(state({ downPayment: '400000' })).error).toMatch(/smaller than the loan/i);
    expect(validateLoan(state({ extraPayment: '-1' })).error).toMatch(/negative/i);
  });

  it('accepts a valid loan with no error', () => {
    const { inputs, error } = validateLoan(state());
    expect(error).toBeNull();
    expect(inputs).toEqual({
      amount: 300000,
      annualRate: 6.5,
      termYears: 30,
      downPayment: 0,
      extraPayment: 0,
    });
  });

  it('computeMortgage returns null for invalid inputs', () => {
    expect(computeMortgage(state({ loanAmount: '0' }))).toBeNull();
    expect(computeMortgage(state({ termYears: '' }))).toBeNull();
    expect(resultText(state({ loanAmount: 'xyz' }))).toBeNull();
    expect(summaryText(state({ loanAmount: 'xyz' }))).toContain('enter valid');
  });
});

describe('serialization and URL state round-trips', () => {
  it('serialize/deserialize round-trips the full state', () => {
    const custom = state({
      loanAmount: '450000',
      interestRate: '5.25',
      termYears: '15',
      downPayment: '90000',
      extraPayment: '250',
      view: 'yearly',
      history: [{ text: 'snapshot', createdAt: '2026-11-22T00:00:00.000Z' }],
    });
    expect(roundTrips(custom)).toBe(true);
    const restored = deserializeState(JSON.parse(serializeState(custom)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data).toEqual(custom);
    }
  });

  it('deserialize repairs invalid payloads to defaults', () => {
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState('nope').success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
    const repaired = deserializeState({ nope: true });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.data.loanAmount).toBe(DEFAULT_STATE.loanAmount);
      expect(repaired.data.view).toBe('monthly');
      expect(repaired.data.history).toEqual([]);
    }
    const badView = deserializeState({ view: 'weekly' });
    expect(badView.success).toBe(true);
    if (badView.success) {
      expect(badView.data.view).toBe('monthly');
    }
  });

  it('caps restored history at MAX_HISTORY', () => {
    const entries = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
      text: `t${i}`,
      createdAt: '2026-11-22T00:00:00.000Z',
    }));
    const restored = deserializeState({ history: entries });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.history).toHaveLength(MAX_HISTORY);
    }
  });

  it('withHistory prepends and caps entries', () => {
    let s = state({ history: [] });
    for (let i = 0; i < MAX_HISTORY + 3; i += 1) {
      s = withHistory(s, `entry ${i}`, new Date(2026, 10, 22, 12, 0, i));
    }
    expect(s.history).toHaveLength(MAX_HISTORY);
    expect(s.history[0]?.text).toBe('entry 22');
  });

  it('tool definition exposes the canonical id and exporters', () => {
    expect(mortgageCalculatorTool.id).toBe('mortgage-payment-calculator');
    expect(mortgageCalculatorTool.initialState).toEqual(DEFAULT_STATE);
    const formats = (mortgageCalculatorTool.exporters ?? []).map((e) => e.format);
    expect(formats).toEqual(['png', 'jpeg', 'webp', 'pdf']);
  });
});

describe('formatting helpers', () => {
  it('formats currency without float noise', () => {
    expect(formatCurrency(1896.2)).toBe('$1,896.20');
    expect(formatCurrency(Number.NaN)).toBe('—');
  });
});

describe('yearly aggregation', () => {
  it('aggregates monthly rows into 12-payment years', () => {
    const { rows } = amortize(300000, 6.5, 30, 0);
    const yearly = yearlyRows(rows);
    expect(yearly.length).toBe(30);
    expect(yearly[0]?.year).toBe(1);
    expect(yearly[0]?.principal).toBeCloseTo(
      rows.slice(0, 12).reduce((a, r) => a + r.principal, 0),
      6
    );
    expect(yearly[yearly.length - 1]?.balance).toBe(0);
    // suppress possibly-undefined in strict array math above
  });
});
