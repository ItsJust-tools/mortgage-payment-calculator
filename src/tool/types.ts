export type ScheduleView = 'monthly' | 'yearly';

export interface HistoryEntry {
  /** Short human readable description of the calculation. */
  text: string;
  /** ISO timestamp when the entry was saved. */
  createdAt: string;
}

export interface ToolState {
  /** Loan amount (home price basis for the loan). */
  loanAmount: string;
  /** Annual interest rate in percent (e.g. 6.5). */
  interestRate: string;
  /** Loan term in years. */
  termYears: string;
  /** Down payment amount, subtracted from loan amount for financed amount. */
  downPayment: string;
  /** Extra payment added to every monthly payment. */
  extraPayment: string;
  /** Amortization table granularity. */
  view: ScheduleView;
  /** Saved calculation history, newest first. */
  history: HistoryEntry[];
}

export const DEFAULT_STATE: ToolState = {
  loanAmount: '300000',
  interestRate: '6.5',
  termYears: '30',
  downPayment: '0',
  extraPayment: '0',
  view: 'monthly',
  history: [],
};

export const MAX_HISTORY = 20;

/** Parse a plain decimal number; returns null for empty/unparseable input. */
export function parseNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** True when the string parses to a usable positive number (or zero). */
export function isValidNonNegative(input: string): boolean {
  const value = parseNumber(input);
  return value !== null && value >= 0;
}

export interface LoanInputs {
  amount: number;
  annualRate: number;
  termYears: number;
  downPayment: number;
  extraPayment: number;
}

export interface AmortizationRow {
  /** 1-based payment index. */
  index: number;
  /** Payment applied this period. */
  payment: number;
  principal: number;
  interest: number;
  extra: number;
  balance: number;
  /** Cumulative interest paid so far. */
  totalInterest: number;
}

export interface MortgageResult {
  /** Financed amount after down payment. */
  loanAmount: number;
  /** Standard monthly payment (including regular payment + extra). */
  monthlyPayment: number;
  /** Payment without extra. */
  baseMonthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  payments: AmortizationRow[];
  /** Year in which the loan is paid off, relative to start (1-based). */
  payoffYears: number;
  /** Total number of scheduled payments for the term. */
  termMonths: number;
  /** Interest saved versus the no-extra-payment schedule. */
  interestSaved: number;
  /** Months removed from the term by extra payments. */
  monthsSaved: number;
  /** Validation error message, or null when inputs are usable. */
  error: string | null;
}

/** Validate raw state fields into loan inputs, or a clean error message. */
export function validateLoan(state: ToolState): {
  inputs: LoanInputs | null;
  error: string | null;
} {
  const amount = parseNumber(state.loanAmount);
  const annualRate = parseNumber(state.interestRate);
  const termYears = parseNumber(state.termYears);
  const downPayment = parseNumber(state.downPayment);
  const extraPayment = parseNumber(state.extraPayment);

  if (amount === null) {
    return { inputs: null, error: 'Loan amount is required and must be a number.' };
  }
  if (amount <= 0) {
    return { inputs: null, error: 'Loan amount must be greater than zero.' };
  }
  if (annualRate === null) {
    return { inputs: null, error: 'Interest rate is required and must be a number.' };
  }
  if (annualRate < 0) {
    return { inputs: null, error: 'Interest rate cannot be negative.' };
  }
  if (termYears === null) {
    return { inputs: null, error: 'Loan term is required and must be a number.' };
  }
  if (termYears <= 0) {
    return { inputs: null, error: 'Loan term must be greater than zero years.' };
  }
  if (downPayment === null || downPayment < 0) {
    return { inputs: null, error: 'Down payment cannot be negative.' };
  }
  if (downPayment >= amount) {
    return { inputs: null, error: 'Down payment must be smaller than the loan amount.' };
  }
  if (extraPayment === null || extraPayment < 0) {
    return { inputs: null, error: 'Extra payment cannot be negative.' };
  }

  return {
    inputs: {
      amount,
      annualRate,
      termYears,
      downPayment,
      extraPayment,
    },
    error: null,
  };
}

/**
 * Standard fully-amortizing monthly payment:
 *   P = L * r / (1 - (1 + r)^-n)
 * with r = monthly rate, n = number of payments. For a 0% rate the payment
 * is a plain L / n split.
 */
