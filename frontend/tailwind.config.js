/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Safelist dynamic classes used by glowtypes from database
  // Pattern matching ensures all color variants are available for future glowtypes
  safelist: [
    // cardAccent: from-{color}-50, to-{color}-50
    { pattern: /^from-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-50$/ },
    { pattern: /^to-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-50$/ },
    // textColor: text-{color}-900
    { pattern: /^text-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-900$/ },
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

