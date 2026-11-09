// POST /account/profile — start a builder profile here (mode=create) or edit
// the name and bio of one started here (mode=update).
import { NextResponse, type NextRequest } from "next/server";
import { checkHandle, startBuilder, updateNewBuilder } from "@/lib/auth/builders";
import { sameOrigin } from "@/lib/auth/request";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";
import { loadPerson } from "@/lib/directory";
import { database } from "@/lib/server/env";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const db = await database();
  const session = db ? await validateSession(db, request.cookies.get(SESSION_COOKIE)?.value) : null;
  if (!db || !session) return NextResponse.redirect(new URL("/signin?next=/builders/new", request.url), 303);

  const form = await request.formData().catch(() => null);
  const field = (k: string) => (typeof form?.get(k) === "string" ? (form!.get(k) as string) : "");
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  if (field("mode") === "update") {
    const result = await updateNewBuilder(db, session.account.id, { displayName: field("displayName"), bio: field("bio") });
    return result.ok ? go("/account?saved=1#profile") : go(`/account?error=refused&message=${encodeURIComponent(result.message)}#profile`);
  }

  const back = (message: string) =>
    go(`/builders/new?error=${encodeURIComponent(message)}&handle=${encodeURIComponent(field("handle").slice(0, 30))}&name=${encodeURIComponent(field("displayName").slice(0, 80))}`);
  const checked = checkHandle(field("handle"));
  if (!checked.ok) return back(checked.message);
  // A new profile can't take a handle openproduct.live already uses.
  const existing = await loadPerson(checked.handle);
  if (existing === "unreachable") return back("We couldn't check that handle against openproduct.live just now. Try again in a minute.");
  const result = await startBuilder(
    db,
    session.account.id,
    { handle: checked.handle, displayName: field("displayName"), bio: field("bio") },
    existing !== null,
  );
  return result.ok ? go(`/builders/${result.handle}?started=1`) : back(result.message);
}
