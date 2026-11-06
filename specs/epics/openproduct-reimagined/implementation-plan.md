# openproduct-reimagined — implementation plan

## OP0 — the spec

- This doc set and `tasks/OP-1.TaskContract.yaml` are on main.

## OP1 — the directory

- `web/`, `intent.yaml` and the orun CI workflow are on main; a merge
  deploys to stage, then prod, and the smoke check passes.
- `/` renders the hero, the card grid with app maps, the sort tabs, the
  category chips and the quiet row from `api.openproduct.live`, on stage
  and prod.
- Every sample value on the page is labelled as sample.
- A failed API read shows the unreachable state, not an error page.

## OP2 — the build page

- `/builds/<slug>` renders for every listing the API returns, with its real
  tagline, category, licence and roles.
- An unknown slug is a 404.
- The app map pieces are selectable and show their detail.

## OP3 — the pulse, roles and phone

- The live pulse and the "Looking for people" row are on the home page;
  `/roles` lists every open role.
- At 390 px the home page matches the PDF's phone layout, with the bottom
  bar.

## OP4 — polish and hand-off

- A screenshot pass at 1440 and 390 px, each defect fixed.
- The prod URL is reported to the user to share.

## Sequencing

OP1 carries the app, its orun wiring and the data module, so it is the
largest. OP2 and OP3 only read what OP1's module already returns. OP4 is
fixes only.
