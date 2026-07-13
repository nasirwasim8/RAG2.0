/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /* =======================================================================
         DDN DESIGN SYSTEM COLORS
         These reference the CSS variables in index.css for consistency.
         To change colors, modify the CSS variables - not these values.
         ======================================================================= */
      colors: {
        /* DDN Brand Colors */
        ddn: {
          red: 'var(--ddn-red)',
          'red-hover': 'var(--ddn-red-hover)',
          'red-light': 'var(--ddn-red-light)',
          'red-dark': 'var(--ddn-red-dark)',
        },

        /* NVIDIA Colors (use only for NVIDIA-related elements) */
        nvidia: {
          green: 'var(--nvidia-green)',
          'green-light': 'var(--nvidia-green-light)',
        },

        /* Neutral Palette */
        neutral: {
          0: 'var(--neutral-0)',
          25: 'var(--neutral-25)',
          50: 'var(--neutral-50)',
          100: 'var(--neutral-100)',
          200: 'var(--neutral-200)',
          300: 'var(--neutral-300)',
          400: 'var(--neutral-400)',
          500: 'var(--neutral-500)',
          600: 'var(--neutral-600)',
          700: 'var(--neutral-700)',
          800: 'var(--neutral-800)',
          900: 'var(--neutral-900)',
          1000: 'var(--neutral-1000)',
        },

        /* Status Colors */
        status: {
          success: 'var(--status-success)',
          'success-subtle': 'var(--status-success-subtle)',
          error: 'var(--status-error)',
          'error-subtle': 'var(--status-error-subtle)',
          warning: 'var(--status-warning)',
          'warning-subtle': 'var(--status-warning-subtle)',
          info: 'var(--status-info)',
          'info-subtle': 'var(--status-info-subtle)',
        },

        /* Semantic Surfaces */
        surface: {
          base: 'var(--surface-base)',
          primary: 'var(--surface-primary)',
          secondary: 'var(--surface-secondary)',
          tertiary: 'var(--surface-tertiary)',
          card: 'var(--surface-card)',
          elevated: 'var(--surface-elevated)',
        },

        /* Semantic Text */
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverted: 'var(--text-inverted)',
        },

        /* Semantic Borders */
        border: {
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
      },

      /* Font Families */
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },

      /* Spacing using 8px grid */
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },

      /* Border Radius */
      borderRadius: {
        'xs': 'var(--radius-xs)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },

      /* Box Shadows */
      boxShadow: {
        'xs': 'var(--shadow-xs)',
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
      },

      /* Transitions */
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
