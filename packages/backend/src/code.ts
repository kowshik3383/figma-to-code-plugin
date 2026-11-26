import {
  retrieveGenericLinearGradients,
  retrieveGenericSolidUIColors,
} from "./common/retrieveUI/retrieveColors";
import {
  addWarning,
  clearWarnings,
  warnings,
} from "./common/commonConversionWarnings";
import {
  postConversionComplete,
  postEmptyMessage,
  postError,
} from "./messaging";
import { DetectedAsset, PluginSettings } from "types";
import { nodeHasImageFill } from "./common/images";
import { visibleSelection } from "./compiler/assets";
import { runDesignCompiler, supportsCompiler } from "./compiler/session";
import { convertToCode } from "./common/retrieveUI/convertToCode";
import { generateHTMLPreview } from "./html/htmlMain";
import { oldConvertNodesToAltNodes } from "./altNodes/oldAltConversion";
import {
  getNodeByIdAsyncCalls,
  getNodeByIdAsyncTime,
  getStyledTextSegmentsCalls,
  getStyledTextSegmentsTime,
  nodesToJSON,
  processColorVariablesCalls,
  processColorVariablesTime,
  resetPerformanceCounters,
} from "./altNodes/jsonNodeConversion";

export const run = async (settings: PluginSettings, isCurrent = () => true) => {
  resetPerformanceCounters();
  clearWarnings();

  const selection = visibleSelection(figma.currentPage.selection);
  if (supportsCompiler(settings))
    return runDesignCompiler(selection, settings, isCurrent);

  if (selection.length === 0) {
    if (isCurrent()) postEmptyMessage();
    return;
  }

  const MAX_NODE_COUNT_PREVIEW = 1200;
  const MAX_NODE_COUNT_HARD = 4000;
  const countNodes = (nodes: ReadonlyArray<SceneNode>) => {
    let count = 0;
    const stack = [...nodes];
    while (stack.length > 0) {
      const node = stack.pop()!;
      count += 1;
      if ("children" in node && Array.isArray(node.children)) {
        for (const child of node.children) {
          stack.push(child);
        }
      }
    }
    return count;
  };

  const nodeCount = countNodes(selection);
  if (nodeCount > MAX_NODE_COUNT_HARD) {
    if (isCurrent())
      postError(
        `Selection too large (${nodeCount} nodes). Please select a smaller frame.`,
      );
    return;
  }
  const assets = detectAssetsInSelection(selection);
  try {
    await runCompatibility(
      selection,
      settings,
      assets,
      nodeCount,
      MAX_NODE_COUNT_PREVIEW,
      isCurrent,
    );
  } catch (error) {
    if (!isCurrent()) return;
    if (!assets.length) throw error;
    postConversionComplete({
      code: "// Code generation failed. You can still download assets below.",
      htmlPreview: { size: { width: 0, height: 0 }, content: "" },
      settings,
      colors: [],
      gradients: [],
      assets,
      warnings: [error instanceof Error ? error.message : String(error)],
    });
  }
};

