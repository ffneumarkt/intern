# Locations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD; German UI, English code; commits end with
> the `Co-Authored-By` line; branch `feature/locations`.

**Goal:** Track where every item is, set it automatically after a use and from the check form, and filter lists by it.

**Spec:** `docs/superpowers/specs/2026-11-25-locations-design.md`

## Tasks

1. **Backend:** migration `1793380009_locations.go` (collection, three relations, default AS-Werkstatt, existing items
   assigned), rules in `1793380001_rules.go`-style for `locations` (extra migration rules or in the new one), hooks in
   `internal/material/hooks.go` (use, check, delete guards, default protection), `locationId` in `route.go`; Go tests;
   `devseed` creates RLF and LAST and puts some masks there.
2. **Web data:** `Location`, `listLocations`, `createLocation`/`updateLocation`/`deleteLocation`, `Item.locationId`,
   `ItemInput.locationId`, `CheckInput.locationId`, history detail „Standort“; fixtures and `fakeMaterial` (a use sets the
   default location like the server).
3. **Web views:** `components/LocationFilter.tsx` on the due list and the category page, location in `ItemRow` and
   the item page, history; tests.
4. **Web forms:** Standort select in `RecordCheckPage` (Bestanden only, default AS-Werkstatt), location select in
   `ItemForm`, „Standorte“ tab in Verwalten; tests.
5. **E2E and docs:** `web/e2e/locations.spec.ts`, STATUS.md, spec cross references.
