export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#7048E8', // Purple color from the stoppr website
        'secondary': '#1A1A3B', // Dark blue from the stoppr website
      },
      fontFamily: {
        'sans': ['Roboto', 'Inter', 'sans-serif'],
      },
      screens: {
        'xs': '375px', // Extra small devices (phones)
        // Default Tailwind breakpoints:
        // 'sm': '640px',
        // 'md': '768px',
        // 'lg': '1024px',
        // 'xl': '1280px',
        // '2xl': '1536px',
      },
    },
  },
  plugins: [],
} 