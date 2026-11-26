import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPrototype,
  inspectLayers,
} from "../../../plugin-ui/src/prototype/export";
import {
  compareContracts,
  contractFor,
  emptyPrototype,
  parseBaseline,
  parseRows,
  type Prototype,
} from "../../../plugin-ui/src/prototype/model";

const html = `<!doctype html><html><head><style>p { color: navy; }</style></head><body>
<main data-figma-layer="screen" data-figma-name="Pricing">
  <div data-figma-layer="plans" data-figma-name="Plans">
    <article data-figma-layer="annual"><p data-figma-layer="annual-title">Annual</p><p data-figma-layer="annual-price">₹3599/year</p></article>
    <article data-figma-layer="monthly"><p data-figma-layer="monthly-title">Monthly</p></article>
  </div>
  <div data-figma-layer="continue">Continue</div>
  <div data-figma-layer="toggle">Details</div>
  <aside data-figma-layer="details"><button data-figma-layer="close">Close</button></aside>
</main>
</body></html>`;

const configuration: Prototype = {
  ...emptyPrototype,
  group: "plans",
  choices: [
    { layer: "annual", value: "annual" },
    { layer: "monthly", value: "monthly" },
  ],
  selected: "annual",
  interactions: [
    { id: "checkout", trigger: "continue", kind: "continue" },
    { id: "details", trigger: "toggle", target: "details", kind: "toggle" },
    { id: "dismiss", trigger: "close", target: "details", kind: "close" },
  ],
  component: {
    name: "PlanCard",
    source: "annual",
    replace: ["monthly"],
    fields: [
      { field: "title", layer: "annual-title", required: true },
      { field: "price", layer: "annual-price", required: false },
    ],
  },
  rows: [
    { title: "Annual", price: "₹3599/year" },
    { title: "Monthly", price: "₹599/month" },
  ],
};

describe("standalone prototype", () => {
  const windows: JSDOM[] = [];
  const dom = (markup: string) => {
    const instance = new JSDOM(markup, {
      runScripts: "dangerously",
      pretendToBeVisual: true,
    });
    windows.push(instance);
    return instance.window;
  };
  beforeEach(() => {
    const blank = dom("");
    vi.stubGlobal("DOMParser", blank.DOMParser);
  });
  afterEach(() => {
    for (const instance of windows.splice(0)) instance.window.close();
    vi.unstubAllGlobals();
  });

  it("binds repeated data, retains source choice identities and emits the checkout hook", () => {
    const window = dom(buildPrototype(html, configuration));
    const doc = window.document;
    expect(doc.querySelector("template")?.dataset.component).toBe("PlanCard");
    const [annual, monthly] = Array.from(
      doc.querySelectorAll<HTMLElement>('[role="radio"]'),
    );
    expect(annual.getAttribute("aria-checked")).toBe("true");
    expect(monthly.textContent).toContain("₹599/month");
    annual.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(monthly.getAttribute("aria-checked")).toBe("true");
    expect(doc.activeElement).toBe(monthly);
    const checkout = vi.fn<(event: Event) => void>();
    window.addEventListener("figma-prototype:continue", checkout);
    doc.querySelector<HTMLElement>('[data-figma-layer="continue"]')?.click();
    expect(doc.querySelector("#prototype-status")?.textContent).toContain(
      "Selected plan: monthly",
    );
    expect(checkout).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { selectedPlan: "monthly", actionId: "checkout" },
      }),
    );
  });

  it("toggles a panel and lets an internal close action restore focus", () => {
    const { document } = dom(buildPrototype(html, configuration));
    const toggle = document.querySelector<HTMLElement>(
      '[data-figma-layer="toggle"]',
    )!;
    const details = document.querySelector<HTMLElement>(
      '[data-figma-layer="details"]',
    )!;
    toggle.click();
    expect(details.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    toggle.click();
    expect(details.hidden).toBe(false);
    details.querySelector("button")!.click();
    expect(details.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
  });

  it("captures named states in an isolated gallery and applies content stress scenarios", () => {
    const gallery = [
      { name: "Loading", html },
      { name: "Disabled", html: html.replace("Continue", "Disabled") },
    ];
    const { document, Event } = dom(
      buildPrototype(html, { ...configuration, gallery, stress: "ten" }),
    );
    const picker = document.querySelector(
      "#prototype-gallery select",
    ) as HTMLSelectElement;
    expect(picker.options).toHaveLength(2);
    picker.selectedIndex = 1;
    picker.dispatchEvent(new Event("change"));
    expect(
      document
        .querySelector("#prototype-gallery iframe")
        ?.getAttribute("srcdoc"),
    ).toContain("Disabled");
    expect(
      document.querySelectorAll('[data-figma-layer="plans"] > article'),
    ).toHaveLength(10);
    const empty = dom(
      buildPrototype(html, { ...configuration, stress: "empty" }),
    );
    expect(
      empty.document.querySelectorAll('[data-figma-layer="plans"] > article'),
    ).toHaveLength(0);
    const rtl = dom(buildPrototype(html, { ...configuration, stress: "rtl" }));
    expect(rtl.document.documentElement.dir).toBe("rtl");
  });

  it("escapes script delimiters in data and inserts field content as text", () => {
    const payload = "</script><script>window.injected = true;</script>";
    const output = buildPrototype(html, {
      ...configuration,
      rows: [{ title: payload }],
    });
    const { document } = dom(output);
    expect(output).not.toContain(payload);
    expect(document.querySelector("article")?.textContent).toContain(payload);
    expect(document.querySelectorAll("script")).toHaveLength(2);
  });

  it("exports a schema and detects removed fields, actions and new states", () => {
    const ids = new Set(inspectLayers(html).map(({ id }) => id));
    const old = contractFor(configuration, ids);
    expect(old.dataSchema.items.required).toEqual(["title"]);
    expect(parseBaseline(JSON.stringify(old)).events[0].name).toBe(
      "figma-prototype:continue",
    );
    ids.delete("continue");
    ids.delete("annual-price");
    const current = contractFor(
      { ...configuration, gallery: [{ name: "Disabled", html }] },
      ids,
    );
    expect(compareContracts(old, current)).toEqual([
      "Field removed or renamed: price",
      "Action removed or moved: figma-prototype:continue (continue)",
      "New state: Disabled",
    ]);
    expect(() => parseRows('[{"unexpected":{"nested":true}}]')).toThrow(
      /Fields must/,
    );
    expect(() => parseBaseline('{"events":2}')).toThrow(
      /valid integration contract/,
    );
  });
});
