import type { PluginSettings } from "types";
import { getCleanAssetFileName } from "../common/images";
import { postConversionComplete, postEmptyMessage } from "../messaging";
import {
  exportAsset,
  isContainerBackground,
  resolvePreviewAssets,
  toDetectedAsset,
} from "./assets";
import { projectAssetDirectory, projectAssetUrl } from "../zipGenerator";
import type { DesignAsset } from "./model";
import { normalizeSelection } from "./normalize";
import { webGenerator } from "./web";

export function supportsCompiler(settings: PluginSettings): boolean {
  return (
    settings.designCompiler === true &&
    (settings.framework === "HTML"
      ? settings.htmlGenerationMode === "html" ||
        settings.htmlGenerationMode === "jsx"
      : settings.tailwindGenerationMode !== "twig")
  );
}

export async function runDesignCompiler(
  selection: readonly SceneNode[],
  settings: PluginSettings,
  isCurrent: () => boolean,
) {
  const start = Date.now();
  const { document, sources } = normalizeSelection(selection);
  if (!document.roots.length) {
    if (isCurrent()) postEmptyMessage();
    return;
  }
  const parsed = Date.now();
  const { urls, renderedIds } =
    sources.size <= 1200
      ? await resolvePreviewAssets(
          document.assets,
          sources,
          document.diagnostics,
          isCurrent,
        )
      : { urls: new Map<string, string>(), renderedIds: new Set<string>() };
  if (!isCurrent()) return;

  let directory = "images";
  try {
    directory = projectAssetDirectory(settings.customImagePath);
  } catch (error) {
    document.diagnostics.push(
      error instanceof Error ? error.message : String(error),
    );
  }
  const jsx =
    settings.framework === "HTML"
      ? settings.htmlGenerationMode === "jsx"
      : settings.tailwindGenerationMode === "jsx";
  const code = webGenerator({
    jsx,
    tailwind: settings.framework === "Tailwind",
  }).render(document, {
    assetUrl: (asset) => {
      const shouldEmbed =
        asset.format === "PNG" ? settings.embedImages : settings.embedVectors;
      return (
        (shouldEmbed && renderedIds.has(asset.id) && urls.get(asset.id)) ||
        projectAssetUrl(asset.name, "html", directory)
      );
    },
  });
  const roots = document.roots.map(({ id }) => sources.get(id)!);
  const htmlPreview = {
    size: {
      width: Math.max(1, ...roots.map((node) => node.width)),
      height: Math.max(
        1,
        roots.reduce((sum, node) => sum + node.height, 0),
      ),
    },
    content:
      sources.size <= 1200
        ? webGenerator().render(document, {
            assetUrl: (asset) => urls.get(asset.id),
          })
        : "",
  };
  if (sources.size > 1200)
    document.diagnostics.push(
      "Preview is disabled for selections over 1,200 layers.",
    );
  postConversionComplete({
    code,
    htmlPreview,
    settings,
    colors: [],
    gradients: [],
    warnings: [...new Set(document.diagnostics)].slice(0, 100),
    assets: document.assets.map((asset) =>
      toDetectedAsset(asset, sources.get(asset.id)!.name),
    ),
    metrics: {
      nodeCount: sources.size,
      parseTimeMs: parsed - start,
      codegenTimeMs: Date.now() - parsed,
      totalTimeMs: Date.now() - start,
    },
  });
}

export async function collectProjectAssets(
  assets: readonly DesignAsset[],
  sources: ReadonlyMap<string, SceneNode>,
  diagnostics: string[],
  maxBytes: number,
) {
  const files = [];
  let bytesUsed = 0;
  for (const asset of assets) {
    const node = sources.get(asset.id);
    if (!node) continue;
    try {
      const bytes = await exportAsset(node, asset);
      if (bytesUsed + bytes.byteLength > maxBytes)
        throw new Error("Asset exceeds the remaining project byte budget.");
      bytesUsed += bytes.byteLength;
      files.push({ name: asset.name, bytes, nodeId: node.id });
    } catch (error) {
      diagnostics.push(
        `Could not export ${node.name} (${node.id}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return files;
}

export function downloadAssetDescriptor(
  node: SceneNode,
  format: "PNG" | "SVG",
): DesignAsset {
  return {
    id: node.id,
    name: getCleanAssetFileName(node, format === "SVG" ? "svg" : "png"),
    format,
    placement: isContainerBackground(node) ? "background" : "image",
    width: Math.round(node.width),
    height: Math.round(node.height),
  };
}
