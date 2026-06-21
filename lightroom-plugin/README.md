# Wedding App — Lightroom Classic plugin

A Publish Service for Adobe Lightroom Classic that uploads galleries straight
from Lightroom to the Wedding App, the same way Pixieset's plugin works.

## What it does

- Adds a **Wedding App** publish service to Lightroom's Publish panel.
- Sign in once with your Wedding App email + password.
- Create a gallery (publish collection) in Lightroom, drag photos in, hit
  **Publish**. Each photo is rendered to a web JPEG and uploaded directly to
  Wasabi via a presigned URL, then registered with the app (which queues
  thumbnails / web sizes / watermarks).
- Removing a photo from the published collection deletes it from the gallery.
- Editing a published photo marks it for re-publishing.

## How it talks to the app

The plugin only uses the JSON API — no direct DB or storage access:

| Step            | Endpoint                              |
| --------------- | ------------------------------------- |
| Sign in         | `POST /api/lightroom/login`           |
| Validate token  | `GET  /api/lightroom/account`         |
| List galleries  | `GET  /api/lightroom/collections`     |
| Create gallery  | `POST /api/lightroom/collections`     |
| Presigned URL   | `POST /api/uploads/presign`           |
| Upload original | `PUT` (directly to Wasabi)            |
| Register photo  | `POST /api/photos`                    |
| Delete photo    | `DELETE /api/photos/{id}`             |

Auth is a Laravel Sanctum personal access token returned by the login call and
sent as `Authorization: Bearer <token>` on every request.

## Install (for the photographer)

1. Copy the `WeddingApp.lrplugin` folder somewhere permanent (e.g. your
   Documents folder).
2. Lightroom Classic → **File → Plug-in Manager… → Add** → select
   `WeddingApp.lrplugin`.
3. In the **Publish Services** panel (left side of the Library module) click
   **Set Up…** next to *Wedding App*.
4. Confirm the **Server** URL, enter your **Email** and **Password**, click
   **Sign in**, then **Save**.
5. Create galleries and publish (see mapping below), then click **Publish**.

## Galleries and sets

The plugin mirrors your Lightroom structure into the app:

| In Lightroom                                   | In the app            |
| ---------------------------------------------- | --------------------- |
| Published **Collection Set** (e.g. "Smith Wedding") | a **gallery**    |
| Published **Collection** inside that set (e.g. "Ceremony", "Reception") | a **set** in that gallery |
| A plain top-level Published **Collection**     | a simple gallery (single default set) |

So to build a gallery with multiple sets entirely from Lightroom:
*Wedding App → Create Published Collection Set* ("Smith Wedding") → inside it
*Create Published Collection* for each set ("Ceremony", "Reception"…), drag the
right photos into each, and **Publish**. The gallery, its sets and the photos
are all created on the server.

> The **Server** field defaults to `https://wedding-app.jackonthe.net`. Point it
> at a local/staging URL for testing.

## Files

- `Info.lua` — plugin manifest.
- `WeddingAppPublishServiceProvider.lua` — publish service: login dialog,
  upload pipeline, delete handling.
- `WeddingAppAPI.lua` — HTTP client for the endpoints above.
- `JSON.lua` — dependency-free JSON encode/decode (the SDK ships none).

## Notes / limitations (v1)

- Uploads send a web-sized **sRGB JPEG** (the gallery generates its own
  derivatives). RAW/originals are not pushed.
- The presigned `PUT` replays exactly the headers the app signed; if Wasabi
  rejects an upload, check `PresignedUploadController` and the signed headers.
- No automatic gallery publish/share — galleries are created as **draft**;
  publish them from the web app when ready.
