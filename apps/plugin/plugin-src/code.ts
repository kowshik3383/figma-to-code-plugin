import {
  run,
  tailwindMain,
  htmlMain,
  extractProjectImageNodeIds,
  generateProjectZip,
  postSettingsChanged,
  replaceProjectImagePlaceholders,
} from "backend";
import { nodesToJSON } from "backend/src/altNodes/jsonNodeConversion";
import { oldConvertNodesToAltNodes } from "backend/src/altNodes/oldAltConversion";
import { nodeHasImageFill } from "backend/src/common/images";
import { retrieveGenericSolidUIColors } from "backend/src/common/retrieveUI/retrieveColors";
import { htmlCodeGenTextStyles } from "backend/src/html/htmlMain";
import { tailwindCodeGenTextStyles } from "backend/src/tailwind/tailwindMain";
import {
  collectProjectAssets,
  downloadAssetDescriptor,
  supportsCompiler,
} from "backend/src/compiler/session";
import { exportAsset, visibleSelection } from "backend/src/compiler/assets";
import { normalizeSelection } from "backend/src/compiler/normalize";
import { webGenerator } from "backend/src/compiler/web";
import {
  projectAssetDirectory,
  projectAssetUrl,
} from "backend/src/zipGenerator";
import { generateAssetZip } from "backend/src/zipGenerator";
import {
  AssetDownloadMessage,
  DownloadProjectFormat,
  PluginSettings,
  SettingWillChangeMessage,
} from "types";

let userPluginSettings: PluginSettings;

export const defaultPluginSettings: PluginSettings = {
  framework: "HTML",
  showLayerNames: false,
  useOldPluginVersion2025: false,
  designCompiler: false,
  responsiveRoot: false,
  roundTailwindValues: true,
  roundTailwindColors: true,
  useColorVariables: true,
  customTailwindPrefix: "",
  embedImages: false,
  embedVectors: true,
  customImagePath: "images/",
  htmlGenerationMode: "html",
  tailwindGenerationMode: "jsx",
  baseFontSize: 16,
  useTailwind4: true,
  thresholdPercent: 15,
  baseFontFamily: "",
  fontFamilyCustomConfig: {},
};

// A helper type guard to ensure the key belongs to the PluginSettings type
function isKeyOfPluginSettings(key: string): key is keyof PluginSettings {
  return Object.prototype.hasOwnProperty.call(defaultPluginSettings, key);
}

const getUserSettings = async () => {
  console.log("[DEBUG] getUserSettings - Starting to fetch user settings");
  const possiblePluginSrcSettings =
    (await figma.clientStorage.getAsync("userPluginSettings")) ?? {};
  console.log(
    "[DEBUG] getUserSettings - Raw settings from storage:",
    possiblePluginSrcSettings,
  );

  const updatedPluginSrcSettings = {
    ...defaultPluginSettings,
    ...Object.keys(defaultPluginSettings).reduce((validSettings, key) => {
      if (
        isKeyOfPluginSettings(key) &&
        key in possiblePluginSrcSettings &&
        typeof possiblePluginSrcSettings[key] ===
          typeof defaultPluginSettings[key]
      ) {
        validSettings[key] = possiblePluginSrcSettings[key] as any;
      }
      return validSettings;
    }, {} as Partial<PluginSettings>),
  };

  userPluginSettings = updatedPluginSrcSettings as PluginSettings;
  console.log("[DEBUG] getUserSettings - Final settings:", userPluginSettings);
  return userPluginSettings;
};

let initialized = false;
let isLoading = false;
let isDownloadingProject = false;
let assetOperations = 0;
let revision = 0;
let completedRevision = 0;
let observedLayerIds = new Set<string>();

