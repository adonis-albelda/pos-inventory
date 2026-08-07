import {
  DEFAULT_RECEIPT_LAYOUT,
  type ReceiptLayout,
} from "@double-a/shared-types";
import { getDb } from "./index";

function flag(value: number | null | undefined): boolean {
  return (value ?? 0) !== 0;
}

/** Layout as this device last pulled it. Office owns it; local copy is read-only. */
export async function getLocalReceiptLayout(): Promise<ReceiptLayout> {
  const row = await getDb().getFirstAsync<{
    show_shop_name: number;
    show_address: number;
    show_phone: number;
    show_logo_line: number;
    show_cashier: number;
    show_terminal: number;
    show_customer: number;
    show_discounts: number;
    show_payment: number;
    show_footer: number;
    updated_at: string | null;
  }>(
    `SELECT show_shop_name, show_address, show_phone, show_logo_line,
            show_cashier, show_terminal, show_customer, show_discounts,
            show_payment, show_footer, updated_at
       FROM receipt_layout
      WHERE id = 1`,
  );

  if (!row) return DEFAULT_RECEIPT_LAYOUT;

  return {
    showShopName: flag(row.show_shop_name),
    showAddress: flag(row.show_address),
    showPhone: flag(row.show_phone),
    showLogoLine: flag(row.show_logo_line),
    showCashier: flag(row.show_cashier),
    showTerminal: flag(row.show_terminal),
    showCustomer: flag(row.show_customer),
    showDiscounts: flag(row.show_discounts),
    showPayment: flag(row.show_payment),
    showFooter: flag(row.show_footer),
    paperWidthMm: 58,
    columns: 32,
    printerModel: "PT-210",
    updatedAt: row.updated_at ?? "",
  };
}

export async function saveLocalReceiptLayout(layout: ReceiptLayout): Promise<void> {
  await getDb().runAsync(
    `UPDATE receipt_layout
        SET show_shop_name = ?,
            show_address = ?,
            show_phone = ?,
            show_logo_line = ?,
            show_cashier = ?,
            show_terminal = ?,
            show_customer = ?,
            show_discounts = ?,
            show_payment = ?,
            show_footer = ?,
            paper_width_mm = 58,
            columns = 32,
            printer_model = 'PT-210',
            updated_at = ?
      WHERE id = 1`,
    layout.showShopName ? 1 : 0,
    layout.showAddress ? 1 : 0,
    layout.showPhone ? 1 : 0,
    layout.showLogoLine ? 1 : 0,
    layout.showCashier ? 1 : 0,
    layout.showTerminal ? 1 : 0,
    layout.showCustomer ? 1 : 0,
    layout.showDiscounts ? 1 : 0,
    layout.showPayment ? 1 : 0,
    layout.showFooter ? 1 : 0,
    layout.updatedAt,
  );
}
