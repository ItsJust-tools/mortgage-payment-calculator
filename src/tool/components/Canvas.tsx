'use client';

import React from 'react';
import {
  computeMortgage,
  formatCurrency,
  summaryText,
  type AmortizationRow,
  type ToolState,
} from '../types';
import { yearlyRows } from '../ui-shared';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
}

const numberInputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

function NumberField({
  label,
  value,
  onChangeState,
  testid,
  suffix,
}: {
  label: string;
  value: string;
  onChangeState: (next: string) => void;
  testid: string;
  suffix?: string;
}) {
  return (
    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
      {label}
      {suffix ? <span className="ml-1 text-gray-500">{suffix}</span> : null}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChangeState(e.target.value)}
        data-testid={testid}
        className={numberInputClass}
      />
    </label>
  );
}

function SummaryCard({ label, value, testid }: { label: string; value: string; testid?: string }) {
  return (
    <div
      data-testid={testid}
      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}

/** Simple SVG line chart of remaining balance over time. */
function BalanceChart({ rows }: { rows: AmortizationRow[] }) {
  if (rows.length === 0) return null;
  const width = 640;
  const height = 200;
  const pad = 8;
  const maxBalance = rows[0]?.balance || 1;
  const points = rows
    .filter((_, i) => i % Math.max(Math.ceil(rows.length / 120), 1) === 0 || i === rows.length - 1)
    .map((row, i, arr) => {
      const x = pad + i * ((width - pad * 2) / Math.max(arr.length - 1, 1));
      const y = height - pad - (row.balance / maxBalance) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      data-testid="balance-chart"
      viewBox={`0 0 ${width} ${height}`}
      className="mt-4 w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      role="img"
      aria-label="Remaining loan balance over time"
    >
      <polyline
        points={points}
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onSaveHistory }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const result = computeMortgage(state);
  const [saved, setSaved] = React.useState(false);

  const saveSnapshot = React.useCallback(() => {
    if (!onSaveHistory || !result) return;
    onSaveHistory(summaryText(state));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }, [onSaveHistory, result, state]);

  return (
    <div className="p-4 space-y-6" data-testid="mortgage-canvas">
      <section aria-label="Loan inputs">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField
            label="Loan amount"
            suffix="$"
            value={state.loanAmount}
            onChangeState={(v) => update({ loanAmount: v })}
            testid="input-loan-amount"
          />
          <NumberField
            label="Interest rate"
            suffix="% / year"
            value={state.interestRate}
            onChangeState={(v) => update({ interestRate: v })}
            testid="input-interest-rate"
          />
          <NumberField
            label="Term"
            suffix="years"
            value={state.termYears}
            onChangeState={(v) => update({ termYears: v })}
            testid="input-term-years"
          />
          <NumberField
            label="Down payment"
            suffix="$"
            value={state.downPayment}
            onChangeState={(v) => update({ downPayment: v })}
            testid="input-down-payment"
          />
          <NumberField
            label="Extra monthly payment"
            suffix="$"
            value={state.extraPayment}
            onChangeState={(v) => update({ extraPayment: v })}
            testid="input-extra-payment"
          />
        </div>
      </section>

      {result ? (
        <>
          <section aria-label="Summary">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                label="Monthly payment"
                value={formatCurrency(result.monthlyPayment)}
                testid="card-monthly-payment"
              />
              <SummaryCard
                label="Total interest"
                value={formatCurrency(result.totalInterest)}
                testid="card-total-interest"
              />
              <SummaryCard
                label="Total cost"
                value={formatCurrency(result.totalCost)}
                testid="card-total-cost"
              />
              <SummaryCard
                label="Payoff"
                value={`${result.payments.length} payments · ${result.payoffYears} yr`}
                testid="card-payoff"
              />
            </div>
            {result.interestSaved > 0 || result.monthsSaved > 0 ? (
              <p
                data-testid="extra-savings"
                className="mt-3 text-sm text-emerald-600 dark:text-emerald-400"
              >
                Extra payments save {formatCurrency(result.interestSaved)} in interest and shorten
                the loan by {result.monthsSaved} month{result.monthsSaved === 1 ? '' : 's'}.
              </p>
            ) : null}
          </section>

          <BalanceChart rows={result.payments} />

          <section aria-label="Amortization schedule">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Amortization schedule
              </h3>
              <div
                role="group"
                aria-label="Schedule view"
                className="flex overflow-hidden rounded-md border border-gray-300 text-xs dark:border-gray-700"
              >
                {(['monthly', 'yearly'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    data-testid={`view-${v}`}
                    aria-pressed={state.view === v}
                    onClick={() => update({ view: v })}
                    className={`px-3 py-1.5 font-medium ${
                      state.view === v
                        ? 'bg-sky-500 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {v === 'monthly' ? 'Monthly' : 'Yearly'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={saveSnapshot}
                data-testid="btn-save-snapshot"
                className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {saved ? 'Saved!' : 'Save snapshot'}
              </button>
            </div>

            {state.view === 'monthly' ? (
              <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-right text-xs" data-testid="schedule-monthly">
                  <thead className="bg-gray-50 text-left text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Payment</th>
                      <th className="px-3 py-2 font-medium">Principal</th>
                      <th className="px-3 py-2 font-medium">Interest</th>
                      <th className="px-3 py-2 font-medium">Extra</th>
                      <th className="px-3 py-2 font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.payments.map((row) => (
                      <tr key={row.index} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-1.5 text-gray-500">{row.index}</td>
                        <td className="px-3 py-1.5">{formatCurrency(row.payment)}</td>
                        <td className="px-3 py-1.5">{formatCurrency(row.principal)}</td>
                        <td className="px-3 py-1.5">{formatCurrency(row.interest)}</td>
                        <td className="px-3 py-1.5">{formatCurrency(row.extra)}</td>
                        <td className="px-3 py-1.5">{formatCurrency(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-right text-xs" data-testid="schedule-yearly">
                  <thead className="bg-gray-50 text-left text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Year</th>
                      <th className="px-3 py-2 font-medium">Principal</th>
                      <th className="px-3 py-2 font-medium">Interest</th>
                      <th className="px-3 py-2 font-medium">Extra</th>
                      <th className="px-3 py-2 font-medium">End balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyRows(result.payments).map((row) => (
                      <tr key={row.year} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-1.5 text-gray-500">{row.year}</td>
                        <td className="px-3 py-1.5">{formatCurrency(row.principal)}</td>
                        <td className="px-3 py-1.5">{formatCurrency(row.interest)}</td>
                        <td className="px-3 py-1.5">{formatCurrency(row.extra)}</td>
                        <td className="px-3 py-1.5">{formatCurrency(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <div
          data-testid="validation-error"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        >
          {state.loanAmount.trim() === '' ||
          state.interestRate.trim() === '' ||
          state.termYears.trim() === ''
            ? 'Enter a loan amount, interest rate and term to calculate the monthly payment.'
            : 'Loan inputs are invalid. Loan amount must be positive, the rate non-negative, the term at least one year, and the down payment smaller than the loan amount.'}
        </div>
      )}
    </div>
  );
};
