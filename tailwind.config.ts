import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Aligned to the razorbled.com/ignite-safety.html marketing site's
        // accent red (#ff4d4d) as brand-500, with a slightly deeper 600/700
        // kept for button/hover states so white text stays readable.
        brand: {
          50: '#fff1f0',
          100: '#ffe1de',
          200: '#ffc7c2',
          300: '#ffa39c',
          400: '#ff7267',
          500: '#ff4d4d',
          600: '#ec2f2f',
          700: '#c81f1f',
          800: '#a01c1c',
          900: '#7e1b14',
          950: '#440a06',
        },
        ink: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
