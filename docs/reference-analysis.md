# Reference evidence and implementation decisions

Source recording: `/Users/ankitmishra/Desktop/Screen Recording 2026-10-29 at 5.03.17 PM.mov` (the actual filename uses a narrow nonbreaking space before PM).

- Duration: 37.938 seconds.
- Original pixels: 4096 × 2326; reported nominal capture rate: 240 fps.
- Eighteen temporal samples were inspected at 1–37 seconds. Six representative frames are retained in `docs/reference/`, normalized to 1600 × 909.
- No browser was used during this implementation after the user requested recording-based analysis.

| Recording | Observed state | Retained behavior |
|---|---|---|
| 1–5 s | Blank stage, rolling count orbiting a rising/turning disc, then a fan of neighboring discs | Original preloader choreography; S10 and 2017–2026 replace the film identity |
| 8–15 s | Diagonal gallery, oversized neighboring discs, masked metadata replacements, oscillating sketch outlines | Original WebGL renderer, camera and input physics |
| 15–19 s | Disc retreats into depth and metadata becomes a centered detail heading | Original gallery-to-production transition with music content |
| 19–21 s | Irregular dissolving lower edge reveals a full-width image and scattered typography | Original dissolve mask and quote-layout algorithms; official release still and editorial caption |
| 23–37 s | Scroll-pushed disc and split next title resolve into the next detail page | Original scrolling next-disc renderer and transition |

The existing SVGs are content/storyboard references. They are not the disc renderer and are not used as flattened page screenshots.

Exact source settings retained include the −30° X/Y gallery orientation, 40° camera field of view, 4.4 camera distance, 0.46-second base snap, 0.4-second masked text exit, 0.7-second reveal, and 10 fps sketch-outline updates. Source-specific spring, wheel-intent, drag momentum, touch fitting, adaptive resolution, reflection/iridescence and visibility-idling behavior are retained as well.

The recording supplies desktop evidence only. Responsive styles and touch behavior are retained from the source, but their rendered result in this adaptation is unverified. Neither source-code correspondence nor static-file checks are treated as visual or interaction verification.
