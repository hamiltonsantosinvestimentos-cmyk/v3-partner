import { NextRequest, NextResponse } from "next/server";
import { sendToClickSign, type SendToClickSignInput } from "@/lib/clicksign";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let body: SendToClickSignInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const result = await sendToClickSign(body);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
