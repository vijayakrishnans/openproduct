// Who is looking, for pages that change with it: signed in, has a builder
// profile, moderates.
import { builderOfAccount, type OwnedBuilder } from "./builders";
import { isModerator, parseModerators } from "./discussions";
import { currentSession } from "./request";
import type { Session } from "./session";
import { appEnv, database } from "../server/env";
import type { Db } from "../server/db";

export type Viewer = { session: Session | null; builder: OwnedBuilder | null; moderator: boolean; db: Db | null };

export async function viewer(): Promise<Viewer> {
  const [session, db, env] = await Promise.all([currentSession(), database(), appEnv()]);
  if (!session || !db) return { session, builder: null, moderator: false, db };
  const [builder, moderator] = await Promise.all([
    builderOfAccount(db, session.account.id),
    isModerator(db, session.account.id, parseModerators(env.MODERATORS)),
  ]);
  return { session, builder, moderator, db };
}
