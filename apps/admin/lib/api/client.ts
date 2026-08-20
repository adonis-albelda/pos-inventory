import { ApiClient, assertApiUrl } from "@double-a/api-client";

/**
 * NEXT_PUBLIC_ on purpose: the browser calls the Tally API directly (see
 * lib/api/browser-client.ts), not just the Next.js server, so this URL has
 * to reach client bundles too. The session token that travels with it is a
 * separate, deliberate tradeoff — see cookie-names.ts / session.ts.
 */
function apiUrl(): string {
  return assertApiUrl(process.env.NEXT_PUBLIC_TALLY_API_URL, "NEXT_PUBLIC_TALLY_API_URL");
}

/** Authenticated client bound to a fixed token — used for one-off scoped calls (e.g. superadmin acting-company actions) that must not touch the session cookie. */
export function createScopedClient(token: string): ApiClient {
  return new ApiClient({ baseUrl: apiUrl(), getToken: () => token });
}
