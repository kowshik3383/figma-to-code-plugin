# Visual-first generation

On the `feat/design-compiler` branch, enable **Design Compiler (beta)** in the plugin's code preferences to use this engine with HTML, React JSX, or Tailwind.

## Before and after

| Stage                | Before                                                                                            | After                                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Traversal            | Live layers became an IR in Figma's tree order. Freeform output used local x/y positions.         | The IR records absolute bounds, sibling paint order, clip state, active paints, sizing and text metrics. It prunes empty and provably redundant layers before inference.                                                                                                 |
| Hierarchy and layout | Native Auto Layout drove flex and grid. Freeform children were generally positioned individually. | Recover contained overlays in paint order, promote equivalent solid backgrounds, infer aligned flex rows or columns and regular grids, then fall back to relative containers with positioned children.                                                                   |
| Rendering            | Target generators consumed the same IR, with basic font and shape mapping.                        | The same generators lower inferred layout, text metrics, clipping, overflow, overlapping paint order, and supported CSS effects. The Warnings panel and project diagnostics identify layers requiring review.                                                            |
| Assets               | A manifest exported live Figma layers as PNG or SVG.                                              | Keep deterministic native assets and raw-image fallback for failed previews. A vector-only group named `@icon Name` can export as a single SVG. Verified opaque, uniform PNG dividers can become CSS in the preview and project. Meaningful `@alt` assets remain images. |

## Validate against an exported frame

Install Pillow in a Python environment and ensure Chromium or Chrome is available. In Figma, export the reference frame as a PNG at **1×**. Download and unpack the static **HTML** project from the same selection. Install the design's fonts on the screenshot machine and use matching background and viewport assumptions.

```sh
python3 apps/plugin/scripts/visual-diff.py \
  --reference figma-frame.png \
  --html generated-project/index.html \
  --tolerance 8 \
  --max-mismatch 1 \
  --diff difference.png
```

The tool reports the percentage of pixels whose largest RGB channel difference exceeds the tolerance after compositing on white. Different image dimensions are an error. The optional PNG highlights changed pixels in red. Supply `--actual browser.png` in place of `--html` to compare an existing screenshot, or set `--browser /path/to/chromium` to choose the capture browser.

```sh
pnpm test
pnpm build
node apps/plugin/scripts/smoke.cjs
node apps/plugin/scripts/visual-fixture.cjs
node apps/plugin/scripts/visual-fixture.cjs --browser
```

The visual fixture uses an independently drawn synthetic reference for an unordered freeform frame, redundant background, and misplaced overlay. The default fixture checks compilation and comparator accuracy. The browser flag additionally checks Chromium output against the golden at zero tolerance.

## Limits and next steps

- Containment is conservative. Z-order barriers, transforms, masked groups, and painted geometry that cannot safely become a container keep their existing relationships. Re-parenting across separate branches of the layer tree requires evidence that clipping and blending survive the move.
- Flexible layout is inferred only from regular geometry. Irregular gaps, deliberate overlaps, complex grid spans, and transformed freeform layers may keep positioned output. Figma spacing may differ slightly within the 2 px grouping tolerance. A second reference viewport is needed to infer breakpoint behavior reliably.
- Overflow extending left or above the apparent frame is flagged. Moving the origin automatically could shift adjacent content. Visual clipping is explicit; general alpha, vector, and luminance masks still need compositing support. Unsupported blends, layered paints, and effects are flagged.
- Font availability, mixed styled text runs, variable bindings, text truncation, gradients, and exact effect rasterization can affect pixel parity. PNG remains the raster default. SVG minification and WebP encoding can follow once visual baselines show the acceptable impact.
- Collect real 1× Figma PNGs for clipped dashboards, composited masks, and variant-heavy component libraries. Use them as browser baselines before making this engine the default.
