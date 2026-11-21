import type {
  Alignment,
  DesignGenerator,
  DesignLayout,
  DesignNode,
  GridTrack,
  Style,
} from "./model";

const escapeHTML = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
const cssName = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const css = (style: Style) =>
  Object.entries(style)
    .map(([key, value]) => `${cssName(key)}: ${value}`)
    .join("; ");
const utility = {
  display: { flex: "flex", grid: "grid" },
  flexDirection: { row: "flex-row", column: "flex-col" },
  flexWrap: { wrap: "flex-wrap" },
} as Record<string, Record<string, string>>;

function flexAlignment(value: Alignment) {
  if (value === "start") return "flex-start";
  if (value === "end") return "flex-end";
  return value;
}

const gridTrack = (track: GridTrack) =>
  track.kind === "fixed" ? `${track.pixels}px` : "minmax(0, 1fr)";

function lowerLayout(layout?: DesignLayout): Style {
  if (layout?.kind === "flex") {
    return {
      display: "flex",
      flexDirection: layout.axis === "horizontal" ? "row" : "column",
      flexWrap: layout.wrap ? "wrap" : "nowrap",
      justifyContent: flexAlignment(layout.main),
      alignItems: flexAlignment(layout.cross),
      padding: layout.padding.join(" "),
      ...(layout.gap ? { gap: layout.gap } : {}),
    };
  }
  if (layout?.kind === "grid") {
    return {
      display: "grid",
      gridTemplateColumns: layout.columns.map(gridTrack).join(" "),
      gridTemplateRows: layout.rows.map(gridTrack).join(" "),
      columnGap: layout.columnGap,
      rowGap: layout.rowGap,
    };
  }
  return {};
}

export function webGenerator(
  options: { jsx?: boolean; tailwind?: boolean } = {},
): DesignGenerator {
  const { jsx, tailwind } = options;

  function attributes(style: Style) {
    const utilities: string[] = [];
    const inline: Style = {};
    for (const [key, value] of Object.entries(style)) {
      const className = tailwind ? utility[key]?.[value] : undefined;
      if (className) utilities.push(className);
      else inline[key] = value;
    }
    const classes = utilities.length
      ? ` ${jsx ? "className" : "class"}="${utilities.join(" ")}"`
      : "";
    const styles = jsx
      ? ` style={${JSON.stringify(inline)}}`
      : ` style="${escapeHTML(css(inline))}"`;
    return classes + styles;
  }

  return {
    render(document, { assetUrl }) {
      function renderNode(node: DesignNode, depth: number): string {
        const indent = "  ".repeat(depth);
        const style = { ...node.style, ...lowerLayout(node.layout) };
        if (node.gridCell) {
          style.gridRow = `${node.gridCell.row + 1} / span ${node.gridCell.rowSpan}`;
          style.gridColumn = `${node.gridCell.column + 1} / span ${node.gridCell.columnSpan}`;
        }
        const url = node.asset && assetUrl(node.asset);
        const stringAttribute = (value: string) =>
          jsx ? `{${JSON.stringify(value)}}` : `"${escapeHTML(value)}"`;
        if (url && node.asset?.placement === "image") {
          // Opt into meaningful alternative text with @alt; vectors default to decorative.
          const alt = node.name.startsWith("@alt ")
            ? node.name.slice(5).trim()
            : (node.text ?? "");
          const imgStyle = {
            ...style,
            display: "block",
            height: "auto",
            minHeight: "0",
          };
          return `${indent}<img src=${stringAttribute(url)} alt=${stringAttribute(alt)} width="${Math.max(1, node.asset.width)}" height="${Math.max(1, node.asset.height)}"${attributes(imgStyle)}${jsx ? " />" : ">"}`;
        }
        if (url) {
          style.backgroundImage = `url(${JSON.stringify(url)})`;
          style.backgroundSize = "100% 100%";
          style.backgroundRepeat = "no-repeat";
        }
        const start = `${indent}<${node.tag}${attributes(style)}>`;
        if (node.text !== undefined)
          return `${start}${jsx ? `{${JSON.stringify(node.text)}}` : escapeHTML(node.text)}</${node.tag}>`;
        if (!node.children.length) return `${start}</${node.tag}>`;
        return `${start}\n${node.children.map((child) => renderNode(child, depth + 1)).join("\n")}\n${indent}</${node.tag}>`;
      }
      const roots = document.roots
        .map((node) => renderNode(node, jsx ? 1 : 0))
        .join("\n");
      if (jsx) return `<>\n${roots}\n</>`;
      return roots;
    },
  };
}
