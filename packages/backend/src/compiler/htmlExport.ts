import { strToU8 } from "fflate";
import { fromUint8Array } from "js-base64";
import { collectProjectAssets } from "./assets";
import type { DesignAsset, DesignDocument } from "./model";
import { SingleFileHtmlEmitter } from "./singleFileHtml";

export async function prepareHtmlExport(
  document: DesignDocument,
  sources: ReadonlyMap<string, SceneNode>,
  embed: boolean,
  separateStyles: boolean,
  isCurrent = () => true,
  linkGoogleFonts = false,
  includeLayerMetadata = false,
) {
  const flatColors = new Map<string, string>();
  const files = await collectProjectAssets(
    document.assets,
    sources,
    document.diagnostics,
    embed ? 6 * 1024 * 1024 : 25 * 1024 * 1024,
    flatColors,
    isCurrent,
  );
  if (!isCurrent()) return;
  const byId = new Map(files.map((file) => [file.nodeId, file]));
  let previewBytes = 0;
  const inline = (asset: DesignAsset) => {
    const file = byId.get(asset.id);
    if (!file) return;
    // Reference mode still gets a self-contained preview with a bounded budget.
    if (!embed && previewBytes + file.bytes.byteLength > 3 * 1024 * 1024)
      return;
    previewBytes += file.bytes.byteLength;
    const mime = asset.format === "SVG" ? "image/svg+xml" : "image/png";
    return `data:${mime};base64,${fromUint8Array(file.bytes)}`;
  };
  const assetColor = (asset: DesignAsset) => flatColors.get(asset.id);
  const emitter = new SingleFileHtmlEmitter(
    new Date(),
    linkGoogleFonts,
    includeLayerMetadata,
  );
  const options = {
    assetColor,
    assetUrl: embed
      ? inline
      : (asset: DesignAsset) => {
          const file = byId.get(asset.id);
          return file ? `assets/${file.name}` : undefined;
        },
  };
  const output = emitter.emit(
    document,
    options,
    separateStyles ? "styles.css" : undefined,
  );
  const preview =
    embed && !separateStyles
      ? undefined
      : emitter.render(document, { assetColor, assetUrl: inline });
  if (embed && strToU8(output.html).byteLength > 2_000_000)
    document.diagnostics.push(
      "Embedded HTML exceeds 2 MB. Reference separate assets to reduce the file size.",
    );
  const assets = Object.fromEntries(
    files.map(({ name, bytes }) => [`assets/${name}`, bytes]),
  );
  return { ...output, preview, assets };
}

export { strToU8 as encodeHtmlFile };
