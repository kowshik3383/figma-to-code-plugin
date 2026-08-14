# Contributing to Figma to Code

Thank you for your interest in contributing to **Figma to Code**! We welcome bug fixes, improvements, new framework codegen targets, and documentation updates.

Please take a moment to review this document before submitting your contribution.

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all contributors and users with respect and kindness.

---

## Development Setup

### Prerequisites

- **Node.js**: `24.x` (see [.node-version](.node-version))
- **pnpm**: `11.x` (`corepack enable` or `npm install -g pnpm@11`)
- **Figma Desktop App** (for testing the plugin in a live Figma environment)

### Installation

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/<your-username>/figma-to-code-plugin.git
   cd figma-to-code-plugin
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Build the project:

   ```bash
   pnpm build
   ```

4. Start development mode with hot rebuilding:

   ```bash
   pnpm dev
   ```

---

## Testing in Figma

1. Open the **Figma Desktop App**.
2. Open any design document or draft.
3. In the menu, navigate to:
   **Plugins → Development → Import plugin from manifest...**
4. Select the `manifest.json` file located in the root of this repository.
5. Run the plugin via **Plugins → Development → Figma to Code [HTML, Tailwind, React]**.
6. When you make code changes with `pnpm dev` running, close and re-open the plugin in Figma or right-click and select **Re-run plugin** to test your updates.

---

## Project Structure

This monorepo is managed using [Turborepo](https://turbo.build/) and [pnpm workspaces](https://pnpm.io/workspaces):

```
figma-to-code-plugin/
├── apps/
│   └── plugin/             # Figma plugin runtime (plugin-src/code.ts + Vite webview UI)
├── packages/
│   ├── backend/            # Core codegen engine (HTML, Tailwind, React, Svelte, Styled Components)
│   ├── plugin-ui/          # Reusable React UI components, settings, and views
│   ├── types/              # Shared TypeScript definitions & schemas
│   └── tsconfig/           # Shared tsconfig bases
├── assets/                 # Icons, screenshots, demo media
├── docs/                   # Extended guides (e.g. PUBLISHING.md)
├── manifest.json           # Figma plugin manifest
└── turbo.json              # Turborepo task pipeline
```

---

## Code Quality & Standards

Before opening a pull request, ensure all linters, formatting checks, and tests pass.

### Formatting (`oxfmt`)

```bash
# Check formatting
pnpm format:check

# Auto-format all files
pnpm format
```

### Linting (`oxlint`)

```bash
pnpm lint
```

### Testing (`vitest`)

```bash
# Run unit tests
pnpm test
```

### Building

```bash
# Verify complete build across all workspace packages
pnpm build
```

---

## Pull Request Guidelines

1. **Branch Naming**: Use descriptive branch names:
   - `fix/issue-description`
   - `feat/feature-name`
   - `docs/update-readme`
2. **Atomic Commits**: Write clear, descriptive commit messages.
3. **Keep It Focused**: One feature or bug fix per pull request is preferred.
4. **Pass CI**: Ensure `pnpm format:check`, `pnpm lint`, `pnpm test`, and `pnpm build` pass locally before pushing.
5. **Fill out the PR Template**: Describe the changes, motivation, and include testing screenshots if you modified the UI.

---

## Licensing Note

All contributions to this repository will be licensed under the [GNU General Public License v3.0 or later (GPL-3.0-or-later)](LICENSE). By submitting a pull request, you agree that your contributions are made under this license.
