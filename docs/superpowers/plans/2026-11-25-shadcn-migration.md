# Migrating the frontend from Ionic to shadcn/ui

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). One PR per phase; the app works after every PR.

**Goal:** Replace Ionic (`@ionic/react`, `@ionic/react-router`, `ionicons`) by shadcn/ui (Radix primitives, Tailwind 4, class-variance-authority, lucide icons) without changing what the app does. The Go backend, the PocketBase API, push, passkeys and the PWA stay as they are.

**Architecture:** Vite + React 19 + react-router 6 stay. An internal UI kit in `web/src/components/ui/` (shadcn-style source files, Tailwind classes, brand tokens in `theme/tailwind.css`) gets the same props as the wrappers pages already use (`Field`, `SelectField`, `CheckboxField`, `ui.tsx`, `useDialogs`), so pages change little. Ionic stays in place until the last phase; Tailwind runs without its preflight until then so the two do not fight. Test helpers (`test/ionic.ts`) find both kinds of element, so the 560 unit tests keep passing through the phases.

**Tech stack:** Tailwind CSS 4 (`@tailwindcss/vite`), Radix (`react-slot`, `alert-dialog`, `switch`), class-variance-authority, clsx, tailwind-merge, lucide-react.

## Decisions (made with the user's recommendations)

- A native `<select>` styled with Tailwind, not Radix Select: better on touch screens, and the OS picker stays.
- Plain page changes: no transitions and no swipe-back. Pages unmount when left, so `useResource` loads on mount and on route re-entry, and the "never `<Navigate>` in a page" rule loses its reason (the single `LoginRedirect` stays anyway).
- Brand: RAL 3000 red `#af2b1e`, check green `#1f7a4a`, slate neutrals, Roboto: unchanged, as Tailwind theme tokens.
- Icons: lucide-react replaces ionicons.

## Global constraints

- UI text German only; code and comments English. Routes only in `web/src/routes.ts`.
- Required fields keep the `required`/`error`/`tried` convention; `showFirstInvalid()` does not take the focus.
- Confirm and prompt dialogs stay behind `useDialogs`, never `window.confirm`.
- Every PR: `make test`, Chromium e2e locally, `govulncheck` untouched, `npm audit` no new findings; CI runs three browsers.

## Phases (one PR each)

1. **Foundation.** Tailwind 4 without preflight, brand tokens, `cn`, `@` alias, `components.json`, a shadcn `Button`; nothing visible changes. Test: `cn`, `Button` variants and `asChild`; the build contains the utilities.
2. **Controls.** `BlockButton` and buttons on `Button`; `Field`/`TextAreaField` on native inputs; `CheckboxField` on Radix `Switch`; `SelectField` on a native select; `useDialogs` on Radix `AlertDialog`; chips, segment, badge. `test/ionic.ts` helpers learn both elements. e2e selectors for dialogs, selects and toggles updated.
3. **Layout.** Own `List`, `ListHeader`, `Row`, `RowLabel`, `Note`, `Card` replace `IonList`, `IonListHeader`, `IonItem`, `IonLabel`, `IonNote`, `IonText`, `IonCard`; lucide icons replace `IonIcon`; `ui.css` shrinks to what Tailwind cannot say. Pages migrate in groups (auth and settings; material lists; forms; admin).
4. **Shell.** react-router `<Routes>`, `AppShell` (header with back button, bottom tabs, FAB), `useViewEnter` replacing `useIonViewWillEnter`; remove `@ionic/*`, `ionicons`, the `@lit/react` alias, Ionic CSS and `setupIonicReact`; test helpers renamed to plain role queries; e2e selectors (`ion-*`) replaced.
5. **Polish and docs.** Safe areas, 16 px input text (no iOS zoom), standalone PWA check, CLAUDE.md conventions and README rewritten, STATUS.

## Review focus

- iOS keyboard behaviour in WebKit (the Ionic input shim goes away in phase 4).
- Focus handling and screen-reader names of dialogs, switches and selects (Radix gives them; the tests assert roles).
- Pages that relied on staying mounted (typed form state, scroll position) after phase 4.
- Bundle size (should shrink) and the service worker precache.
