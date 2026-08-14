import { AltNode, ExportableNode } from "types";
import { btoa } from "js-base64";
import { addWarning } from "./commonConversionWarnings";
import { exportAsyncProxy } from "./exportAsyncProxy";

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
    const base64 = await exportNodeAsBase64PNG(altNode, hasChildren);
    if (base64) return base64;
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
  fills?: ReadonlyArray<Paint> | PluginAPI["mixed"] | null;
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
  try {
    if (!node || node.isMask || !node.fills || !Array.isArray(node.fills)) {
      return [];
    }
    return (node.fills as Paint[]).filter(fillIsActiveImage);
  } catch {
    return [];
  }
};

export const nodeHasImageFill = (
  node?: NodeWithFills | MinimalFillsMixin | SceneNode | null,
): boolean => getImageFills(node).length > 0;

export const nodeHasMultipleFills = (
  node?: NodeWithFills | MinimalFillsMixin | SceneNode | null,
): boolean => Array.isArray(node?.fills) && (node?.fills?.length ?? 0) > 1;

const imageBytesToBase64 = (bytes: Uint8Array): string => {
  // Convert Uint8Array to binary string
  const binaryString = bytes.reduce((data, byte) => {
    return data + String.fromCharCode(byte);
  }, "");

  // Encode binary string to base64
  const b64 = btoa(binaryString);

  return `data:image/png;base64,${b64}`;
};

const exportWithHiddenChildren = async <T>(
  node: SceneNode,
  excludeChildren: boolean,
  exportNode: () => Promise<T>,
): Promise<T> => {
  const parent = node as SceneNode & Partial<ChildrenMixin>;
  const children =
    excludeChildren && "children" in parent && parent.children
      ? [...parent.children]
      : [];
  const originalVisibility = new Map(
    children.map((child) => [child, child.visible]),
  );

  try {
    for (const child of children) {
      child.visible = false;
    }
    return await exportNode();
  } finally {
    for (const child of children) {
      child.visible = originalVisibility.get(child) ?? false;
    }
  }
};

export const exportNodeAsBase64PNG = async <T extends ExportableNode>(
  node: AltNode<T>,
  excludeChildren: boolean,
) => {
  // Shorcut export if the node has already been converted.
  if (node.base64 !== undefined && node.base64 !== "") {
    return node.base64;
  }

  const n: ExportableNode = node;

  // export the image as bytes
  const exportSettings: ExportSettingsImage = {
    format: "PNG",
    constraint: { type: "SCALE", value: 1 },
  };
  const bytes = await exportWithHiddenChildren(n, excludeChildren, () =>
    exportAsyncProxy(n, exportSettings),
  );

  addWarning("Some images exported as Base64 PNG");

  // Encode binary string to base64
  const base64 = imageBytesToBase64(bytes);
  // Save the value so it's only calculated once.
  node.base64 = base64;
  return base64;
};

export const exportNodeAsPNG = async (
  node: SceneNode & ExportMixin,
  excludeChildren: boolean,
): Promise<Uint8Array> => {
  return exportWithHiddenChildren(node, excludeChildren, () =>
    node.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: 1 },
    }),
  );
};

export const exportNodeAsPNGWithScale = async (
  node: SceneNode & ExportMixin,
  excludeChildren: boolean,
  scale = 1,
): Promise<Uint8Array> => {
  return exportWithHiddenChildren(node, excludeChildren, () =>
    node.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: scale },
    }),
  );
};
