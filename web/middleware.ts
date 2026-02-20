import { NextRequest, NextResponse } from "next/server";

function getRole(req: NextRequest): "ADMIN" | "CASHIER" | null {
  const role = req.cookies.get("waserda_role")?.value;
  if (role === "ADMIN" || role === "CASHIER") return role;
  return null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = getRole(req);

  if (pathname.startsWith("/admin")) {
    if (!role) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (role === "CASHIER") {
      const allowed = pathname === "/admin" || pathname.startsWith("/admin/cashier");
      if (!allowed) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin/cashier";
        return NextResponse.redirect(url);
      }
    }
  }

  if (pathname === "/login" && role) {
    const url = req.nextUrl.clone();
    url.pathname = role === "CASHIER" ? "/admin/cashier" : "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
