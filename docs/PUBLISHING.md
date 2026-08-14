# Publishing to the Figma Community

This guide covers getting your plugin listed in the Figma Community after you've
built it locally.

## 1. Create a Figma developer account

1. Go to <https://www.figma.com/developers>
2. Sign in with your Figma account (or create one).
3. Open your account settings and go to the **Developer** tab.
4. Your **Publisher ID** is shown there (it looks like a long number, e.g.
   `123456789012345678`).

## 2. Set your Publisher ID

Open [`manifest.json`](../manifest.json) in the repo root and replace the
placeholder:

```json
"publisherId": "REPLACE_WITH_YOUR_FIGMA_PUBLISHER_ID",
```

with your actual Publisher ID.

> If you do not plan to publish to the Figma Community, you can keep the
> placeholder or remove the `publisherId` field entirely — it is only required
> when publishing a public plugin listing.

## 3. Prepare your icon and screenshots

The Figma Community listing requires:

- **Icon**: a square PNG, at least 128×128 px. This repo ships ready-made icons in
  [`assets/`](../assets):
  - `icon_round_128.png` (128×128, recommended for the manifest `icon` field)
  - `icon_768.png` (768×768, good for the Community listing)
- **Screenshots / preview**: 1–3 images or a GIF demonstrating the plugin. Reuse
  the existing `assets/` previews (`examples.png`, `workflow.png`, `lossy_gif.gif`)
  or generate new ones.

## 4. Review the Figma plugin review guidelines

Before submitting, read and comply with:

- [Figma Plugin Review Guidelines](https://help.figma.com/hc/en-us/articles/360042034994)
- The Community **Content Guidelines** shown in the publishing dialog.

This plugin is designed to be compliant out of the box:

| Guideline concern          | Status                                                          |
| -------------------------- | --------------------------------------------------------------- |
| Data privacy (local-only)  | All processing happens locally; nothing leaves the machine      |
| Network access             | `"allowedDomains": ["none"]` in the manifest                    |
| Offline operation          | Fully offline, no API keys or accounts required                 |
| Respecting user selections | Only reads the user's current selection                         |
| Attribution                | Original author and license preserved (see [NOTICE](../NOTICE)) |

## 5. Build before submitting

The manifest points at built output (`apps/plugin/dist/`). Make sure it exists:

```sh
pnpm install
pnpm build
```

## 6. Submit the plugin

1. In the Figma desktop app, open **Plugins → Development → Import plugin from
   manifest** and select `manifest.json` from the repo root.
2. Run the plugin once to make sure it works.
3. Go to **Plugins → Development → Your plugin → Publish to Figma Community**.
4. Fill in the listing details:
   - **Name**: Figma to Code
   - **Description**: what it does and supported frameworks
   - **Icon & screenshots**: from `assets/`
   - **Pricing**: Free
5. Submit. Figma will review the listing and notify you of the outcome.

## 7. Keep it up to date

When you make changes and want to push a new version:

1. Bump the plugin version (in `apps/plugin/package.json` and the manifest if it
   tracks a version).
2. Rebuild with `pnpm build`.
3. Re-run the **Publish to Figma Community** flow to submit an update.
