const { colors, spacing, borderRadius } = require('./src/design-system/tokens/design-tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      spacing,
      borderRadius,
    },
  },
  plugins: [],
};
