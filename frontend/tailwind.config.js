/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: "#FFC107",
          "yellow-hover": "#E6AC00",
          dark: "#1A1A1A",
          bg: "#F5F5F5",
          card: "#FFFFFF",
          border: "#E5E5E5",
          text: "#111111",
          muted: "#666666",
        },
      },
    },
  },
  plugins: [],
};
