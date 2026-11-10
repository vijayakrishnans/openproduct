// POST /community/post — every write in the community: start a thread,
// reply, report, and (moderators) hide or restore. Same-origin forms only.
import { NextResponse, type NextRequest } from "next/server";
import { createReply, createThread, isModerator, parseModerators, reportContent, setHidden } from "@/lib/auth/discussions";
import { sameOrigin } from "@/lib/auth/request";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";
import { appEnv, database } from "@/lib/server/env";

const ID = /^[0-9a-f-]{36}$/;

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const form = await request.formData().catch(() => null);
  const field = (k: string) => (typeof form?.get(k) === "string" ? (form!.get(k) as string) : "");
  const action = field("action");
  const threadId = field("thread");
  const back = ID.test(threadId) ? `/community/t/${threadId}` : "/community";
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);

  const [db, env] = await Promise.all([database(), appEnv()]);
  const session = db ? await validateSession(db, request.cookies.get(SESSION_COOKIE)?.value) : null;
  if (!db || !session) return go(`/signin?next=${encodeURIComponent(action === "thread" ? "/community/new" : back)}`);
  const me = session.account.id;

  if (action === "thread") {
    const r = await createThread(db, me, { tag: field("tag"), title: field("title"), body: field("body") });
    if (r.ok) return go(`/community/t/${r.id}`);
    const q = new URLSearchParams({ error: r.message, tag: field("tag"), title: field("title").slice(0, 140) });
    return go(`/community/new?${q}`);
  }
  if (!ID.test(threadId)) return go("/community");

  if (action === "reply") {
    const r = await createReply(db, me, threadId, field("body"));
    return go(r.ok ? `${back}#p-${r.id}` : `${back}?error=${encodeURIComponent(r.message)}#reply`);
  }
  const kind = field("kind") === "post" ? "post" : "thread";
  const target = kind === "post" ? field("post") : threadId;
  if (!ID.test(target)) return go(back);

  if (action === "report") {
    await reportContent(db, me, kind, target, field("reason"));
    return go(`${back}?reported=1`);
  }
  if (action === "hide" || action === "restore") {
    if (!(await isModerator(db, me, parseModerators(env.MODERATORS)))) return new NextResponse("Forbidden", { status: 403 });
    await setHidden(db, kind, target, action === "hide");
    return go(field("from") === "moderation" ? "/community/moderation" : kind === "thread" && action === "hide" ? "/community" : back);
  }
  return go(back);
}
