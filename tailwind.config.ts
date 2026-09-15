import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Quiet monochrome chrome: near-black paper, one hairline, three ink steps.
        // No hue lives in the chrome; colour is reserved for data marks and status.
        paper: { DEFAULT: '#101010', 2: '#161616', 3: '#1c1c1c' },
        well: { DEFAULT: '#0a0a0a', deep: '#060606' },
        line: { DEFAULT: '#404040', strong: '#5a5a5a', soft: '#262626' },
        fg: { DEFAULT: '#f5f5f5', soft: '#a0a0a0', mute: '#787878' },
        // Incident-type palette, categorical (see app/utils/theme.ts).
        outage: '#e11d48',
        bgp: '#8b5cf6',
        ddos: '#0891b2',
        cable: '#d97706',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Radius system: panels 16px, tiles 10px, controls 8px, chips pill.
      borderRadius: {
        panel: '16px',
        tile: '10px',
        block: '8px',
      },
      transitionTimingFunction: {
        house: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        livePulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 400ms cubic-bezier(0.16, 1, 0.3, 1) both',
        livePulse: 'livePulse 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