async function refreshSelection() {
  if (
    !initialized ||
    isLoading ||
    isDownloadingProject ||
    assetOperations ||
    revision === completedRevision
  )
    return;

  isLoading = true;
  const roots = [...figma.currentPage.selection];
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length && seen.size < 4000) {
    const layer = stack.pop()!;
    if (seen.has(layer.id)) continue;
    seen.add(layer.id);
    if ("children" in layer)
      for (const child of layer.children) stack.push(child);
  }
  for (const root of roots) {
    for (
      let node = root.parent;
      node && node.type !== "PAGE";
      node = node.parent
    )
      seen.add(node.id);
  }
  observedLayerIds = seen;

  const current = revision;
  const isCurrent = () => current === revision;
  try {
    await run({ ...userPluginSettings }, isCurrent);
  } catch (error) {
    if (isCurrent()) {
      figma.ui.postMessage({ type: "error", error: errorText(error) });
    }
  } finally {
    completedRevision = current;
    isLoading = false;
    void refreshSelection();
  }
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function queueSelectionRefresh() {
  revision += 1;
  void refreshSelection();
}

function postAssetDownload(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
) {
  if (bytes.byteLength > 10 * 1024 * 1024) {
    throw new Error(
      "Download exceeds the 10 MB message limit. Use a smaller selection or export scale.",
    );
  }
  const message: AssetDownloadMessage = {
    type: "download-file",
    bytes: Uint8Array.from(bytes).buffer,
    fileName,
    mimeType,
  };
  figma.ui.postMessage(message);
}

type ExportedProjectImage = {
  name: string;
  bytes: Uint8Array;
  nodeId: string;
};

const allowedFormatsByFramework: Record<
  "HTML" | "Tailwind",
  DownloadProjectFormat[]
> = {
  HTML: ["html", "nextjs", "vite"],
  Tailwind: ["html", "nextjs", "vite"],
};

const toKebab = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const getRootSelectionName = (selection: readonly SceneNode[]) => {
  if (selection.length === 0) {
    return "figma-export";
  }

  if (selection.length === 1) {
    return toKebab(selection[0].name) || "figma-export";
  }

  return (
    toKebab(selection[0].parent?.name ?? "figma-selection") || "figma-selection"
  );
};

const exportProjectAssets = async (
  selection: readonly SceneNode[],
  requiredNodeIds: ReadonlySet<string>,
): Promise<ExportedProjectImage[]> => {
  const assets: ExportedProjectImage[] = [];
  const missingNodeIds = new Set(requiredNodeIds);

  const visit = async (node: SceneNode) => {
    if (node.visible === false) {
      return;
    }

    if (missingNodeIds.has(node.id)) {
      const format = nodeHasImageFill(node) ? "PNG" : "SVG";
      const descriptor = downloadAssetDescriptor(node, format);
      assets.push({
        bytes: await exportAsset(node, descriptor),
        name: descriptor.name,
        nodeId: node.id,
      });
      missingNodeIds.delete(node.id);
    }

    if ("children" in node) {
      for (const child of node.children) {
        await visit(child);
      }
    }
  };

  for (const node of selection) {
    await visit(node);
  }

  if (missingNodeIds.size > 0) {
    throw new Error(
      `Could not find ${missingNodeIds.size} asset layer${
        missingNodeIds.size === 1 ? "" : "s"
      } in the selected content.`,
    );
  }

  return assets;
};

const getConvertedSelectionForDownload = async (
  nodes: readonly SceneNode[],
  pluginSettings: PluginSettings,
): Promise<SceneNode[]> => {
  if (nodes.length === 0) {
    return [];
  }

  const convertedSelection = pluginSettings.useOldPluginVersion2025
    ? oldConvertNodesToAltNodes(nodes, null)
    : await nodesToJSON(nodes, pluginSettings);
  return convertedSelection as unknown as SceneNode[];
};

