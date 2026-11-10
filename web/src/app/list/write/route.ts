// POST /list/write — create, edit, verify, publish and unpublish a listing
// (list-your-build LB1). Same-origin forms; maintainers only past create.
import { NextResponse, type NextRequest } from "next/server";
import { createListing, setPublished, updateListing, verifyListing } from "@/lib/auth/listings";
import { addRole, setRoleOpen, updateRole } from "@/lib/auth/listing-roles";
import { sameOrigin } from "@/lib/auth/request";
import { SESSION_COOKIE, validateSession } from "@/lib/auth/session";
import { loadDirectory, slugTakenOnOpenproduct } from "@/lib/directory";
import { appEnv, database } from "@/lib/server/env";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const form = await request.formData().catch(() => null);
  const field = (k: string) => (typeof form?.get(k) === "string" ? (form!.get(k) as string) : "");
  const action = field("action");
  const slug = field("slug").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
  const go = (path: string, q: Record<string, string> = {}) => {
    const u = new URL(path, request.url);
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v.slice(0, 300));
    return NextResponse.redirect(u, 303);
  };

  const [db, env] = await Promise.all([database(), appEnv()]);
  const session = db ? await validateSession(db, request.cookies.get(SESSION_COOKIE)?.value) : null;
  if (!db || !session) return go(`/signin`, { next: action === "create" ? "/list" : `/list/${slug}` });
  const me = session.account.id;
  const github = { fetch: (u: string, i?: RequestInit) => fetch(u, i), auth: { token: env.GITHUB_TOKEN, clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } };
  const categories = async () => {
    const d = await loadDirectory();
    return d.ok ? d.topics.map((t) => t.value) : [];
  };

  if (action === "create") {
    const input = { repo: field("repo"), slug: field("name"), tagline: field("tagline"), category: field("category"), stack: field("stack") };
    const r = await createListing(db, me, input, { ...github, takenThere: slugTakenOnOpenproduct, categories: await categories() });
    return r.ok ? go(`/list/${r.slug}`, { created: "1" }) : go("/list", { error: r.message, repo: input.repo, name: input.slug, tagline: input.tagline, category: input.category, stack: input.stack });
  }
  if (!slug) return go("/list");
  const back = `/list/${slug}`;
  if (action === "update") {
    const r = await updateListing(db, slug, me, { tagline: field("tagline"), category: field("category"), stack: field("stack") }, await categories());
    return go(back, r.ok ? { saved: "1" } : { error: r.message });
  }
  if (action === "verify") {
    const r = await verifyListing(db, slug, me, github);
    return go(back, r.ok ? { verified: "1" } : { error: r.message });
  }
  // Open seats (LB3).
  const seat = { title: field("title"), type: field("type"), description: field("description"), commitment: field("commitment") };
  if (action === "role-add") {
    const r = await addRole(db, slug, me, seat);
    return go(`${back}#seats`, r.ok ? { seat: "added" } : { error: r.message });
  }
  if (action === "role-update" || action === "role-close" || action === "role-reopen") {
    const id = field("role");
    const r = action === "role-update" ? await updateRole(db, id, me, seat) : await setRoleOpen(db, id, me, action === "role-reopen");
    return go(`${back}#seats`, r.ok ? { seat: action === "role-update" ? "saved" : action === "role-close" ? "closed" : "reopened" } : { error: r.message });
  }
  if (action === "publish" || action === "unpublish") {
    const r = await setPublished(db, slug, me, action === "publish");
    if (!r.ok) return go(back, { error: r.message });
    return action === "publish" ? go(`/builds/${slug}`, { published: "1" }) : go(back, { unpublished: "1" });
  }
  return go(back);
}
