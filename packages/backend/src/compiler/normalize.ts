import {
  inferVisualLayout,
  recoverContainment,
  resolveOverflow,
} from "./visual";
import { getImageFills } from "../common/images";
import { describeAsset, visibleSelection } from "./assets";
import type {
  Alignment,
  Bounds,
  DesignDocument,
  DesignLayout,
  DesignNode,
  GridTrack,
  SemanticTag,
  Style,
  VisualLayer,
} from "./model";

const px = (value: number) => `${Math.round(value * 100) / 100}px`;
const roles = new Set<SemanticTag>([
  "section",
  "article",
  "header",
  "footer",
  "nav",
  "p",
  "span",
  "h1",
  "h2",
  "h3",
]);
const alignment: Record<string, Alignment> = {
  MIN: "start",
  CENTER: "center",
  MAX: "end",
  SPACE_BETWEEN: "space-between",
  BASELINE: "baseline",
};
const activePaint = (paint: Paint) =>
  paint.visible !== false && (paint.opacity ?? 1) > 0;
const color = (paint: SolidPaint) => {
  const { r, g, b } = paint.color;
  return `rgba(${[r, g, b].map((channel) => Math.round(channel * 255)).join(", ")}, ${paint.opacity ?? 1})`;
};

function normalizeTracks(
  tracks: readonly GridTrackSize[],
  count: number,
): GridTrack[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    const track = tracks[index];
    return track?.type === "FIXED" && typeof track.value === "number"
      ? { kind: "fixed", pixels: track.value }
      : { kind: "flex" };
  });
}

