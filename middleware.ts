import { type NextRequest, NextResponse } from "next/server";
import { proxy } from "./proxy";

// Service token bypass: API routes that handle their own auth via x-v3-service-token
// The route handler validates the token — middleware just needs to let it through.
const SERVICE_TOKEN_API_ROUTES = ["/api/ma/meetings/ingest"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow service-token-authenticated API calls through before auth check
  if (SERVICE_TOKEN_API_ROUTES.some((r) => pathname.startsWith(r))) {
    const serviceToken = request.headers.get("x-v3-service-token");
    const validToken = process.env.V3_INGEST_SECRET;
    if (validToken && serviceToken === validToken) {
      return NextResponse.next();
    }
  }

  return proxy(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
