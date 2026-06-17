# SPEC.md — Pixieset Clone ("working name: TBD")

> Product + technical specification. This is the source of truth for the build.
> Claude Code should read this fully before planning. Build it in **phases** (see §10) — do not attempt to build all modules at once.

---

## 1. Product overview

An all-in-one SaaS platform for professional photographers, modelled closely on Pixieset (2026). It is **multi-tenant**: each photographer ("studio") has their own account, branding, clients, galleries, store, and payouts. Their clients ("end clients") view galleries, proof photos, and buy prints/downloads.

The platform has five product modules, mirroring Pixieset:

1. **Client Gallery** — deliver, share, and proof photos/videos.
2. **Store** — sell prints (lab-fulfilled or self-fulfilled) and digital downloads.
3. **Studio Manager** — CRM: bookings, invoices, contracts, questionnaires, projects.
4. **Website** — drag-and-drop photography website + blog builder.
5. **Mobile Gallery App** — a personalised gallery for the client (build as a PWA in v1).

Plus a future module: **Photo Editor / AI culling** (explicitly out of scope for v1 — see §9).

### Commercial model (mirrors Pixieset)
- Free tier: limited storage, **15% commission** on store sales.
- Paid tiers: more storage, **0% commission**, custom branding, custom domain, etc.
- Tiers (illustrative, refine later): Free / Basic / Plus / Pro / Ultimate, plus a "Suite" bundle.

---

## 2. Tech stack (locked unless flagged)

- **Backend framework:** **Laravel 13** (PHP 8.3+).
- **Frontend:** **Inertia.js + React 19 + TypeScript**, via Laravel's official starter kit. Tailwind CSS + shadcn-style component library. Mobile-first, responsive. Single codebase — no separate API/SPA to deploy, but gallery UI still gets real React interactivity.
- **DB:** PostgreSQL, **Eloquent ORM + migrations**.
- **Auth:** Laravel starter-kit auth (**Fortify**) for studio users — email/password + Google OAuth via **Socialite**; passkeys optional (Laravel 13). End clients access galleries via **signed URLs / a lightweight guard**, not full accounts (see §4).
- **Object storage:** **Wasabi** (S3-compatible) as a custom Laravel **filesystem disk** (`league/flysystem-aws-s3-v3`) with the Wasabi endpoint/region. Direct browser uploads via **presigned URLs** (S3 client / `temporaryUploadUrl`). Never stream large originals through PHP.
- **Image processing:** **Intervention Image v3** (Imagick) in **queued jobs**; consider **libvips** (`jcupitt/php-vips`) for speed on large wedding sets. Generate derivatives + watermarked previews. Never process in the request lifecycle.
- **Queues / jobs:** **Laravel Queues (Redis driver) + Horizon** for monitoring. Workers run as separate processes (image processing, email, fulfilment, reminders).
- **Payments:**
  - **Subscriptions** (photographer plans): **Laravel Cashier (Stripe)**.
  - **Marketplace** (store orders, client invoices): **Stripe PHP SDK** with **Stripe Connect (Express)** destination charges + `application_fee_amount` for commission.
  - **Webhooks** (Cashier controller + custom handlers) are the source of truth for payment state.
- **Email:** Laravel Mail via **Resend/Postmark**; branded per-studio.
- **Scheduling:** **Laravel scheduler** for reminders (invoices/contracts/bookings) + cleanup tasks.
- **PDFs:** invoices/contracts via **dompdf** (`barryvdh/laravel-dompdf`).
- **Realtime (optional):** **Laravel Reverb** for upload/processing progress.
- **CDN / delivery:** **Cloudflare** in front of Wasabi; serve **sized derivatives** via signed URLs, never originals (Wasabi egress should not chronically exceed stored volume).
- **Tooling:** **Pest** (tests), **Pint** (formatting), **Telescope + Pulse** (debug/monitoring), **Sail or Herd** (local).
- **Deploy:** **Laravel Forge + VPS** (fits your Cloudways/Ubuntu/nginx experience); **Octane** optional later for throughput.

> **Stack note:** Laravel 13 + Inertia + React keeps everything in one codebase you control, leans on Eloquent / Cashier / Horizon for the heavy lifting, and still gives the gallery UI real React where it needs interactivity. If you'd rather Laravel serve a pure JSON API with a separate SPA, or use **Livewire** instead of React, that's a small reshape — flag it. Everything below (data model, modules, phases) is stack-agnostic.

