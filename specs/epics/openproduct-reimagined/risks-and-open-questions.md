# openproduct-reimagined — risks and open questions

## OP-A — The real directory is quieter than the mockup (ACCEPTED)

On 2026-11-06 the API lists 35 builds; almost all show 0 merges in 7 days,
no components and no build log. Rendered honestly, most land below the
floor. The sample shows that truthfully, and the labelled sample data fills
the app map and build log so the design can be judged.

## OP-B — Sample data could be read as real (RISK)

The PDF's own line is "Nothing is self-reported." Every sample value is
labelled on the page, and the footer says which parts are sample.

## OP-C — The API changes shape (RISK)

The API is openproduct.live's own and may change. All reads go through one
module with tolerant parsing; a missing field is a blank, not a crash.

## OP-D — No baseline template (SETTLED)

The repository starts empty on purpose, so it holds only what this app needs.
orun still builds and deploys it: `intent.yaml` declares stage and prod, the
web component uses stack-tectonic's `cloudflare-workers-assets-turbo`
composition, and CI runs `orun plan` and `orun run --remote-state` against the
newopenproduct workspace, which brokers the Cloudflare token per run.
