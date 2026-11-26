import { AltNode, ExportableNode } from "types";
import { fromUint8Array } from "js-base64";
import { addWarning } from "./commonConversionWarnings";

export const PLACEHOLDER_IMAGE_DOMAIN = "https://placehold.co";

const toKebab = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const getCleanAssetFileName = (
  node: SceneNode,
  extension: "png" | "svg" = "png",
): string => {
  const fallback = extension === "svg" ? "icon" : "image";
  const cleanName = toKebab(node.name) || fallback;
  const suffix = (node.id || "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "");
  return `${cleanName}${suffix ? `-${suffix}` : ""}.${extension}`;
};

export const getCleanImageFileName = (node: SceneNode): string =>
  getCleanAssetFileName(node, "png");

export const getCleanSvgFileName = (node: SceneNode): string =>
  getCleanAssetFileName(node, "svg");

export const getVectorSrc = async (
  node: SceneNode,
  settings: {
    customImagePath?: string;
    imagePlaceholderMode?: "remote" | "asset";
  },
): Promise<string> => {
  if (settings.imagePlaceholderMode === "asset" && node.id) {
    return `__FIGMA_IMAGE_${encodeURIComponent(node.id)}__`;
  }

  const customPath = (settings.customImagePath || "images/")
    .trim()
    .replace(/\/+$/, "");
  const fileName = getCleanSvgFileName(node);
  return customPath ? `${customPath}/${fileName}` : fileName;
};

export const getImageSrc = async (
  node: SceneNode,
  settings: {
    embedImages: boolean;
    imagePlaceholderMode?: "remote" | "asset";
    customImagePath?: string;
  },
): Promise<string> => {
  const altNode = node as AltNode<ExportableNode>;
  const hasChildren =
    "children" in node && (node.children as any[])?.length > 0;

  if (settings.imagePlaceholderMode === "asset" && node.id) {
    return `__FIGMA_IMAGE_${encodeURIComponent(node.id)}__`;
  }

  if (settings.embedImages) {
    try {
      const base64 = await exportNodeAsBase64PNG(altNode, hasChildren);
      if (base64) return base64;
    } catch (error) {
      addWarning(
        `Could not embed ${node.name} (${node.id}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const customPath = (settings.customImagePath || "images/")
    .trim()
    .replace(/\/+$/, "");
  const fileName = getCleanImageFileName(node);
  return customPath ? `${customPath}/${fileName}` : fileName;
};

export const getPlaceholderImage = (
  w: number,
  h = -1,
  nodeId?: string,
  mode: "remote" | "asset" = "remote",
) => {
  const _w = w.toFixed(0);
  const _h = (h < 0 ? w : h).toFixed(0);

  if (mode === "asset" && nodeId) {
    return `__FIGMA_IMAGE_${encodeURIComponent(nodeId)}__`;
  }

  return `${PLACEHOLDER_IMAGE_DOMAIN}/${_w}x${_h}`;
};

export interface NodeWithFills {
  fills?: unknown;
  isMask?: boolean;
  opacity?: number;
  [key: string]: unknown;
}

const fillIsActiveImage = (fill: unknown): fill is ImagePaint => {
  if (!fill || typeof fill !== "object") return false;
  const paint = fill as Paint;
  if (paint.type !== "IMAGE") return false;
  if (paint.visible === false) return false;
  if (paint.opacity !== undefined && paint.opacity <= 0) return false;
  return true;
};

export const getImageFills = (
  node?: NodeWithFills | MinimalFillsMixin | SceneNode | null,
): ImagePaint[] => {
  if (!node || ("isMask" in node && node.isMask)) return [];
  const fills = "fills" in node ? node.fills : undefined;
  if (Array.isArray(fills)) return fills.filter(fillIsActiveImage);

  // Mixed text paints live on character ranges, not on the node-level fills array.
  if (
    "type" in node &&
    node.type === "TEXT" &&
    "getStyledTextSegments" in node &&
    typeof node.getStyledTextSegments === "function"
  ) {
    return (node as TextNode)
      .getStyledTextSegments(["fills"])
      .flatMap((segment) => segment.fills.filter(fillIsActiveImage));
  }
  return [];
};

export const nodeHasImageFill = (
  node?: NodeWithFills | MinimalFillsMixin | SceneNode | null,
): boolean => getImageFills(node).length > 0;

export const nodeHasMultipleFills = (
  node?: NodeWithFills | MinimalFillsMixin | SceneNode | null,
): boolean =>
  !!node &&
  "fills" in node &&
  Array.isArray(node.fills) &&
  node.fills.length > 1;

export async function renderImage(
  node: SceneNode,
  excludeChildren: boolean,
  scale = 1,
): Promise<Uint8Array> {
  let surface: RectangleNode | undefined;
  try {
    if (
      excludeChildren &&
      node.type !== "BOOLEAN_OPERATION" &&
      "fills" in node &&
      Array.isArray(node.fills)
    ) {
      // An isolated rectangle preserves the fill stack and local crop coordinates.
      // An off-canvas temporary layer avoids changing source visibility or auto-layout.
      surface = figma.createRectangle();
      surface.x = -100000;
      surface.y = -100000;
      surface.resize(Math.max(0.01, node.width), Math.max(0.01, node.height));
      surface.fills = node.fills;
    }
    const bytes = await (surface ?? node).exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: scale },
    });
    if (!bytes.byteLength) throw new Error("Figma returned an empty PNG.");
    return bytes;
  } finally {
    surface?.remove();
  }
}

export async function exportNodeAsBase64PNG<T extends ExportableNode>(
  node: AltNode<T>,
  excludeChildren: boolean,
) {
  if (node.base64) return node.base64;
  const source = await figma.getNodeByIdAsync(node.id);
  if (!source || source.type === "DOCUMENT" || source.type === "PAGE") {
    throw new Error("Image layer is no longer available.");
  }
  const bytes = await renderImage(source, excludeChildren);
  node.base64 = `data:image/png;base64,${fromUint8Array(bytes)}`;
  addWarning("Some images exported as Base64 PNG");
  return node.base64;
}
