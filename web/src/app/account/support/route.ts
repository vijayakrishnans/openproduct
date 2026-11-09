// POST /account/support — replace the support links of the signed-in
// builder's profile (kind=builder) or of a build they maintain (kind=build).
import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/auth/request";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";
import { maySetSupport, saveSupportLinks, type SupportOwner } from "@/lib/auth/support";
import { maintainsOf } from "@/lib/directory";
import { database } from "@/lib/server/env";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const db = await database();
  const session = db ? await validateSession(db, request.cookies.get(SESSION_COOKIE)?.value) : null;
  if (!db || !session) return NextResponse.redirect(new URL("/signin?next=/account", request.url), 303);

  const form = await request.formData().catch(() => null);
  const kind = form?.get("kind");
  const key = form?.get("key");
  const go = (q: string, anchor: string) => NextResponse.redirect(new URL(`/account?${q}#${anchor}`, request.url), 303);
  if ((kind !== "builder" && kind !== "build") || typeof key !== "string" || !key || key.length > 64) {
    return go(`error=refused&message=${encodeURIComponent("That form didn't say what to save.")}`, "support");
  }
  const owner: SupportOwner = { kind, key };
  const anchor = kind === "build" ? `build-${key}` : "support";
  if (!(await maySetSupport(db, session.account.id, owner, maintainsOf))) {
    return go(`error=refused&message=${encodeURIComponent(kind === "build" ? "Only a maintainer of that build can set its support links." : "That isn't your profile.")}`, anchor);
  }
  const links = (form?.getAll("link") ?? []).filter((v): v is string => typeof v === "string");
  const result = await saveSupportLinks(db, owner, session.account.id, links);
  return result.ok ? go("saved=1", anchor) : go(`error=refused&message=${encodeURIComponent(result.message)}`, anchor);
}
