/**
 * The palette, and why it is this one.
 *
 * The audience is a Deputy Commissioner's office. The panel has to look like an
 * instrument of record — closer to a bank statement than to a startup
 * dashboard. So: an ink-and-paper base with a slight warmth, one deep green
 * accent carried over from the ticket, and colour used only where it carries
 * meaning.
 *
 *   ink      near-black with a green bias, so it sits with the accent
 *   paper    a warm off-white; pure white looks like an unstyled page
 *   forest   the accent — the same green as the ticket header
 *   allowed / refused / pending are SEMANTIC and never decorative. A green
 *   number on this panel always means a vehicle was let in.
 */

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#101917', 800: '#1b2724', 700: '#2c3a36',
          600: '#4a5854', 500: '#6b7975', 400: '#93a09c', 300: '#c2ccc8',
        },
        paper: { DEFAULT: '#f7f8f6', raised: '#ffffff', sunken: '#eef1ee' },
        forest: {
          900: '#04302b', 700: '#0f766e', 600: '#12897f',
          500: '#19a396', 100: '#d8f0ec', 50: '#eefaf7',
        },
        allowed: { DEFAULT: '#15803d', soft: '#dcfce7' },
        refused: { DEFAULT: '#b91c1c', soft: '#fee2e2' },
        pending: { DEFAULT: '#b45309', soft: '#fef3c7' },
      },
      fontFamily: {
        // IBM Plex reads institutional rather than fashionable, which is the
        // right register for a government-facing record.
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,25,23,.06), 0 1px 3px rgba(16,25,23,.04)',
        lift: '0 8px 24px rgba(16,25,23,.10)',
      },
    },
  },
  plugins: [],
};
