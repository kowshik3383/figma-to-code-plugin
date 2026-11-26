# Standalone HTML export

Select a frame and use **Output format** in the plugin.

| Format                    | Download                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Single HTML file          | A browser-ready document containing one stylesheet and embedded images by default                         |
| Separate HTML + CSS files | A ZIP containing `index.html`, `styles.css`, and an `assets/` folder when the design uses exported assets |
| Framework options         | The existing options for React, Tailwind, and other supported targets                                     |

For a smaller single-file download, choose **Reference files (assets/)**. Download the HTML and extract the separate assets ZIP beside it. The preview and **Open in new tab** use embedded assets so you can inspect the result before downloading.

The emitter uses the visual compiler's flex, grid, stacking, and fallback positioning. It generates named CSS classes and reuses one class when multiple layers have the same declarations. Design tokens and the reset live in the document stylesheet. See the [feature-card fixture output](examples/feature-card.html).

## Limitations and next steps

- The default output works offline. **Load supported Google Fonts online** optionally adds a stylesheet for recognized families. Other fonts use the available font stack. The optional online loader currently requests the default weight.
- SVG is embedded as image data so its contents stay in an image context. A future sanitized inline-SVG path could make vector paths directly editable in the HTML.
- The plugin warns when embedded HTML exceeds 2 MB. Asset limits and export failures can omit individual assets and produce warnings. Referencing assets is the better option for large selections.
- The visual compiler still reports ambiguous overlaps, mixed paints, and unsupported masks. Compare against a real frame in Figma Desktop before relying on pixel parity. Browser popup behavior inside the Figma host still needs a desktop check.
