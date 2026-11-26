import type { Style } from "./model";
import { px } from "./visual";

const cssBlendModes = new Set([
  "darken",
  "multiply",
  "color-burn",
  "lighten",
  "screen",
  "color-dodge",
  "overlay",
  "soft-light",
  "hard-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
]);

export function applyEffects(
  node: SceneNode,
  style: Style,
  diagnostics: string[],
  baked: boolean,
) {
  const label = `${node.name} (${node.id})`;
  if ("rotation" in node && node.rotation) {
    style.transform = `rotate(${-node.rotation}deg)`;
    style.transformOrigin = "0 0";
  }
  if (
    "blendMode" in node &&
    node.blendMode !== "NORMAL" &&
    node.blendMode !== "PASS_THROUGH"
  ) {
    const blend = node.blendMode.toLowerCase().replaceAll("_", "-");
    if (cssBlendModes.has(blend)) style.mixBlendMode = blend;
    else
      diagnostics.push(`Unsupported blend mode ${node.blendMode} on ${label}.`);
  }
  if (baked || !("effects" in node)) return;
  const boxShadows: string[] = [];
  const textShadows: string[] = [];
  for (const effect of node.effects) {
    if (!effect.visible) continue;
    if (
      (effect.type !== "DROP_SHADOW" && effect.type !== "INNER_SHADOW") ||
      effect.blendMode !== "NORMAL"
    ) {
      diagnostics.push(`Unsupported effect ${effect.type} on ${label}.`);
      continue;
    }
    const { r, g, b, a } = effect.color;
    const rgba = `rgba(${[r, g, b].map((channel) => Math.round(channel * 255)).join(", ")}, ${a})`;
    const offsets = `${px(effect.offset.x)} ${px(effect.offset.y)} ${px(effect.radius)}`;
    if (node.type === "TEXT") {
      if (effect.type === "DROP_SHADOW" && !effect.spread)
        textShadows.unshift(`${offsets} ${rgba}`);
      else
        diagnostics.push(
          `Text shadow ${effect.type} with spread or inset on ${label} needs manual styling.`,
        );
    } else {
      boxShadows.unshift(
        `${effect.type === "INNER_SHADOW" ? "inset " : ""}${offsets} ${px(effect.spread ?? 0)} ${rgba}`,
      );
    }
  }
  if (boxShadows.length) style.boxShadow = boxShadows.join(", ");
  if (textShadows.length) style.textShadow = textShadows.join(", ");
}
