# openproduct

Products built in the open: a directory where every build is a public repo
and a public workspace on Orunbase. This is a sample of the redesigned
openproduct.live. It reads the real directory from openproduct.live's public
API, and labels anything the API does not provide yet as sample data.

- `web/`: the app, Next.js on Cloudflare Workers via OpenNext
- `intent.yaml`: how orun builds and deploys it (stage, then prod)
- `specs/epics/openproduct-reimagined/`: the design and the plan

```bash
cd web && pnpm install && pnpm dev     # http://localhost:3000
```

Merges to `main` deploy through orun to
[stage](https://openproduct-web-stage.vijayakrishnan12994.workers.dev) and then
[prod](https://openproduct-web-prod.vijayakrishnan12994.workers.dev). The
Cloudflare deploy token is brokered per run by the `newopenproduct` Orunbase
workspace; no credential is stored in this repository.
