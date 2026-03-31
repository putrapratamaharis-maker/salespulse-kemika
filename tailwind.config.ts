import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Helvetica Light", "Helvetica Neue Light", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          muted: "hsl(var(--sidebar-muted))",
        },
        kpi: {
          blue: "hsl(var(--kpi-blue))",
          "blue-fg": "hsl(var(--kpi-blue-fg))",
          "blue-border": "hsl(var(--kpi-blue-border))",
          teal: "hsl(var(--kpi-teal))",
          "teal-fg": "hsl(var(--kpi-teal-fg))",
          "teal-border": "hsl(var(--kpi-teal-border))",
          amber: "hsl(var(--kpi-amber))",
          "amber-fg": "hsl(var(--kpi-amber-fg))",
          "amber-border": "hsl(var(--kpi-amber-border))",
          purple: "hsl(var(--kpi-purple))",
          "purple-fg": "hsl(var(--kpi-purple-fg))",
          "purple-border": "hsl(var(--kpi-purple-border))",
          rose: "hsl(var(--kpi-rose))",
          "rose-fg": "hsl(var(--kpi-rose-fg))",
          "rose-border": "hsl(var(--kpi-rose-border))",
          emerald: "hsl(var(--kpi-emerald))",
          "emerald-fg": "hsl(var(--kpi-emerald-fg))",
          "emerald-border": "hsl(var(--kpi-emerald-border))",
          indigo: "hsl(var(--kpi-indigo))",
          "indigo-fg": "hsl(var(--kpi-indigo-fg))",
          "indigo-border": "hsl(var(--kpi-indigo-border))",
          orange: "hsl(var(--kpi-orange))",
          "orange-fg": "hsl(var(--kpi-orange-fg))",
          "orange-border": "hsl(var(--kpi-orange-border))",
          cyan: "hsl(var(--kpi-cyan))",
          "cyan-fg": "hsl(var(--kpi-cyan-fg))",
          "cyan-border": "hsl(var(--kpi-cyan-border))",
          slate: "hsl(var(--kpi-slate))",
          "slate-fg": "hsl(var(--kpi-slate-fg))",
          "slate-border": "hsl(var(--kpi-slate-border))",
        },
        status: {
          green: "hsl(var(--status-green))",
          "green-bg": "hsl(var(--status-green-bg))",
          yellow: "hsl(var(--status-yellow))",
          "yellow-bg": "hsl(var(--status-yellow-bg))",
          red: "hsl(var(--status-red))",
          "red-bg": "hsl(var(--status-red-bg))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
