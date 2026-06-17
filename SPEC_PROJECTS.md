# Projects Module — SPEC

> Companion to SPEC.md. Covers the **Projects** feature in Studio Manager (CRM). Off the original
> roadmap — added because Pixieset lacks good project management + note collection.

## 1. Overview

A **Projects** module inside Studio Manager for tracking shoots/jobs end-to-end and collecting notes.
Airtable-like: a fixed core schema plus user-defined **custom fields**, surfaced through three views
— **Grid** (default), **Kanban** (by status), and **Calendar** (by event date). Multi-tenant: every
record is studio-scoped via the `BelongsToStudio` trait.

## 2. Core (fixed, non-removable) fields

Every project always has:

- **name** — string, required.
- **event_date** — date, nullable (drives the Calendar view).
- **status** — FK to a customisable `project_statuses` row (drives Kanban columns).
- **type** — FK to a customisable `project_types` row (drives colour coding); e.g. Wedding, Couples
  Shoot, Corporate.
- **notes** — long text (the "collect good notes" need).
- Optional links: **contact_id** (→ `contacts`), **collection_id** (→ `collections`).

> The four core fields (name, event_date, status, type) cannot be deleted or renamed as concepts —
> but the **status** and **type** *lists* are fully customisable (see §3).

## 3. Customisable lists (colour-coded)

- **`project_statuses`** — `id, studio_id, label, color (hex), position`. Ordered; rendered as the
  Kanban columns. Default seed pipeline (customisable):
  `Lead → Enquiry → Booked → In progress → Editing → Delivered → Completed`.
- **`project_types`** — `id, studio_id, label, color (hex), position`. Default seed:
  `Wedding, Couples Shoot, Corporate, Portrait, Event, Other`.

Colours are stored as hex; the UI offers a fixed palette plus a custom picker. Both lists are seeded
automatically for a studio on first visit (same pattern as a new Collection auto-creating its
"Highlights" set).

## 4. Custom fields (Airtable-style, hybrid storage)

- **`project_field_definitions`** — `id, studio_id, key (slug), label, type, options (json),
  position`. `type ∈ {text, long_text, number, money, date, select, multi_select, checkbox, url,
  contact}`. `options` holds the choices (with optional per-choice colour) for select / multi_select.
- **Values** are stored on `projects.custom_fields` (a JSON column), keyed by definition `key`. There
  is **no per-value table** — reads stay a single row, while definitions remain relational so they
  can be reordered and recoloured easily.
- Adding/removing a field changes definitions only; existing projects simply lack that key until set.

> Rationale for hybrid (vs full EAV): the photographer manages a handful of fields, not millions of
> rows; JSON values avoid join explosion while keeping field metadata first-class.

## 5. Data model

- **`projects`** — `id, studio_id, name, event_date (date, nullable), status_id (FK), type_id (FK,
  nullable), contact_id (FK, nullable), collection_id (FK, nullable), notes (text, nullable),
  custom_fields (json, nullable), position (int — order within a Kanban column), timestamps`.
  Uses `BelongsToStudio`. Casts: `event_date => date`, `custom_fields => array`.
- Relations: `status()`, `type()`, `contact()`, `collection()`.
- `project_statuses`, `project_types`, `project_field_definitions` are all `BelongsToStudio`.
- **SPEC.md §11 additions:** `Project`, `ProjectStatus`, `ProjectType`, `ProjectFieldDefinition`.

## 6. Backend (Laravel)

- `App\Http\Controllers\StudioManager\ProjectController` — resource
  (index / store / show / update / destroy). `index()` returns projects (status/type/contact
  eager-loaded), the studio's statuses, types, and field definitions, and the active view; supports
  search + type/status filters (mirrors `ContactController`).
- `POST projects/{project}/move` — Kanban drag: set `status_id` + `position` (reorder within column).
- `ProjectSettingsController` (or nested resources) — CRUD + reorder for statuses, types, and field
  definitions (mirrors the `invoices/settings` pattern).
- Routes under the existing auth group in `routes/web.php`; register literal paths (e.g.
  `projects/settings`) **before** `Route::resource('projects', …)` so they don't match `{project}`.
- Default statuses/types are seeded on first access if none exist.

## 7. Frontend (Inertia + React + Tailwind)

- Add **Projects** to `resources/js/Components/StudioManagerNav.tsx` (`Section` gets `'projects'`,
  `href: '/projects'`).
- `resources/js/Pages/Projects/Index.tsx` with a **view switcher** — Grid · Kanban · Calendar
  (persist the active view in the URL query, like the invoices status filter).
- **Grid view (default):** spreadsheet table; columns = name, event date, status pill, type pill,
  then each custom-field column; inline-editable cells; "＋ Add row" and "＋ Add field" (opens the
  field config).
- **Kanban view:** one column per status (ordered by position); cards grouped by `status_id`; drag a
  card between columns → `projects/{id}/move`. Reuse the **pointer-based drag-and-drop** already in
  `resources/js/Pages/Collections/Show.tsx` (no DnD library). Each card has a **left colour strip =
  type colour**, plus name, event date, and contact. Column headers allow add / rename / recolour /
  reorder of statuses.
- **Calendar view:** custom month grid built with native `Date` (prev/next month — no calendar
  library). Each project sits on its `event_date`, **colour-coded by type**, with a **status dot**
  (status colour). Click → project detail.
- **Project detail drawer/modal:** edit core fields + custom fields + notes + contact/collection
  links.
- **Projects settings:** manage statuses, types, and custom field definitions (label, type, options,
  colour, order) — mirrors `resources/js/Pages/Invoices/Settings.tsx`.
- `resources/js/lib/projectColors.ts` — default colour palette + hex → pill/dot/strip render helpers.

## 8. Colour coding summary

- **Type colour** → Kanban card left strip · Calendar entry colour · Grid type pill.
- **Status colour** → Kanban column accent · Calendar **status dot** · Grid status pill.

## 9. Phased build

- **A — Foundations + Grid:** migrations + models + `BelongsToStudio`; seed default statuses/types;
  Projects tab; `ProjectController` CRUD; **Grid view** with the core fields + colour pills.
  *Test:* create a project, see it in the grid, edit inline; tinker-verify studio scoping + seeding.
- **B — Kanban:** status columns + drag-to-move (`/move`), type colour strip, column management.
  *Test:* drag a card across columns → `status_id` updates and persists; reorder within a column.
- **C — Calendar:** month grid, type colour + status dot, click-through.
  *Test:* a project with an event date shows on the correct day with the right colours.
- **D — Custom fields:** field definitions CRUD + JSON values; grid columns + detail editing.
  *Test:* add a `select` field with coloured options, set it on a project, see it in grid + detail.
- **E — Polish:** Projects settings UI (colours/order); optional notes timeline; contact/collection
  linking from the detail view.

## 10. Open items

- **Notes:** single rich-text `notes` field for now; an optional timestamped `project_notes` timeline
  is a later enhancement.
- **Collections:** one optional `collection_id` for now; revisit if a project should group multiple
  collections/shoots.
- **Custom field types** may grow over time; an `attachment`/file type would need object storage and
  is deferred.
