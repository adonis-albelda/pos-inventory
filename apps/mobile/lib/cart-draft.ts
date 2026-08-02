import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type {
  CartLine,
  CustomerDetails,
  Fulfillment,
  PaymentMethod,
} from "@double-a/shared-types";

const DRAFTS_KEY = "double-a.cart-drafts";
/** Pre-multi-draft single slot — read once and migrate. */
const LEGACY_DRAFT_KEY = "double-a.cart-draft";

/** One parked cart on this terminal. Many can sit side by side. */
export interface CartDraft {
  id: string;
  lines: CartLine[];
  overridden: string[];
  payment: PaymentMethod;
  customer: CustomerDetails;
  fulfillment: Fulfillment;
  savedAt: string;
}

export type CartDraftInput = Omit<CartDraft, "id" | "savedAt">;

async function readAll(): Promise<CartDraft[]> {
  const raw = await AsyncStorage.getItem(DRAFTS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as CartDraft[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      await AsyncStorage.removeItem(DRAFTS_KEY);
      return [];
    }
  }

  // Migrate the old single-draft key if a terminal still has one.
  const legacy = await AsyncStorage.getItem(LEGACY_DRAFT_KEY);
  if (!legacy) return [];

  try {
    const old = JSON.parse(legacy) as Omit<CartDraft, "id"> & { id?: string };
    const migrated: CartDraft = {
      id: old.id ?? Crypto.randomUUID(),
      lines: old.lines,
      overridden: old.overridden,
      payment: old.payment,
      customer: old.customer,
      fulfillment: old.fulfillment,
      savedAt: old.savedAt ?? new Date().toISOString(),
    };
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify([migrated]));
    await AsyncStorage.removeItem(LEGACY_DRAFT_KEY);
    return [migrated];
  } catch {
    await AsyncStorage.removeItem(LEGACY_DRAFT_KEY);
    return [];
  }
}

async function writeAll(drafts: CartDraft[]): Promise<void> {
  if (drafts.length === 0) {
    await AsyncStorage.removeItem(DRAFTS_KEY);
    return;
  }
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

/** Newest first. */
export async function listCartDrafts(): Promise<CartDraft[]> {
  const drafts = await readAll();
  return drafts.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export async function addCartDraft(input: CartDraftInput): Promise<CartDraft> {
  const next: CartDraft = {
    ...input,
    id: Crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  const drafts = await readAll();
  drafts.push(next);
  await writeAll(drafts);
  return next;
}

export async function getCartDraft(id: string): Promise<CartDraft | null> {
  const drafts = await readAll();
  return drafts.find((draft) => draft.id === id) ?? null;
}

/** Remove after loading into the cart so it cannot be opened twice by accident. */
export async function removeCartDraft(id: string): Promise<void> {
  const drafts = await readAll();
  await writeAll(drafts.filter((draft) => draft.id !== id));
}

export async function countCartDrafts(): Promise<number> {
  return (await readAll()).length;
}
