import { postConversionStart } from "../messaging";

let pendingExports = 0;

export async function exportAsyncProxy(
  node: SceneNode,
  settings: ExportSettings,
): Promise<Uint8Array> {
  const first = pendingExports++ === 0;
  try {
    if (first) {
      postConversionStart();
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    const source = await figma.getNodeByIdAsync(node.id);
    if (!source || source.type === "DOCUMENT" || source.type === "PAGE") {
      throw new Error(`Layer ${node.id} is no longer available to export.`);
    }
    return await source.exportAsync(settings);
  } finally {
    pendingExports -= 1;
  }
}
