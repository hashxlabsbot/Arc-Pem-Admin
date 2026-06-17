import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#3b82f6',
          navy: '#0f172a',
          green: '#10b981',
        },
      },
    },
  },
  plugins: [],
}

export default config
