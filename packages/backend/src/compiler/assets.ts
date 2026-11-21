import { flatDividerColor } from "./flatPng";
import { fromUint8Array } from "js-base64";
import {
  getCleanAssetFileName,
  getImageFills,
  nodeHasImageFill,
  renderImage,
} from "../common/images";
import type { DesignAsset } from "./model";

const vectorTypes = new Set([
  "VECTOR",
  "BOOLEAN_OPERATION",
  "STAR",
  "POLYGON",
  "LINE",
]);

export function visibleSelection(selection: readonly SceneNode[]): SceneNode[] {
  const selected = new Set(selection.map((node) => node.id));
  return selection.filter((node) => {
    if (!node.visible) return false;
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (("visible" in parent && !parent.visible) || selected.has(parent.id))
        return false;
    }
    return true;
  });
}

export function isContainerBackground(node: SceneNode): boolean {
  return (
    node.type !== "BOOLEAN_OPERATION" &&
    "children" in node &&
    node.children.length > 0
  );
}

function vectorIcon(node: SceneNode): boolean {
  if (
    !("children" in node) ||
    !node.children.length ||
    !node.name.startsWith("@icon ")
  )
    return false;
  const stack = [...node.children];
  while (stack.length) {
    const child = stack.pop()!;
    if (!child.visible) continue;
    if (
      nodeHasImageFill(child) ||
      child.type === "TEXT" ||
      ("isMask" in child && child.isMask)
    )
      return false;
    if ("children" in child) stack.push(...child.children);
    else if (
      !vectorTypes.has(child.type) &&
      child.type !== "RECTANGLE" &&
      child.type !== "ELLIPSE"
    )
      return false;
  }
  return true;
}

export function cssAssetColor(
  node: SceneNode,
  asset: DesignAsset,
  bytes: Uint8Array,
): string | undefined {
  if (
    asset.format !== "PNG" ||
    node.name.startsWith("@alt ") ||
    node.type === "TEXT" ||
    Math.min(asset.width, asset.height) > 2
  )
    return;
  return flatDividerColor(bytes);
}

export function describeAsset(node: SceneNode): DesignAsset | undefined {
  if ("isMask" in node && node.isMask) return;
  const image = nodeHasImageFill(node);
  if (!image && !vectorTypes.has(node.type) && !vectorIcon(node)) return;
  const format = image ? "PNG" : "SVG";
  return {
    id: node.id,
    name: getCleanAssetFileName(node, image ? "png" : "svg"),
    format,
    placement: image && isContainerBackground(node) ? "background" : "image",
    width: Math.round(node.width),
    height: Math.round(node.height),
  };
}

export function toDetectedAsset(asset: DesignAsset, layerName: string) {
  return {
    id: asset.id,
    name: layerName,
    type: asset.format === "PNG" ? ("image" as const) : ("svg" as const),
    format: asset.format,
    width: asset.width,
    height: asset.height,
  };
}

export async function exportAsset(
  node: SceneNode,
  asset: DesignAsset,
  scale = 1,
): Promise<Uint8Array> {
  if (asset.format === "SVG") {
    const bytes = await node.exportAsync({ format: "SVG" });
    if (!bytes.byteLength) throw new Error("Figma returned an empty SVG.");
    return bytes;
  }

  return renderImage(node, asset.placement === "background", scale);
}

async function readOriginalPreview(
  node: SceneNode,
): Promise<{ bytes: Uint8Array; mime: string } | undefined> {
  const paints = getImageFills(node);
  if (paints.length !== 1 || !paints[0].imageHash) return;
  const handle = figma.getImageByHash(paints[0].imageHash);
  if (!handle) return;
  const bytes = await handle.getBytesAsync();
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return { bytes, mime: "image/png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { bytes, mime: "image/jpeg" };
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)
    return { bytes, mime: "image/gif" };
}

export interface PreviewAssets {
  urls: Map<string, string>;
  renderedIds: Set<string>;
  colors: Map<string, string>;
}

export async function resolvePreviewAssets(
  documentAssets: readonly DesignAsset[],
  sources: ReadonlyMap<string, SceneNode>,
  diagnostics: string[],
  isCurrent: () => boolean = () => true,
): Promise<PreviewAssets> {
  const urls = new Map<string, string>();
  const renderedIds = new Set<string>();
  const colors = new Map<string, string>();
  let remaining = 1_500_000;
  for (const asset of documentAssets.slice(0, 40)) {
    if (remaining <= 0 || !isCurrent()) break;
    const node = sources.get(asset.id);
    if (!node) continue;
    try {
      const scale = Math.min(1, 600 / Math.max(asset.width, asset.height, 1));
      const bytes = await exportAsset(node, asset, scale);
      const flat = scale === 1 ? cssAssetColor(node, asset, bytes) : undefined;
      if (flat) colors.set(asset.id, flat);
      if (bytes.byteLength > remaining) continue;
      remaining -= bytes.byteLength;
      const mime = asset.format === "PNG" ? "image/png" : "image/svg+xml";
      urls.set(asset.id, `data:${mime};base64,${fromUint8Array(bytes)}`);
      renderedIds.add(asset.id);
    } catch (error) {
      diagnostics.push(
        `Could not render ${node.name} (${node.id}): ${error instanceof Error ? error.message : String(error)}`,
      );
      if (asset.format !== "PNG" || !isCurrent()) continue;
      try {
        const source = await readOriginalPreview(node);
        if (!source || source.bytes.byteLength > remaining) continue;
        remaining -= source.bytes.byteLength;
        urls.set(
          asset.id,
          `data:${source.mime};base64,${fromUint8Array(source.bytes)}`,
        );
        diagnostics.push(
          `Previewing the original image for ${node.name}. Crop and compositing may differ from Figma.`,
        );
      } catch (sourceError) {
        diagnostics.push(
          `Original image unavailable for ${node.name}: ${sourceError instanceof Error ? sourceError.message : String(sourceError)}`,
        );
      }
    }
  }
  if (urls.size < documentAssets.length)
    diagnostics.push(
      "Some assets could not be previewed. Export the project for full-size assets and export diagnostics.",
    );
  return { urls, renderedIds, colors };
}
