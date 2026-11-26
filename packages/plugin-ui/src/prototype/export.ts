import { contractFor, jsonForScript, type Prototype } from "./model";
import { mountPrototype } from "./runtime";

export function inspectLayers(html: string) {
  const root = new DOMParser().parseFromString(html, "text/html");
  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-figma-layer]"),
    (element) => ({
      id: element.dataset.figmaLayer ?? "",
      name: element.dataset.figmaName || element.tagName,
      text: element.childElementCount === 0 && element.tagName !== "IMG",
      parent:
        element.parentElement?.closest<HTMLElement>("[data-figma-layer]")
          ?.dataset.figmaLayer,
      value:
        element.childElementCount === 0
          ? (element.textContent?.trim() ?? "")
          : "",
    }),
  );
}

export type Layer = ReturnType<typeof inspectLayers>[number];

export function buildPrototype(html: string, model: Prototype): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  const layerEntries = Array.from(
    document.querySelectorAll<HTMLElement>("[data-figma-layer]"),
    (node) => [node.dataset.figmaLayer ?? "", node] as const,
  );
  const layers = new Map(layerEntries);
  const component = model.component;
  const source = component && layers.get(component.source);
  let activeComponent = component;
  if (component && source) {
    const original = new Set(
      component.replace
        .map((id) => layers.get(id))
        .filter((node) => node?.parentElement === source.parentElement),
    );
    original.add(source);
    const template = document.createElement("template");
    template.id = "prototype-template";
    template.dataset.component = component.name;
    template.content.append(source.cloneNode(true));
    const placeholder = document.createElement("span");
    placeholder.id = "prototype-items";
    placeholder.hidden = true;
    source.before(placeholder);
    for (const item of original) item?.remove();
    document.body.append(template);
  } else activeComponent = undefined;

  const style =
    document.querySelector("style") ??
    document.head.appendChild(document.createElement("style"));
  style.textContent += `
  [hidden] { display: none !important; }
  [role="radio"], [role="button"] { cursor: pointer; }
  [role="radio"][aria-checked="true"], [data-selected-state="true"]:not([role="radio"]) { outline: 2px solid #2563eb; outline-offset: -2px; }
  [role="radio"]:focus-visible, [role="button"]:focus-visible { outline: 3px solid #0891b2; outline-offset: 3px; }
  [data-prototype-overflow] { outline: 2px dashed #ea580c !important; }
  #prototype-status, #prototype-layout, #prototype-gallery { margin: 16px; padding: 12px; background: #f0f6ff; color: #14253d; border-radius: 8px; font: 14px system-ui; }
  #prototype-gallery iframe { display: block; width: 100%; height: 70vh; margin-top: 12px; background: white; border: 0; }
  `;

  if (model.interactions.some((action) => action.kind === "continue")) {
    const note = document.createElement("output");
    note.id = "prototype-status";
    note.setAttribute("aria-live", "polite");
    note.hidden = true;
    document.body.append(note);
  }
  if (model.stress !== "none") {
    const note = document.createElement("output");
    note.id = "prototype-layout";
    note.setAttribute("aria-live", "polite");
    document.body.prepend(note);
  }
  if (model.gallery.length) {
    const gallery = document.createElement("section");
    gallery.id = "prototype-gallery";
    const label = document.createElement("label");
    label.textContent = "Component state ";
    label.append(document.createElement("select"));
    const frame = document.createElement("iframe");
    frame.title = "Component state preview";
    frame.setAttribute("sandbox", "");
    gallery.append(label, frame);
    document.body.append(gallery);
  }
  const manifest = document.createElement("script");
  manifest.type = "application/json";
  manifest.id = "prototype-contract";
  manifest.textContent = jsonForScript(
    contractFor(model, new Set(layers.keys())),
  );
  document.body.append(manifest);
  const script = document.createElement("script");
  script.textContent = `(${mountPrototype.toString()})(${jsonForScript({ ...model, component: activeComponent })});`;
  document.body.append(script);
  return "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
}

export function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
