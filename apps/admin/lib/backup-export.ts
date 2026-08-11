import {
  formatQuantity,
  lineProfit,
  marginPercent,
} from "@double-a/shared-types";
import {
  fetchStoreSettings,
  listCategories,
  listCustomers,
  listExpenses,
  listMovements,
  listProducts,
  listPurchaseOrders,
  listSales,
  listSuppliers,
  listUsers,
  type DoubleAClient,
} from "@double-a/supabase";
import { type CsvValue, toCsv } from "@/lib/csv";

/**
 * One named table the owner can pull out of the shop. Built as flat rows so
 * CSV, Excel and PDF all speak the same shape — no format invents its own
 * columns.
 *
 * Secrets stay out: pin_hash, auth_user_id and passwords never leave. Stock
 * rides on products for reference only (same rule as the products export).
 */

export const BACKUP_DATASETS = [
  "products",
  "categories",
  "customers",
  "sales",
  "inventory_movements",
  "expenses",
  "suppliers",
  "purchase_orders",
  "users",
  "store_settings",
] as const;

export type BackupDatasetId = (typeof BACKUP_DATASETS)[number];

export function isBackupDatasetId(value: string): value is BackupDatasetId {
  return (BACKUP_DATASETS as readonly string[]).includes(value);
}

export const BACKUP_DATASET_META: Record<
  BackupDatasetId,
  { label: string; blurb: string }
> = {
  products: {
    label: "Products",
    blurb: "Catalogue, prices, cost, stock, units.",
  },
  categories: {
    label: "Categories",
    blurb: "Shelf tree and markup.",
  },
  customers: {
    label: "Customers",
    blurb: "Names, addresses, contacts.",
  },
  sales: {
    label: "Sales",
    blurb: "Receipts with line items (recent cap).",
  },
  inventory_movements: {
    label: "Inventory movements",
    blurb: "Every stock change on record (recent cap).",
  },
  expenses: {
    label: "Expenses",
    blurb: "Rent, wages, utilities.",
  },
  suppliers: {
    label: "Suppliers",
    blurb: "Who you buy from.",
  },
  purchase_orders: {
    label: "Purchase orders",
    blurb: "Orders, lines and installment terms.",
  },
  users: {
    label: "Users",
    blurb: "Cashiers, admins, terminals — no PINs.",
  },
  store_settings: {
    label: "Store settings",
    blurb: "Shop name, address, phone, footer.",
  },
};

/** PostgREST and a busy shop both need a ceiling. Caps are stated in the file. */
const MAX_SALES = 8_000;
const MAX_MOVEMENTS = 20_000;
const MAX_PURCHASE_ORDERS = 2_000;

/** PDF is for reading, not for a full dump — Excel/CSV carry every row. */
export const PDF_ROW_CAP = 60;

export interface BackupSheet {
  id: BackupDatasetId;
  label: string;
  /** Base name without extension, safe for zip entries. */
  filename: string;
  headers: string[];
  rows: CsvValue[][];
  /** True when a hard cap cut the list short. */
  truncated: boolean;
}

export async function buildBackupSheets(
  client: DoubleAClient,
  ids: BackupDatasetId[],
): Promise<BackupSheet[]> {
  const sheets: BackupSheet[] = [];
  for (const id of ids) {
    sheets.push(await buildSheet(client, id));
  }
  return sheets;
}

