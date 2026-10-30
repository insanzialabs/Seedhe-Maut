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
- The selected CD plays its supplied recording with a 650 ms equal-power crossfade. Music continues into the same song’s detail page and follows the next chapter when navigation commits. Fast scrolling is debounced so skipped discs do not accumulate players.
- Sound attempts to start automatically after the document, fonts and CD entrance finish loading. Browsers that block audible autoplay still require an interaction or **Enable sound**. The small sound button mutes/unmutes playback and remembers a manual mute for the session. Music pauses while the tab is hidden or the YouTube overlay is open, and resumes when appropriate.
- The native YouTube player overlay supports play/pause, volume, seeking, fullscreen, Escape to close and keyboard controls. A direct YouTube link remains available if embedding is blocked.
- Covers, fonts, recordings, video stills and rendering modules are local. The optional YouTube video overlay and external Spotify links require internet access.
- Reduced-motion handling comes from the reference runtime. A readable song index is available if WebGL fails, and plain song pages remain usable without JavaScript.

## Edit

- `src/tracks.json`: song metadata, order, covers, verified media URLs and editorial captions.
- `src/templates/`: shared shell, gallery and detail-page markup.
- `public/adaptation.css` / `public/app.js`: music-specific styling, accessibility and failure recovery.
- `public/soundtrack.js`: streamed Web Audio mixer and renderer/navigation integration. It uses at most three media voices (two mixing, one loading), never decodes the entire catalog into memory, and crossfades the ends of supplied cuts when looping.
- `public/music/`: deployable 160 kbps MP3 versions of the supplied recordings, loudness-matched to a −18 LUFS target. `python3 scripts/prepare-music.py` regenerates these locally with FFmpeg; it preserves `assets/music/` originals. Commit the prepared files so Vercel needs no FFmpeg installation.
- `public/vendor/`: reference rendering/navigation runtime and bundled dependencies. See [ATTRIBUTION.md](ATTRIBUTION.md).
- `scripts/build.mjs`: generates twelve pages from the templates and song data.

The original `manifest.json`, SVG `frames/`, supplied `assets/`, and `preview.html` are preserved. The new working experience starts at the local server, not at the old SVG preview.

## Verification

```sh
npm run check
npm test
```

Checks cover generated routes, local asset and module references, JavaScript syntax, chapter order, native player triggers and next-song links. Media identifiers were checked against the official YouTube and Spotify oEmbed endpoints; evidence is in `docs/media-verification.json`.

Reference analysis used the supplied 37.94-second recording and public source files. The original recreation’s full matched-reference visual QA remains pending; see [design-qa.md](design-qa.md). Audio-enhancement verification is recorded separately in [docs/audio-qa.md](docs/audio-qa.md). Reusing the source runtime preserves its settings but does not establish that this adaptation has passed complete visual QA.

Stream counts are the supplied October 28, 2026 snapshot, not live measurements. Editorial captions are written for this archive and are not song lyrics or attributed reviews.
