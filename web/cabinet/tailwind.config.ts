import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: '0.75rem',
        sm: '0.75rem',
        // Радиус контролов из макета админки: кнопки и поля заметно
        // квадратнее карточек, иначе кнопка читается пилюлей.
        btn: '0.625rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'nav-tip-in': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'fortune-winners-marquee': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        // Тост: всплывает снизу с лёгким увеличением, уходит вниз и тает
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-out': {
          from: { opacity: '1', transform: 'translateY(0) scale(1)' },
          to: { opacity: '0', transform: 'translateY(10px) scale(0.96)' },
        },
        // Иконка тоста «выпрыгивает»
        'toast-icon': {
          '0%': { transform: 'scale(0)' },
          '60%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
        // Строка ноды вспыхивает зелёным после оплаты
        'infra-flash': {
          '0%': { backgroundColor: 'rgb(16 185 129 / 0.32)', borderColor: 'rgb(16 185 129 / 0.9)' },
          '100%': {},
        },
        // Полоска оставшегося времени
        'toast-progress': {
          from: { transform: 'scaleX(1)' },
          to: { transform: 'scaleX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out both',
        'nav-tip-in': 'nav-tip-in 0.15s ease-out both',
        'spin-slow': 'spin-slow 2s linear infinite',
        'fortune-winners-marquee': 'fortune-winners-marquee 250s linear infinite',
        'toast-in': 'toast-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'toast-out': 'toast-out 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'toast-icon': 'toast-icon 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'toast-progress': 'toast-progress linear forwards',
        'infra-flash': 'infra-flash 1.4s cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}

export default config
