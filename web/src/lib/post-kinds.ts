// Kinds of writing (topics-and-community TC2, design D2).

export const POST_KINDS = ["blog", "tutorial", "doc", "baseline", "launch"] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const POST_KIND: Record<PostKind, { label: string; plural: string; hint: string }> = {
  blog: { label: "Blog", plural: "Blogs", hint: "A build log, a lesson, an opinion." },
  tutorial: { label: "Tutorial", plural: "Tutorials", hint: "How to do one thing, step by step." },
  doc: { label: "Doc", plural: "Docs", hint: "Reference people will come back to." },
  baseline: { label: "Baseline", plural: "Baselines", hint: "A starter others can copy: link its repo." },
  launch: { label: "Launch", plural: "Launches", hint: "You shipped something: name the build." },
};

export const isPostKind = (v: string): v is PostKind => (POST_KINDS as readonly string[]).includes(v);
