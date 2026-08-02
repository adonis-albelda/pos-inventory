/**
 * Kept out of dead-stock-days.tsx because that file is a client component, and
 * a plain value exported across the client boundary reaches the server as a
 * module reference rather than the array itself.
 */
export const DEAD_STOCK_WINDOWS = [30, 60, 90];

export const DEAD_STOCK_DEFAULT_DAYS = 60;