export function normalizeSelection(selection: readonly SceneNode[]) {
  const document: DesignDocument = {
    version: 1,
    roots: [],
    assets: [],
    tokens: {},
    diagnostics: [],
  };
  const sources = new Map<string, SceneNode>();
  const tokens = new Map<string, string>();
  const token = (kind: string, value: string) => {
    const key = `${kind}:${value}`;
    let name = tokens.get(key);
    if (!name) {
      name = `--figma-${kind}-${tokens.size + 1}`;
      tokens.set(key, name);
      document.tokens[name] = value;
    }
    return `var(${name}, ${value})`;
  };

  function visit(
    node: SceneNode,
    parent?: SceneNode,
    depth = 0,
    order = 0,
    parentBounds?: Bounds,
  ): DesignNode | undefined {
    if (!node.visible || ("isMask" in node && node.isMask)) return;
    if (sources.size >= 4000 || depth >= 160)
      throw new Error(
        "Selection exceeds the compiler limit (4,000 visible layers or 160 levels of nesting).",
      );
    if (
      (node.width <= 0 || node.height <= 0) &&
      node.type !== "LINE" &&
      !("children" in node && node.children.length)
    )
      return;
    sources.set(node.id, node);
    const bounds = node.absoluteBoundingBox ?? {
      x:
        (parentBounds?.x ?? 0) +
        node.x -
        (parent?.type === "GROUP" ? parent.x : 0),
      y:
        (parentBounds?.y ?? 0) +
        node.y -
        (parent?.type === "GROUP" ? parent.y : 0),
      width: node.width,
      height: node.height,
    };
    const visual: VisualLayer = {
      bounds: { ...bounds },
      type: node.type,
      order,
      clips: "clipsContent" in node && node.clipsContent,
      complex:
        ("effects" in node && node.effects.some((effect) => effect.visible)) ||
        ("strokes" in node && node.strokes.some(activePaint)) ||
        ("blendMode" in node &&
          node.blendMode !== "PASS_THROUGH" &&
          node.blendMode !== "NORMAL"),
      sizing: { horizontal: "fixed", vertical: "fixed" },
      mixed: "fills" in node && typeof node.fills === "symbol",
      fills:
        "fills" in node && Array.isArray(node.fills)
          ? node.fills.filter(activePaint).map((paint) => ({
              kind: paint.type,
              opacity: paint.opacity ?? 1,
            }))
          : [],
    };
    const text = node.type === "TEXT" ? node.characters : undefined;
    const hint = node.name
      .trim()
      .split(/\s|:/, 1)[0]
      .replace(/^@/, "") as SemanticTag;
    const isTextTag = ["p", "span", "h1", "h2", "h3"].includes(hint);
    const tag =
      node.name.startsWith("@") &&
      roles.has(hint) &&
      isTextTag === (text !== undefined)
        ? hint
        : text === undefined
          ? "div"
          : "p";
    const asset = describeAsset(node);
    if (asset) {
      document.assets.push(asset);
      if (
        asset.format === "PNG" &&
        getImageFills(node).some((paint) => !paint.imageHash)
      ) {
        document.diagnostics.push(
          `Some image paints on ${node.name} have no source hash. Using Figma's rendered export.`,
        );
      }
    }
    const style: Style = {
      boxSizing: "border-box",
      margin: "0",
      minWidth: "0",
    };
    const parentMode =
      parent && "layoutMode" in parent ? parent.layoutMode : "NONE";
    const inFlow =
      parentMode !== "NONE" &&
      (!("layoutPositioning" in node) || node.layoutPositioning !== "ABSOLUTE");
    const widthMode =
      "layoutSizingHorizontal" in node
        ? node.layoutSizingHorizontal
        : undefined;
    const heightMode =
      "layoutSizingVertical" in node ? node.layoutSizingVertical : undefined;
    const fitTextWidth =
      node.type === "TEXT" && node.textAutoResize === "WIDTH_AND_HEIGHT";
    const fitTextHeight =
      node.type === "TEXT" && node.textAutoResize !== "NONE";
    visual.explicitWidth = parentMode !== "NONE" && widthMode !== undefined;
    visual.sizing = {
      horizontal:
        widthMode === "FILL"
          ? "fill"
          : widthMode === "HUG" || fitTextWidth
            ? "hug"
            : "fixed",
      vertical:
        heightMode === "FILL"
          ? "fill"
          : heightMode === "HUG" || fitTextHeight
            ? "hug"
            : "fixed",
    };
    style.width =
      visual.sizing.horizontal === "hug" ? "fit-content" : px(node.width);
    style.maxWidth = "100%";
    if (visual.sizing.vertical === "fixed") style.minHeight = px(node.height);
    if (inFlow && widthMode === "FILL") {
      style.width = "100%";
      if (parentMode === "HORIZONTAL") style.flex = "1 1 0%";
    }
    if (inFlow && heightMode === "FILL") {
      style.minHeight = "0";
      if (parentMode === "VERTICAL") style.flex = "1 1 0%";
      if (parentMode === "HORIZONTAL") style.alignSelf = "stretch";
    }
    const gridCell =
      inFlow && parentMode === "GRID" && "gridRowAnchorIndex" in node
        ? {
            row: node.gridRowAnchorIndex,
            column: node.gridColumnAnchorIndex,
            rowSpan: node.gridRowSpan,
            columnSpan: node.gridColumnSpan,
          }
        : undefined;
    if (parent && !inFlow) {
      style.position = "absolute";
      style.left = px(node.x - (parent.type === "GROUP" ? parent.x : 0));
      style.top = px(node.y - (parent.type === "GROUP" ? parent.y : 0));
    }

    if (asset?.placement !== "image" && "opacity" in node && node.opacity !== 1)
      style.opacity = String(node.opacity);
    if ("rotation" in node && node.rotation)
      style.transform = `rotate(${-node.rotation}deg)`;
    if (
      "cornerRadius" in node &&
      typeof node.cornerRadius === "number" &&
      node.cornerRadius
    )
      style.borderRadius = px(node.cornerRadius);
    else if ("topLeftRadius" in node)
      style.borderRadius = [
        node.topLeftRadius,
        node.topRightRadius,
        node.bottomRightRadius,
        node.bottomLeftRadius,
      ]
        .map(px)
        .join(" ");
    if (node.type === "ELLIPSE") style.borderRadius = "50%";
    if ("clipsContent" in node && node.clipsContent) style.overflow = "hidden";

    if ("fills" in node && Array.isArray(node.fills)) {
      const paint = [...node.fills]
        .reverse()
        .find(
          (fill): fill is SolidPaint =>
            fill.type === "SOLID" && activePaint(fill),
        );
      if (paint && !asset)
        style[text === undefined ? "backgroundColor" : "color"] = token(
          "color",
          color(paint),
        );
      if (
        !asset &&
        node.fills.some(
          (fill) => activePaint(fill) && fill.type.startsWith("GRADIENT"),
        )
      ) {
        document.diagnostics.push(
          `Gradient on ${node.name} needs manual styling.`,
        );
      }
    }

    if (node.type === "TEXT") {
      style.whiteSpace = "pre-wrap";
      style.overflowWrap = "anywhere";
      style.textAlign =
        node.textAlignHorizontal === "JUSTIFIED"
          ? "justify"
          : node.textAlignHorizontal.toLowerCase();
      if (typeof node.fontSize === "number")
        style.fontSize = token("font-size", px(node.fontSize));
      const font =
        typeof node.fontName === "object" ? node.fontName : undefined;
      const fallback =
        font && /mono|courier/i.test(font.family)
          ? "monospace"
          : font &&
              /serif|times|georgia/i.test(font.family) &&
              !/sans/i.test(font.family)
            ? "serif"
            : "system-ui, sans-serif";
      const fontFamily = font
        ? `${JSON.stringify(font.family)}, ${fallback}`
        : fallback;
      style.fontFamily = token("font", fontFamily);
      if (font && /italic|oblique/i.test(font.style))
        style.fontStyle = "italic";
      const line = node.lineHeight;
      const spacing = node.letterSpacing;
      const lineHeight =
        typeof line !== "object" || line.unit === "AUTO"
          ? "normal"
          : line.unit === "PIXELS"
            ? px(line.value)
            : String(line.value / 100);
      const letterSpacing =
        typeof spacing !== "object"
          ? "normal"
          : spacing.unit === "PIXELS"
            ? px(spacing.value)
            : `${spacing.value / 100}em`;
      if (lineHeight !== "normal") style.lineHeight = lineHeight;
      if (letterSpacing !== "normal") style.letterSpacing = letterSpacing;
      visual.textMetrics = {
        autoResize: node.textAutoResize,
        lineHeight,
        letterSpacing,
        fontFamily,
      };
      if (node.textAutoResize === "TRUNCATE")
        document.diagnostics.push(
          `Text truncation on ${node.name} (${node.id}) needs review; generated text wraps.`,
        );
      if (typeof node.fontWeight === "number")
        style.fontWeight = String(node.fontWeight);
      if (node.fontName === figma.mixed || node.fills === figma.mixed)
        document.diagnostics.push(
          `Mixed text styles on ${node.name} need manual review.`,
        );
    }

    const children: DesignNode[] = [];
    let layout: DesignLayout | undefined;
    // SVG/PNG leaves are already composited, including boolean-operation children.
    if ("children" in node && asset?.placement !== "image") {
      style.position ??= "relative";
      if (node.children.some((child) => "isMask" in child && child.isMask))
        document.diagnostics.push(`Masks on ${node.name} need manual review.`);
      if (
        "layoutMode" in node &&
        (node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL")
      ) {
        layout = {
          kind: "flex",
          axis: node.layoutMode === "HORIZONTAL" ? "horizontal" : "vertical",
          wrap: node.layoutWrap === "WRAP",
          gap:
            node.itemSpacing >= 0
              ? token("space", px(node.itemSpacing))
              : undefined,
          main: alignment[node.primaryAxisAlignItems] ?? "start",
          cross: alignment[node.counterAxisAlignItems] ?? "start",
          padding: [
            token("space", px(node.paddingTop)),
            token("space", px(node.paddingRight)),
            token("space", px(node.paddingBottom)),
            token("space", px(node.paddingLeft)),
          ],
        };
        if (node.itemSpacing < 0)
          document.diagnostics.push(
            `Negative spacing on ${node.name} needs manual styling.`,
          );
      } else if ("layoutMode" in node && node.layoutMode === "GRID") {
        layout = {
          kind: "grid",
          columns: normalizeTracks(node.gridColumnSizes, node.gridColumnCount),
          rows: normalizeTracks(node.gridRowSizes, node.gridRowCount),
          columnGap: token("space", px(node.gridColumnGap)),
          rowGap: token("space", px(node.gridRowGap)),
        };
      } else if (node.children.some((child) => child.visible)) {
        layout = { kind: "freeform" };
      }
      for (const [index, child] of node.children.entries()) {
        const converted = visit(child, node, depth + 1, index, bounds);
        if (converted) children.push(converted);
      }
    }

    if (
      node.type === "GROUP" &&
      !asset &&
      visual.fills.length === 0 &&
      node.opacity === 1 &&
      node.rotation === 0 &&
      node.effects.length === 0 &&
      !node.isMask &&
      node.blendMode === "PASS_THROUGH" &&
      tag === "div"
    ) {
      if (!children.length) return;
      const child = children[0];
      if (
        children.length === 1 &&
        Object.keys(bounds).every(
          (key) =>
            bounds[key as keyof Bounds] ===
            child.visual.bounds[key as keyof Bounds],
        )
      ) {
        child.visual.order = order;
        for (const key of ["position", "left", "top"]) {
          if (style[key]) child.style[key] = style[key];
          else delete child.style[key];
        }
        return child;
      }
    }

    let component: DesignNode["component"];
    if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
      component = {
        kind: node.type === "COMPONENT" ? "definition" : "set",
        key: node.key,
        variants:
          node.type === "COMPONENT"
            ? (node.variantProperties ?? undefined)
            : undefined,
      };
    } else if (node.type === "INSTANCE") {
      component = {
        kind: "instance",
        variants: node.variantProperties ?? undefined,
        properties: Object.fromEntries(
          Object.entries(node.componentProperties).map(([key, property]) => [
            key,
            property.value,
          ]),
        ),
      };
    }
    if (asset?.placement === "image")
      return {
        visual,
        id: node.id,
        name: node.name,
        tag,
        style,
        gridCell,
        text,
        asset,
        children,
      };
    return {
      visual,
      id: node.id,
      name: node.name,
      tag,
      style,
      layout,
      gridCell,
      text,
      asset,
      component,
      children,
    };
  }

  for (const [index, root] of visibleSelection(selection).entries()) {
    const normalized = visit(root, undefined, 0, index);
    if (normalized) document.roots.push(normalized);
  }
  recoverContainment(document.roots);
  inferVisualLayout(document.roots, document.diagnostics);
  resolveOverflow(document.roots, document.diagnostics);
  return { document, sources };
}
