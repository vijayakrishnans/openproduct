// POST /posts/write — every write to builder posts (BP6): publish, edit and
// delete for the author; report for anyone signed in; hide and restore for
// moderators. Same-origin forms only.
import { NextResponse, type NextRequest } from "next/server";
import { createArticle, deleteArticle, updateArticle } from "@/lib/auth/articles";
import { isModerator, parseModerators, reportContent, setHidden } from "@/lib/auth/discussions";
import { sameOrigin } from "@/lib/auth/request";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";
import { builderOfAccount } from "@/lib/auth/builders";
import { appEnv, database } from "@/lib/server/env";

const ID = /^[0-9a-f-]{36}$/;

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const form = await request.formData().catch(() => null);
  const field = (k: string) => (typeof form?.get(k) === "string" ? (form!.get(k) as string) : "");
  const action = field("action");
  const id = ID.test(field("id")) ? field("id") : null;
  const back = id ? `/posts/${id}` : "/posts/new";
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  const [db, env] = await Promise.all([database(), appEnv()]);
  const session = db ? await validateSession(db, request.cookies.get(SESSION_COOKIE)?.value) : null;
  if (!db || !session) return go(`/signin?next=${encodeURIComponent(back)}`);
  const me = session.account.id;
  const input = { title: field("title"), body: field("body"), video: field("video"), build: field("build") };
  // A refused draft goes back to the form with what was typed. A body too long
  // for a URL is left out; the form's own checks catch most mistakes first.
  const retry = (message: string, edit: string | null) => {
    const q = new URLSearchParams({ error: message, title: input.title.slice(0, 140), video: input.video.slice(0, 300), build: input.build.slice(0, 64) });
    if (input.body.length <= 3000) q.set("body", input.body);
    if (edit) q.set("edit", edit);
    return go(`/posts/new?${q}`);
  };

  if (action === "create") {
    const r = await createArticle(db, me, input);
    return r.ok ? go(`/posts/${r.id}?published=1`) : retry(r.message, null);
  }
  if (!id) return go("/community");
  if (action === "update") {
    const r = await updateArticle(db, me, id, input);
    return r.ok ? go(`/posts/${id}?saved=1`) : retry(r.message, id);
  }
  if (action === "delete") {
    const own = await builderOfAccount(db, me);
    const done = await deleteArticle(db, me, id);
    return go(done && own ? `/builders/${encodeURIComponent(own.handle)}?deleted=1` : back);
  }
  if (action === "report") {
    await reportContent(db, me, "article", id, field("reason"));
    return go(`${back}?reported=1`);
  }
  if (action === "hide" || action === "restore") {
    if (!(await isModerator(db, me, parseModerators(env.MODERATORS)))) return new NextResponse("Forbidden", { status: 403 });
    await setHidden(db, "article", id, action === "hide");
    return go(field("from") === "moderation" ? "/community/moderation" : back);
  }
  return go(back);
}
