# figma-to-code-plugin

A Figma plugin that generates production-ready code from your designs — HTML, Tailwind, React (JSX), Svelte, and Styled Components.

## Features

- Convert Figma frames/layers to clean, typed code
- Multiple output formats: HTML, Tailwind, React, Svelte, Styled Components
- Zip export of generated assets
- Works in the Figma and FigJam dev modes

## Getting started

### Prerequisites

- Node.js 24.x
- pnpm 11.x

### Install

```bash
pnpm install
```

### Build

```bash
pnpm build
```

### Develop (watch mode)

```bash
pnpm dev
```

### Test

```bash
pnpm test
```

## Project structure

```
├── apps/
│   └── plugin/          # Figma plugin app (UI + plugin main script)
├── packages/
│   ├── backend/         # Code generation engine (HTML/Tailwind/etc.)
│   ├── plugin-ui/       # React UI components for the plugin
│   ├── types/           # Shared TypeScript types
│   └── tsconfig/        # Shared TypeScript configs
```

## Loading the plugin in Figma

1. Run `pnpm build`
2. In Figma, go to **Plugins → Development → Import plugin from manifest**
3. Select `manifest.json` from the repo root

## License

See [LICENSE](./LICENSE).