export function monthlyPayment(loanAmount: number, annualRate: number, termYears: number): number {
  const n = Math.round(termYears * 12);
  if (n <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return loanAmount / n;
  return (loanAmount * r) / (1 - Math.pow(1 + r, -n));
}

/**
 * Build the amortization schedule for the loan. `extra` is added to every
 * payment, shortening the term. Interest saved and months saved are computed
 * against the same loan without extras (0 when there is no extra payment).
 */
export function amortize(
  loanAmount: number,
  annualRate: number,
  termYears: number,
  extra = 0
): { rows: AmortizationRow[]; totalInterest: number; baseInterest: number } {
  const n = Math.round(termYears * 12);
  const financed = loanAmount;
  const r = annualRate / 100 / 12;
  const base = monthlyPayment(financed, annualRate, termYears);
  const rows: AmortizationRow[] = [];
  let balance = financed;
  let totalInterest = 0;
  let paymentIndex = 0;

  // Baseline schedule interest (no extras) for savings comparison.
  let baseBalance = financed;
  let baseInterest = 0;
  for (let i = 0; i < n && baseBalance > 0; i += 1) {
    const interest = baseBalance * r;
    const principal = Math.min(base - interest, baseBalance);
    baseInterest += interest;
    baseBalance = Math.max(baseBalance - principal, 0);
  }

  while (balance > 0 && paymentIndex < n * 3 + 12) {
    paymentIndex += 1;
    const interest = balance * r;
    const target = base + extra;
    const principalBeforeCap = target - interest;
    if (principalBeforeCap <= 0) {
      // Payment cannot cover interest; invalid loan shape. Bail out cleanly.
      return { rows: [], totalInterest: Number.NaN, baseInterest };
    }
    const principal = Math.min(principalBeforeCap, balance);
    const actualPayment = interest + principal;
    balance = Math.max(balance - principal, 0);
    totalInterest += interest;
    rows.push({
      index: paymentIndex,
      payment: actualPayment,
      principal,
      interest,
      extra: Math.max(principal - (base - interest), 0),
      balance,
      totalInterest,
    });
    const lastRow = rows[rows.length - 1];
    if (balance <= 0.005 && lastRow) {
      balance = 0;
      lastRow.balance = 0;
      break;
    }
  }

  return { rows, totalInterest, baseInterest };
}

/** Round a monetary value to cents. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Full mortgage computation from raw state, or a clean error. */
export function computeMortgage(state: ToolState): MortgageResult | null {
  const { inputs } = validateLoan(state);
  if (!inputs) return null;

  const { amount, annualRate, termYears, downPayment, extraPayment } = inputs;
  const financed = amount - downPayment;
  const n = Math.round(termYears * 12);
  const base = monthlyPayment(financed, annualRate, termYears);
  const { rows, totalInterest } = amortize(financed, annualRate, termYears, extraPayment);
  if (Number.isNaN(totalInterest)) return null;

  const baseline = amortize(financed, annualRate, termYears, 0);
  const interestSaved = Math.max(baseline.totalInterest - totalInterest, 0);
  const monthsSaved = Math.max(baseline.rows.length - rows.length, 0);
  const payment = extraPayment > 0 ? base + extraPayment : base;

  return {
    loanAmount: financed,
    monthlyPayment: payment,
    baseMonthlyPayment: base,
    totalInterest: round2(totalInterest),
    totalCost: round2(financed + totalInterest),
    payments: rows,
    payoffYears: Math.ceil(rows.length / 12) || 1,
    termMonths: n,
    interestSaved: round2(interestSaved),
    monthsSaved,
    error: null,
  };
}

/** Human-readable result line for the active state, or null. */
export function resultText(state: ToolState): string | null {
  const result = computeMortgage(state);
  if (!result) return null;
  return `${formatCurrency(result.monthlyPayment)}/mo`;
}

/** Format a currency amount (USD, no cents unless needed). */
export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

/** Compact summary used by the status bar and copy actions. */
export function summaryText(state: ToolState): string {
  const result = computeMortgage(state);
  if (!result) return 'Mortgage: enter valid loan inputs';
  return `${formatCurrency(result.monthlyPayment)}/mo · ${result.payments.length} payments · ${formatCurrency(result.totalInterest)} interest`;
}

/** Build a history entry text for the current state. */
export function historyText(state: ToolState): string {
  return summaryText(state);
}

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return typeof v.loanAmount === 'string' && typeof v.interestRate === 'string';
}
