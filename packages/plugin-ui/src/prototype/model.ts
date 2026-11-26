export type Scalar = string | number | boolean | null;
export type DataRow = Record<string, Scalar>;
export type Interaction = {
  id: string;
  trigger: string;
  target?: string;
  kind: "toggle" | "open" | "close" | "continue";
};
export type Choice = { layer: string; value: string };
export type Binding = { field: string; layer: string; required: boolean };
export type Component = {
  name: string;
  source: string;
  replace: string[];
  fields: Binding[];
};
export type GalleryState = { name: string; html: string };
export type StressCase =
  | "none"
  | "long-text"
  | "rtl"
  | "large-text"
  | "missing-images"
  | "large-prices"
  | "empty"
  | "ten";
export type Prototype = {
  group: string;
  choices: Choice[];
  selected: string;
  interactions: Interaction[];
  component?: Component;
  rows: DataRow[];
  stress: StressCase;
  gallery: GalleryState[];
};

export const emptyPrototype: Prototype = {
  group: "",
  choices: [],
  selected: "",
  interactions: [],
  rows: [],
  stress: "none",
  gallery: [],
};

function isScalar(value: unknown): value is Scalar {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function parseRows(text: string): DataRow[] {
  const parsed: unknown = JSON.parse(text);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  if (list.length > 50) throw new Error("Use at most 50 preview records.");
  return list.map((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row))
      throw new Error("Each record must be a JSON object.");
    const fields = Object.entries(row);
    if (fields.some(([, value]) => !isScalar(value)))
      throw new Error("Fields must be strings, numbers, booleans, or null.");
    return Object.fromEntries(
      fields.filter((entry): entry is [string, Scalar] => isScalar(entry[1])),
    );
  });
}

export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

export function contractFor(model: Prototype, layerIds: ReadonlySet<string>) {
  const bindings =
    model.component && layerIds.has(model.component.source)
      ? model.component.fields.filter(({ layer }) => layerIds.has(layer))
      : [];
  const dataSchema = {
    type: "array",
    items: {
      type: "object",
      properties: Object.fromEntries(
        bindings.map(({ field }) => {
          const types = new Set(
            model.rows
              .filter((row) => Object.prototype.hasOwnProperty.call(row, field))
              .map((row) => (row[field] === null ? "null" : typeof row[field])),
          );
          return [field, types.size ? { type: [...types] } : {}];
        }),
      ),
      required: bindings
        .filter(({ required }) => required)
        .map(({ field }) => field),
    },
  };
  return {
    fields: bindings.map(({ field, required }) => ({ field, required })),
    dataSchema,
    events: model.interactions
      .filter(
        ({ kind, trigger }) => kind === "continue" && layerIds.has(trigger),
      )
      .map(({ id, trigger }) => ({
        id,
        name: "figma-prototype:continue",
        detail: { selectedPlan: "string", actionId: "string" },
        trigger,
      })),
    states: model.gallery.map(({ name }) => name),
    choices: model.choices
      .filter(({ layer }) => layerIds.has(layer))
      .map(({ value }) => value),
  };
}

export type Contract = ReturnType<typeof contractFor>;
export type ContractBaseline = Pick<
  Contract,
  "fields" | "states" | "choices"
> & {
  events: Pick<Contract["events"][number], "id" | "name" | "trigger">[];
};

export function parseBaseline(text: string): ContractBaseline {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object")
    throw new Error("Choose an integration contract JSON file.");
  const record = Object.fromEntries(Object.entries(value)) as Record<
    string,
    unknown
  >;
  const fields = record.fields;
  const events = record.events;
  const states = record.states;
  const choices = record.choices;
  const strings = (items: unknown): items is string[] =>
    Array.isArray(items) &&
    items.every((item: unknown) => typeof item === "string");
  const hasFields = (item: unknown, keys: string[]) =>
    item &&
    typeof item === "object" &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(item, key));
  if (
    !Array.isArray(fields) ||
    !fields.every(
      (item: unknown) =>
        hasFields(item, ["field", "required"]) &&
        typeof (item as { field: unknown }).field === "string" &&
        typeof (item as { required: unknown }).required === "boolean",
    ) ||
    !Array.isArray(events) ||
    !events.every(
      (item: unknown) =>
        hasFields(item, ["id", "name", "trigger"]) &&
        ["id", "name", "trigger"].every(
          (key) => typeof (item as Record<string, unknown>)[key] === "string",
        ),
    ) ||
    !strings(states) ||
    !strings(choices)
  ) {
    throw new Error("This file does not contain a valid integration contract.");
  }
  return { fields, events, states, choices };
}

export function compareContracts(
  previous: ContractBaseline,
  current: ContractBaseline,
): string[] {
  const changes: string[] = [];
  for (const { field } of previous.fields) {
    if (!current.fields.some((binding) => binding.field === field))
      changes.push(`Field removed or renamed: ${field}`);
  }
  for (const field of current.fields) {
    const old = previous.fields.find(
      (binding) => binding.field === field.field,
    );
    if (field.required && !old?.required)
      changes.push(`New required field: ${field.field}`);
  }
  for (const event of previous.events) {
    if (
      !current.events.some(
        ({ id, trigger }) => id === event.id && trigger === event.trigger,
      )
    )
      changes.push(`Action removed or moved: ${event.name} (${event.trigger})`);
  }
  for (const state of previous.states) {
    if (!current.states.includes(state))
      changes.push(`State removed: ${state}`);
  }
  for (const state of current.states) {
    if (!previous.states.includes(state)) changes.push(`New state: ${state}`);
  }
  for (const choice of previous.choices) {
    if (!current.choices.includes(choice))
      changes.push(`Option removed: ${choice}`);
  }
  return changes;
}
