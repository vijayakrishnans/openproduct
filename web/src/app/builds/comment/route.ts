// POST /builds/comment — comments under a build (OP-46): add, delete your
// own, report, and (moderators) hide or restore. Same-origin forms only.
import { NextResponse, type NextRequest } from "next/server";
import { addComment, deleteComment } from "@/lib/auth/build-comments";
import { isModerator, moderatorsFor, reportContent, setHidden } from "@/lib/auth/discussions";
import { sameOrigin } from "@/lib/auth/request";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";
import { appEnv, database } from "@/lib/server/env";

const ID = /^[0-9a-f-]{36}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const form = await request.formData().catch(() => null);
  const field = (k: string) => (typeof form?.get(k) === "string" ? (form!.get(k) as string) : "");
  const action = field("action");
  const slug = field("slug").toLowerCase();
  const id = field("id");
  const back = SLUG.test(slug) ? `/builds/${slug}` : "/";
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  const [db, env] = await Promise.all([database(), appEnv()]);
  const session = db ? await validateSession(db, request.cookies.get(SESSION_COOKIE)?.value) : null;
  if (!db || !session) return go(`/signin?next=${encodeURIComponent(`${back}#comments`)}`);
  const me = session.account.id;

  if (action === "add") {
    const r = await addComment(db, me, slug, field("body"));
    return go(r.ok ? `${back}#c-${r.id}` : `${back}?comment_error=${encodeURIComponent(r.message)}#comments`);
  }
  if (!ID.test(id)) return go(back);
  if (action === "delete") {
    await deleteComment(db, me, id);
    return go(`${back}#comments`);
  }
  if (action === "report") {
    await reportContent(db, me, "comment", id, field("reason"));
    return go(`${back}?comment_reported=1#c-${id}`);
  }
  if (action === "hide" || action === "restore") {
    if (!(await isModerator(db, me, moderatorsFor(env)))) return new NextResponse("Forbidden", { status: 403 });
    await setHidden(db, "comment", id, action === "hide");
    return go(field("from") === "moderation" ? "/community/moderation" : `${back}#c-${id}`);
  }
  return go(back);
}
