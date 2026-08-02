import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@double-a/shared-types";
import { getLocalUser } from "@/db/users";
import { verifyPin } from "@/lib/pin";

interface SessionValue {
  cashier: User | null;
  unlock: (userId: string, pin: string) => Promise<boolean>;
  lock: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * The cashier's shift, held in memory only. Deliberately not persisted: closing
 * the app should end the shift, and nothing here ever touches the network — the
 * PIN is checked against a hash pulled during the last sync.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [cashier, setCashier] = useState<User | null>(null);

  const unlock = useCallback(async (userId: string, pin: string) => {
    const ok = await verifyPin(userId, pin);
    if (!ok) return false;

    setCashier(await getLocalUser(userId));
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
