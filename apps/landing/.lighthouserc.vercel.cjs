const url = process.env.LHCI_VERCEL_URL;
if (!url) {
  throw new Error(
    "LHCI_VERCEL_URL environment variable is required for the Vercel-preview LHCI run."
  );
}
module.exports = {
  ci: {
    collect: {
      url: [url],
      numberOfRuns: 3,
      settings: { preset: "desktop", throttlingMethod: "simulate" },
      // NOTE: no startServerCommand — collecting against the remote Vercel CDN.
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
