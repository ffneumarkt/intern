# Ionic dialogs and form fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the last native UI elements with Ionic components: the five `window.confirm`/`window.prompt` dialogs become `IonAlert`s, and the form fields from `Field.tsx` (text, select, textarea, checkbox) become `IonInput`, `IonSelect`, `IonTextarea` and `IonToggle`.

**Architecture:** Two stacked PRs. A (Task 1, branch `feature/ionic-dialogs`, from `main`): a small `useDialogs` hook over Ionic's `useIonAlert` with promise-based `confirm` and `prompt`, used at the five call sites. B (Tasks 2-3, branch `feature/ionic-forms`, based on A): `Field.tsx` keeps its component names and props but renders Ionic controls, so the six forms change without touching their logic; the tests get one shared helper for typing and choosing.

**Tech Stack:** Ionic React 9 (`useIonAlert`, `IonInput`, `IonSelect`, `IonTextarea`, `IonToggle`), Vitest with the `@lit/react` alias already in `vite.config.ts`, Playwright (`web/e2e`).

**Context (verified by a probe under the current vitest setup):** `IonInput`/`IonTextarea` pass `type`, `value`, `autocomplete` to the inner native input, `getByLabelText` finds it, and `fireEvent.input` on it drives `onIonInput`. `IonSelect` takes `value` and fires `ionChange`. `useIonAlert` renders an `ion-alert` with header, message and real `<button>`s. The old tests use `fireEvent.change` (34 places in `*.test.tsx`), which does not reach Ionic inputs.

## Global Constraints

- Everything in `CLAUDE.md`: TDD, UI text German only, code and comments English, Ionic conventions in tests. `CLAUDE.md` currently says forms use native inputs through `Field.tsx` and not `IonInput`/`IonSelect`; Task 2 rewrites that line.
- Never redirect from a page or route element (`<Navigate>`); see `LoginRedirect`.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (use the exact line the controller gives you).
- Work in `/home/rloi/repo/intern` directly on the branch that is checked out; no worktrees; do not push; do not touch `backend/pb_data` or stop the user's dev servers (ports 8090 and 5173); the e2e server uses port 8099.
- Behaviour must not change: the same German texts, the same validation, the same save logic. Password managers and autofill must keep working: `autocomplete` values stay, inputs stay inside the existing `<form>` elements so Enter submits.
- Native `<input type="time">` for Ruhezeit and native `type="date"` pickers stay native-OS pickers (`IonInput type="date"` renders the same native control). `IonDatetime` is out of scope.
- `make test` stays fast and browser-free; `make e2e` (Chromium, Firefox, and WebKit in CI) must stay green. Locally run `npm --prefix web run e2e -- --project=chromium --project=firefox`; WebKit runs in CI (or the Playwright Docker image).

## Review Focus

1. A confirmation dialog must never act on "Abbrechen" or on a dismissed overlay (backdrop tap, Escape), and must never act twice (double tap). (Task 1)
2. Autofill and Enter-to-submit on the login form keep working with `IonInput`: `autocomplete`, `type`, form submit through the keyboard. (Task 2, e2e)
3. Every form still shows the right value after a failed save and after a reload of the data (controlled values do not stick to stale state). (Task 2)
4. A select with an unset or removed option (e.g. a deleted category) does not show a wrong selection or crash. (Task 2)
5. Looks right in iOS and Material mode at 390 px: labels, spacing, error text, no overlap; the forms (login, record use, record check, item form, check type form, passkey add) were checked on real screenshots. (Task 3)

---

### Task 1: Dialogs as IonAlerts (branch `feature/ionic-dialogs`)

**Files:**
- Create: `web/src/components/useDialogs.ts`, `web/src/components/useDialogs.test.tsx`, `web/e2e/dialogs.spec.ts`
- Modify: the five call sites (`web/src/pages/SettingsPage.tsx` rename and remove passkey, `web/src/pages/ItemEditPage.tsx` delete, `web/src/pages/ItemPage.tsx` retire, `web/src/pages/ManagePage.tsx` delete), their tests (`web/src/App.test.tsx` lines about `window.prompt`/`window.confirm`, `web/src/pages/pages.test.tsx` likewise), `web/src/test/ionic.ts` (helper to find alert buttons), `CLAUDE.md` if a convention changes

