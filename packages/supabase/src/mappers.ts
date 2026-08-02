import type {
  Category,
  InventoryMovement,
  InventoryReason,
  PaymentMethod,
  Product,
  ProductUnit,
  Sale,
  SaleItem,
  SaleStatus,
  StoreSettings,
  User,
  UserRole,
} from "@double-a/shared-types";
import type { Tables } from "./database.types";

/**
 * snake_case rows to camelCase domain objects, in one place. Postgres numerics
 * arrive as numbers through PostgREST but are coerced anyway so a string never
 * leaks into arithmetic.
 */

export function toProduct(row: Tables<"products">): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    price: Number(row.price),
    costPrice: Number(row.cost_price),
    stockQuantity: row.stock_quantity,
    category: row.category,
    categoryId: row.category_id,
    unit: row.unit as ProductUnit,
    barcode: row.barcode,
    reorderPoint: row.reorder_point,
    bulkPrice: row.bulk_price === null ? null : Number(row.bulk_price),
    bulkMinQuantity: row.bulk_min_quantity,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

export function toCategory(row: Tables<"categories">): Category {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

/**
 * Takes only the columns callers are allowed to read — pin_hash and
 * auth_user_id are revoked from normal clients, so queries never select them.
 */
export type UserRowSubset = Pick<
  Tables<"users">,
  "id" | "name" | "email" | "role" | "is_active" | "updated_at"
>;

export function toUser(row: UserRowSubset): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

export function toStoreSettings(row: Tables<"store_settings">): StoreSettings {
  return {
    name: row.name,
    logoUrl: row.logo_url,
    address: row.address,
    phone: row.phone,
    receiptFooter: row.receipt_footer,
    updatedAt: row.updated_at,
  };
}

export function toSale(row: Tables<"sales">): Sale {
  return {
    id: row.id,
    userId: row.user_id,
    totalAmount: Number(row.total_amount),
    discountAmount: Number(row.discount_amount ?? 0),
    paymentMethod: row.payment_method as PaymentMethod | null,
    status: row.status as SaleStatus,
    deviceId: row.device_id,
    createdAt: row.created_at,
    customerName: row.customer_name,
    customerAddress: row.customer_address,
    customerContact: row.customer_contact,
  };
}

export function toSaleItem(row: Tables<"sale_items">): SaleItem {
  return {
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    listPrice: Number(row.list_price ?? row.unit_price),
    unitCost: Number(row.unit_cost ?? 0),
    subtotal: Number(row.subtotal),
  };
}

export function toInventoryMovement(
  row: Tables<"inventory_movements">,
): InventoryMovement {
  return {
    id: row.id,
    productId: row.product_id,
    changeQuantity: row.change_quantity,
    reason: row.reason as InventoryReason,
    referenceId: row.reference_id,
    note: row.note,
    createdAt: row.created_at,
  };
}
