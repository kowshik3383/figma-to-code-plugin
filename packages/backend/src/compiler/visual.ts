import type { Bounds, DesignNode } from "./model";

export const px = (value: number) => `${Math.round(value * 100) / 100}px`;
const right = (bounds: Bounds) => bounds.x + bounds.width;
const bottom = (bounds: Bounds) => bounds.y + bounds.height;

export function contains(
  outer: Bounds,
  inner: Bounds,
  tolerance = 0.25,
): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    right(inner) <= right(outer) + tolerance &&
    bottom(inner) <= bottom(outer) + tolerance
  );
}

export function overlaps(a: Bounds, b: Bounds): boolean {
  return (
    Math.min(right(a), right(b)) - Math.max(a.x, b.x) > 0.5 &&
    Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y) > 0.5
  );
}

function plainRectangle(node: DesignNode): boolean {
  return (
    node.visual.type === "RECTANGLE" &&
    !node.asset &&
    !node.visual.mixed &&
    node.visual.fills.length === 1 &&
    node.visual.fills[0].kind === "SOLID" &&
    !!node.style.backgroundColor &&
    !node.visual.complex &&
    !node.style.opacity &&
    !node.style.transform
  );
}

function fitsRoundedRectangle(container: DesignNode, content: Bounds): boolean {
  const bounds = container.visual.bounds;
  const corner = Math.max(
    0,
    ...(container.style.borderRadius ?? "")
      .split(" ")
      .map((value) => Number.parseFloat(value) || 0),
  );
  const inset = Math.min(corner, Math.min(bounds.width, bounds.height) / 2);
  return contains(
    {
      x: bounds.x + inset,
      y: bounds.y + inset,
      width: bounds.width - inset * 2,
      height: bounds.height - inset * 2,
    },
    content,
  );
}

function attach(container: DesignNode, child: DesignNode) {
  container.layout ??= { kind: "freeform" };
  container.style.position ??= "relative";
  child.style.position = "absolute";
  child.style.left = px(child.visual.bounds.x - container.visual.bounds.x);
  child.style.top = px(child.visual.bounds.y - container.visual.bounds.y);
  container.children.push(child);
}

export function recoverContainment(nodes: DesignNode[], parent?: DesignNode) {
  for (const node of nodes) recoverContainment(node.children, node);
  if (
    !parent ||
    parent.visual.maskedStack ||
    parent.visual.reverseOrder ||
    parent.layout?.kind === "flex" ||
    parent.layout?.kind === "grid"
  )
    return;

  const background = nodes[0];
  if (
    background &&
    plainRectangle(background) &&
    !parent.style.backgroundColor &&
    !parent.asset &&
    !parent.style.borderRadius &&
    contains(parent.visual.bounds, background.visual.bounds) &&
    contains(background.visual.bounds, parent.visual.bounds) &&
    (!background.style.borderRadius || parent.visual.clips)
  ) {
    parent.style.backgroundColor = background.style.backgroundColor;
    parent.visual.fills = background.visual.fills;
    if (background.style.borderRadius)
      parent.style.borderRadius = background.style.borderRadius;
    nodes.splice(0, 1);
  }

  const remaining: DesignNode[] = [];
  for (const child of nodes) {
    const bounds = child.visual.bounds;
    let host: DesignNode | undefined;
    if (!child.style.transform && !child.visual.complex) {
      for (let index = remaining.length - 1; index >= 0; index--) {
        const candidate = remaining[index];
        if (!overlaps(candidate.visual.bounds, bounds)) continue;
        if (
          plainRectangle(candidate) &&
          fitsRoundedRectangle(candidate, bounds) &&
          !contains(bounds, candidate.visual.bounds)
        ) {
          host = candidate;
        }
        // Crossing another painted sibling would change the visual stack.
        break;
      }
    }
    if (host) attach(host, child);
    else remaining.push(child);
  }
  nodes.splice(0, nodes.length, ...remaining);
}

const tolerance = 2;
const close = (a: number, b: number) => Math.abs(a - b) <= tolerance;

function useFlow(child: DesignNode) {
  delete child.style.position;
  if (child.children.length) child.style.position = "relative";
  delete child.style.left;
  delete child.style.top;
}