const generateDownloadCode = async (
  nodes: readonly SceneNode[],
  format: DownloadProjectFormat,
  pluginSettings: PluginSettings,
) => {
  const convertedSelection = await getConvertedSelectionForDownload(
    nodes,
    pluginSettings,
  );

  if (convertedSelection.length === 0) {
    return "<div>No content to export</div>";
  }

  const settings = {
    ...pluginSettings,
    embedImages: false,
    embedVectors: false,
    imagePlaceholderMode: "asset" as const,
  };
  const isReactProject = format === "nextjs" || format === "vite";

  if (pluginSettings.framework === "Tailwind") {
    const result = await tailwindMain(convertedSelection, {
      ...settings,
      tailwindGenerationMode: isReactProject ? "jsx" : "html",
    });
    return result || "<div>Failed to generate Tailwind</div>";
  }

  const result = await htmlMain(
    convertedSelection,
    {
      ...settings,
      htmlGenerationMode: isReactProject ? "jsx" : "html",
    },
    true,
  );
  return result?.html || "<div>Failed to generate HTML</div>";
};

const downloadProject = async (format: DownloadProjectFormat) => {
  if (!["html", "nextjs", "vite"].includes(format)) {
    throw new Error(`Invalid download format: ${format}.`);
  }

  const pluginSettings = { ...userPluginSettings };
  if (!allowedFormatsByFramework[pluginSettings.framework].includes(format)) {
    throw new Error(
      `${format} export is not available for ${pluginSettings.framework}.`,
    );
  }

  projectAssetDirectory(pluginSettings.customImagePath);
  const selection = visibleSelection(figma.currentPage.selection);
  if (selection.length === 0) {
    throw new Error("Please select at least one layer to export.");
  }

  const maxRawAssetSizeBytes = 25 * 1024 * 1024;
  let assets: ExportedProjectImage[];
  let code: string;
  let artifacts: Parameters<typeof generateProjectZip>[6];
  if (supportsCompiler(pluginSettings)) {
    const { document, sources } = normalizeSelection(selection);
    const flatColors = new Map<string, string>();
    assets = await collectProjectAssets(
      document.assets,
      sources,
      document.diagnostics,
      maxRawAssetSizeBytes,
      flatColors,
    );
    const exported = new Map(assets.map((asset) => [asset.nodeId, asset.name]));
    code = webGenerator({
      jsx: format !== "html",
      tailwind: pluginSettings.framework === "Tailwind",
    }).render(document, {
      assetColor: (asset) => flatColors.get(asset.id),
      assetUrl: (asset) => {
        const name = exported.get(asset.id);
        return name
          ? projectAssetUrl(name, format, pluginSettings.customImagePath)
          : undefined;
      },
    });
    artifacts = {
      tokens: document.tokens,
      diagnostics: [...new Set(document.diagnostics)],
    };
  } else {
    const rawCode = await generateDownloadCode(
      selection,
      format,
      pluginSettings,
    );
    assets = await exportProjectAssets(
      selection,
      extractProjectImageNodeIds(rawCode),
    );
    code = replaceProjectImagePlaceholders(
      rawCode,
      assets,
      format,
      pluginSettings.customImagePath,
    );
  }
  const rootName = getRootSelectionName(selection);
  const rawAssetSize = assets.reduce(
    (sum, asset) => sum + asset.bytes.byteLength,
    0,
  );
  if (rawAssetSize > maxRawAssetSizeBytes) {
    throw new Error(
      `Assets are too large (${Math.round(rawAssetSize / 1024 / 1024)}MB). Try selecting fewer assets or smaller components.`,
    );
  }
  const zipData = generateProjectZip(
    code,
    pluginSettings.framework,
    assets,
    format,
    rootName,
    pluginSettings.customImagePath,
    artifacts,
  );

  const maxMessageSizeBytes = 10 * 1024 * 1024;
  if (zipData.byteLength > maxMessageSizeBytes) {
    throw new Error(
      `Project too large (${Math.round(zipData.byteLength / 1024 / 1024)}MB). Try selecting fewer images or smaller components.`,
    );
  }

  const zip = zipData.buffer.slice(
    zipData.byteOffset,
    zipData.byteOffset + zipData.byteLength,
  );

  figma.ui.postMessage({
    type: "project-zip",
    zip,
    format,
    fileName: `${rootName}-${format}.zip`,
  });
};

