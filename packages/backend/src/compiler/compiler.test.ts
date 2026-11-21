import { afterEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { getImageFills } from "../common/images";
import { generateProjectZip, projectAssetUrl } from "../zipGenerator";
import { exportAsset, resolvePreviewAssets, visibleSelection } from "./assets";
import { normalizeSelection } from "./normalize";
import { collectProjectAssets } from "./session";
import { webGenerator } from "./web";

const mixed = Symbol("figma.mixed");
const image = (overrides: Partial<ImagePaint> = {}): ImagePaint => ({
  type: "IMAGE",
  imageHash: "hash",
  scaleMode: "FILL",
  ...overrides,
});

function layer(id: string, properties: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    visible: true,
    parent: null,
    type: "RECTANGLE",
    width: 160,
    height: 80,
    x: 0,
    y: 0,
    exportAsync: vi.fn<() => Promise<Uint8Array>>(
      async () => new Uint8Array([1, 2, 3]),
    ),
    ...properties,
  } as unknown as SceneNode;
}

function row(
  id: string,
  children: SceneNode[],
  properties: Record<string, unknown> = {},
) {
  const root = layer(id, {
    name: "@section Card",
    type: "FRAME",
    layoutMode: "HORIZONTAL",
    layoutWrap: "WRAP",
    width: 480,
    itemSpacing: 12,
    paddingTop: 12,
    paddingLeft: 12,
    paddingBottom: 12,
    paddingRight: 12,
    primaryAxisAlignItems: "SPACE_BETWEEN",
    counterAxisAlignItems: "CENTER",
    children,
    ...properties,
  });
  for (const child of children) Object.assign(child, { parent: root });
  return root;
}