async function runCompatibility(
  selection: readonly SceneNode[],
  settings: PluginSettings,
  assets: DetectedAsset[],
  nodeCount: number,
  previewLimit: number,
  isCurrent: () => boolean,
) {
  const { framework, useOldPluginVersion2025 } = settings;
  const skipHeavyUI = nodeCount > previewLimit;
  if (skipHeavyUI) {
    addWarning(
      `Large selection (${nodeCount} nodes). HTML preview and colors are disabled to avoid memory issues.`,
    );
  }

  // Timing with Date.now() instead of console.time
  const nodeToJSONStart = Date.now();

  const convertedSelection = (useOldPluginVersion2025
    ? oldConvertNodesToAltNodes(selection, null)
    : await nodesToJSON(selection, settings)) as unknown as SceneNode[];
  if (!isCurrent()) return;

  if (!convertedSelection.length) {
    if (assets.length)
      throw new Error("No layers were available for code generation.");
    postEmptyMessage();
    return;
  }

  const convertToCodeStart = Date.now();
  const code = await convertToCode(convertedSelection, settings);
  if (!isCurrent()) return;
  if (!code.trim() && assets.length)
    throw new Error("The selection produced no code.");
  console.log(
    `[benchmark] convertToCode: ${Date.now() - convertToCodeStart}ms`,
  );

  let htmlPreview = { size: { width: 0, height: 0 }, content: "" };
  let colors: Awaited<ReturnType<typeof retrieveGenericSolidUIColors>> = [];
  let gradients: Awaited<ReturnType<typeof retrieveGenericLinearGradients>> =
    [];

  if (!skipHeavyUI) {
    const generatePreviewStart = Date.now();
    htmlPreview = await generateHTMLPreview(convertedSelection, settings);
    console.log(
      `[benchmark] generateHTMLPreview: ${Date.now() - generatePreviewStart}ms`,
    );

    const colorPanelStart = Date.now();
    colors = await retrieveGenericSolidUIColors(framework);
    gradients = await retrieveGenericLinearGradients(framework);
    console.log(
      `[benchmark] color and gradient panel: ${Date.now() - colorPanelStart}ms`,
    );
  }
  console.log(
    `[benchmark] total generation time: ${Date.now() - nodeToJSONStart}ms`,
  );

  // Log performance statistics
  console.log(
    `[benchmark] getNodeByIdAsync: ${getNodeByIdAsyncTime}ms (${getNodeByIdAsyncCalls} calls, avg: ${(getNodeByIdAsyncTime / getNodeByIdAsyncCalls || 1).toFixed(2)}ms)`,
  );
  console.log(
    `[benchmark] getStyledTextSegments: ${getStyledTextSegmentsTime}ms (${getStyledTextSegmentsCalls} calls, avg: ${
      getStyledTextSegmentsCalls > 0
        ? (getStyledTextSegmentsTime / getStyledTextSegmentsCalls).toFixed(2)
        : 0
    }ms)`,
  );
  console.log(
    `[benchmark] processColorVariables: ${processColorVariablesTime}ms (${processColorVariablesCalls} calls, avg: ${
      processColorVariablesCalls > 0
        ? (processColorVariablesTime / processColorVariablesCalls).toFixed(2)
        : 0
    }ms)`,
  );

  if (!isCurrent()) return;
  const supplemental = detectAssetsInSelection(convertedSelection);
  const known = new Set(assets.map(({ id }) => id));
  assets.push(...supplemental.filter(({ id }) => !known.has(id)));
  const totalTimeMs = Date.now() - nodeToJSONStart;
  const parseTimeMs = convertToCodeStart - nodeToJSONStart;
  const codegenTimeMs = Date.now() - convertToCodeStart;

  postConversionComplete({
    code,
    htmlPreview,
    colors,
    gradients,
    settings,
    warnings: [...warnings],
    assets,
    metrics: {
      nodeCount,
      parseTimeMs,
      codegenTimeMs,
      totalTimeMs,
    },
  });
}

export const detectAssetsInSelection = (
  nodes: readonly SceneNode[],
): DetectedAsset[] => {
  const assets: DetectedAsset[] = [];
  const seenIds = new Set<string>();

  const isVectorType = (type: string) =>
    ["VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON", "LINE"].includes(type);

  const visit = (node: SceneNode) => {
    if (node.visible === false || ("isMask" in node && node.isMask)) return;

    if (!seenIds.has(node.id)) {
      if (nodeHasImageFill(node)) {
        seenIds.add(node.id);
        assets.push({
          id: node.id,
          name: node.name || "image",
          type: "image",
          format: "PNG",
          width: Math.round(node.width || 0),
          height: Math.round(node.height || 0),
        });
      } else if (
        isVectorType(node.type) ||
        ("canBeFlattened" in node && (node as any).canBeFlattened)
      ) {
        seenIds.add(node.id);
        assets.push({
          id: node.id,
          name: node.name || "icon",
          type: "svg",
          format: "SVG",
          width: Math.round(node.width || 0),
          height: Math.round(node.height || 0),
        });
      }
    }

    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };

  for (const node of nodes) {
    visit(node);
  }

  return assets;
};
