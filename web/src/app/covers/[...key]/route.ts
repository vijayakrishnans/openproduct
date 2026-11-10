// GET /covers/<slug>/<random>.<ext> — a listing's cover image from R2
// (list-your-build LB5). Only keys the upload wrote can be asked for; the
// type comes from the stored object (set from the file's magic bytes),
// sniffing is off, and the response can't run anything.
import { NextResponse, type NextRequest } from "next/server";
import { COVER_KEY, COVER_TYPES } from "@/lib/auth/listing-media";
import { appEnv } from "@/lib/server/env";

const ALLOWED = new Set<string>(Object.values(COVER_TYPES));

export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const key = `covers/${(await params).key.join("/")}`;
  if (!COVER_KEY.test(key)) return new NextResponse("Not found", { status: 404 });
  const env = await appEnv();
  const obj = env.COVERS ? await env.COVERS.get(key).catch(() => null) : null;
  const type = obj?.httpMetadata?.contentType ?? "";
  if (!obj || !ALLOWED.has(type)) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(obj.body, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
