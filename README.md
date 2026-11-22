# Mortgage Payment Calculator

Calculate monthly mortgage payments, explore a full amortization schedule, and see total interest and total cost — with extra monthly payments that cut interest and shorten the payoff date.

**Live:** mortgage-payment-calculator (see deployment/DNS for the live URL)

## Features

- Loan inputs: amount, annual interest rate, term years, down payment and extra monthly payment
- Monthly payment via the standard amortization formula `P = L·r / (1 − (1+r)^−n)`
- Full amortization table with per-payment principal/interest split and running balance
- Extra payment support: total interest saved and months removed from the term
- Summary cards for monthly payment, total interest, total cost and payoff
- Interactive balance-over-time chart of the remaining loan balance
- Yearly vs monthly schedule view toggle
- Save payment snapshots to history, copy results, and share state via URL
- `.itsjust.json` import/export plus png/jpeg/webp/pdf export
- 100% client-side — no data ever leaves your browser

## Keyboard shortcuts

| Key | Action                     |
| --- | -------------------------- |
| `Y` | Copy the monthly payment   |
| `V` | Toggle yearly/monthly view |

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t itsjust-mortgage-payment-calculator .
docker run -p 3000:3000 itsjust-mortgage-payment-calculator
```

## License

MIT