const standardMode = async () => {
  console.log("[DEBUG] standardMode - Starting standard mode initialization");
  figma.showUI(__html__, { width: 450, height: 700, themeColors: true });
  let settingsReady: Promise<void> | undefined;
  figma.on("selectionchange", queueSelectionRefresh);
  figma.on("currentpagechange", queueSelectionRefresh);
  // Current-page node events avoid loading unrelated pages solely to refresh the preview.
  let observedPage = figma.currentPage;
  const onEdit = ({ nodeChanges }: NodeChangeEvent) => {
    const selected = new Set(figma.currentPage.selection.map(({ id }) => id));
    if (!selected.size) return;
    const affectsSelection = nodeChanges.some(({ node }) => {
      if (observedLayerIds.has(node.id)) return true;
      if (node.removed) return false;
      for (
        let current: BaseNode | null = node;
        current;
        current = current.parent
      ) {
        if (selected.has(current.id)) return true;
      }
      return false;
    });
    if (affectsSelection) queueSelectionRefresh();
  };
  observedPage.on("nodechange", onEdit);
  figma.on("currentpagechange", () => {
    observedPage.off("nodechange", onEdit);
    observedPage = figma.currentPage;
    observedPage.on("nodechange", onEdit);
  });

  figma.ui.onmessage = async (msg) => {
    if (!msg || typeof msg.type !== "string") return;
    console.log(
      "[DEBUG] figma.ui.onmessage",
      msg?.type ? `type=${msg.type}` : "unknown type",
    );

    if (msg.type === "ui-ready") {
      settingsReady ??= getUserSettings()
        .catch(() => {
          userPluginSettings = { ...defaultPluginSettings };
        })
        .then(() => {
          initialized = true;
          postSettingsChanged(userPluginSettings);
          queueSelectionRefresh();
        });
      await settingsReady;
      return;
    }
    if (!initialized) return;
    if (msg.type === "download-project") {
      if (isLoading || assetOperations) {
        figma.ui.postMessage({
          type: "project-download-error",
          error: "Please wait for the current conversion to finish.",
        });
        return;
      }

      if (isDownloadingProject) {
        figma.ui.postMessage({
          type: "project-download-error",
          error: "A project download is already in progress.",
        });
        return;
      }

      isDownloadingProject = true;
      try {
        await downloadProject(msg.format as DownloadProjectFormat);
      } catch (error) {
        console.error("Download project failed:", error);
        figma.ui.postMessage({
          type: "project-download-error",
          error: `Failed to create project: ${
            error instanceof Error ? error.message : "Unknown error occurred"
          }`,
        });
      } finally {
        isDownloadingProject = false;
        void refreshSelection();
      }
    } else if (
      msg.type === "export-single-asset" ||
      msg.type === "export-multiple-assets"
    ) {
      if (assetOperations || isDownloadingProject || isLoading) {
        figma.ui.postMessage({
          type: "asset-export-error",
          error: "Wait for the current conversion or export to finish.",
        });
        return;
      }
      assetOperations += 1;
      try {
        const single = msg.type === "export-single-asset";
        const items: unknown = single ? [msg] : msg.items;
        if (!Array.isArray(items) || !items.length || items.length > 4000)
          throw new Error("Select between 1 and 4,000 assets.");
        const files: Record<string, Uint8Array> = Object.create(null);
        let size = 0;
        for (const item of items) {
          if (
            !item ||
            typeof item.nodeId !== "string" ||
            !["PNG", "SVG"].includes(item.format)
          )
            throw new Error("Invalid asset request.");
          const scale = item.scale ?? 1;
          if (!Number.isInteger(scale) || scale < 1 || scale > 4)
            throw new Error("Asset scale must be between 1× and 4×.");
          const node = await figma.getNodeByIdAsync(item.nodeId);
          if (!node || node.type === "DOCUMENT" || node.type === "PAGE")
            throw new Error(`Asset ${item.nodeId} could not be found.`);
          const descriptor = downloadAssetDescriptor(node, item.format);
          const name =
            scale > 1 && item.format === "PNG"
              ? descriptor.name.replace(/\.png$/, `@${scale}x.png`)
              : descriptor.name;
          const bytes = await exportAsset(node, descriptor, scale);
          if (single) {
            postAssetDownload(
              bytes,
              name,
              item.format === "SVG" ? "image/svg+xml" : "image/png",
            );
            break;
          }
          size += bytes.byteLength;
          if (size > 25 * 1024 * 1024)
            throw new Error(
              "Asset selection exceeds 25 MB. Reduce the export scale or select fewer layers.",
            );
          files[name] = bytes;
        }
        if (!single)
          postAssetDownload(
            generateAssetZip(files),
            "exported-assets.zip",
            "application/zip",
          );
      } catch (error) {
        figma.ui.postMessage({
          type: "asset-export-error",
          error: errorText(error),
        });
      } finally {
        assetOperations -= 1;
        void refreshSelection();
      }
    } else if (msg.type === "pluginSettingWillChange") {
      const { key, value } = msg as SettingWillChangeMessage<unknown>;
      console.log(`[DEBUG] Setting changed: ${key} = ${value}`);
      if (
        !isKeyOfPluginSettings(key) ||
        typeof value !== typeof defaultPluginSettings[key]
      )
        return;
      userPluginSettings = { ...userPluginSettings, [key]: value };
      void figma.clientStorage
        .setAsync("userPluginSettings", userPluginSettings)
        .catch(console.error);
      queueSelectionRefresh();
    } else if (msg.type === "get-selection-json") {
      console.log("[DEBUG] get-selection-json message received");

      const nodes = figma.currentPage.selection;
      if (nodes.length === 0) {
        figma.ui.postMessage({
          type: "selection-json",
          data: { message: "No nodes selected" },
        });
        return;
      }
      const result: {
        json?: SceneNode[];
        oldConversion?: any;
        newConversion?: any;
      } = {};

      try {
        result.json = (await Promise.all(
          nodes.map(
            async (node) =>
              (
                (await node.exportAsync({
                  format: "JSON_REST_V1",
                })) as any
              ).document,
          ),
        )) as SceneNode[];
      } catch (error) {
        console.error("Error exporting JSON:", error);
      }

      try {
        const newNodes = await nodesToJSON(nodes, userPluginSettings);
        const removeParent = (node: any) => {
          if (node.parent) {
            delete node.parent;
          }
          if (node.children) {
            node.children.forEach(removeParent);
          }
        };
        newNodes.forEach(removeParent);
        result.newConversion = newNodes;
      } catch (error) {
        console.error("Error in new conversion:", error);
      }

      const nodeJson = result;

      console.log(
        "[DEBUG] Exported node JSON:",
        `jsonCount=${result.json?.length ?? 0}`,
        `newConversionCount=${result.newConversion?.length ?? 0}`,
      );

      // Send the JSON data back to the UI
      figma.ui.postMessage({
        type: "selection-json",
        data: nodeJson,
      });
    }
  };
};