function flexFromBounds(node: DesignNode, horizontal: boolean): boolean {
  const start = (b: Bounds) => (horizontal ? b.x : b.y);
  const end = horizontal ? right : bottom;
  const crossStart = (b: Bounds) => (horizontal ? b.y : b.x);
  const crossEnd = horizontal ? bottom : right;
  const parent = node.visual.bounds;
  const sorted = [...node.children].sort(
    (a, b) => start(a.visual.bounds) - start(b.visual.bounds),
  );
  const boxes = sorted.map((child) => child.visual.bounds);
  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  const starts = boxes.map(crossStart);
  const ends = boxes.map(crossEnd);
  const crossMin = Math.min(...starts);
  const crossMax = Math.max(...ends);
  const center = boxes.every((b) =>
    close(crossStart(b) + crossEnd(b), crossMin + crossMax),
  );
  const cross = starts.every((v) => close(v, crossMin))
    ? "start"
    : ends.every((v) => close(v, crossMax))
      ? "end"
      : center
        ? "center"
        : undefined;
  const gaps = boxes.slice(1).map((b, i) => start(b) - end(boxes[i]));
  if (!cross || gaps.some((g) => g < -0.5 || !close(g, gaps[0]))) return false;

  const before = start(first) - start(parent);
  const after = end(parent) - end(last);
  const crossBefore = crossMin - crossStart(parent);
  const crossAfter = crossEnd(parent) - crossMax;
  const main =
    !gaps.length && close(before, after)
      ? "center"
      : gaps.length > 0 &&
          close(before, 0) &&
          close(after, 0) &&
          gaps[0] > tolerance
        ? "space-between"
        : "start";
  const values = horizontal
    ? [crossBefore, after, crossAfter, before]
    : [before, crossAfter, after, crossBefore];
  const padding = values.map((value) => px(Math.max(0, value))) as [
    string,
    string,
    string,
    string,
  ];
  node.layout = {
    kind: "flex",
    axis: horizontal ? "horizontal" : "vertical",
    wrap: false,
    main,
    cross,
    gap: main === "space-between" ? undefined : px(Math.max(0, gaps[0] ?? 0)),
    padding,
  };
  node.children = sorted;
  for (const child of sorted) {
    useFlow(child);
    if (
      !horizontal &&
      close(
        child.visual.bounds.width,
        crossEnd(parent) - crossStart(parent) - crossBefore - crossAfter,
      ) &&
      close(crossStart(child.visual.bounds), crossMin) &&
      child.visual.sizing.horizontal === "fixed" &&
      !child.visual.explicitWidth
    ) {
      child.visual.sizing.horizontal = "fill";
      child.style.width = "100%";
    }
  }
  return true;
}

function gridFromBounds(node: DesignNode): boolean {
  const sorted = [...node.children].sort(
    (a, b) =>
      a.visual.bounds.y - b.visual.bounds.y ||
      a.visual.bounds.x - b.visual.bounds.x,
  );
  const bands: DesignNode[][] = [];
  for (const child of sorted) {
    const band = bands.at(-1);
    if (band && close(band[0].visual.bounds.y, child.visual.bounds.y))
      band.push(child);
    else bands.push([child]);
  }
  for (const band of bands)
    band.sort((a, b) => a.visual.bounds.x - b.visual.bounds.x);
  const columns = bands[0].map((child) => child.visual.bounds);
  const rows = bands.map((band) => band[0].visual.bounds);
  if (columns.length < 2 || rows.length < 2) return false;
  if (
    bands.some(
      (band, row) =>
        band.length !== columns.length ||
        band.some(
          ({ visual: { bounds: b } }, column) =>
            !close(b.x, columns[column].x) ||
            !close(b.width, columns[column].width) ||
            !close(b.height, rows[row].height),
        ),
    )
  )
    return false;
  const xGaps = columns.slice(1).map((b, i) => b.x - right(columns[i]));
  const yGaps = rows.slice(1).map((b, i) => b.y - bottom(rows[i]));
  if (
    [xGaps, yGaps].some((gaps) =>
      gaps.some((gap) => gap < 0 || !close(gap, gaps[0])),
    )
  )
    return false;
  const parent = node.visual.bounds;
  node.style.padding = [
    rows[0].y - parent.y,
    right(parent) - right(columns.at(-1)!),
    bottom(parent) - bottom(rows.at(-1)!),
    columns[0].x - parent.x,
  ]
    .map((value) => px(Math.max(0, value)))
    .join(" ");
  node.layout = {
    kind: "grid",
    columns: columns.map(({ width }) => ({ kind: "fixed", pixels: width })),
    rows: rows.map(({ height }) => ({ kind: "fixed", pixels: height })),
    columnGap: px(xGaps[0]),
    rowGap: px(yGaps[0]),
  };
  node.children = bands.flat();
  node.children.forEach((child, index) => {
    useFlow(child);
    child.gridCell = {
      row: Math.floor(index / columns.length),
      column: index % columns.length,
      rowSpan: 1,
      columnSpan: 1,
    };
  });
  return true;
}

