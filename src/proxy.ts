import { NextResponse, type NextRequest } from "next/server";

// Usuarios válidos: BASIC_AUTH_USER/BASIC_AUTH_PASSWORD más una lista opcional
// BASIC_AUTH_USERS="usuario:contraseña,usuario2:contraseña2" (las contraseñas no pueden tener comas).
function allowedUsers(): Map<string, string> {
  const users = new Map<string, string>();
  const { BASIC_AUTH_USER: user, BASIC_AUTH_PASSWORD: password, BASIC_AUTH_USERS: list } = process.env;
  if (user && password) users.set(user, password);
  for (const entry of (list ?? "").split(",")) {
    const i = entry.indexOf(":");
    if (i > 0 && i < entry.length - 1) users.set(entry.slice(0, i).trim(), entry.slice(i + 1));
  }
  return users;
}

// Basic auth para toda la app (Next 16 renombró middleware.ts a proxy.ts).
export function proxy(request: NextRequest) {
  const users = allowedUsers();
  if (users.size === 0) {
    return new NextResponse("Basic auth no configurado", { status: 500 });
  }

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const i = decoded.indexOf(":");
    const expected = users.get(decoded.slice(0, i));
    if (i > 0 && expected !== undefined && decoded.slice(i + 1) === expected) return NextResponse.next();
  }

  return new NextResponse("Autenticación requerida", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Wiki viva"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
