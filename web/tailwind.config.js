/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme: "Warm Vault"
        vault: {
          terracotta: '#C8553D',
          indigo: '#1F2A44',
          cream: '#FFF6EC',
          sage: '#7A9E7E',
          sand: '#F4ECE1',
          surface: '#FDFBF7',
          border: '#E8DFD3',
          dark: {
            bg: '#141B2D',
            surface: '#1F2A44',
            surface2: '#283556',
            border: '#2E3D63',
            amber: '#E8A857',
            text: '#F5EFE6',
            muted: '#96A4C2',
          }
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Hind Siliguri"', 'sans-serif'],
      },
      borderRadius: {
        'room': '18px',
        'bubble-in': '16px 16px 16px 4px',
        'bubble-out': '16px 16px 4px 16px',
      },
      boxShadow: {
        'vault-glow': '0 0 20px -3px rgba(200, 85, 61, 0.25)',
        'amber-glow': '0 0 15px 0 rgba(232, 168, 87, 0.3)',
      }
    },
  },
  plugins: [],
}
