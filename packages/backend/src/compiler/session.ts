import type { PluginSettings } from "types";
import { getCleanAssetFileName } from "../common/images";
import { postConversionComplete, postEmptyMessage } from "../messaging";
import {
  isContainerBackground,
  resolvePreviewAssets,
  toDetectedAsset,
} from "./assets";
import { projectAssetDirectory, projectAssetUrl } from "../zipGenerator";
import type { DesignAsset } from "./model";
import { normalizeSelection } from "./normalize";
import { prepareHtmlExport } from "./htmlExport";
import { webGenerator } from "./web";

export function supportsCompiler(settings: PluginSettings): boolean {
  if (
    settings.outputFormat === "single-html" ||
    settings.outputFormat === "separate-html"
  )
    return true;
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
  const documentMode =
    settings.outputFormat === "single-html" ||
    settings.outputFormat === "separate-html";
  const standalone = documentMode
    ? await prepareHtmlExport(
        document,
        sources,
        settings.outputFormat === "single-html" &&
          settings.embedDocumentImages !== false,
        settings.outputFormat === "separate-html",
        isCurrent,
        settings.linkGoogleFonts,
        true,
      )
    : undefined;
  const { urls, renderedIds, colors } =
    !documentMode && sources.size <= 1200
      ? await resolvePreviewAssets(
          document.assets,
          sources,
          document.diagnostics,
          isCurrent,
        )
      : {
          urls: new Map<string, string>(),
          renderedIds: new Set<string>(),
          colors: new Map<string, string>(),
        };
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
  const code =
    standalone?.html ??
    webGenerator({
      jsx,
      tailwind: settings.framework === "Tailwind",
    }).render(document, {
      assetColor: (asset) => colors.get(asset.id),
      assetUrl: (asset) => {
        const shouldEmbed =
          asset.format === "PNG" ? settings.embedImages : settings.embedVectors;
        return (
          (shouldEmbed && renderedIds.has(asset.id) && urls.get(asset.id)) ||
          projectAssetUrl(asset.name, "html", directory)
        );
      },
    });
  const roots = document.roots.map(
    ({ visual }) => visual.renderedBounds ?? visual.bounds,
  );
  const htmlPreview = {
    fullDocument: Boolean(standalone),
    allowRemoteFonts: Boolean(standalone && settings.linkGoogleFonts),
    useCode: Boolean(standalone && !standalone.preview),
    size: {
      width: Math.max(1, ...roots.map((node) => node.width)),
      height: Math.max(
        1,
        roots.reduce((sum, node) => sum + node.height, 0),
      ),
    },
    content: standalone
      ? (standalone.preview ?? "")
      : sources.size <= 1200
        ? webGenerator().render(document, {
            assetColor: (asset) => colors.get(asset.id),
            assetUrl: (asset) => urls.get(asset.id),
          })
        : "",
  };
  if (!documentMode && sources.size > 1200)
    document.diagnostics.push(
      "Preview is disabled for selections over 1,200 layers.",
    );
  postConversionComplete({
    code,
    documentCss:
      settings.outputFormat === "separate-html" ? standalone?.css : undefined,
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

export { collectProjectAssets } from "./assets";

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
