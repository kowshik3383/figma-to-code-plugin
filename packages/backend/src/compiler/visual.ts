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
          !candidate.style.borderRadius &&
          contains(candidate.visual.bounds, bounds) &&
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
