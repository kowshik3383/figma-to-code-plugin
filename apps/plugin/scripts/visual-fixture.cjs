// Exercise the compiled visual inference against an independently drawn golden.
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { buildSync } = require("esbuild");

const root = path.resolve(__dirname, "../../..");
const output = mkdtempSync(path.join(tmpdir(), "figma-fixture-"));
const reference = path.join(output, "reference.png");
const altered = path.join(output, "altered.png");
const html = path.join(output, "design.html");
const compiler = path.join(root, "packages/backend/src/compiler");
const python = process.env.PYTHON || "python3";
const compare = (args) =>
  spawnSync(
    python,
    [path.join(__dirname, "visual-diff.py"), "--reference", reference, ...args],
    { encoding: "utf8" },
  );

try {
  const bundle = path.join(output, "compiler.cjs");
  buildSync({
    stdin: {
      contents:
        'export { normalizeSelection } from "./normalize"; export { webGenerator } from "./web";',
      resolveDir: compiler,
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: bundle,
  });
  const { normalizeSelection, webGenerator } = require(bundle);
  const rect = (id, x, y, width, height, color) => ({
    id,
    name: id,
    x,
    y,
    width,
    height,
    type: "RECTANGLE",
    visible: true,
    fills: [{ type: "SOLID", color }],
  });
  const white = { r: 1, g: 1, b: 1 };
  const layer = {
    ...rect("design", 0, 0, 640, 300, white),
    type: "FRAME",
    layoutMode: "NONE",
    fills: [],
    children: [
      rect("page-backdrop", 0, 0, 640, 300, white),
      rect("tile right", 240, 24, 180, 96, {
        r: 17 / 255,
        g: 24 / 255,
        b: 39 / 255,
      }),
      rect("tile left", 24, 24, 180, 96, {
        r: 37 / 255,
        g: 99 / 255,
        b: 235 / 255,
      }),
      rect("overlay sibling", 44, 50, 70, 18, white),
    ],
  };
  const { document } = normalizeSelection([layer]);
  assert.equal(document.roots[0].layout.kind, "flex");
  assert.equal(document.roots[0].children[0].children[0].id, "overlay sibling");
  const markup = webGenerator().render(document, { assetUrl: () => undefined });
  writeFileSync(
    html,
    `<!doctype html><meta charset="utf-8"><style>body{margin:0}</style>${markup}`,
  );
  execFileSync(python, [
    "-c",
    [
      "import sys",
      "from PIL import Image, ImageDraw",
      'image = Image.new("RGB", (640, 300), "white")',
      "draw = ImageDraw.Draw(image)",
      'draw.rectangle((24, 24, 203, 119), fill="#2563eb")',
      'draw.rectangle((240, 24, 419, 119), fill="#111827")',
      'draw.rectangle((44, 50, 113, 67), fill="white")',
      "image.save(sys.argv[1])",
      'draw.rectangle((0, 0, 9, 9), fill="black")',
      "image.save(sys.argv[2])",
    ].join("\n"),
    reference,
    altered,
  ]);
  const identical = compare(["--actual", reference, "--max-mismatch", "0"]);
  assert.equal(identical.status, 0, identical.stderr);
  assert.equal(JSON.parse(identical.stdout).mismatchPercent, 0);
  const different = compare(["--actual", altered, "--max-mismatch", "0"]);
  assert.equal(different.status, 1, different.stderr);
  assert.equal(JSON.parse(different.stdout).pixelsDifferent, 100);
  if (process.argv.includes("--browser")) {
    const rendered = compare([
      "--html",
      html,
      "--tolerance",
      "0",
      "--max-mismatch",
      "0",
    ]);
    process.stdout.write(rendered.stdout);
    process.stderr.write(rendered.stderr);
    process.exitCode = rendered.status ?? 2;
  } else {
    console.log(
      "Visual fixture and mismatch calculation passed (0 identical pixels changed, 100 injected differences).",
    );
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
