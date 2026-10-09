import { NextResponse, type NextRequest } from "next/server";

// Basic auth para toda la app (Next 16 renombró middleware.ts a proxy.ts).
export function proxy(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!user || !password) {
    return new NextResponse("Basic auth no configurado", { status: 500 });
  }

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const [u, ...rest] = atob(header.slice(6)).split(":");
    if (u === user && rest.join(":") === password) return NextResponse.next();
  }

  return new NextResponse("Autenticación requerida", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Wiki viva"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
