import type { Prototype } from "./model";

export function mountPrototype(model: Prototype) {
  const layers = new Map(
    Array.from(
      document.querySelectorAll<HTMLElement>("[data-figma-layer]"),
      (node) => [node.dataset.figmaLayer ?? "", node],
    ),
  );
  const layer = (id?: string) => (id ? layers.get(id) : undefined);
  if (model.component) {
    const template = document.querySelector<HTMLTemplateElement>(
      "#prototype-template",
    );
    const target = document.querySelector<HTMLElement>("#prototype-items");
    const sourceRows = model.rows;
    const rows =
      model.stress === "empty"
        ? []
        : model.stress === "ten" && sourceRows.length
          ? Array.from(
              { length: 10 },
              (_, index) => sourceRows[index % sourceRows.length],
            )
          : sourceRows;
    if (target && template) {
      const fragment = document.createDocumentFragment();
      const originalIds = [model.component.source, ...model.component.replace];
      for (const [index, row] of rows.entries()) {
        const instance = template.content.cloneNode(true) as DocumentFragment;
        const values = new Map(
          Array.from(
            instance.querySelectorAll<HTMLElement>("[data-figma-layer]"),
            (node) => [node.dataset.figmaLayer, node],
          ),
        );
        for (const field of model.component.fields) {
          const element = values.get(field.layer);
          if (element && Object.prototype.hasOwnProperty.call(row, field.field))
            element.textContent = String(row[field.field] ?? "");
        }
        const instanceRoot = instance.firstElementChild;
        const originalId = originalIds[index];
        if (instanceRoot instanceof HTMLElement) {
          if (originalId) layers.set(originalId, instanceRoot);
          if (typeof row.selectedState === "boolean")
            instanceRoot.dataset.selectedState = String(row.selectedState);
        }
        if (index === 0) {
          for (const [id, element] of values) if (id) layers.set(id, element);
        }
        for (const element of values.values()) {
          delete element.dataset.figmaLayer;
          element.removeAttribute("id");
        }
        fragment.append(instance);
      }
      target.replaceWith(fragment);
    }
  }

  const options = model.choices.flatMap(({ layer: id, value }) => {
    const element = layer(id);
    return element?.isConnected ? [{ element, value }] : [];
  });
  const group = layer(model.group);
  const validGroup =
    group &&
    options.length >= 2 &&
    options.every(
      ({ element }) => element !== group && group.contains(element),
    );
  let selectedPlan = "";
  if (validGroup) {
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "Choose an option");
    const select = (value: string, focus = false) => {
      selectedPlan = value;
      for (const option of options) {
        const selected = option.value === value;
        option.element.setAttribute("aria-checked", String(selected));
        option.element.tabIndex = selected ? 0 : -1;
        if (selected && focus) option.element.focus();
      }
    };
    options.forEach(({ element, value }, index) => {
      element.setAttribute("role", "radio");
      element.addEventListener("click", () => select(value));
      element.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          select(value, true);
          return;
        }
        const offset = ["ArrowRight", "ArrowDown"].includes(event.key)
          ? 1
          : ["ArrowLeft", "ArrowUp"].includes(event.key)
            ? -1
            : 0;
        if (!offset && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? options.length - 1
              : (index + offset + options.length) % options.length;
        select(options[next].value, true);
      });
    });
    select(
      options.some(({ value }) => value === model.selected)
        ? model.selected
        : options[0].value,
    );
  }

  const demoStatus = document.querySelector<HTMLElement>("#prototype-status");
  for (const action of model.interactions) {
    const trigger = layer(action.trigger);
    const target = layer(action.target);
    if (
      !trigger?.isConnected ||
      (action.kind !== "continue" &&
        (!target?.isConnected || target === trigger))
    )
      continue;
    if (!trigger.matches("button, a[href], input")) {
      trigger.setAttribute("role", "button");
      trigger.tabIndex = 0;
      trigger.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          trigger.click();
        }
      });
    }
    if (target) {
      target.id ||= "prototype-panel-" + action.id;
      trigger.setAttribute("aria-controls", target.id);
      trigger.setAttribute("aria-expanded", String(!target.hidden));
    }
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (action.kind === "continue") {
        if (demoStatus) {
          demoStatus.hidden = false;
          demoStatus.textContent = selectedPlan
            ? "Demo checkout · Selected plan: " + selectedPlan
            : "Demo action triggered";
        }
        window.dispatchEvent(
          new CustomEvent("figma-prototype:continue", {
            detail: { selectedPlan, actionId: action.id },
          }),
        );
      } else if (target) {
        target.hidden =
          action.kind === "close" ||
          (action.kind === "toggle" && !target.hidden);
        for (const control of document.querySelectorAll<HTMLElement>(
          "[aria-controls]",
        )) {
          if (control.getAttribute("aria-controls") === target.id) {
            control.setAttribute("aria-expanded", String(!target.hidden));
            if (
              target.hidden &&
              target.contains(trigger) &&
              !target.contains(control)
            )
              control.focus();
          }
        }
      }
    });
  }

  if (model.stress === "rtl") document.documentElement.dir = "rtl";
  if (model.stress === "missing-images") {
    for (const image of document.querySelectorAll("img")) {
      image.removeAttribute("src");
      image.alt ||= "Image unavailable";
    }
    for (const node of document.querySelectorAll<HTMLElement>(
      "[data-figma-layer]",
    ))
      node.style.setProperty("background-image", "none", "important");
  }
  if (["large-text", "long-text", "large-prices"].includes(model.stress)) {
    for (const node of document.querySelectorAll<HTMLElement>(
      "main :is(p, span, h1, h2, h3), body > :is(p, span, h1, h2, h3), [data-figma-name]:is(p, span, h1, h2, h3)",
    )) {
      if (model.stress === "large-text")
        node.style.fontSize =
          parseFloat(getComputedStyle(node).fontSize) * 1.5 + "px";
      if (model.stress === "long-text")
        node.textContent =
          (node.textContent ?? "") +
          " — Zusätzliche Informationen zum ausgewählten Angebot";
      if (
        model.stress === "large-prices" &&
        /[₹$£€]|\bprice\b/i.test(node.textContent ?? "")
      )
        node.textContent = "₹1,29,999/year";
    }
  }
  if (model.stress !== "none") {
    const audit = () => {
      const status = document.querySelector<HTMLElement>("#prototype-layout");
      if (!status) return;
      const findings: string[] = [];
      for (const node of document.querySelectorAll<HTMLElement>(
        "[data-figma-layer], [data-figma-name]",
      )) {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (
          rect.left < -1 ||
          rect.right > document.documentElement.clientWidth + 1 ||
          (!node.children.length &&
            (node.scrollWidth > node.clientWidth + 1 ||
              node.scrollHeight > node.clientHeight + 1))
        ) {
          node.dataset.prototypeOverflow = "";
          findings.push(
            node.dataset.figmaName || node.dataset.figmaLayer || node.tagName,
          );
        } else delete node.dataset.prototypeOverflow;
      }
      status.textContent = findings.length
        ? "Layout warnings: " + findings.slice(0, 8).join(", ")
        : "No horizontal or text overflow detected.";
    };
    requestAnimationFrame(audit);
    window.addEventListener("resize", audit);
    if (document.fonts) void document.fonts.ready.then(audit);
  }

  const gallery = document.querySelector<HTMLElement>("#prototype-gallery");
  if (gallery && model.gallery.length) {
    const frame = gallery.querySelector("iframe");
    const picker = gallery.querySelector("select");
    if (frame && picker) {
      for (const state of model.gallery) picker.add(new Option(state.name));
      const show = () => {
        const state = model.gallery[picker.selectedIndex];
        if (state) frame.srcdoc = state.html;
      };
      picker.addEventListener("change", show);
      show();
    }
  }
}
