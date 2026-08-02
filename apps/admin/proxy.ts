import { NextResponse, type NextRequest } from "next/server";
import { createAdminServerClient } from "@double-a/supabase/server";

const PUBLIC_PATHS = ["/login", "/auth"];

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

  const isPublic = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
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
