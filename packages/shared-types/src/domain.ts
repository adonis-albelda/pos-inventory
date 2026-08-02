/**
 * The domain shapes both apps agree on.
 *
 * Mobile writes the same `sales` and `sale_items` rows that admin reads for
 * reporting, so these live here rather than being declared twice.
 */

export type UserRole = "cashier" | "admin" | "device";
export type PaymentMethod = "cash" | "gcash" | "card" | "other";
export type SaleStatus = "completed" | "voided" | "refunded";
export type InventoryReason =
  | "sale"
  | "restock"
  | "adjustment"
  | "oversell_correction"
  | "void_restore";

/** Local-only. Never sent to Supabase — it describes a row's push state. */
export type SyncStatus = "pending" | "synced" | "failed";

/**
 * How a product is sold across the counter. A hardware store sells wire by the
 * metre, cement by the bag, and screws by the piece — the unit belongs to the
 * product, not to the line item.
 */
export const PRODUCT_UNITS = [
  "pc",
  "box",
  "set",
  "pack",
  "roll",
  "sheet",
  "m",
  "ft",
  "kg",
  "l",
  "gal",
  "bag",
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export function isProductUnit(value: string): value is ProductUnit {
  return (PRODUCT_UNITS as readonly string[]).includes(value);
}

/**
 * How a cashier or owner reads a unit on a receipt or a form. Kept here so the
 * POS and the admin dashboard never invent different words for the same unit.
 */
export const UNIT_LABELS: Record<ProductUnit, string> = {
  pc: "Piece",
  box: "Box",
  set: "Set",
  pack: "Pack",
  roll: "Roll",
  sheet: "Sheet",
  m: "Metre",
  ft: "Foot",
  kg: "Kilogram",
  l: "Litre",
  gal: "Gallon",
  bag: "Bag",
};

/** Short label for a receipt or a quantity stepper: "3 m", "2 bag". */
export function formatUnit(quantity: number, unit: ProductUnit): string {
  return `${quantity} ${unit}`;
}

/** The shop's day, matching `public.store_timezone()` in Postgres. */
export const STORE_TIME_ZONE = "Asia/Manila";

/**
 * Who the shop is. One row in Postgres, edited in admin, pulled read-only to
 * every terminal so the POS header can carry the real name and logo instead of
 * a constant compiled into the app.
 */
export interface StoreSettings {
  name: string;
  /** Public URL of the uploaded logo, or null while the name stands alone. */
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  /** Printed under the total. Null keeps the receipt's built-in footer. */
  receiptFooter: string | null;
  updatedAt: string;
}

/**
 * What a surface renders before the first pull lands — a terminal being set up
 * has an empty local table and still has to draw a header.
 */
export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  name: "DOUBLE A",
  logoUrl: null,
  address: null,
  phone: null,
  receiptFooter: null,
  updatedAt: "",
};

/** The letter drawn in the logo well when there is no image to show. */
export function storeInitial(name: string): string {
  return (name.trim()[0] ?? "A").toUpperCase();
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  updatedAt: string;
}

/** A node in the category tree, e.g. Plumbing / Pipes / PVC. */
export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  updatedAt: string;
}

/** A category with its ancestry resolved, ready to render as a tree. */
export interface CategoryNode extends Category {
  path: string;
  depth: number;
  children: CategoryNode[];
}

/**
 * What `public.category_path()` joins a tree with: "Plumbing / Pipes / PVC".
 * Products carry that flattened path for receipts and reports, so anything
 * building or reading a path apart has to use exactly this.
 *
 * Filtering by category is done on ids, never on this text: a product keeps the
 * path it was sold under even after the category itself is deleted.
 */
export const CATEGORY_PATH_SEPARATOR = " / ";

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  /** The shelf price. What the attendant charges may be lower — see CartLine. */
  price: number;
  /** What the supplier charges us. The owner's margin hangs off this. */
  costPrice: number;
  /** Authoritative on the server; the last pulled value on a device. */
  stockQuantity: number;
  /** Flattened path of `categoryId`, kept in sync by a Postgres trigger. */
  category: string | null;
  categoryId: string | null;
  unit: ProductUnit;
  barcode: string | null;
  /** At or below this count the product lands on the reorder report. */
  reorderPoint: number;
  /** Contractor price, offered once the line reaches `bulkMinQuantity`. */
  bulkPrice: number | null;
  bulkMinQuantity: number | null;
  isActive: boolean;
  updatedAt: string;
}

