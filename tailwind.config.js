/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* An admin panel is read for hours, so it is quiet: a near-neutral
           slate, one brand green for the product, and three states that mean
           the same thing everywhere — good, watch, wrong. */
        brand: { DEFAULT: '#075e54', light: '#128c7e', accent: '#00a884', deep: '#053f38' },
        ink: '#0f1a1c', body: '#37474a', muted: '#6b7f80', line: '#e4eaea', shell: '#f6f8f8',
        good: { 50: '#e9f8ef', 500: '#12a150', 700: '#0a6c34' },
        watch: { 50: '#fff6e6', 500: '#e08700', 700: '#8f5600' },
        wrong: { 50: '#fdecec', 500: '#d92d20', 700: '#912018' },
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Kannada"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: { '2xs': ['11px', '14px'] },
      boxShadow: {
        card: '0 1px 2px rgba(15,26,28,.04), 0 1px 3px rgba(15,26,28,.03)',
        pop: '0 12px 32px rgba(15,26,28,.12)',
      },
    },
  },
  plugins: [],
};
