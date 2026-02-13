import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rotas de API (proxy) — não interferir
const apiRoutes = ["/api/"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Não interferir em rotas de API
  if (apiRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Não interferir em assets estáticos
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Rota raiz sempre redireciona para login
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
