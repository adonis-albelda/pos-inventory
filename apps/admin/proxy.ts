import { NextResponse, type NextRequest } from "next/server";
import { ApiClient, ApiError, assertApiUrl } from "@double-a/api-client";
import { me } from "@double-a/api-client/queries";
import { ACTING_COMPANY_COOKIE, SESSION_COOKIE } from "@/lib/api/cookie-names";

const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * Refreshes-in-place is no longer a concept (Sanctum tokens aren't renewed
 * client-side the way a Supabase JWT was) — this just gates routes off
 * whatever `GET /auth/me` says about the current session cookie, every
 * navigation. Fine — apps/admin assumes constant connectivity (CLAUDE.md §5).
 */
export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
  const isChangePassword = path.startsWith("/change-password");
  const isPlatform = path.startsWith("/platform");

  const token = request.cookies.get(SESSION_COOKIE)?.value ?? null;
  const acting = Boolean(request.cookies.get(ACTING_COMPANY_COOKIE)?.value);

  let user: Awaited<ReturnType<typeof me>> | null = null;
  if (token) {
    try {
      const client = new ApiClient({
        baseUrl: assertApiUrl(process.env.NEXT_PUBLIC_TALLY_API_URL, "NEXT_PUBLIC_TALLY_API_URL"),
        getToken: () => token,
      });
      user = await me(client);
    } catch (error) {
      if (!(error instanceof ApiError && (error.isUnauthenticated || error.isForbidden))) throw error;
    }
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && !isPublic) {
    const home = user.role === "superadmin" && !acting ? "/platform" : "/";

    if (user.mustChangePassword && !isChangePassword) {
      const url = request.nextUrl.clone();
      url.pathname = "/change-password";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (!user.mustChangePassword && isChangePassword) {
      const url = request.nextUrl.clone();
      url.pathname = home;
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (user.role === "superadmin" && !acting && !isPlatform && !isChangePassword) {
      const url = request.nextUrl.clone();
      url.pathname = "/platform";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (user.role === "admin" && isPlatform) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = user.role === "superadmin" && !acting ? "/platform" : "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
