/**
 * Cashier PIN handling, shared so admin writes a hash the mobile app can
 * verify offline.
 *
 * Threat model, stated plainly: a 4-6 digit PIN salted with a public user id is
 * brute-forceable by anyone holding the device. It is a shift lock that keeps a
 * cashier from ringing up sales under someone else's name, not an
 * authentication boundary. The real boundary is the enrolled device session,
 * which is what Supabase authenticates and what RLS checks. Do not reuse this
 * for anything that guards data.
 */

export const PIN_LENGTH_MIN = 4;
export const PIN_LENGTH_MAX = 6;

/** Canonical string that gets hashed. Both apps must build it identically. */
export function pinHashInput(userId: string, pin: string): string {
  return `double-a-pin:${userId}:${pin}`;
}

export function isValidPin(pin: string): boolean {
  return (
    pin.length >= PIN_LENGTH_MIN &&
    pin.length <= PIN_LENGTH_MAX &&
    /^\d+$/.test(pin)
  );
}
