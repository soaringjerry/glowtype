/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Safelist dynamic classes used by glowtypes from database
  // These classes are not statically referenced in code, so Tailwind would purge them
  safelist: [
    // cardAccent gradients
    'from-indigo-50', 'to-blue-50',
    'from-rose-50', 'to-orange-50',
    'from-teal-50', 'to-emerald-50',
    'from-amber-50', 'to-yellow-50',
    // textColor classes
    'text-indigo-900',
    'text-rose-900',
    'text-teal-900',
    'text-amber-900',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

