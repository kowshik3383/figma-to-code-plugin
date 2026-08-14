import { PluginSettings } from "types";
import { htmlMain } from "../../html/htmlMain";
import { tailwindMain } from "../../tailwind/tailwindMain";

export const convertToCode = async (
  nodes: SceneNode[],
  settings: PluginSettings,
) => {
  switch (settings.framework) {
    case "Tailwind":
      return await tailwindMain(nodes, settings);
    case "HTML":
    default:
      return (await htmlMain(nodes, settings)).html;
  }
};
