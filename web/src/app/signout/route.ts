// POST /signout — end this session. POST only, from a page on this site, so
// a link or an image on another site can't sign anyone out.
import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/auth/request";
import { invalidateSession, SESSION_COOKIE } from "@/lib/auth/session";
import { database } from "@/lib/server/env";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  const db = await database();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (db) await invalidateSession(db, token);
  const res = NextResponse.redirect(new URL("/", request.url), 303);
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax" });
  return res;
}
