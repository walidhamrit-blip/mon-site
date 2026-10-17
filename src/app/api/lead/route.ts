import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  console.log("New lead:", body);
  // TODO: send email via Resend / webhook
  // await fetch(process.env.WEBHOOK_URL, { method: "POST", body: JSON.stringify(body) })
  return NextResponse.json({ ok: true });
}
