import * as Crypto from "expo-crypto";
import { pinHashInput } from "@double-a/shared-types";
import { getStoredPinHash } from "@/db/users";

/**
 * PIN check, done entirely on-device against the hash pulled during sync — a
 * cashier can start a shift with no connectivity at all.
 *
 * Same input string and algorithm as the admin dashboard uses when it sets the
 * PIN, which is why pinHashInput lives in shared-types.
 */
export async function hashPin(userId: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pinHashInput(userId, pin),
    { encoding: Crypto.CryptoEncoding.HEX },
  );
}

export async function verifyPin(userId: string, pin: string): Promise<boolean> {
  const stored = await getStoredPinHash(userId);
  if (!stored) return false;

  const candidate = await hashPin(userId, pin);
  return candidate === stored;
}
