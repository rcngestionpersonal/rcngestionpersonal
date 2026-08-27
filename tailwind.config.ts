import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: 'var(--bg)',
        'bg-alt': 'var(--bg-alt)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'input-bg': 'var(--input-bg)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        text: 'var(--text)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        brand: 'var(--brand)',
        'brand-dim': 'var(--brand-dim)',
        'brand-line': 'var(--brand-line)',
        'brand-contrast': 'var(--brand-contrast)',
        accent: 'var(--accent)',
        'accent-dim': 'var(--accent-dim)',
        'accent-line': 'var(--accent-line)',
        'accent-contrast': 'var(--accent-contrast)',
        danger: 'var(--danger)',
        'danger-dim': 'var(--danger-dim)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
      },
      backgroundImage: {
        grad: 'var(--grad)',
      },
      // 100vh no considera la barra de direcciones movil (aparece/desaparece
      // al hacer scroll, cambiando el alto disponible y "saltando" cualquier
      // elemento medido en vh) - 100dvh si (Fase 7, seccion 7.2). Se
      // redefine aqui una sola vez en vez de tocar cada h-screen/min-h-screen
      // por separado.
      height: {
        screen: '100dvh',
      },
      minHeight: {
        screen: '100dvh',
      },
    },
  },
  plugins: [],
}
export default config