export function inferVisualLayout(nodes: DesignNode[], diagnostics: string[]) {
  for (const node of nodes) {
    inferVisualLayout(node.children, diagnostics);
    if (node.layout?.kind !== "freeform" || !node.children.length) continue;
    if (
      !node.visual.maskedStack &&
      !node.style.transform &&
      node.children.every(
        (child) =>
          contains(node.visual.bounds, child.visual.bounds) &&
          !child.style.transform,
      )
    ) {
      if (
        flexFromBounds(node, true) ||
        flexFromBounds(node, false) ||
        gridFromBounds(node)
      )
        continue;
    }
    diagnostics.push(
      `Unresolved layout on ${node.name} (${node.id}); preserving measured positions.`,
    );
    node.style.position ??= "relative";
    for (const child of node.children) {
      if (!node.style.transform && !child.style.transform) {
        child.style.left = px(child.visual.bounds.x - node.visual.bounds.x);
        child.style.top = px(child.visual.bounds.y - node.visual.bounds.y);
      }
      child.style.position = "absolute";
      if (child.visual.sizing.horizontal === "fill")
        child.style.width = px(child.visual.bounds.width);
      if (child.visual.sizing.vertical === "fill")
        child.style.minHeight = px(child.visual.bounds.height);
    }
  }
}

export function resolveOverflow(nodes: DesignNode[], diagnostics: string[]) {
  function visit(node: DesignNode): Bounds {
    const bounds = node.visual.bounds;
    const children = node.children.map(visit);
    if (node.visual.clips) {
      node.style.overflow = "hidden";
      // Clipping needs a bounded viewport even when flow children are taller.
      node.style.height = px(bounds.height);
      delete node.style.minHeight;
      return bounds;
    }
    if (!children.length) return bounds;
    const x = Math.min(bounds.x, ...children.map((child) => child.x));
    const y = Math.min(bounds.y, ...children.map((child) => child.y));
    const farRight = Math.max(right(bounds), ...children.map(right));
    const farBottom = Math.max(bottom(bounds), ...children.map(bottom));
    const extraWidth = farRight - bounds.x;
    const extraHeight = farBottom - bounds.y;
    if (extraWidth > bounds.width + 0.5 && node.layout?.kind === "freeform")
      node.style.width = px(extraWidth);
    if (extraHeight > bounds.height + 0.5)
      node.style.minHeight = px(extraHeight);
    if (
      x < bounds.x - 0.5 ||
      y < bounds.y - 0.5 ||
      extraWidth > bounds.width + 0.5 ||
      extraHeight > bounds.height + 0.5
    ) {
      diagnostics.push(
        `Unclipped overflow on ${node.name} (${node.id}); check content outside the original frame.`,
      );
    }
    node.visual.renderedBounds = {
      x,
      y,
      width: farRight - x,
      height: farBottom - y,
    };
    return node.visual.renderedBounds;
  }
  nodes.forEach(visit);
}

export function assignStackOrder(nodes: DesignNode[], diagnostics: string[]) {
  for (const parent of nodes) {
    assignStackOrder(parent.children, diagnostics);
    if (parent.children.length < 2) continue;
    const participants = new Set<DesignNode>();
    for (const [i, a] of parent.children.entries()) {
      for (const b of parent.children.slice(i + 1)) {
        if (
          overlaps(
            a.visual.renderedBounds ?? a.visual.bounds,
            b.visual.renderedBounds ?? b.visual.bounds,
          )
        ) {
          participants.add(a);
          participants.add(b);
        }
      }
    }
    if (!participants.size) continue;
    diagnostics.push(
      `Overlapping layers in ${parent.name} (${parent.id}): ${[...participants]
        .slice(0, 5)
        .map(({ name, id }) => `${name} (${id})`)
        .join(
          ", ",
        )}${participants.size > 5 ? ` and ${participants.size - 5} more` : ""}. Review stacking and narrow layouts.`,
    );
    if (parent.visual.reverseOrder) {
      for (const child of participants)
        child.style.zIndex = String(
          parent.children.length - child.visual.order,
        );
    } else {
      for (const child of participants)
        child.style.zIndex = String(child.visual.order + 1);
    }
    for (const child of participants) child.style.position ??= "relative";
    if (!parent.children.some((child) => child.style.mixBlendMode))
      parent.style.isolation = "isolate";
  }
}
