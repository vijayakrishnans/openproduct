// POST /account/claim — claim an openproduct.live builder profile. Proved
// only by GitHub: the profile's GitHub link must name the GitHub account the
// signed-in person used (design D10). Checked here, against the live
// profile, not trusted from the form.
import { NextResponse, type NextRequest } from "next/server";
import { githubLoginOf } from "@/lib/auth/accounts";
import { canClaim, checkHandle, claimBuilder } from "@/lib/auth/builders";
import { sameOrigin } from "@/lib/auth/request";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";
import { loadPerson } from "@/lib/directory";
import { database } from "@/lib/server/env";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const form = await request.formData().catch(() => null);
  const raw = typeof form?.get("handle") === "string" ? (form!.get("handle") as string) : "";
  const checked = checkHandle(raw);
  const page = checked.ok ? `/builders/${checked.handle}` : "/builders";
  const go = (query: string) => NextResponse.redirect(new URL(`${page}?${query}`, request.url), 303);

  const db = await database();
  const session = db ? await validateSession(db, request.cookies.get(SESSION_COOKIE)?.value) : null;
  if (!db || !session) return NextResponse.redirect(new URL(`/signin?next=${encodeURIComponent(page)}`, request.url), 303);
  if (!checked.ok) return go(`claim=invalid`);

  const person = await loadPerson(checked.handle);
  if (person === "unreachable") return go("claim=unreachable");
  if (person === null) return go("claim=missing");
  const login = await githubLoginOf(db, session.account.id);
  if (!canClaim(person.githubUrl, login)) return go("claim=unproved");

  const result = await claimBuilder(db, session.account.id, person.handle);
  return result.ok ? go("claim=done") : go(`claim=refused&message=${encodeURIComponent(result.message)}`);
}
