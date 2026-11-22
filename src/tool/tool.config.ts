import type { ToolConfig } from '@itsjust/core';

const toolConfig = {
  id: 'mortgage-payment-calculator',
  name: 'Mortgage Payment Calculator',
  description:
    'Calculate monthly mortgage payments, view full amortization schedules, and see total interest and cost, with extra monthly payments that shorten the payoff date.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: false,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#0ea5e9',
    accentHover: '#0284c7',
    accentSubtle: 'rgba(14, 165, 233, 0.12)',
    brand: 'Mortgage Payment Calculator',
    icon: '🏠',
  },
  shortcuts: [
    {
      title: 'Mortgage Payment Calculator',
      shortcuts: [
        {
          keys: 'Y',
          label: 'Copy result',
          description: 'copy the monthly payment to the clipboard',
        },
        {
          keys: 'V',
          label: 'Toggle view',
          description: 'switch between yearly and monthly schedule',
        },
      ],
    },
  ],
} satisfies ToolConfig;

export default toolConfig;