**Interfaces:**
- Produces:

```ts
export interface ConfirmOptions { header?: string; message: string; confirmText: string; destructive?: boolean }
export interface PromptOptions { header: string; label: string; value: string; confirmText: string }
export function useDialogs(): {
  confirm(options: ConfirmOptions): Promise<boolean>        // true only for the confirm button
  prompt(options: PromptOptions): Promise<string | null>    // trimmed text, or null when cancelled, dismissed or empty
}
// test helper in web/src/test/ionic.ts:
export const alertButton: (text: string) => HTMLElement | null   // a button inside the open ion-alert, by its text
```

- [ ] **Step 1: Write the failing tests** for `useDialogs` (a tiny test component with two buttons): `confirm` resolves true after pressing the confirm button; resolves false after „Abbrechen“; resolves false when dismissed (dispatch the overlay's dismiss through the backdrop or `ionAlertDidDismiss` with role `backdrop`, or Escape, whichever the jsdom wiring allows; probe first); a second call while an alert is open does not open a second one and does not act twice (Review Focus 1); `prompt` returns the trimmed text, pre-fills `value`, returns null when cancelled, dismissed, or empty/whitespace. A destructive confirm button has the `destructive` role (iOS red).
- [ ] **Step 2: Run them** and watch them fail (module missing). Implement `useDialogs.ts` over `useIonAlert`: buttons `Abbrechen` (role cancel) and the confirm text; resolve inside the buttons' handlers and on `onDidDismiss` (resolve false/null if nothing resolved yet); a ref guard so a second call while one is open returns false/null at once. German texts come from the call sites.
- [ ] **Step 3: Replace the five call sites.** Texts stay identical: rename: header „Passkey umbenennen“ (label „Neuer Name“, value = the current name, confirm „Speichern“); remove passkey: message `Passkey „<name>“ entfernen?`, confirm „Entfernen“, destructive; delete item (`ItemEditPage`, `ManagePage`): message `<name> löschen?`, confirm „Löschen“, destructive; retire item: message `<name> ausscheiden?`, confirm „Ausscheiden“, destructive. Look at the call sites for the exact current texts and keep them as the message.
- [ ] **Step 4: Update the existing tests** that spied on `window.confirm`/`window.prompt`: they now click the alert buttons through `alertButton` and assert the same effects (including: cancel does nothing). No test may be deleted.
- [ ] **Step 5: End-to-end spec** `web/e2e/dialogs.spec.ts`: as `verwaltung` (use the fixtures from `web/e2e/fixtures.ts`), create a throwaway item through the REST API (own token), then in the UI delete it from the manage page: cancel first (item still listed), then confirm (item gone); a second item: retire it from its detail page with confirm. Chromium only for a passkey rename/remove spec (use the virtual authenticator as `login.spec.ts` does): rename a passkey to „Diensthandy“ and remove it. Clean up what each test creates; tests must not depend on order.
- [ ] **Step 6: Verify:** `npm --prefix web run typecheck`, `npm --prefix web test`, `npm --prefix web run e2e -- --project=chromium --project=firefox` green, twice in a row. Take screenshots of an open alert in iOS and Material mode (a throwaway spec or `E2E_SCREENSHOTS=1` extension of `screens.spec.ts`), look at them, report.
- [ ] **Step 7: Commit.**

---

### Task 2: Field components become Ionic (branch `feature/ionic-forms`, based on `feature/ionic-dialogs`)

**Files:**
- Modify: `web/src/components/Field.tsx`, the six forms only where their markup differs from the helpers (`web/src/components/ItemForm.tsx`, `web/src/pages/LoginPage.tsx`, `web/src/pages/ManagePage.tsx`, `web/src/pages/RecordCheckPage.tsx`, `web/src/pages/RecordUsePage.tsx` incl. its raw code `<input>` and suggestions, `web/src/pages/SettingsPage.tsx` passkey add form), all their tests, `web/src/test/ionic.ts`, `web/src/theme/variables.css` (delete the now unused `code-input`, `stacked-label`, `checkbox-label` rules), `CLAUDE.md`

**Interfaces:**
- `Field.tsx` keeps `Field`, `TextAreaField`, `CheckboxField`, `SelectField` with the current props and adds only what Ionic needs. New implementation: `Field` -> `IonInput` (`labelPlacement="stacked"`, `type`, `autocomplete`, `required`, `max`, `onIonInput`), `TextAreaField` -> `IonTextarea` (`labelPlacement="stacked"`, `autoGrow`), `SelectField` -> `IonSelect` with `IonSelectOption` children (callers currently pass `<option>` children: change those call sites to `IonSelectOption`; give the helper a typed `options` or keep `children` as `IonSelectOption`s, whichever touches fewer lines), `CheckboxField` -> `IonToggle` (`justify="space-between"`). Each stays wrapped in an `IonItem` as now.
- Test helpers in `web/src/test/ionic.ts`:

```ts
export function typeInto(input: HTMLElement, value: string): void       // fires the native input event on the inner input
export function choose(select: HTMLElement, value: string): void        // fires ionChange with that value on the ion-select
export function setToggle(toggle: HTMLElement, on: boolean): void       // existing ionToggle pattern, if not already there
```

- [ ] **Step 1: Failing tests first.** Add a `web/src/components/Field.test.tsx` that renders each helper with a controlled value and checks: label text, `getByLabelText` finds the inner input, typing calls `onChange` with the value, `type` and `autocomplete` reach the inner input, a select shows the chosen option's text and `choose` changes it, a toggle's `checked` follows its prop and a click calls `onChange`. Run: fails (still native).
- [ ] **Step 2: Implement `Field.tsx`** and the helpers. Update the call sites. Keep every form's `<form onSubmit>`, `required`, `max`, `autoComplete` behaviour; the RecordUse manual code input (`code-input`, label „Code manuell eingeben“) becomes an `IonInput` as well, Enter submits it.
- [ ] **Step 3: Migrate the tests** (34 `fireEvent.change` uses and the select/checkbox interactions in `App.test.tsx`, `pages.test.tsx`, others) to `typeInto`/`choose`/`setToggle`. No test may be deleted or weakened; where an old assertion cannot be expressed, keep its intent and say so in the report. Run the whole suite until green.
- [ ] **Step 4: Review Focus checks as tests** where jsdom can express them: a form shows the server value again after a failed save (the existing failure tests cover several; add one for the item form if none does), a select whose value is not among the options shows no selection and does not crash.
- [ ] **Step 5: `CLAUDE.md`:** rewrite the line that says forms use native inputs through `Field.tsx` (now: `Field.tsx` wraps Ionic controls; tests drive them with `typeInto`/`choose`/`setToggle`; native stays only for the time and date pickers). Remove CSS classes that are no longer used.
- [ ] **Step 6: Verify:** typecheck, `npm --prefix web test`, e2e (Chromium + Firefox) green twice in a row. `login.spec.ts` must still pass unchanged (labels, Enter-to-submit, passkey flow); if a spec needs a locator change, keep it role/label based and say why.
- [ ] **Step 7: Commit.**

---

### Task 3: Forms on real screens and e2e coverage

**Files:**
- Modify: `web/e2e/screens.spec.ts` (more states), new `web/e2e/forms.spec.ts`, app files for visual fixes, `docs/superpowers/STATUS.md`

- [ ] **Step 1: `forms.spec.ts`**, role/label locators, each test restores what it changes: record a use for an item as `verwendung` (select kind „Übung“, type „Erfasst von“, note, date default today; saved, shows in the item's history); record a check as `pruefung` (choose check type and result, note); create an item as `verwaltung` (name, serial, category select, a „zuletzt geprüft“ date) and delete it again; the login form: Enter in the password field submits (all three engines).
- [ ] **Step 2: Screens.** Extend `screens.spec.ts` (still only with `E2E_SCREENSHOTS=1`) with: login, record use, record check, item form, check type form, a form with a validation error. iOS mode via the iPhone profile (WebKit in Docker locally, or Chromium with the iPhone user agent), Material via Chromium. Look at every PNG: labels, spacing, error text, overlap at 390 px, select popups/action sheets readable. Fix real problems in the app files and say what you fixed.
- [ ] **Step 3: Docs.** `STATUS.md`: Ionic migration done, what stays native on purpose (time and date pickers), the dialogs and forms removed from the "still native" notes, deferred items you found.
- [ ] **Step 4: Verify** typecheck, jsdom, e2e twice in a row (Chromium + Firefox); commit.
