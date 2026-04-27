import express from 'express';

/**
 * Configured express.json body parser with a 1mb limit.
 * Per RESEARCH Pitfall 4: explicit limit prevents unbounded payload DoS (T-03-15).
 */
export const jsonBody = express.json({ limit: '1mb' });
