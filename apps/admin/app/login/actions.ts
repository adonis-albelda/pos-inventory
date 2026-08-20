import { logout } from "@double-a/api-client/queries";
import { getBrowserApiClient, endBrowserSession } from "@/lib/api/browser-client";

/**
 * Plain client-side function (not a Server Action — login/logout are
 * browser-direct REST calls now, see login-form.tsx). Still valid as a
 * `<form action={signOut}>` target: React 19 accepts any async function
 * there, client or server. A full navigation (not router.push) is
 * deliberate — it drops the in-memory TanStack Query cache along with the
 * session, so nothing cached under the old identity survives into the
 * logged-out state.
 */
export async function signOut(): Promise<void> {
  try {
    await logout(getBrowserApiClient());
  } catch {
    // Token may already be invalid/expired — clearing cookies below is what matters.
  }
  endBrowserSession();
  window.location.href = "/login";
}
