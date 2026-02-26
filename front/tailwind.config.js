/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    screens: {
      'sm': '500px',
      'md': '800px',
      'lg': '1000px',
    },
    extend: {
      maxWidth: {
        'wide': '1400px',
        'ultra': '1600px',
      },
      colors: {
        night: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        accent: {
          DEFAULT: '#f59e0b',  // Amber-500
          light: '#fbbf24',     // Amber-400
          dark: '#d97706',      // Amber-600
        },
        surface: {
          DEFAULT: '#ffffff',
          'glass': 'rgba(255,255,255,0.85)',
        }
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0,0,0,0.08)',
        'card-hover': '0 12px 40px rgba(0,0,0,0.15)',
        'glass': '0 8px 32px rgba(0,0,0,0.1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['var(--fs-xs)', { lineHeight: '1.2' }],
        sm: ['var(--fs-sm)', { lineHeight: '1.35' }],
        base: ['var(--fs-base)', { lineHeight: '1.5' }],
        lg: ['var(--fs-lg)', { lineHeight: '1.55' }],
        xl: ['var(--fs-xl)', { lineHeight: '1.45' }],
        '2xl': ['var(--fs-2xl)', { lineHeight: '1.25' }],
        '3xl': ['var(--fs-3xl)', { lineHeight: '1.15' }],
        '4xl': ['var(--fs-4xl)', { lineHeight: '1.08' }],
        '5xl': ['var(--fs-5xl)', { lineHeight: '1.03' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-subtle': 'bounceSubtle 0.6s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
};
