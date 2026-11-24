# Locations of items: design

Replaces the „Standort“ column of the paper Betriebsnachweis. Extends §3 (data model) and §8 (screens) of
`2026-10-29-intern-platform-design.md`.

## Behaviour

- Every item has a **current location**. Locations are records in a managed list; **AS-Werkstatt** is created
  by the migration as the default, trucks (RLF, LAST, …) are added in Verwalten.
- **After a use**, the item is in the default location (AS-Werkstatt) automatically.
- **After a check with a location** the item is there. In „Prüfung erfassen“ a „Standort“ select appears when the
  result is Bestanden, defaulting to AS-Werkstatt and listing all locations (a mask checked in the workshop while the
  trucks are full stays there; otherwise the Wart picks the truck). With Mangel or ausgeschieden the select is hidden
  and the location does not change. The same form opens from the „Prüfen“ button on the due list.
- The history keeps where the item was at each use and check („Standort: RLF“ in the entry).
- A **filter by location** on the due list and on the category page: chips „Alle“ plus the locations, showing the
  items currently there („the masks that are in RLF“).
- The item page shows „Standort“, rows show it in the secondary line, the item form (Verwalten) has a select that
  defaults to AS-Werkstatt for a new item, so it can be corrected by hand.
- Verwalten has a „Standorte“ tab to add, rename and remove locations. A location that items, uses or checks refer
  to cannot be deleted; the default location cannot be deleted or changed into a non-default one.

## Data

- `locations`: `name` (required, unique), `is_default` (bool). Read by every logged in user; created, renamed and
  deleted by users with the manage level in at least one category. `is_default` is not settable through the API.
- `items.location`, `uses.location`, `checks.location`: optional single relations to `locations`. The migration
  gives all existing items the default location.

## Rules (server side, so every client behaves the same)

- Creating a use sets `uses.location` and the item's location to the default location.
- Creating a check with a location sets the item's location to it; without one nothing changes.
- A location cannot be deleted while referenced; the default one never.

## Out of scope

Locations per category, moving an item without a check or use (the item form does that), a location history page,
stock counts per location.

## Testing

Migration and rules (who may read and manage), the hooks (use, check with and without location, delete guards), the
due API carrying `locationId`; web: filter, rows, item page, history, check form (select only for Bestanden, default,
saved value), item form, Verwalten tab; a Playwright test for check → location → filter.
