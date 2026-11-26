import { useMemo, useState, type ReactNode } from "react";
import {
  Boxes,
  Download,
  FlaskConical,
  Layers2,
  MousePointer2,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  buildPrototype,
  downloadText,
  inspectLayers,
  type Layer,
} from "../prototype/export";
import {
  compareContracts,
  contractFor,
  emptyPrototype,
  parseRows,
  parseBaseline,
  type Binding,
  type ContractBaseline,
  type Interaction,
  type Prototype,
  type StressCase,
} from "../prototype/model";

const control =
  "w-full min-w-0 rounded-md border border-border bg-background px-2.5 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";
const stressCases: [StressCase, string][] = [
  ["none", "Original content"],
  ["long-text", "Long translations"],
  ["rtl", "Right-to-left layout"],
  ["large-text", "150% text"],
  ["missing-images", "Missing images"],
  ["large-prices", "Large prices"],
  ["empty", "Zero records"],
  ["ten", "Ten records"],
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-medium">
      {label}
      {children}
    </label>
  );
}

function LayerPicker({
  label,
  layers,
  value,
  onChange,
}: {
  label: string;
  layers: Layer[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        className={control}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">Select a layer</option>
        {layers.map(({ id, name }) => (
          <option key={id} value={id}>
            {name} · {id}
          </option>
        ))}
      </select>
    </Field>
  );
}

function suggestedField(layer: Layer, index: number): string {
  if (/[₹$£€]|price|cost|amount/i.test(layer.name + " " + layer.value))
    return "price";
  if (/badge|save|discount/i.test(layer.name + " " + layer.value))
    return "badge";
  if (/selected|state/i.test(layer.name)) return "selectedState";
  if (/period|billing|month|year/i.test(layer.name)) return "billingPeriod";
  if (index === 0 || /title|heading/i.test(layer.name)) return "title";
  return (
    layer.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "text"
  );
}

export default function PrototypePanel({
  html,
  active,
  onEnable,
}: {
  html?: string;
  active: boolean;
  onEnable: () => void;
}) {
  const [tab, setTab] = useState<"actions" | "data" | "review">("actions");
  const [model, setModel] = useState<Prototype>(emptyPrototype);
  const [draftRows, setDraftRows] = useState("[]");
  const [choiceLayer, setChoiceLayer] = useState("");
  const [choiceValue, setChoiceValue] = useState("");
  const [trigger, setTrigger] = useState("");
  const [target, setTarget] = useState("");
  const [kind, setKind] = useState<Interaction["kind"]>("continue");
  const [source, setSource] = useState("");
  const [replacement, setReplacement] = useState("");
  const [bindingField, setBindingField] = useState("");
  const [bindingLayer, setBindingLayer] = useState("");
  const [stateName, setStateName] = useState("");
  const [baseline, setBaseline] = useState<ContractBaseline>();
  const [notice, setNotice] = useState("");
  const [width, setWidth] = useState("375");
  const layers = useMemo(
    () => (active && html ? inspectLayers(html) : []),
    [active, html],
  );
  const ids = useMemo(() => new Set(layers.map((layer) => layer.id)), [layers]);
  const contract = useMemo(() => contractFor(model, ids), [model, ids]);
  const changes = baseline ? compareContracts(baseline, contract) : [];
  const update = (patch: Partial<Prototype>) => {
    setNotice("");
    setModel((current) => ({ ...current, ...patch }));
  };
  const preview = useMemo(
    () => (html && layers.length ? buildPrototype(html, model) : ""),
    [html, layers, model],
  );
  const childrenOf = (root: string) => {
    const descendants = new Set([root]);
    return layers.filter((layer) => {
      if (!layer.parent || !descendants.has(layer.parent)) return false;
      descendants.add(layer.id);
      return layer.text && layer.value;
    });
  };
  const suggest = () => {
    const original = layers.find((layer) => layer.id === source);
    if (!original) return;
    const chosen = layers.find(
      (layer) =>
        layer.id === replacement &&
        layer.parent === original.parent &&
        layer.id !== source,
    );
    const text = childrenOf(source);
    if (!text.length) {
      setNotice("Choose a component layer with text children.");
      return;
    }
    const fields: Binding[] = [];
    for (const [index, layer] of text.entries()) {
      const base = suggestedField(layer, index);
      const field = fields.some((entry) => entry.field === base)
        ? `${base}_${index + 1}`
        : base;
      fields.push({ field, layer: layer.id, required: index === 0 });
    }
    const rows = [source, ...(chosen ? [chosen.id] : [])].map((root) => {
      const values = childrenOf(root);
      return Object.fromEntries(
        fields.map(({ field }, index) => [field, values[index]?.value ?? ""]),
      );
    });
    setDraftRows(JSON.stringify(rows, null, 2));
    update({
      component: {
        name:
          original.name.replace(/[^a-zA-Z0-9]+/g, " ").trim() || "Component",
        source,
        replace: chosen ? [chosen.id] : [],
        fields,
      },
      rows,
    });
  };

  if (!active) return null;

  if (!html || !layers.length)
    return (
      <section className="grid gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Prototype</h2>
        <p className="text-xs text-muted-foreground">
          Select a Figma frame and enable Single HTML to configure interactions,
          bind data, and preview a standalone demo.
        </p>
        <Button onClick={onEnable} size="sm">
          Use Single HTML
        </Button>
      </section>
    );

  const discarded = model.interactions.filter(
    (action) =>
      !ids.has(action.trigger) || (action.target && !ids.has(action.target)),
  );
  const warning = discarded.length
    ? `${discarded.length} action(s) refer to layers outside this selection.`
    : model.component && !ids.has(model.component.source)
      ? "The component template is outside this selection."
      : "";
  const groupContains = (id: string) => {
    for (
      let item = layers.find((layer) => layer.id === id);
      item?.parent;
      item = layers.find((layer) => layer.id === item?.parent)
    ) {
      if (item.parent === model.group) return true;
    }
    return false;
  };
  return (
    <div className="grid gap-3">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <header className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
          <span className="text-xs font-semibold">Interactive preview</span>
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            aria-label="Preview width"
            value={width}
            onChange={(event) => setWidth(event.currentTarget.value)}
          >
            <option value="320">320 px</option>
            <option value="375">375 px</option>
            <option value="430">430 px</option>
            <option value="100%">Available width</option>
          </select>
        </header>
        <div className="overflow-x-auto bg-muted p-2">
          <iframe
            title="Interactive prototype preview"
            sandbox="allow-scripts"
            className="mx-auto block h-72 rounded-lg border border-border bg-white"
            style={{ width: width === "100%" ? width : Number(width) }}
            srcDoc={preview.replace(
              "<head>",
              "<head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src about:\">",
            )}
          />
        </div>
      </section>
      <nav
        className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-1"
        aria-label="Prototype tools"
      >
        {(
          [
            ["actions", "Actions", MousePointer2],
            ["data", "Components", Boxes],
            ["review", "Review", FlaskConical],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            className={`flex items-center justify-center gap-1.5 rounded-md px-1 py-2 text-xs font-medium ${tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-background"}`}
            onClick={() => {
              setNotice("");
              setTab(id);
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>
      {(notice || warning) && (
        <output className="rounded-md border border-border bg-muted p-2 text-xs">
          {notice || warning}
        </output>
      )}
      <section className="grid gap-3 rounded-xl border border-border bg-card p-3">
        {tab === "actions" && (
          <>
            <h2 className="text-sm font-semibold">Single choice</h2>
            <LayerPicker
              label="Group layer"
              value={model.group}
              layers={layers.filter((layer) => !layer.text)}
              onChange={(group) => update({ group, choices: [], selected: "" })}
            />
            <LayerPicker
              label="Option layer"
              value={choiceLayer}
              layers={layers.filter((layer) => groupContains(layer.id))}
              onChange={setChoiceLayer}
            />
            <Field label="Option value">
              <input
                className={control}
                value={choiceValue}
                onChange={(event) => setChoiceValue(event.currentTarget.value)}
                placeholder="annual"
              />
            </Field>
            <Button
              size="sm"
              variant="outline"
              disabled={
                !choiceLayer ||
                !groupContains(choiceLayer) ||
                !choiceValue.trim() ||
                model.choices.some(
                  (choice) =>
                    choice.layer === choiceLayer ||
                    choice.value === choiceValue.trim(),
                )
              }
              onClick={() => {
                update({
                  choices: [
                    ...model.choices,
                    { layer: choiceLayer, value: choiceValue.trim() },
                  ],
                });
                setChoiceValue("");
                setChoiceLayer("");
              }}
            >
              Add option
            </Button>
            {model.choices.map((choice) => (
              <div
                key={choice.layer}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="default-choice"
                    checked={
                      (model.selected || model.choices[0]?.value) ===
                      choice.value
                    }
                    onChange={() => update({ selected: choice.value })}
                  />
                  {choice.value}
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    update({
                      choices: model.choices.filter(
                        ({ layer }) => layer !== choice.layer,
                      ),
                      selected:
                        model.selected === choice.value ? "" : model.selected,
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <h2 className="border-t border-border pt-3 text-sm font-semibold">
              Actions
            </h2>
            <LayerPicker
              label="Trigger layer"
              layers={layers.filter(
                ({ id }) =>
                  id !== model.group &&
                  !model.choices.some((choice) => choice.layer === id) &&
                  !model.interactions.some((action) => action.trigger === id),
              )}
              value={trigger}
              onChange={setTrigger}
            />
            <Field label="Behavior">
              <select
                value={kind}
                className={control}
                onChange={(event) =>
                  setKind(event.currentTarget.value as Interaction["kind"])
                }
              >
                <option value="continue">Continue to demo summary</option>
                <option value="toggle">Toggle panel visibility</option>
                <option value="open">Show panel</option>
                <option value="close">Hide panel</option>
              </select>
            </Field>
            {kind !== "continue" && (
              <LayerPicker
                label="Target panel"
                layers={layers.filter(({ id }) => id !== trigger)}
                value={target}
                onChange={setTarget}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={
                !ids.has(trigger) || (kind !== "continue" && !ids.has(target))
              }
              onClick={() => {
                update({
                  interactions: [
                    ...model.interactions,
                    {
                      id:
                        trigger.replace(/[^\w-]/g, "-") +
                        "-" +
                        model.interactions.length,
                      kind,
                      trigger,
                      target: kind === "continue" ? undefined : target,
                    },
                  ],
                });
                setTrigger("");
              }}
            >
              Add action
            </Button>
            {model.interactions.map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span>
                  {layers.find(({ id }) => id === action.trigger)?.name ||
                    action.trigger}{" "}
                  · {action.kind}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update({
                      interactions: model.interactions.filter(
                        ({ id }) => id !== action.id,
                      ),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </>
        )}
        {tab === "data" && (
          <>
            <h2 className="text-sm font-semibold">Reusable component</h2>
            <LayerPicker
              label="Template layer"
              layers={layers.filter((layer) => !layer.text)}
              value={source}
              onChange={setSource}
            />
            <LayerPicker
              label="Replace matching sibling"
              layers={layers.filter(
                (layer) =>
                  layer.id !== source &&
                  !layer.text &&
                  layer.parent ===
                    layers.find(({ id }) => id === source)?.parent,
              )}
              value={replacement}
              onChange={setReplacement}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!ids.has(source)}
              onClick={suggest}
            >
              Suggest fields and records
            </Button>
            {model.component && (
              <>
                <Field label="Component name">
                  <input
                    className={control}
                    value={model.component.name}
                    onChange={(event) =>
                      model.component &&
                      update({
                        component: {
                          ...model.component,
                          name: event.currentTarget.value,
                        },
                      })
                    }
                  />
                </Field>
                {model.component.fields.map((binding, index) => (
                  <div
                    key={binding.layer + index}
                    className="flex items-center gap-2"
                  >
                    <input
                      aria-label={`Field name for ${binding.layer}`}
                      className={control}
                      value={binding.field}
                      onChange={(event) =>
                        model.component &&
                        update({
                          component: {
                            ...model.component,
                            fields: model.component.fields.map((field, i) =>
                              i === index
                                ? { ...field, field: event.currentTarget.value }
                                : field,
                            ),
                          },
                        })
                      }
                    />
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={binding.required}
                        onChange={(event) =>
                          model.component &&
                          update({
                            component: {
                              ...model.component,
                              fields: model.component.fields.map((field, i) =>
                                i === index
                                  ? {
                                      ...field,
                                      required: event.currentTarget.checked,
                                    }
                                  : field,
                              ),
                            },
                          })
                        }
                      />
                      Required
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        model.component &&
                        update({
                          component: {
                            ...model.component,
                            fields: model.component.fields.filter(
                              (_, i) => i !== index,
                            ),
                          },
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <LayerPicker
                  label="Text layer to bind"
                  layers={childrenOf(model.component.source)}
                  value={bindingLayer}
                  onChange={setBindingLayer}
                />
                <Field label="JSON field">
                  <input
                    className={control}
                    value={bindingField}
                    onChange={(event) =>
                      setBindingField(event.currentTarget.value)
                    }
                  />
                </Field>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    !bindingField.trim() ||
                    !bindingLayer ||
                    model.component.fields.some(
                      (field) =>
                        field.field === bindingField.trim() ||
                        field.layer === bindingLayer,
                    )
                  }
                  onClick={() => {
                    if (!model.component) return;
                    update({
                      component: {
                        ...model.component,
                        fields: [
                          ...model.component.fields,
                          {
                            field: bindingField.trim(),
                            layer: bindingLayer,
                            required: false,
                          },
                        ],
                      },
                    });
                    setBindingField("");
                    setBindingLayer("");
                  }}
                >
                  Bind field
                </Button>
                <Field label="Sample records (JSON)">
                  <textarea
                    rows={5}
                    className={control + " font-mono"}
                    value={draftRows}
                    onChange={(event) =>
                      setDraftRows(event.currentTarget.value)
                    }
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      try {
                        const rows = parseRows(draftRows);
                        const missing = model.component?.fields.find(
                          ({ field, required }) =>
                            required &&
                            rows.some(
                              (row) =>
                                !Object.prototype.hasOwnProperty.call(
                                  row,
                                  field,
                                ),
                            ),
                        );
                        if (missing)
                          throw new Error(
                            `Records must include ${missing.field}.`,
                          );
                        update({ rows });
                      } catch (error) {
                        setNotice(
                          error instanceof Error
                            ? error.message
                            : "Invalid JSON.",
                        );
                      }
                    }}
                  >
                    Apply records
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => update({ component: undefined, rows: [] })}
                  >
                    Remove component
                  </Button>
                </div>
              </>
            )}
          </>
        )}
        {tab === "review" && (
          <>
            <h2 className="text-sm font-semibold">Content stress test</h2>
            <Field label="Scenario">
              <select
                className={control}
                value={model.stress}
                onChange={(event) =>
                  update({ stress: event.currentTarget.value as StressCase })
                }
              >
                {stressCases.map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                    disabled={
                      (value === "empty" || value === "ten") && !model.component
                    }
                  >
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <h2 className="border-t border-border pt-3 text-sm font-semibold">
              Component states
            </h2>
            <Field label="State name">
              <input
                className={control}
                maxLength={48}
                value={stateName}
                onChange={(event) => setStateName(event.currentTarget.value)}
                placeholder="Loading, Error, Disabled…"
              />
            </Field>
            <Button
              size="sm"
              variant="outline"
              disabled={!stateName.trim()}
              onClick={() => {
                const name = stateName.trim();
                const gallery = [
                  ...model.gallery.filter((state) => state.name !== name),
                  { name, html },
                ];
                if (
                  gallery.length > 6 ||
                  gallery.reduce((size, state) => size + state.html.length, 0) >
                    6_000_000
                ) {
                  setNotice(
                    "Keep the state gallery under six captures and 6 MB.",
                  );
                  return;
                }
                update({ gallery });
                setStateName("");
              }}
            >
              Capture current frame
            </Button>
            {model.gallery.map(({ name }) => (
              <div
                key={name}
                className="flex items-center justify-between text-xs"
              >
                <span>{name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update({
                      gallery: model.gallery.filter(
                        (state) => state.name !== name,
                      ),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <h2 className="border-t border-border pt-3 text-sm font-semibold">
              Integration changes
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBaseline(contract);
                setNotice(
                  "Baseline saved for this session. Select the updated frame to compare.",
                );
              }}
            >
              Save current as baseline
            </Button>
            <Field label="Compare against a saved integration JSON">
              <input
                type="file"
                accept=".json,application/json"
                className={control}
                onChange={async (event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 100_000)
                      throw new Error(
                        "Integration contract must be under 100 KB.",
                      );
                    setBaseline(parseBaseline(await file.text()));
                    setNotice("");
                  } catch (error) {
                    setNotice(
                      error instanceof Error
                        ? error.message
                        : "Unable to load that contract.",
                    );
                  } finally {
                    input.value = "";
                  }
                }}
              />
            </Field>
            {baseline &&
              (changes.length ? (
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No integration changes since the baseline.
                </p>
              ))}
          </>
        )}
      </section>
      <footer className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadText(
              "integration-contract.json",
              JSON.stringify(contract, null, 2),
              "application/json",
            )
          }
        >
          <Layers2 size={14} /> Integration JSON
        </Button>
        <Button
          size="sm"
          onClick={() =>
            downloadText(
              "interactive-prototype.html",
              model.stress === "none"
                ? preview
                : buildPrototype(html, { ...model, stress: "none" }),
              "text/html;charset=utf-8",
            )
          }
        >
          <Download size={14} /> Download demo
        </Button>
      </footer>
    </div>
  );
}
