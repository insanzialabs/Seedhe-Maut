# Seedhe Maut — Ten Chapters

A local adaptation of [Ravi Klaassens’ A24 experience](https://a24.raviklaassens.com/), with the supplied 2017–2026 Seedhe Maut selection. The reference’s actual disc renderer, gesture physics, typography, layouts and page-transition runtime are retained locally, with music-specific content and branding.

## Run

Requires Node.js 20 or later. No dependency installation is necessary.

```sh
npm run dev
```

Open **http://127.0.0.1:4173**. `npm run build` produces a standalone static website in `dist/`; `npm start` serves that build. Static hosting must serve directory `index.html` files for `/archive` and `/songs/<slug>`.

## Vercel

The committed `vercel.json` selects the static framework, runs `npm run build` and publishes `dist/`. The `public/` directory contains assets only; publishing it instead of the generated output causes a platform 404 at `/`.

Import this repository with its root as the Vercel Root Directory (the folder containing `package.json` and `vercel.json`). Redeploy after pushing configuration changes. Do not set the output to `public` or run the local Node server as a serverless function.

Production domain: **https://seedhe-maut.insanzialabs.com**. Add that hostname under the Vercel project's Domains settings, and apply the DNS record Vercel supplies. This local configuration does not create a domain assignment or change DNS.

## Experience

- **Journey:** chronological disc gallery, 2017 → 2026.
- **Archive:** reverse chronological gallery with the reference’s gallery-switch transition.
- Wheel/trackpad, drag, touch swipe, arrow keys, Home and End browse the collection. Enter opens the active song; Space flips its physical disc.
- Index navigates directly to any song in the gallery.
- Every song has a detail page with the source’s text reveals, dissolving edge, parallax, playback overlay and scrolling next-disc transition.
- The native YouTube player overlay supports play/pause, volume, seeking, fullscreen, Escape to close and keyboard controls. A direct YouTube link remains available if embedding is blocked.
- Covers, fonts, video stills and rendering modules are local. Playback and external Spotify links require internet access.
- Reduced-motion handling comes from the reference runtime. A readable song index is available if WebGL fails, and plain song pages remain usable without JavaScript.

## Edit

- `src/tracks.json`: song metadata, order, covers, verified media URLs and editorial captions.
- `src/templates/`: shared shell, gallery and detail-page markup.
- `public/adaptation.css` / `public/app.js`: music-specific styling, accessibility and failure recovery.
- `public/vendor/`: reference rendering/navigation runtime and bundled dependencies. See [ATTRIBUTION.md](ATTRIBUTION.md).
- `scripts/build.mjs`: generates twelve pages from the templates and song data.

The original `manifest.json`, SVG `frames/`, supplied `assets/`, and `preview.html` are preserved. The new working experience starts at the local server, not at the old SVG preview.

## Verification

```sh
npm run check
npm test
```

Checks cover generated routes, local asset and module references, JavaScript syntax, chapter order, native player triggers and next-song links. Media identifiers were checked against the official YouTube and Spotify oEmbed endpoints; evidence is in `docs/media-verification.json`.

Reference analysis used the supplied 37.94-second recording and public source files. **Browser rendering, live interaction, mobile and motion-comparison QA were not performed, per the instruction to avoid browser use.** Those checks remain pending; see [design-qa.md](design-qa.md). Reusing the source runtime preserves its settings but does not establish that this adaptation has passed visual QA.

Stream counts are the supplied October 28, 2026 snapshot, not live measurements. Editorial captions are written for this archive and are not song lyrics or attributed reviews.
