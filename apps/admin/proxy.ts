import { NextResponse, type NextRequest } from "next/server";
import { createAdminServerClient } from "@double-a/supabase/server";

const PUBLIC_PATHS = ["/login", "/auth"];

function actingCompanyId(user: {
  app_metadata?: Record<string, unknown>;
}): string | null {
  const value = user.app_metadata?.acting_company_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Refreshes the Supabase session cookie on every request and keeps the dashboard
 * behind a login. Runs on every navigation, which is fine — this app assumes
 * constant connectivity.
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createAdminServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (records) => {
      for (const { name, value } of records) {
        request.cookies.set(name, value);
      }
      response = NextResponse.next({ request });
      for (const { name, value, options } of records) {
        response.cookies.set(name, value, options);
      }
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
  const isChangePassword = path.startsWith("/change-password");
  const isPlatform = path.startsWith("/platform");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && !isPublic) {
    const { data: rows, error: appError } = await supabase.rpc("current_app_user");
    if (!appError) {
      const appUser = Array.isArray(rows) ? rows[0] : rows;
      const role = appUser?.role as string | undefined;
      const mustChange = Boolean(appUser?.must_change_password);
      const acting = actingCompanyId(user);
      const home = role === "superadmin" && !acting ? "/platform" : "/";

      if (mustChange && !isChangePassword) {
        const url = request.nextUrl.clone();
        url.pathname = "/change-password";
        url.search = "";
        return NextResponse.redirect(url);
      }

      if (!mustChange && isChangePassword) {
        const url = request.nextUrl.clone();
        url.pathname = home;
        url.search = "";
        return NextResponse.redirect(url);
      }

      if (role === "superadmin" && !acting && !isPlatform && !isChangePassword) {
        const url = request.nextUrl.clone();
        url.pathname = "/platform";
        url.search = "";
        return NextResponse.redirect(url);
      }

      if (role === "admin" && isPlatform) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  if (user && path === "/login") {
    const { data: rows } = await supabase.rpc("current_app_user");
    const appUser = Array.isArray(rows) ? rows[0] : rows;
    const acting = actingCompanyId(user);
    const url = request.nextUrl.clone();
    url.pathname =
      appUser?.role === "superadmin" && !acting ? "/platform" : "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
