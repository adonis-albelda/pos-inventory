import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@double-a/shared-types";
import { verifyPin } from "@/lib/pin";

interface SessionValue {
  cashier: User | null;
  unlock: (user: User, pin: string) => Promise<boolean>;
  lock: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * The cashier's shift, held in memory only. Closing the app ends the shift.
 * Unlock always calls live verify_pin — local SQLite is for POS work after.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [cashier, setCashier] = useState<User | null>(null);

  const unlock = useCallback(async (user: User, pin: string) => {
    const ok = await verifyPin(user.id, pin);
    if (!ok) return false;

    setCashier(user);
    return true;
  }, []);

  const lock = useCallback(() => setCashier(null), []);

  const value = useMemo(() => ({ cashier, unlock, lock }), [cashier, unlock, lock]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