const codegenMode = async () => {
  console.log("[DEBUG] codegenMode - Starting codegen mode initialization");
  // figma.showUI(__html__, { visible: false });
  await getUserSettings();

  figma.codegen.on(
    "generate",
    async ({ language, node }: CodegenEvent): Promise<CodegenResult[]> => {
      console.log(
        `[DEBUG] codegen.generate - Language: ${language}, Node: id=${node.id}, type=${node.type}`,
      );

      if (
        userPluginSettings.designCompiler &&
        ["html", "html_jsx", "tailwind", "tailwind_jsx"].includes(language)
      ) {
        const { document } = normalizeSelection([node]);
        const code = webGenerator({
          jsx: language.endsWith("_jsx"),
          tailwind: language.startsWith("tailwind"),
        }).render(document, {
          assetUrl: (asset) =>
            `${projectAssetDirectory(userPluginSettings.customImagePath)}/${asset.name}`,
        });
        return [{ title: "Design Compiler", code, language: "HTML" }];
      }

      const convertedSelection = await getConvertedSelectionForDownload(
        [node],
        { ...userPluginSettings, useOldPluginVersion2025: false },
      );
      console.log(
        "[DEBUG] codegen.generate - Converted selection count:",
        convertedSelection.length,
      );

      switch (language) {
        case "html":
          return [
            {
              title: "Code",
              code: (
                await htmlMain(
                  convertedSelection,
                  { ...userPluginSettings, htmlGenerationMode: "html" },
                  true,
                )
              ).html,
              language: "HTML",
            },
            {
              title: "Text Styles",
              code: htmlCodeGenTextStyles(userPluginSettings),
              language: "HTML",
            },
          ];
        case "html_jsx":
          return [
            {
              title: "Code",
              code: (
                await htmlMain(
                  convertedSelection,
                  { ...userPluginSettings, htmlGenerationMode: "jsx" },
                  true,
                )
              ).html,
              language: "HTML",
            },
            {
              title: "Text Styles",
              code: htmlCodeGenTextStyles(userPluginSettings),
              language: "HTML",
            },
          ];

        case "html_svelte":
          return [
            {
              title: "Code",
              code: (
                await htmlMain(
                  convertedSelection,
                  { ...userPluginSettings, htmlGenerationMode: "svelte" },
                  true,
                )
              ).html,
              language: "HTML",
            },
            {
              title: "Text Styles",
              code: htmlCodeGenTextStyles(userPluginSettings),
              language: "HTML",
            },
          ];

        case "html_styled_components":
          return [
            {
              title: "Code",
              code: (
                await htmlMain(
                  convertedSelection,
                  {
                    ...userPluginSettings,
                    htmlGenerationMode: "styled-components",
                  },
                  true,
                )
              ).html,
              language: "HTML",
            },
            {
              title: "Text Styles",
              code: htmlCodeGenTextStyles(userPluginSettings),
              language: "HTML",
            },
          ];

        case "tailwind":
        case "tailwind_jsx":
          return [
            {
              title: "Code",
              code: await tailwindMain(convertedSelection, {
                ...userPluginSettings,
                tailwindGenerationMode:
                  language === "tailwind_jsx" ? "jsx" : "html",
              }),
              language: "HTML",
            },
            // {
            //   title: "Style",
            //   code: tailwindMain(convertedSelection, defaultPluginSettings),
            //   language: "HTML",
            // },
            {
              title: "Tailwind Colors",
              code: (await retrieveGenericSolidUIColors("Tailwind"))
                .map((d) => {
                  let str = `${d.hex};`;
                  if (d.colorName !== d.hex) {
                    str += ` // ${d.colorName}`;
                  }
                  if (d.meta) {
                    str += ` (${d.meta})`;
                  }
                  return str;
                })
                .join("\n"),
              language: "JAVASCRIPT",
            },
            {
              title: "Text Styles",
              code: tailwindCodeGenTextStyles(),
              language: "HTML",
            },
          ];
        default:
          break;
      }

      const blocks: CodegenResult[] = [];
      return blocks;
    },
  );
};

switch (figma.mode) {
  case "default":
  case "inspect":
    console.log("[DEBUG] Starting plugin in", figma.mode, "mode");
    standardMode();
    break;
  case "codegen":
    console.log("[DEBUG] Starting plugin in codegen mode");
    codegenMode();
    break;
  default:
    console.log("[DEBUG] Unknown plugin mode:", figma.mode);
    break;
}
