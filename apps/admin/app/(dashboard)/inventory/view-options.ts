export const STOCK_STATES = ["all", "attention", "low", "out", "oversold", "healthy", "hidden"] as const;
export type StockState = (typeof STOCK_STATES)[number];

export const STOCK_STATE_LABELS: Record<StockState, string> = {
  all: "All products",
  attention: "Needs attention",
  low: "Low stock",
  out: "Out of stock",
  oversold: "Oversold",
  healthy: "In stock",
  hidden: "Hidden from terminals",
};

export const STOCK_SORTS = [
  "name",
  "stock-asc",
  "stock-desc",
  "short-desc",
  "value-desc",
] as const;
export type StockSort = (typeof STOCK_SORTS)[number];

export const STOCK_SORT_LABELS: Record<StockSort, string> = {
  name: "Name (A–Z)",
  "stock-asc": "Stock, lowest first",
  "stock-desc": "Stock, highest first",
  "short-desc": "Furthest below reorder point",
  "value-desc": "Money tied up, highest first",
};

export function isStockState(value: string | undefined): value is StockState {
  return STOCK_STATES.includes((value ?? "") as StockState);
}

export function isStockSort(value: string | undefined): value is StockSort {
  return STOCK_SORTS.includes((value ?? "") as StockSort);
}

export const MOVEMENTS_PAGE_SIZE = 25;
