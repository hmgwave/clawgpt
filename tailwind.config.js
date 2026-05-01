module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "aisymetry-bg": "#0a1628",
        "primary-gold": "#c9922a",
        "warm-gold": "#d9a347",
        "soft-gold": "#e5b660",
        cream: "#f5f0e6",
        aisymetry: {
          background: "#0a1628",
          gold: "#c9922a",
          warm: "#d9a347",
          soft: "#e5b660",
          cream: "#f5f0e6",
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', "sans-serif"],
        serif: ['"Fraunces"', "serif"],
      },
    },
  },
  plugins: [],
};