async function buildSheet(
  client: DoubleAClient,
  id: BackupDatasetId,
): Promise<BackupSheet> {
  const label = BACKUP_DATASET_META[id].label;

  switch (id) {
    case "products": {
      const products = await listProducts(client, { includeInactive: true });
      return {
        id,
        label,
        filename: "products",
        truncated: false,
        headers: [
          "id",
          "name",
          "sku",
          "barcode",
          "price",
          "cost_price",
          "margin_percent",
          "unit",
          "allow_decimal",
          "reorder_point",
          "bulk_price",
          "bulk_min_quantity",
          "category",
          "category_id",
          "stock_quantity",
          "is_active",
          "updated_at",
        ],
        rows: products.map((product) => [
          product.id,
          product.name,
          product.sku,
          product.barcode,
          product.price,
          product.costPrice,
          marginPercent(product.price, product.costPrice),
          product.unit,
          product.allowDecimal,
          product.reorderPoint,
          product.bulkPrice,
          product.bulkMinQuantity,
          product.category,
          product.categoryId,
          product.stockQuantity,
          product.isActive,
          product.updatedAt,
        ]),
      };
    }

    case "categories": {
      const categories = await listCategories(client, { includeInactive: true });
      return {
        id,
        label,
        filename: "categories",
        truncated: false,
        headers: [
          "id",
          "name",
          "parent_id",
          "markup_percent",
          "markup_applied",
          "is_active",
          "updated_at",
        ],
        rows: categories.map((category) => [
          category.id,
          category.name,
          category.parentId,
          category.markupPercent,
          category.markupApplied,
          category.isActive,
          category.updatedAt,
        ]),
      };
    }

    case "customers": {
      const customers = await listCustomers(client);
      return {
        id,
        label,
        filename: "customers",
        truncated: false,
        headers: ["id", "name", "address", "contact", "updated_at"],
        rows: customers.map((customer) => [
          customer.id,
          customer.name,
          customer.address,
          customer.contact,
          customer.updatedAt,
        ]),
      };
    }

    case "sales": {
      const sales = await listSales(client, { limit: MAX_SALES });
      const rows = sales.flatMap((sale) =>
        sale.items.map((item) => [
          sale.createdAt,
          sale.id,
          sale.cashierName,
          sale.deviceId,
          sale.paymentMethod,
          sale.status,
          sale.isPaid,
          sale.fulfillment,
          sale.deliveryCompleted,
          sale.customerId,
          sale.customerName,
          sale.customerContact,
          sale.customerAddress,
          item.id,
          item.productId,
          item.productName,
          item.quantity,
          item.listPrice,
          item.unitPrice,
          item.unitCost,
          item.subtotal,
          lineProfit(item.unitPrice, item.unitCost, item.quantity),
        ]),
      );
      return {
        id,
        label,
        filename: "sales",
        truncated: sales.length >= MAX_SALES,
        headers: [
          "sold_at",
          "sale_id",
          "cashier",
          "terminal",
          "payment",
          "status",
          "is_paid",
          "fulfillment",
          "delivery_completed",
          "customer_id",
          "customer_name",
          "customer_contact",
          "customer_address",
          "line_id",
          "product_id",
          "product",
          "quantity",
          "list_price",
          "unit_price",
          "unit_cost",
          "subtotal",
          "line_profit",
        ],
        rows,
      };
    }

    case "inventory_movements": {
      const movements = await listMovements(client, { limit: MAX_MOVEMENTS });
      return {
        id,
        label,
        filename: "inventory_movements",
        truncated: movements.length >= MAX_MOVEMENTS,
        headers: [
          "id",
          "product_id",
          "change_quantity",
          "reason",
          "reference_id",
          "note",
          "created_by",
          "created_at",
        ],
        rows: movements.map((movement) => [
          movement.id,
          movement.productId,
          movement.changeQuantity,
          movement.reason,
          movement.referenceId,
          movement.note,
          movement.createdBy,
          movement.createdAt,
        ]),
      };
    }

    case "expenses": {
      const expenses = await listExpenses(client);
      return {
        id,
        label,
        filename: "expenses",
        truncated: false,
        headers: [
          "id",
          "expense_date",
          "category",
          "description",
          "amount",
          "note",
          "created_by",
          "created_at",
          "updated_at",
        ],
        rows: expenses.map((expense) => [
          expense.id,
          expense.expenseDate,
          expense.category,
          expense.description,
          expense.amount,
          expense.note,
          expense.createdBy,
          expense.createdAt,
          expense.updatedAt,
        ]),
      };
    }

    case "suppliers": {
      const suppliers = await listSuppliers(client, { includeInactive: true });
      return {
        id,
        label,
        filename: "suppliers",
        truncated: false,
        headers: [
          "id",
          "name",
          "contact_person",
          "phone",
          "email",
          "address",
          "is_active",
          "created_at",
          "updated_at",
        ],
        rows: suppliers.map((supplier) => [
          supplier.id,
          supplier.name,
          supplier.contactPerson,
          supplier.phone,
          supplier.email,
          supplier.address,
          supplier.isActive,
          supplier.createdAt,
          supplier.updatedAt,
        ]),
      };
    }

    case "purchase_orders": {
      const orders = await listPurchaseOrders(client, {
        limit: MAX_PURCHASE_ORDERS,
      });
      const rows: CsvValue[][] = [];
      for (const order of orders) {
        const terms = order.payments
          .map(
            (payment) =>
              `T${payment.termNumber}:${payment.amount}${payment.isPaid ? ":paid" : ""}`,
          )
          .join("|");
        const header = [
          order.id,
          order.supplierId,
          order.supplierName,
          order.status,
          order.orderDate,
          order.expectedDate,
          order.referenceNo,
          order.notes,
          order.totalAmount,
          order.createdBy,
          order.createdAt,
          terms,
        ] as CsvValue[];

        if (order.items.length === 0) {
          rows.push([...header, null, null, null, null, null, null, null, null]);
          continue;
        }
        for (const item of order.items) {
          rows.push([
            ...header,
            item.id,
            item.productId,
            item.productName,
            item.quantityOrdered,
            item.quantityReceived,
            item.unitCost,
            item.lineTotal,
            item.note,
          ]);
        }
      }
      return {
        id,
        label,
        filename: "purchase_orders",
        truncated: orders.length >= MAX_PURCHASE_ORDERS,
        headers: [
          "purchase_order_id",
          "supplier_id",
          "supplier_name",
          "status",
          "order_date",
          "expected_date",
          "reference_no",
          "notes",
          "total_amount",
          "created_by",
          "created_at",
          "payment_terms",
          "line_id",
          "product_id",
          "product_name",
          "quantity_ordered",
          "quantity_received",
          "unit_cost",
          "line_total",
          "line_note",
        ],
        rows,
      };
    }

    case "users": {
      const users = await listUsers(client, { includeInactive: true });
      return {
        id,
        label,
        filename: "users",
        truncated: false,
        headers: [
          "id",
          "name",
          "email",
          "role",
          "is_active",
          "can_sell",
          "must_change_password",
          "updated_at",
        ],
        rows: users.map((user) => [
          user.id,
          user.name,
          user.email,
          user.role,
          user.isActive,
          user.canSell,
          user.mustChangePassword,
          user.updatedAt,
        ]),
      };
    }

    case "store_settings": {
      const settings = await fetchStoreSettings(client);
      return {
        id,
        label,
        filename: "store_settings",
        truncated: false,
        headers: [
          "name",
          "logo_url",
          "address",
          "phone",
          "receipt_footer",
          "updated_at",
        ],
        rows: [
          [
            settings.name,
            settings.logoUrl,
            settings.address,
            settings.phone,
            settings.receiptFooter,
            settings.updatedAt,
          ],
        ],
      };
    }
  }
}

export function sheetToCsv(sheet: BackupSheet): string {
  return toCsv(sheet.headers, sheet.rows);
}

/** Cell text for PDF / Excel display — keep numbers readable. */
export function cellText(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : formatQuantity(value);
  }
  return String(value);
}
