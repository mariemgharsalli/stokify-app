/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "app-bg": "var(--bg-app)",
        "card-bg": "var(--bg-card)",
        "input-bg": "var(--bg-input)",
        "sidebar-bg": "var(--bg-sidebar)",
        border: "var(--border-default)",
        "text-main": "var(--text-primary)",
        "text-sub": "var(--text-secondary)",
        /** Palette principale Stokify — bleu #378ADD */
        accent: {
          50: "#eef6fd",
          100: "#d6ebfa",
          200: "#adcdf5",
          300: "#7fb0ef",
          400: "#5596e8",
          500: "#378ADD",
          600: "#2a6db1",
          700: "#1f5285",
          800: "#15385a",
          900: "#0c2033",
        },
        /** Actions destructives / alertes critiques */
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
        },
        navy: {
          50: "#e8eef7",
          100: "#c9d5eb",
          200: "#94a8d4",
          300: "#5f7ab8",
          400: "#3d5a9a",
          500: "#2c4478",
          600: "#23365f",
          700: "#1a2848",
          800: "#121c35",
          900: "#0c1428",
          950: "#070d1a",
        },
        brand: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
        },
        surface: {
          50: "#f8fafc",
          100: "#1e293b",
          200: "#172033",
          300: "#0f172a",
          400: "#0a0f1a",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Outfit", "DM Sans", "system-ui", "sans-serif"],
        mono: ["Space Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(55, 138, 221, 0.35)",
        "glow-navy": "0 0 60px -15px rgba(44, 68, 120, 0.5)",
        card: "0 4px 24px -4px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.06)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-12px) rotate(1deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "fade-up": "fade-up 0.6s ease-out forwards",
        "gradient-x": "gradient-x 8s ease infinite",
        "pulse-soft": "pulseSoft 4s ease-in-out infinite",
      },
      backgroundSize: {
        "300%": "300% 100%",
      },
      transitionProperty: {
        theme: "background-color, color, border-color, fill, stroke",
      },
    },
  },
  plugins: [],
};
