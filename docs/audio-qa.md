# CD soundtrack verification — October 31, 2026

## Implemented

- Ten supplied cuts mapped explicitly to their corresponding song slugs; two WAV inputs converted to MP3 alongside the eight MP3 inputs. Originals remain untouched.
- Local 160 kbps stereo playback copies, loudness-matched to a −18 LUFS target with −2 dBTP ceiling. Approximately 69 MB of source files becomes 31 MB of playback media.
- Selected-disc playback follows the renderer's real `discgallerychange` events, with 110 ms selection settling and 650 ms equal-power fades scheduled on the Web Audio clock.
- Same-song detail navigation preserves playback position. New song pages select their own recording through the existing navigation lifecycle.
- Three-voice resource bound; old/stale loads are aborted and disconnected. Only selected recordings load. No whole-catalog decoded-audio cache.
- Crossfaded repeats for the supplied cuts, persistent session mute, autoplay recovery button, failed/stalled-request recovery, and composed video/visibility interruption handling.
- Native MP3 MIME and HTTP byte-range delivery in the local server. Vercel serves the prepared files from the existing static output.

## Non-browser checks completed

- `npm run check`: twelve pages, local asset/module integrity, JavaScript syntax.
- `npm test`: ten passing tests, including six audio-focused tests with simulated media/context dependencies. They exercise constant-power mixing, interrupted ramps, stale asynchronous loads, rapid navigation bounds, same-song position retention, mute, stacked blockers, autoplay rejection, failed media, looping and teardown.
- Every prepared MP3 fully decoded through FFmpeg without reported errors.
- All ten media routes returned `audio/mpeg`, successful HEAD responses and correct 206 bounded-byte-range responses. A suffix range returned 206; an unsatisfiable range returned 416. Evidence: `audio-http-verification.json`.

## Limited browser observation before the user's stop instruction

The in-app browser host was unavailable. A separate native Chrome window was used briefly, before the user requested no further browser use:

- The actual local gallery loaded.
- An arrow-key interaction selected Pankh; the app exposed its active sound state and Chrome marked the tab as Audio playing.
- Rapid arrow navigation reached Nanchaku with the sound state following the selected disc.
- The mute button changed to its disabled-sound state.
- The sound control was visually observed in the rendered gallery.

No browser actions were performed after the user's instruction to continue without it. No browser console audit, mobile/Safari test, complete detail/video integration test, subjective listening evaluation or final-browser check of subsequent refinements is claimed. Automated state-machine tests and successful HTTP delivery do not establish subjective crossfade quality or cross-device audio compatibility.

Full original-reference visual comparison remains a separate pending check in `design-qa.md`.
