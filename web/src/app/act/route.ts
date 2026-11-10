// POST /act — upvote, follow, raise a hand (OP-25), and mark helpful (TC5). Same-origin forms;
// signed-out visitors are sent to sign in and brought back.
import { NextResponse, type NextRequest } from "next/server";
import { toggleFollow, toggleHand, toggleVote } from "@/lib/auth/reactions";
import { toggleTopicFollow } from "@/lib/auth/topic-follows";
import { toggleHelpful } from "@/lib/auth/rankings";
import { safeNext, sameOrigin } from "@/lib/auth/request";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";
import { database } from "@/lib/server/env";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const form = await request.formData().catch(() => null);
  const field = (k: string) => (typeof form?.get(k) === "string" ? (form!.get(k) as string).trim() : "");
  const back = safeNext(field("next")) ?? "/";
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 303);
  const with_ = (path: string, q: Record<string, string>) => {
    const [base, hash] = path.split("#");
    const u = new URL(base!, request.url);
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
    return `${u.pathname}${u.search}${hash ? `#${hash}` : ""}`;
  };

  const db = await database();
  const session = db ? await validateSession(db, request.cookies.get(SESSION_COOKIE)?.value) : null;
  if (!db || !session) return go(`/signin?next=${encodeURIComponent(back)}`);
  const me = session.account.id;

  switch (field("action")) {
    case "vote":
      await toggleVote(db, me, field("slug").toLowerCase());
      return go(back);
    case "follow": {
      // TC4: following a topic.
      if (field("kind") === "topic") {
        await toggleTopicFollow(db, me, field("key"));
        return go(back);
      }
      const kind = field("kind") === "builder" ? "builder" : "build";
      await toggleFollow(db, me, kind, field("key"));
      return go(back);
    }
    // TC5: "helpful" on a post (article) or a reply (post).
    case "helpful":
      await toggleHelpful(db, me, field("kind"), field("key"));
      return go(back);
    case "hand": {
      const r = await toggleHand(db, me, field("slug").toLowerCase(), field("role"));
      return go(r.ok ? back : with_(back, { error: r.message }));
    }
    default:
      return go(back);
  }
}
