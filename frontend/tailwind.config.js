/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Safelist dynamic classes used by glowtypes from database
  // Pattern matching ensures color variants are available for future glowtypes
  safelist: [
    // cardAccent gradients: from-{color}-{shade}, to-{color}-{shade}
    // Light shades (50-200) for card backgrounds
    { pattern: /^from-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200)$/ },
    { pattern: /^to-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200)$/ },
    // textColor: text-{color}-{shade}
    // Dark shades (700-950) for readable text
    { pattern: /^text-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(700|800|900|950)$/ },
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

