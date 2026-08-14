# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-08-14

### Added

- Modernized monorepo structure with Turborepo and pnpm workspaces.
- Support for generating code in multiple frameworks and styles:
  - HTML & CSS
  - Tailwind CSS
  - React (JSX / TSX)
  - Tailwind (JSX)
  - Svelte
  - Styled Components
- Dev Mode & Codegen capabilities in Figma (`inspect`, `codegen`, `vscode`).
- Interactive UI redesigned with modern React 19, Tailwind CSS v4, Base UI, and Lucide icons.
- Zip export for generated code files and extracted assets.
- Debug helper tool in About tab to inspect and export raw Figma layer selection JSON.
- Comprehensive test suite powered by Vitest for node hierarchy translation, Tailwind class generation, and CSS layout parsing.
- Fast linting and formatting tooling using `oxlint` and `oxfmt`.
- GitHub Actions CI workflow for automated linting, formatting, testing, and building.
- Community publishing documentation and Figma review checklist.

### Security & Privacy

- Enforced zero-network-access policy (`"allowedDomains": ["none"]`).
- 100% local client-side processing — no analytics, tracking, or external server calls.

### Changed

- Refactored backend AST translation and CSS layout conversion algorithms for improved flexbox/grid fidelity.
- Updated all core dependencies to modern versions.

---
