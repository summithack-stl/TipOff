# App icons

Source of truth: [`app/src/app/icon.svg`](../../src/app/icon.svg) — the TipOff radar mark,
`--hot` (`#ff5a1f`) on the app's dark plate, with the outer rings blended toward the plate
so they stay opaque (a transparent ring would let a phone's wallpaper through).

`icon-192.png`, `icon-512.png` and `icon-maskable-512.png` are referenced by
[`app/src/app/manifest.ts`](../../src/app/manifest.ts). `src/app/apple-icon.png`,
`src/app/favicon.ico` and `src/app/icon.svg` are picked up by Next's file conventions.

The maskable icon pads the mark to ~47% of the plate so launchers can crop it to a circle
without clipping. Regenerate all five from the SVG after changing it.
