// POST /account/delete — delete the signed-in account and everything it owns here (D11).
import { NextResponse, type NextRequest } from "next/server";
import { deleteAccount } from "@/lib/auth/accounts";
import { sameOrigin } from "@/lib/auth/request";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";
import { database } from "@/lib/server/env";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const db = await database();
  const session = db ? await validateSession(db, request.cookies.get(SESSION_COOKIE)?.value) : null;
  if (!db || !session) return NextResponse.redirect(new URL("/signin?next=/account", request.url), 303);
  const form = await request.formData().catch(() => null);
  if (form?.get("confirm") !== "on") {
    return NextResponse.redirect(new URL(`/account?error=refused&message=${encodeURIComponent("Tick the box to confirm.")}`, request.url), 303);
  }
  await deleteAccount(db, session.account.id);
  const res = NextResponse.redirect(new URL("/?deleted=1", request.url), 303);
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax" });
  return res;
}
