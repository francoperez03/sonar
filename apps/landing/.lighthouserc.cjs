module.exports = {
  ci: {
    collect: {
      startServerCommand: "pnpm preview --port 4173",
      url: ["http://localhost:4173/"],
      numberOfRuns: 3,
      settings: { preset: "desktop", throttlingMethod: "simulate" },
    },
    assert: {
      assertions: {
        "largest-contentful-paint": ["error", { maxNumericValue: 2000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.05 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 1500 }],
        "total-blocking-time": ["warn", { maxNumericValue: 200 }],
      },
    },
  },
};
