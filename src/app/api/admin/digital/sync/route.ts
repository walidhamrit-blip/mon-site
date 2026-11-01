import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { RETIRED_SUPPLIER_MESSAGE } from "@/lib/retired-supplier";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: false, error: "supplier_retired", message: RETIRED_SUPPLIER_MESSAGE }, { status: 410 });
}