/**
 * What a cashier actually sees on a device: the last synced count minus
 * everything sold locally that has not been pushed yet. An estimate, never
 * written back to Supabase.
 */
export interface ProductWithEstimatedStock extends Product {
  estimatedStock: number;
  pendingQuantity: number;
}

/**
 * Who the sale was for, when the counter bothered to ask. Every field is
 * optional and normally null: a walk-in buying a bag of cement is not going to
 * dictate an address, and nothing about completing a sale may wait on it.
 *
 * Recorded for delivery and for a contractor who needs the sale under their
 * name. Snapshotted text, not a link to a customer table — there is no customer
 * table, and a sale must be complete and valid on a device that has never
 * spoken to the server.
 */
export interface CustomerDetails {
  name: string | null;
  address: string | null;
  contact: string | null;
}

/**
 * Longer than any real name, address line or phone number, and short enough
 * that a paste of the wrong thing cannot bloat a sync payload. Enforced on the
 * way in rather than by the server rejecting a batch of sales.
 */
export const CUSTOMER_FIELD_MAX_LENGTH = 160;

/**
 * Trims, drops blanks to null, and caps length. The blank-to-null part matters:
 * a cashier tabbing through the sheet and typing nothing must leave a sale that
 * looks exactly like one where they were never asked.
 */
export function normaliseCustomerDetails(
  input: Partial<Record<keyof CustomerDetails, string | null | undefined>>,
): CustomerDetails {
  const clean = (value: string | null | undefined): string | null => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return null;
    return trimmed.slice(0, CUSTOMER_FIELD_MAX_LENGTH);
  };

  return {
    name: clean(input.name),
    address: clean(input.address),
    contact: clean(input.contact),
  };
}

/** Whether a sale carries anything worth printing or showing a customer block for. */
export function hasCustomerDetails(details: CustomerDetails): boolean {
  return Boolean(details.name || details.address || details.contact);
}

export interface Sale {
  /** Generated on-device at creation time so offline rows never collide. */
  id: string;
  userId: string | null;
  totalAmount: number;
  /** Everything given away at the counter on this sale, as a positive number. */
  discountAmount: number;
  paymentMethod: PaymentMethod | null;
  status: SaleStatus;
  deviceId: string | null;
  /** The real moment of sale, set by the client, not the server. */
  createdAt: string;
  customerName: string | null;
  customerAddress: string | null;
  customerContact: string | null;
}

/** The three customer columns of a sale, as `CustomerDetails`. */
export function saleCustomer(sale: Sale): CustomerDetails {
  return {
    name: sale.customerName,
    address: sale.customerAddress,
    contact: sale.customerContact,
  };
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string | null;
  /** Snapshotted so renaming a product later cannot rewrite history. */
  productName: string;
  quantity: number;
  /** What the customer paid, after any counter discount. */
  unitPrice: number;
  /** The shelf price at the time of sale. `listPrice - unitPrice` is the discount. */
  listPrice: number;
  /**
   * What it cost us, snapshotted. Reporting never joins back to the product,
   * so a supplier raising their price cannot rewrite last quarter's profit.
   */
  unitCost: number;
  subtotal: number;
}

export interface LocalSale extends Sale {
  syncStatus: SyncStatus;
  syncedAt: string | null;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export interface LocalSaleWithItems extends LocalSale {
  items: SaleItem[];
}

export interface InventoryMovement {
  id: string;
  productId: string;
  /** Negative for sales, positive for restocks. */
  changeQuantity: number;
  reason: InventoryReason;
  /** Points at a sale for `reason: "sale"`, at nothing for adjustments. */
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

/** An in-progress cart, held in memory on a device only. */
export interface CartLine {
  productId: string;
  productName: string;
  /** What this line is selling at. Editable at the counter. */
  unitPrice: number;
  /** The shelf price, so the cart can show what was given away. */
  listPrice: number;
  /** Supplier cost, so the attendant can see the floor before discounting. */
  unitCost: number;
  unit: ProductUnit;
  quantity: number;
  /** Last synced stock, kept so the cart can warn when a line exceeds it. */
  availableStock: number;
}
