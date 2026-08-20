/**
 * Shared between lib/api/session.ts (Server Components/Actions, via
 * next/headers `cookies()`) and proxy.ts (Middleware, via the
 * NextRequest/NextResponse cookie APIs — no next/headers there) so both
 * sides agree on names without either depending on the other's runtime.
 */
export const SESSION_COOKIE = "tally_session";
export const BASE_SESSION_COOKIE = "tally_base_session";
export const ACTING_COMPANY_COOKIE = "tally_acting_company";
