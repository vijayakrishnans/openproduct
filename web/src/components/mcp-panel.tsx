"use client";

import { useState } from "react";
import { OPENPRODUCT_MCP } from "@/lib/links";

const CLIENTS = [
  { key: "claude-code", label: "Claude Code", lang: "shell", code: () => `claude mcp add --transport http openproduct ${OPENPRODUCT_MCP}` },
  {
    key: "cursor",
    label: "Cursor",
    lang: "~/.cursor/mcp.json",
    code: () => JSON.stringify({ mcpServers: { openproduct: { url: OPENPRODUCT_MCP } } }, null, 2),
  },
  {
    key: "vscode",
    label: "VS Code",
    lang: ".vscode/mcp.json",
    code: () => JSON.stringify({ servers: { openproduct: { type: "http", url: OPENPRODUCT_MCP } } }, null, 2),
  },
  {
    key: "claude",
    label: "Claude.ai",
    lang: "Settings → Connectors → Add custom connector",
    code: () => OPENPRODUCT_MCP,
  },
] as const;

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="mcp-copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          },
          () => undefined,
        );
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** How to reach this build from an AI assistant, over openproduct's public MCP server. */
export function McpPanel({ slug }: { slug: string }) {
  const [client, setClient] = useState<(typeof CLIENTS)[number]["key"]>("claude-code");
  const c = CLIENTS.find((x) => x.key === client)!;
  const prompt = `Use the openproduct MCP to get the product "${slug}". What does it do, what is it built with, and which roles are open?`;
  return (
    <div className="panel mcp-panel" id="mcp">
      <div className="panel-head">
        <div>
          <h2>Use it from your AI assistant</h2>
          <div className="sub">
            openproduct runs a public MCP server. Connect it once and any MCP client can read {slug}: what it does, its stack and its open roles. No key needed.
          </div>
        </div>
        <span className="pill mono">MCP</span>
      </div>

      <div className="mcp-endpoint">
        <span className="mono">{OPENPRODUCT_MCP}</span>
        <Copy text={OPENPRODUCT_MCP} />
      </div>

      <div className="mcp-tabs" role="tablist" aria-label="MCP client">
        {CLIENTS.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={x.key === client} onClick={() => setClient(x.key)}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="mcp-code">
        <div className="mcp-code-head">
          <span className="mono">{c.lang}</span>
          <Copy text={c.code()} />
        </div>
        <pre><code>{c.code()}</code></pre>
      </div>

      <div className="mcp-code">
        <div className="mcp-code-head">
          <span>Then ask</span>
          <Copy text={prompt} />
        </div>
        <p className="mcp-prompt">{prompt}</p>
      </div>

      <ul className="mcp-tools">
        <li><code>get_product</code> <span className="mono muted">{`{ "slug": "${slug}" }`}</span> this build: components, open roles, metrics</li>
        <li><code>list_products</code> every build, filterable by category, stack, licence and open roles</li>
        <li><code>list_facets</code> the categories and stacks you can filter by</li>
      </ul>
    </div>
  );
}