function fixture() {
  const heading = layer("2:1", {
    type: "TEXT",
    characters: "A < B & {value}",
    name: "@h2 Heading",
    layoutSizingHorizontal: "FILL",
    width: 300,
    height: 28,
    textAutoResize: "HEIGHT",
    textAlignHorizontal: "LEFT",
    fontName: { family: "Inter", style: "Bold" },
    fontSize: 20,
    fontWeight: 700,
    fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
  });
  const photo = layer("2:2", {
    name: '@alt A "blue" bicycle',
    fills: [image()],
    locked: true,
  });
  return row("2:0", [photo, heading], {
    fills: [image({ scaleMode: "CROP" })],
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("live Figma image discovery", () => {
  it("uses active paints and ignores null, mixed non-text, masked, disabled and zero-alpha fills", () => {
    expect(getImageFills(layer("1", { fills: mixed }))).toEqual([]);
    expect(getImageFills(layer("2", { fills: null }))).toEqual([]);
    expect(
      getImageFills(layer("3", { isMask: true, fills: [image()] })),
    ).toEqual([]);
    const paint = image({ imageHash: null });
    expect(
      getImageFills(
        layer("4", {
          fills: [image({ visible: false }), image({ opacity: 0 }), paint],
        }),
      ),
    ).toEqual([paint]);
  });

  it("checks mixed text paint ranges", () => {
    const getStyledTextSegments = vi.fn<() => Array<{ fills: ImagePaint[] }>>(
      () => [{ fills: [image()] }, { fills: [image({ visible: false })] }],
    );
    const text = layer("1", {
      type: "TEXT",
      fills: mixed,
      getStyledTextSegments,
    });
    expect(getImageFills(text)).toHaveLength(1);
    expect(getStyledTextSegments).toHaveBeenCalledWith(["fills"]);
  });

  it("includes locked nested frame and vector fills, omits hidden subtrees and deduplicates selected descendants", () => {
    vi.stubGlobal("figma", { mixed });
    const design = fixture();
    const vector = layer("3", { type: "VECTOR", fills: [image()] });
    const hidden = row("4", [layer("5", { fills: [image()] })], {
      visible: false,
    });
    const root = row("6", [design, vector, hidden]);
    const { document } = normalizeSelection([design, root, hidden]);
    expect(visibleSelection([design, root, hidden])).toEqual([root]);
    expect(
      document.assets.map(({ id, format, placement }) => [
        id,
        format,
        placement,
      ]),
    ).toEqual([
      ["2:0", "PNG", "background"],
      ["2:2", "PNG", "image"],
      ["3", "PNG", "image"],
    ]);
    expect(visibleSelection([(hidden as FrameNode).children[0]])).toEqual([]);
  });
});

describe("asset rendering", () => {
  it("exports the container fill stack and cleans up after an async Figma failure", async () => {
    const surface = {
      resize: vi.fn<(width: number, height: number) => void>(),
      exportAsync: vi
        .fn<() => Promise<Uint8Array>>()
        .mockRejectedValue(new Error("offline image")),
      remove: vi.fn<() => void>(),
    };
    const createRectangle = vi.fn<() => typeof surface>(() => surface);
    vi.stubGlobal("figma", { mixed, createRectangle });
    const root = fixture();
    const child = (root as FrameNode).children[0];
    const { document } = normalizeSelection([root]);
    await expect(exportAsset(root, document.assets[0], 2)).rejects.toThrow(
      "offline image",
    );
    expect(surface.resize).toHaveBeenCalledWith(480, 80);
    expect(surface).toMatchObject({ fills: [image({ scaleMode: "CROP" })] });
    expect(surface.exportAsync).toHaveBeenCalledWith({
      format: "PNG",
      constraint: { type: "SCALE", value: 2 },
    });
    expect(surface.remove).toHaveBeenCalledOnce();
    expect(child.visible).toBe(true);
    expect(root.exportAsync).not.toHaveBeenCalled();
  });

  it("keeps boolean-operation geometry in the rendered image", async () => {
    const child = layer("2", { type: "VECTOR" });
    const boolean = layer("1", {
      type: "BOOLEAN_OPERATION",
      fills: [image()],
      children: [child],
    });
    const { document } = normalizeSelection([boolean]);
    expect(document.assets[0].placement).toBe("image");
    await exportAsset(boolean, document.assets[0]);
    expect(boolean.exportAsync).toHaveBeenCalledWith({
      format: "PNG",
      constraint: { type: "SCALE", value: 1 },
    });
  });

  it("reports an empty asset export and still returns successful files", async () => {
    const broken = layer("1", {
      fills: [image()],
      exportAsync: vi.fn<() => Promise<Uint8Array>>(
        async () => new Uint8Array(),
      ),
    });
    const valid = layer("2", { type: "VECTOR" });
    const { document, sources } = normalizeSelection([broken, valid]);
    const assets = await collectProjectAssets(
      document.assets,
      sources,
      document.diagnostics,
      100,
    );
    expect(assets.map(({ name }) => name)).toEqual(["2-2.svg"]);
    expect(document.diagnostics.join("\n")).toContain("empty PNG");
    expect(valid.exportAsync).toHaveBeenCalledWith({ format: "SVG" });
  });

  it("uses original bytes only as a preview fallback and handles null hashes and rejected reads independently", async () => {
    const original = vi
      .fn<
        (hash: string) => { getBytesAsync: () => Promise<Uint8Array> } | null
      >()
      .mockReturnValueOnce({
        getBytesAsync: async () => new Uint8Array([0xff, 0xd8, 0xff]),
      })
      .mockReturnValueOnce({
        getBytesAsync: async () => {
          throw new Error("unavailable");
        },
      })
      .mockReturnValueOnce(null);
    vi.stubGlobal("figma", { mixed, getImageByHash: original });
    const layers = ["good", "broken", "missing", null].map((hash, index) =>
      layer(String(index), {
        fills: [image({ imageHash: hash })],
        exportAsync: vi
          .fn<() => Promise<Uint8Array>>()
          .mockRejectedValue(new Error("cannot render")),
      }),
    );
    const { document, sources } = normalizeSelection(layers);
    const { urls, renderedIds } = await resolvePreviewAssets(
      document.assets,
      sources,
      document.diagnostics,
    );
    expect(urls.get("0")).toBe("data:image/jpeg;base64,/9j/");
    expect(urls.size).toBe(1);
    expect(renderedIds.size).toBe(0);
    expect(original.mock.calls.flat()).toEqual(["good", "broken", "missing"]);
    expect(document.diagnostics).toContainEqual(
      expect.stringContaining("unavailable"),
    );
  });

  it("enforces the project budget and stops stale previews before the next export", async () => {
    const first = layer("1", { fills: [image()] });
    const second = layer("2", { fills: [image()] });
    const { document, sources } = normalizeSelection([first, second]);
    expect(
      await collectProjectAssets(
        document.assets,
        sources,
        document.diagnostics,
        3,
      ),
    ).toHaveLength(1);
    expect(document.diagnostics).toContainEqual(
      expect.stringContaining("byte budget"),
    );
    let current = true;
    vi.mocked(first.exportAsync).mockImplementationOnce(async () => {
      current = false;
      return new Uint8Array([1, 2, 3]);
    });
    vi.mocked(second.exportAsync).mockClear();
    await resolvePreviewAssets(document.assets, sources, [], () => current);
    expect(second.exportAsync).not.toHaveBeenCalled();
  });
});

describe("compiler output contract", () => {
  it("keeps a versioned, serializable design model with component properties and layout intent", () => {
    const instance = layer("1", {
      type: "INSTANCE",
      children: [],
      layoutMode: "NONE",
      variantProperties: { State: "Hover" },
      componentProperties: {
        "Show icon#1:2": { type: "BOOLEAN", value: true },
      },
    });
    const { document } = normalizeSelection([row("2", [instance])]);
    expect(JSON.parse(JSON.stringify(document))).toMatchObject({
      version: 1,
      roots: [
        {
          layout: { kind: "flex", axis: "horizontal", wrap: true },
          children: [
            {
              component: {
                kind: "instance",
                variants: { State: "Hover" },
                properties: { "Show icon#1:2": true },
              },
            },
          ],
        },
      ],
    });
  });

  it("emits explicit grid track placement and preserves positioned overlays", () => {
    const cell = layer("1", {
      gridRowAnchorIndex: 0,
      gridColumnAnchorIndex: 1,
      gridRowSpan: 1,
      gridColumnSpan: 2,
    });
    const overlay = layer("2", { layoutPositioning: "ABSOLUTE", x: 8, y: 12 });
    const { document } = normalizeSelection([
      row("3", [cell, overlay], {
        layoutMode: "GRID",
        gridColumnCount: 3,
        gridRowCount: 1,
        gridColumnGap: 12,
        gridRowGap: 8,
        gridColumnSizes: [
          { type: "FIXED", value: 100 },
          { type: "FLEX" },
          { type: "FLEX" },
        ],
        gridRowSizes: [{ type: "FLEX" }],
      }),
    ]);
    const html = webGenerator().render(document, { assetUrl: () => undefined });
    expect(html).toContain(
      "grid-template-columns: 100px minmax(0, 1fr) minmax(0, 1fr)",
    );
    expect(html).toContain("grid-column: 2 / span 2");
    expect(html).toContain("position: absolute; left: 8px; top: 12px");
  });

  it("snapshots semantic HTML, JSX and Tailwind from the same IR", () => {
    vi.stubGlobal("figma", { mixed });
    const { document } = normalizeSelection([fixture()]);
    const options = {
      assetUrl: ({ name }: { name: string }) => `images/${name}`,
    };
    expect(webGenerator().render(document, options)).toMatchSnapshot("HTML");
    expect(
      webGenerator({ jsx: true }).render(document, options),
    ).toMatchSnapshot("React JSX");
    expect(
      webGenerator({ tailwind: true }).render(document, options),
    ).toMatchSnapshot("Tailwind");
  });

  it.each(["html", "nextjs", "vite"] as const)(
    "links %s assets and the editable theme to actual archive entries",
    (format) => {
      const url = projectAssetUrl("hero.png", format, "/media/assets/");
      const code =
        format === "html"
          ? `<img src="${url}" alt="">`
          : `<img src="${url}" alt="" />`;
      const zip = generateProjectZip(
        code,
        "HTML",
        [{ name: "hero.png", bytes: new Uint8Array([1, 2, 3]), nodeId: "1" }],
        format,
        "card",
        "/media/assets/",
        { tokens: { "--figma-space-1": "12px" }, diagnostics: ["Example"] },
      );
      const entries = unzipSync(zip);
      const root = format === "html" ? "card/" : "";
      const assetFolder = format === "html" ? root : "public/";
      const markupPath =
        format === "html"
          ? "card/index.html"
          : format === "nextjs"
            ? "app/page.tsx"
            : "src/App.tsx";
      const themeEntry =
        format === "html"
          ? markupPath
          : format === "nextjs"
            ? "app/layout.tsx"
            : "src/main.tsx";
      expect(strFromU8(entries[markupPath])).toContain(url);
      expect(strFromU8(entries[themeEntry])).toContain("theme.css");
      expect(strFromU8(entries[`${root}theme.css`])).toContain(
        "--figma-space-1: 12px;",
      );
      expect(entries[`${root}design-diagnostics.txt`]).toBeDefined();
      expect(entries[`${assetFolder}media/assets/hero.png`]).toEqual(
        new Uint8Array([1, 2, 3]),
      );
    },
  );
});

it("captures page geometry and prunes invisible, zero-sized and redundant groups", () => {
  const paint = layer("paint", {
    absoluteBoundingBox: { x: 20, y: 30, width: 160, height: 80 },
    fills: mixed,
  });
  const group = row("group", [paint], {
    type: "GROUP",
    name: "Wrapper",
    layoutMode: "NONE",
    opacity: 1,
    rotation: 0,
    effects: [],
    blendMode: "PASS_THROUGH",
    absoluteBoundingBox: { x: 20, y: 30, width: 160, height: 80 },
  });
  const { document } = normalizeSelection([
    layer("zero", { width: 0 }),
    group,
    layer("hidden", { visible: false }),
  ]);
  expect(document.roots.map(({ id }) => id)).toEqual(["paint"]);
  expect(document.roots[0].visual).toMatchObject({
    order: 1,
    mixed: true,
    bounds: { x: 20, y: 30, width: 160, height: 80 },
  });
});

it("merges a full background and nests a later overlay over its contained rectangle", () => {
  const fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
  const full = layer("full", { fills, width: 480 });
  const card = layer("card", { fills, x: 20, y: 10, width: 100, height: 50 });
  const overlay = layer("overlay", { x: 30, y: 20, width: 40, height: 15 });
  const { document } = normalizeSelection([
    row("root", [full, card, overlay], { layoutMode: "NONE" }),
  ]);
  const [root] = document.roots;
  expect(root.style.backgroundColor).toContain("rgba(255, 0, 0");
  expect(root.children.map(({ id }) => id)).toEqual(["card"]);
  expect(root.children[0].children[0]).toMatchObject({
    id: "overlay",
  });
});

it("infers rows in visual order and a regular grid from badly ordered siblings", () => {
  const block = (id: string, x: number, y: number) =>
    layer(id, { x, y, width: 50, height: 25 });
  const inferred = normalizeSelection([
    row("unordered", [block("right", 80, 10), block("left", 10, 11)], {
      layoutMode: "NONE",
    }),
    row(
      "grid",
      [
        block("d", 80, 44),
        block("a", 10, 10),
        block("c", 10, 44),
        block("b", 80, 10),
      ],
      { layoutMode: "NONE" },
    ),
  ]).document.roots;
  expect(inferred[0].layout).toMatchObject({
    kind: "flex",
    axis: "horizontal",
    gap: "20px",
  });
  expect(inferred[0].children.map(({ id }) => id)).toEqual(["left", "right"]);
  expect(inferred[1].layout).toMatchObject({
    kind: "grid",
    columnGap: "20px",
    rowGap: "9px",
  });
  expect(inferred[1].children[3].gridCell).toMatchObject({ row: 1, column: 1 });
});

it("expands an overflowing freeform frame but bounds an explicitly clipped frame", () => {
  const overflow = (id: string) =>
    layer(id, { x: 450, y: 70, width: 100, height: 50 });
  const { document } = normalizeSelection([
    row("open", [overflow("loose")], { layoutMode: "NONE" }),
    row("closed", [overflow("clipped")], {
      layoutMode: "NONE",
      clipsContent: true,
    }),
  ]);
  expect(document.roots[0].style).toMatchObject({
    width: "550px",
    minHeight: "120px",
  });
  expect(document.roots[0].style.overflow).toBeUndefined();
  expect(document.roots[1].style).toMatchObject({
    overflow: "hidden",
    height: "80px",
  });
  expect(
    document.diagnostics.some((warning) =>
      warning.includes("Unclipped overflow on @section Card (open)"),
    ),
  ).toBe(true);
});