---

## 3. Architecture principles

- **Multi-tenancy:** every domain row is scoped to a `studioId`. Enforce tenant isolation at the data-access layer (never trust client input for tenant scope). Consider Postgres RLS later.
- **Upload pipeline:** client requests presigned upload → uploads original directly to Wasabi → dispatches a **queued job** → job streams the original, generates derivatives (thumb, web, hi-res, watermarked preview) → writes back to Wasabi → marks photo `ready`. UI shows processing state (poll or Reverb).
- **Storage layout (Wasabi):** `studios/{studioId}/collections/{collectionId}/photos/{photoId}/{original|thumb|web|preview|print}.ext`.
- **Signed delivery:** all client-visible image URLs are short-lived signed URLs (or signed via CDN). Originals/print-res are never publicly addressable.
- **Money:** store all amounts as integer minor units + currency. Stripe is source of truth via webhooks; never mark paid from the client.
- **Idempotency:** all webhook handlers and fulfilment actions are idempotent.
- **Background-first:** anything slow (image processing, email, fulfilment, reminders) goes through the queue.

---

## 4. Accounts, roles, branding

- **Studio (tenant):** owner account; settings for branding (logo, colours, fonts), custom domain, watermark, default currency, payout (Stripe Connect) status.
- **Studio users:** owner + optional team members (roles: owner, admin, member). v1 can ship owner-only and add team later.
- **End clients / gallery visitors:** access galleries via shareable link, optional password/PIN, optional email-gate. A "Studio Manager contact" can be linked to a collection. End clients do not need full accounts to view, but may create a lightweight identity to track favourites/orders.
- **Multi-brand:** higher tiers support multiple brands under one login (defer past v1; model `Brand` as a child of `Studio` so it's not a painful migration later).

---

## 5. Module: Client Gallery

### 5.1 Structure
- **Collection** (a delivered gallery for a shoot) → contains **Sets** (e.g. "Ceremony", "Reception") → contain **Photos** (and **Videos**).
- Collection has: title, event date, cover photo + **cover style** (typography/colour/layout presets, focal point), privacy settings, assigned price sheet, download settings, favourite settings, expiry date, status (draft/published).

### 5.2 Upload & processing
- Bulk drag-and-drop upload, resumable where possible, direct-to-Wasabi via presigned URLs.
- Support JPEG, PNG; **RAW proofing** (store + preview-only) as a later enhancement.
- **Queued job** generates: `thumb`, `web` (display), `preview` (watermarked, if enabled), `hi-res`/`print` (original retained for downloads/orders).
- EXIF read for capture time / ordering; preserve filename (needed for proofing export to Lightroom/Capture One).

### 5.3 Sharing & privacy
- Shareable link; optional **collection password**; optional **email registration** to view; per-set visibility.
- **Download PIN** option; control which resolutions clients can download; **free download limits**; disable right-click/save where feasible.
- **Watermark** overlay on previews (studio-configurable; not on paid downloads).
- Collection **expiry** + scheduled publish/unpublish; **scheduled emails**.

### 5.4 Proofing & favourites
- Clients **favourite** photos into one or more **favourite lists**; rename lists; **per-list selection limits**; **favourite notes/comments** per photo (toggleable).
- Studio sees **favourite activity** + history per collection; can **export favourites** (download files, copy/export **filenames as CSV**) to drive editing in Lightroom/Capture One.
- Send a favourite list **to the client as a digital download**; copy favourites into a new set/collection.

### 5.5 Delivery extras
- Embedded **videos** (upload + custom thumbnail; view in gallery + downloadable).
- **Gallery presets** — save design/Store/download/privacy settings and one-click apply to new collections.
- **Starred** collections/photos for quick studio access.
- **Email campaigns** — bulk branded emails to past clients (promote sessions, request reviews, announce sales). (Can ship a basic version; full campaign tooling is its own slice.)
- **Analytics**: views, downloads, favourites per collection.

---

## 6. Module: Store

### 6.1 Concepts
- **Price Sheet** = a catalogue of products. Price sheets are assigned to collections to determine what's for sale there. Multiple price sheets; a default.
- **Product types:**
  1. **Print products** — physical (prints, mounted prints, wall art, albums, cards), **lab-fulfilled** (automatic).
  2. **Digital downloads** — always platform-fulfilled; delivered by email/link at chosen resolution.
  3. **Packages** — bundle print + digital for a single price.
  4. **Self-fulfilled items** — studio fulfils manually with their own lab/shipping.
- Products grouped into **categories**; reorderable. Show/hide individual products.
- **Pricing:** per-product/per-option pricing with studio markup; optional "recommended pricing" seed.

### 6.2 Fulfilment
- **Automatic fulfilment:** route print orders to a **print-lab partner**. *Real lab APIs are out of scope for v1* — build a **`FulfilmentProvider` interface** with a `ManualLabProvider` (emails the studio a print order) so the architecture supports plugging in a real lab (e.g. iPrintfromHome-style) later. Lab cost-of-goods deducted from client payment; remainder paid to studio (model the ledger even if the lab is manual).
- **Self-fulfilment:** studio sets own products, pricing, shipping methods; manages fulfilment outside the platform.
- Digital downloads always auto-delivered.

### 6.3 Cart, checkout, pricing
- In-gallery **cart**; product **room/wall preview** (overlay client's photo on product mockups) — nice-to-have, defer if needed.
- Checkout via **Stripe** (card, wallets). **Offline payment** tracking option.
- **Commission:** platform takes 15% on free tier (via Stripe Connect `application_fee_amount`), 0% on paid tiers.
- **Taxes:** configurable tax rates; automated sales-tax later. **Shipping:** methods + rates; pickup option.

### 6.4 Promotions
- **Coupons:** % off, fixed-amount off, free giveaway, free shipping; coupon **banner** in gallery.
- **Gift cards / print credits** (implemented as a self-fulfilment product + credit ledger).

### 6.5 Orders
- Order management dashboard; statuses; **order delay/review window** before fulfilment; **refunds**; boutique/white-label packaging note; per-order ledger (client paid, COGS, studio payout, platform fee).

---

## 7. Module: Studio Manager (CRM)

- **Contacts / leads:** people directory; lead capture **forms** embeddable on the Website.
- **Projects:** visual **kanban board** by stage; attach contacts, documents, sessions. Airtable-style custom fields + Grid/Kanban/Calendar views — **specced separately in [SPEC_PROJECTS.md](SPEC_PROJECTS.md)**.
- **Invoices:** line items; **payment schedules / instalments**; **deposit/retainer**; discount; tax; **tips**; due dates; **templates**; online payment (Stripe) + **offline payment** tracking; **payment links**; auto **payment reminders**.
- **Contracts:** branded; **e-signature** on any device; expiry; reminders; templates.
- **Questionnaires & quotes:** custom form builder; quotes clients can accept.
- **Booking & scheduling:** public **booking site** with **session types**, availability/spots, **Google Calendar sync**, video-call links (Zoom/Google Meet); **intake during booking** (contract + invoice/retainer + questionnaire); **booking coupons**; manual-approve option; booking **reminders**.
- **Email:** send/receive client emails; email templates.
- **Reporting:** revenue, bookings, outstanding payments.

> Studio Manager is large. In v1 prioritise **Contacts → Invoices (Stripe) → Contracts/e-sign → Booking**. Questionnaires/quotes/projects/reporting follow.

---

## 8. Module: Website builder

- **Templates:** business, portfolio, one-page categories; multiple designs; **custom fonts**.
- **Flex editor:** drag-and-drop blocks; full layout library; desktop/tablet/mobile previews; **landing-page** templates; shareable blocks; **anchor links**.
- **Blog / CMS:** posts, galleries, portfolios; **import images from galleries**.
- **SEO Manager:** meta/descriptions, **301/302 redirects**, sitemap, **AI-generated alt text**, auto image optimisation guidance.
- **Domains & hosting:** custom domain, **auto SSL**, unlimited bandwidth, responsive.
- **Analytics:** Google Analytics + Meta Pixel on upgraded tiers.
- **Bio-link page** (link-in-bio).

> Website is effectively a second product. Treat as a later phase; in v1 a minimal template-based site + blog is enough.

---

## 9. Out of scope for v1 (note, don't build)
- **Photo Editor / AI culling** (duplicate grouping, closed-eye/blur detection, AI styles, generative removal, masking). Big, separate, ML-heavy. Leave clean seams but do not build.
- Real print-lab API integrations (use the `FulfilmentProvider` abstraction + manual provider).
- Native mobile apps (ship the gallery as a **PWA**).
- Multi-brand, team roles, advanced reporting, email-campaign automation.

---

## 10. Phased roadmap (build order)

**Phase 0 — Scaffold & foundations**
Laravel 13 app + starter kit (**Inertia + React + TS**), Tailwind + shadcn components, PostgreSQL + base migrations, auth (**Fortify** + **Socialite** Google), **Wasabi filesystem disk** + presigned-upload helper, **Redis + queue + Horizon**, **Cashier + Stripe Connect** config + verified webhook route (test mode), `.env.example` + secrets discipline, **Pest + Pint** + CI, **Telescope/Pulse**, `CLAUDE.md`, authenticated dashboard shell. Multi-tenant `Studio` model + **global `studio_id` scope** (trait + middleware resolving the current studio); single-database tenancy.

**Phase 1 — Client Gallery vertical slice (the proof of life)**
Create collection → bulk upload direct to Wasabi → worker generates derivatives + watermark → published gallery view (signed URLs) → end-client favourites + notes → favourite activity for studio → controlled downloads (resolution + limits + PIN). Collection privacy (password/email-gate), cover styling, sets.

**Phase 2 — Store**
Price sheets, product types (start: digital downloads + self-fulfilled + manual-lab print products), cart, Stripe Connect checkout with commission, digital delivery, coupons, orders dashboard, refunds, basic tax/shipping.

**Phase 3 — Studio Manager core**
Contacts, invoices (Stripe + payment schedules + reminders), contracts + e-sign, booking site (session types, availability, Google Calendar sync, intake docs).

**Phase 4 — Website builder (minimal)**
Template + flex blocks + blog + SEO basics + custom domain.

**Phase 5+ — Polish & defer list**
Email campaigns, analytics, gift cards, packages, multi-brand, reporting, RAW proofing, lab API, PWA gallery app.

---

## 11. Core data model (starting point — Claude Code to refine as Eloquent migrations + models)

- `Studio` (tenant): branding, currency, customDomain, stripeConnectAccountId, plan, commissionRate, storageUsed.
- `User` (studio-side): studioId, email, passwordHash, role.
- `Collection`: studioId, title, eventDate, coverPhotoId, coverStyle(json), privacy(json: passwordHash?, emailGate?), downloadSettings(json), favouriteSettings(json), priceSheetId?, expiresAt?, status, contactId?.
- `Set`: collectionId, name, position.
- `Photo`: collectionId, setId, studioId, filename, wasabiKeyOriginal, keys(json: thumb/web/preview/print), width/height, exifTakenAt, status(processing/ready), position.
- `Video`: collectionId, setId, wasabiKey, thumbnailKey, status.
- `GalleryVisitor`: collectionId, email?, name? (lightweight identity).
- `FavouriteList`: collectionId, visitorId, name, selectionLimit?.
- `Favourite`: listId, photoId, note?.
- `PriceSheet`: studioId, name, isDefault, fulfilment(auto/self).
- `ProductCategory`, `Product` (type: print/digital/package/self), `ProductOption` (size/finish, price, cogs?).
- `Order`: studioId, collectionId?, visitorId, status, currency, subtotal, tax, shipping, total, platformFee, stripePaymentIntentId.
- `OrderItem`: orderId, productId, optionId, photoId?, qty, unitPrice, cogs.
- `Coupon`, `GiftCard`/`CreditLedger`.
- `Contact` (CRM), `Project` + `ProjectStatus` + `ProjectType` + `ProjectFieldDefinition` (see [SPEC_PROJECTS.md](SPEC_PROJECTS.md)), `Invoice` + `InvoiceItem` + `PaymentSchedule`, `Contract` + `Signature`, `Questionnaire`/`Quote`, `Session`/`Booking`, `SessionType`, `AvailabilitySlot`.
- `WebsiteSite`, `WebsitePage`, `WebsiteBlock`, `BlogPost`, `Redirect`.

---

## 12. Non-functional requirements
- **Security:** tenant isolation everywhere; signed URLs; password/PIN hashing; webhook signature verification; no secrets in repo; rate-limit upload/auth.
- **Performance:** serve derivatives via CDN; lazy-load galleries; paginate/virtualise large galleries (weddings = thousands of images); never process images in request path.
- **Cost control:** Wasabi egress discipline (derivatives + CDN cache); lifecycle rules; track per-studio storage for plan limits.
- **Reliability:** idempotent jobs & webhooks; retries with backoff; processing-state UI.
- **Testing:** unit tests for pricing/commission/ledger math and tenant scoping; integration tests for upload→process→deliver and Stripe webhook flows.
- **Observability:** structured logs, job dashboards, error tracking.
