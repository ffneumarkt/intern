# Handover: Ionic → shadcn/ui migration (state of 2026-11-25)

Read first: `docs/superpowers/plans/2026-11-25-shadcn-migration.md` (goal, decisions, phases), then `CLAUDE.md`
(conventions; some of it still describes Ionic and is rewritten in phase 5).

## Where things stand

| Phase | What | State |
|---|---|---|
| 1 | Tailwind 4 (no preflight), brand tokens, `cn`, `@` alias, `components.json`, shadcn `Button` | merged (#64) |
| 2a | `AppButton`/`BlockButton`, `Chip`, `Segment`, `Switch`, Radix `AlertDialog` + `DialogProvider`/`useDialogs` | merged (#65) |
| 2b | native `Field`/`TextAreaField`/`SelectField` (`<input>`, `<textarea>`, `<select>`), `<option>` instead of `IonSelectOption` | merged (#66, Firefox and WebKit CI green) |
| 3a | lucide icons instead of ionicons outside the shell | merged (#67) |
| 3b | list primitives replace `IonList`/`IonItem`/`IonLabel`/`IonListHeader`/`IonNote`/`IonText`/`IonCard` | **in progress, uncommitted** on branch `feature/shadcn-lists` (see below) |
| 4 | shell: react-router `<Routes>`, `AppShell` (header, back, tabs, FAB), `useViewEnter`; remove `@ionic/*` | not started |
| 5 | polish (safe areas, 16 px inputs, PWA), rewrite CLAUDE.md/README/STATUS | not started |

Decisions (from the plan): native styled `<select>`; plain page changes (no transitions/swipe-back); brand colours kept
(`#af2b1e` red, `#1f7a4a` check green, slate); lucide icons.

## Phase 3b: the uncommitted work on `feature/shadcn-lists`

Branch is cut from the phase 3a commit (`7f876cb`). Nothing of 3b is committed or pushed. `git status` shows about 40
changed files. What is done in the working tree:

- **New** `web/src/components/ui/list.tsx` (+ `list.test.tsx`, 7 tests): `List` (`inset`), `ListHeader`, `Row` (link with
  `to`, button with `onClick`, else a div; `detail` chevron, `lines="none"`, `data-slot="row"`; children with
  `slot="end"`/`slot="start"` go right/first), `RowLabel` (`<h2>/<h3>/<p>` styled), `Note`.
- **Scripted conversion** of all non-shell files: `IonList`→`List`, `IonItem`→`Row` (`routerLink`→`to`, `button`/`lines="full"`
  dropped), `IonLabel`→`RowLabel`, `IonListHeader><IonLabel>`→`ListHeader`, `IonNote`→`Note`; `FieldFrame` in
  `components/Field.tsx` uses `Row`. Hand edits: `ui.tsx` (`ErrorText` is a `<p>` with the tinted box, `Card` a div, tone
  `warning` = amber), `StartPage.tsx` (`Tile` is a `Link` with class `tile`), `Scanner.tsx` (camera picker is a
  `NativeSelect`), `TransportDocumentForm.tsx` (Ionic accordion → `<details class="td-route">`; **no CSS yet for
  `.td-route`, check it**), `SettingsGroup.tsx`, `SettingsPage.tsx`, `RecordUsePage.tsx` (`role="list"` added to the three
  `aria-label` lists in `RecordUsePage.tsx` and `AssignCode.tsx`).
- **CSS**: `theme/ui.css` and `theme/variables.css` rewritten to `[data-slot=…]` selectors; dead Ionic rules removed.
  `ui.css` still uses Ionic colour variables (`--ion-color-*`), which stay until phase 4.
- **Tests**: `test/ionic.ts` helpers know both old and new elements (`ionItem` finds `[data-slot="row"]`, `choose`/
  `ionSelect`/`selectedText` handle native selects, `ionToggle`/`setToggle` handle `role=switch`, `alertButton` finds
  `[role=alertdialog]`); `ui.test.tsx` (ErrorText, Card), `Scanner.test.tsx`, `AssignCode.test.tsx`, `pages.test.tsx` adjusted.
- **Result at the moment of the interrupt**: `npx vitest run` in `web/` → **580 passed**. `npm run typecheck` clean.
  **Not yet run on this state: Chromium e2e** (the last command was cancelled by the user), no visual check.

### Next steps for 3b
1. `cd web && npm run typecheck && npx vitest run`.
2. From the repo root: `npm --prefix web run e2e -- --project=chromium` (about 1.3 min; builds the frontend and binaries).
   Expect e2e failures where specs use Ionic selectors for rows/lists (`ion-item`, `ion-list`, `ion-chip`, `ion-label`); grep
   `web/e2e` for `ion-` and convert (use `[data-slot="row"]`, roles, `getByRole('link'|'button')`). Rows that were
   `routerLink` are links now; the "Prüfen" button inside a due-list row sits inside the row link (it stops propagation).
3. Look at the app (`make dev-api` + `make dev-web`, log in as `verwaltung@ffneumarkt.local` / `intern-dev-1234` after
   `make seed`) or screenshots from `web/e2e/screens.spec.ts`; fix what the CSS rewrite broke (list cards, due-list state
   edge, group header dots, settings insets, start tiles, `.td-route` details, scanner camera pill).
4. Add `.td-route` styling for the `<details>`; check `LegalItems`, `InfoPage`, `ManagePage` rows.
5. Commit, push, open a PR against `main` (title "shadcn migration, phase 3b: list primitives"). CI runs Chromium,
   Firefox and WebKit e2e; the PR merges itself when green (`.github/workflows/automerge.yml`).

## Phase 4 (shell) outline

Still Ionic after 3b: `App.tsx` (`IonApp`, `IonTabs`, `IonTabBar`, `IonRouterOutlet`, `IonReactRouter`/`IonReactMemoryRouter`,
tab icons), `components/Page.tsx` (`IonPage`, `IonHeader`, `IonToolbar`, `IonTitle`, `IonButtons`, `IonBackButton`,
`IonContent`), the FAB in `pages/DueListPage.tsx` (`IonFab`, `IonFabButton`, ionicons `barcodeOutline`), `main.tsx`
(`setupIonicReact`, Ionic CSS imports), and the hooks `useIonRouter`, `useIonViewWillEnter`, `useIonViewWillLeave`
(`useResource`, `RecordUsePage`, `RecordCheckPage`, `Scanner`). Plan: react-router `<Routes>` with the same `paths`,
`AppShell` with header/back/bottom tabs/FAB, a `useViewEnter` hook (route became active) replacing the Ionic view hooks,
the single `LoginRedirect` stays. Then remove `@ionic/react`, `@ionic/react-router`, `ionicons`, the `@lit/react` alias and
`server.deps.inline` in `web/vite.config.ts`, Ionic CSS imports, `variables.css` Ionic tokens (move to Tailwind tokens),
`test/ionic.ts` Ionic branches (rename helpers to plain role queries), and e2e `ion-*` selectors. Pages unmount on leave
after this: check forms that kept typed state and scroll position.

## Working agreements in this repo (from CLAUDE.md and the session)

- Work on a branch, PR against `main`; owner PRs merge themselves once all checks are green. Docs-only PRs and PRs touching
  workflows need a manual merge. Branches in this migration are stacked on `main` after each merge (`git checkout main &&
  git pull && git checkout -b …`).
- TDD: failing test first. (Phase 2b's `list.test.tsx` and the phase 3a/PR 3 admin screens were written together with their
  code; do better.)
- UI text German only (Austrian: "Jänner"), code and comments English. Logging only via `internal/logging` in Go.
- `make test` = go vet, go test, `npm run typecheck` (`tsc -b --noEmit`, which also checks test files; plain
  `tsc --noEmit` does not), vitest. e2e: `npm --prefix web run e2e -- --project=chromium` from the repo root;
  `E2E_SKIP_BUILD=1` reuses the last build. `npm audit` in CI fails only at `--audit-level=high`; there are known
  moderate findings (glob, minimatch, react-router) that predate this work.
- Do not push or open PRs for anything the user did not ask for. The user asked for this migration to run
  autonomously with PRs that merge themselves; the last request was to stop and hand over.

## Other open items (not part of the migration)

- `git stash@{0}` on `feature/scan-use-or-check`: the unfinished "scan: use or check, default by due state" feature
  (per-item kind chip on the scan list, `Prüfung erfassen` button, preselected item skips the scan step is already merged).
  Resume with `git checkout feature/scan-use-or-check && git stash pop`; it was branched before several merges, so rebase
  onto `main`. Its tests use the old Ionic helpers; they work through the dual-mode helpers.
- The user's local dev DB (`backend/pb_data`) holds user `hansi` (`loisinger.r@gmail.com`) with manage on both categories
  and no admin area yet: `go run ./cmd/intern admin grant loisinger.r@gmail.com members categories transport corrections
  --dir pb_data` in `backend/`.
- Admin UI, member setup links, corrections, timeline view and README updates are merged; see `docs/superpowers/STATUS.md`.
