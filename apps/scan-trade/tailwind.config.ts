import type { Config } from 'tailwindcss';

/**
 * Scan Trade design tokens.
 *
 * The palette is deliberately small: a near-black canvas, two elevated surfaces,
 * two text weights and three accents used sparingly (§27/§28 of the product spec).
 * Accents carry meaning — green = long/valid, red = short/risk, orange = caution —
 * so they must never be used for decoration.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#080A0F',
        surface: {
          DEFAULT: '#10131A',
          raised: '#171B23',
        },
        border: {
          DEFAULT: '#1F242E',
          strong: '#2B323F',
        },
        content: {
          DEFAULT: '#F5F7FA',
          muted: '#8D96A5',
          faint: '#5C6675',
        },
        accent: {
          DEFAULT: '#22C55E',
          soft: 'rgba(34, 197, 94, 0.12)',
          border: 'rgba(34, 197, 94, 0.28)',
        },
        danger: {
          DEFAULT: '#EF4444',
          soft: 'rgba(239, 68, 68, 0.12)',
          border: 'rgba(239, 68, 68, 0.28)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          soft: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.28)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        'display-lg': ['clamp(2.5rem, 6vw, 4.25rem)', { lineHeight: '1.04', letterSpacing: '-0.03em' }],
        display: ['clamp(2rem, 4.5vw, 3rem)', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        heading: ['clamp(1.375rem, 2.5vw, 1.75rem)', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        metric: ['clamp(1.5rem, 3vw, 2rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255, 255, 255, 0.03) inset, 0 12px 32px -20px rgba(0, 0, 0, 0.9)',
        lift: '0 24px 60px -30px rgba(0, 0, 0, 0.95)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'progress-indeterminate': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        'fade-up': 'fade-up 220ms ease-out both',
        'slide-down': 'slide-down 160ms ease-out both',
        shimmer: 'shimmer 1.6s infinite',
        'progress-indeterminate': 'progress-indeterminate 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
