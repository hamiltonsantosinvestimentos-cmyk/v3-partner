import { NextRequest, NextResponse } from "next/server";
import { getProvider, type SendEnvelopeInput } from "@/lib/esignature";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let body: SendEnvelopeInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const result = await getProvider({ dealId: body.dealId, documentType: body.documentType }).send(body);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
