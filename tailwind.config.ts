import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces - one cool-navy family, no pure black.
        ink: {
          950: '#03060d',
          900: '#070b16',
          800: '#0b1222',
          700: '#111a2e',
          600: '#1a2540',
          500: '#25334f',
        },
        // Incident-type palette, validated for the dark surface (see app/utils/theme.ts).
        outage: '#e11d48',
        bgp: '#8b5cf6',
        ddos: '#0891b2',
        cable: '#d97706',
        accent: '#38bdf8',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Radius system: panels 16px, blocks 8px, controls 8px, chips pill.
      borderRadius: {
        panel: '16px',
        block: '8px',
      },
      boxShadow: {
        panel: '0 16px 48px -16px rgba(3, 6, 13, 0.85), inset 0 1px 0 0 rgba(148, 163, 184, 0.08)',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        livePulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 180ms ease-out both',
        livePulse: 'livePulse 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
