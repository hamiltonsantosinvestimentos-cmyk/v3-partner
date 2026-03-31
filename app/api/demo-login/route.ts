import { NextRequest, NextResponse } from "next/server";
import { demoLogin } from "@/lib/demo-auth";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  const user = demoLogin(email, password);

  if (!user) {
    return NextResponse.json({ error: "Email ou senha inválidos." }, { status: 401 });
  }

  const sessionData = JSON.stringify({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set("v3_demo_session", sessionData, {
    path: "/",
    maxAge: 86400,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  });

  return response;
}
