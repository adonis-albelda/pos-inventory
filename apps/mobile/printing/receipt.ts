import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  hasCustomerDetails,
  roundMoney,
  saleCustomer,
  type LocalSaleWithItems,
  type ProductUnit,
} from "@double-a/shared-types";
import { getProductUnits } from "@/db/products";
import { EscPosBuilder } from "./escpos";
import {
  DEFAULT_PRINTER_SETTINGS,
  transportFor,
  type PrinterSettings,
} from "./transport";

const SETTINGS_KEY = "double-a.printer";
const SHOP_NAME = "DOUBLE A";

export async function getPrinterSettings(): Promise<PrinterSettings> {
  const stored = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!stored) return DEFAULT_PRINTER_SETTINGS;

  try {
    return { ...DEFAULT_PRINTER_SETTINGS, ...(JSON.parse(stored) as PrinterSettings) };
  } catch {
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export async function savePrinterSettings(settings: PrinterSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function money(value: number): string {
  return roundMoney(value).toFixed(2);
}

/**
 * Builds the receipt bytes from the local sale row — no server data involved.
 *
 * `units` maps product id to how that product is sold. It is passed in rather
 * than read here so this stays a pure function of the sale.
 */
export function buildReceipt(
  sale: LocalSaleWithItems,
  options: {
    columns: number;
    cashierName?: string;
    units?: Map<string, ProductUnit>;
  },
): Uint8Array {
  const builder = new EscPosBuilder(options.columns);

  builder.align("center").bold(true).line(SHOP_NAME).bold(false);
  builder.line(new Date(sale.createdAt).toLocaleString());
  builder.line(`Receipt ${sale.id.slice(0, 8).toUpperCase()}`);
  if (options.cashierName) builder.line(`Cashier: ${options.cashierName}`);
  if (sale.deviceId) builder.line(`Terminal ${sale.deviceId.slice(0, 8)}`);

  builder.align("left").divider();

  // Only printed when the counter took details. A "Customer: —" line on every
  // walk-in receipt would be noise on paper the shop pays for.
  const customer = saleCustomer(sale);
  if (hasCustomerDetails(customer)) {
    if (customer.name) builder.wrapped("Customer: ", customer.name);
    if (customer.contact) builder.wrapped("Contact: ", customer.contact);
    if (customer.address) builder.wrapped("Address: ", customer.address);
    builder.divider();
  }

  for (const item of sale.items) {
    const unit = (item.productId ? options.units?.get(item.productId) : null) ?? "pc";
    const sold = `  ${item.quantity} ${unit} @ ${money(item.unitPrice)}`;
    const total = money(item.subtotal);
    // Paper has no strikethrough, so a discounted line says what it was before
    // in words. The customer can see they were given something.
    const was =
      item.listPrice > item.unitPrice ? ` (was ${money(item.listPrice)})` : "";

    builder.line(item.productName);

    // 58mm paper is 32 characters wide and a long name plus both prices will not
    // fit. Rather than let it truncate mid-number, the old price drops to its
    // own line.
    if (was && sold.length + was.length + total.length + 1 > options.columns) {
      builder.columns(sold, total);
      builder.line(`   was ${money(item.listPrice)}`);
    } else {
      builder.columns(`${sold}${was}`, total);
    }
  }

  // Line items end, the total begins.
  builder.ledgerLine();

  if (sale.discountAmount > 0) {
    builder.columns("DISCOUNT", `-${money(sale.discountAmount)}`);
  }

  builder.bold(true).big(true);
  builder.columns("TOTAL", money(sale.totalAmount));
  builder.big(false).bold(false);

  if (sale.paymentMethod) {
    builder.columns("Paid by", sale.paymentMethod.toUpperCase());
  }
  builder.line(`Amounts in PHP`);

  builder.align("center").line().line("Thank you");
  builder.feed(3).cut();

  return builder.build();
}

/**
 * Prints a receipt from the local sale record.
 *
 * Never awaited by the sale flow and never gated on connectivity — a failed
 * print must not be able to fail a completed sale.
 */
export async function printReceipt(
  sale: LocalSaleWithItems,
  cashierName?: string,
): Promise<void> {
  const productIds = sale.items
    .map((item) => item.productId)
    .filter((id): id is string => id !== null);

  const [settings, units] = await Promise.all([
    getPrinterSettings(),
    getProductUnits(productIds),
  ]);

  const payload = buildReceipt(sale, {
    columns: settings.columns,
    cashierName,
    units,
  });

  await transportFor(settings).send(payload);
}
