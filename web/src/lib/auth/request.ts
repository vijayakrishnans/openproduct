// Request-level helpers shared by the auth routes and pages.
import { cookies } from "next/headers";
import { database } from "../server/env";
import { SESSION_COOKIE, validateSession, type Session } from "./session";

export { safeNext, sameOrigin } from "./guards";

/** The signed-in session for the current request, or null. Safe to call from any server component. */
export async function currentSession(): Promise<Session | null> {
  const db = await database();
  if (!db) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    return await validateSession(db, token);
  } catch {
    return null;
  }
}
