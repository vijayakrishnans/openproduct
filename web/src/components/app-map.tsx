"use client";

import { useState } from "react";
import type { Piece } from "@/lib/directory";

const POS: Record<string, string> = { "sign-in": "n-top", data: "n-left", payments: "n-right", deploy: "n-bottom" };

const DETAIL: Record<string, (p: Piece) => { title: string; body: string }> = {
  deploy: (p) => ({ title: `Deployed on ${p.provider}`, body: "Workers on stage and prod. Deploys this week, none rolled back." }),
  data: (p) => ({ title: `Data in ${p.provider}`, body: "The build's own database, connected through the workspace." }),
  "sign-in": (p) => ({ title: `Sign-in with ${p.provider}`, body: "Accounts and sessions, from the integration the build uses." }),
  payments: (p) => ({ title: `Payments with ${p.provider}`, body: "Checkout and subscriptions, through a connected provider." }),
};

/** The build page's app map: the pieces around the app; tap one for its detail. */
export function AppMap({ slug, initials, pieces }: { slug: string; initials: string; pieces: Piece[] }) {
  const first = pieces.find((p) => p.movedLast) ?? pieces.find((p) => p.provider) ?? pieces[0];
  const [sel, setSel] = useState(first.key);
  const chosen = pieces.find((p) => p.key === sel)!;
  const d = chosen.provider ? DETAIL[chosen.key](chosen) : { title: `${chosen.label}: not connected`, body: "This build does not use one yet." };
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>App map</h2>
          <div className="sub">Drawn from the integrations this build uses. Tap a piece.</div>
        </div>
        <div className="legend">
          <span><i className="map-dot moved" /> changed this week</span>
          <span><i className="map-dot hollow" /> not connected</span>
        </div>
      </div>
      <div className="map-big">
        <svg className="map-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {pieces.map((p) => {
            const end = { "sign-in": [50, 16], data: [18, 40], payments: [80, 36], deploy: [76, 80] }[p.key]!;
            return (
              <line key={p.key} x1="50" y1="52" x2={end[0]} y2={end[1]} className={!p.provider ? "off" : p.movedLast ? "hot" : ""} />
            );
          })}
          <line x1="50" y1="52" x2="22" y2="80" className="hot" />
        </svg>
        <div className="map-app">
          <span className="mono">{initials}</span>
          <small>{slug} app</small>
        </div>
        {pieces.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`map-piece ${POS[p.key]}${sel === p.key ? " on" : ""}${p.provider ? "" : " off"}`}
            onClick={() => setSel(p.key)}
            aria-pressed={sel === p.key}
          >
            <b>
              {p.provider ? <i className={`map-dot${p.movedLast ? " moved" : ""}`} /> : null} {p.label}
            </b>
            <small className="mono">{p.provider ?? "not connected"}</small>
          </button>
        ))}
        <div className="map-piece n-repo static">
          <b><i className="map-dot moved" /> Repo</b>
          <small className="mono">GitHub · public</small>
        </div>
      </div>
      <div className="map-detail">
        <div className="kicker mono">{chosen.label.toUpperCase()}{chosen.provider ? ` · ${chosen.provider.toUpperCase()}` : ""}</div>
        <strong>{d.title}</strong>
        <p>{d.body}</p>
      </div>
      <div className="sample-tag">Sample: the API does not describe a build&apos;s integrations yet.</div>
    </div>
  );
}
