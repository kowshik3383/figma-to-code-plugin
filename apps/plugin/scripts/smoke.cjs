const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { runInNewContext } = require("node:vm");
const { setTimeout: wait } = require("node:timers/promises");
const rootDir = path.resolve(__dirname, "../../..");
const { unzipSync, strFromU8 } = require("node:module").createRequire(
  path.join(rootDir, "packages/backend/package.json"),
)("fflate");
const messages = [];
const listeners = new Map();
const pageEvents = new Map();
let release;
let announce;
const started = new Promise((resolve) => {
  announce = resolve;
});
const blocked = new Promise((resolve) => {
  release = resolve;
});
const paint = { type: "IMAGE", imageHash: "fixture", scaleMode: "CROP" };
const image = (id, name, exportAsync) => ({
  id,
  name,
  type: "RECTANGLE",
  fills: [paint],
  locked: true,
  visible: true,
  width: 200,
  height: 100,
  x: 0,
  y: 0,
  exportAsync,
});
const first = image("1:1", "@alt Initial", async () => {
  announce();
  return blocked;
});
const second = image(
  "1:2",
  "@alt Updated",
  async () => new Uint8Array([1, 2, 3]),
);
const page = {
  type: "PAGE",
  selection: [first],
  on: (event, handler) => pageEvents.set(event, handler),
  off: (event) => pageEvents.delete(event),
};
first.parent = page;
second.parent = page;
const ui = { postMessage: (message) => messages.push(message) };
const figma = {
  mode: "default",
  currentPage: page,
  mixed: Symbol("mixed"),
  showUI() {},
  clientStorage: {
    async getAsync() {
      return { designCompiler: true };
    },
    async setAsync() {},
  },
  ui,
  on: (event, handler) => listeners.set(event, handler),
  async getNodeByIdAsync(id) {
    return id === second.id ? second : first;
  },
};
(async () => {
  runInNewContext(
    fs.readFileSync(path.join(rootDir, "apps/plugin/dist/code.js"), "utf8"),
    {
      figma,
      __html__: "",
      console: { log() {}, error() {}, warn() {} },
      setTimeout,
      Uint8Array,
      TextEncoder,
      TextDecoder,
    },
  );
  await ui.onmessage({ type: "ui-ready" });
  await started;
  page.selection = [second];
  listeners.get("selectionchange")();
  release(new Uint8Array([1, 2, 3]));
  for (
    let attempts = 0;
    attempts < 50 && !messages.some((message) => message.type === "code");
    attempts += 1
  )
    await wait(10);
  const conversions = messages.filter(({ type }) => type === "code");
  assert.equal(conversions.length, 1);
  assert.equal(conversions[0].assets[0].id, second.id);
  assert.match(conversions[0].htmlPreview.content, /data:image\/png;base64/);
  await ui.onmessage({
    type: "export-single-asset",
    nodeId: second.id,
    format: "PNG",
    scale: 1,
  });
  const file = messages.find(({ type }) => type === "download-file");
  assert.equal(file.mimeType, "image/png");
  assert.deepEqual(new Uint8Array(file.bytes), new Uint8Array([1, 2, 3]));
  await ui.onmessage({ type: "download-project", format: "vite" });
  const zip = messages.find(({ type }) => type === "project-zip");
  const entries = unzipSync(new Uint8Array(zip.zip));
  assert.match(
    strFromU8(entries["src/App.tsx"]),
    /\/images\/alt-updated-1-2\.png/,
  );
  assert.deepEqual(
    entries["public/images/alt-updated-1-2.png"],
    new Uint8Array([1, 2, 3]),
  );
  assert.ok(entries["theme.css"]);
  await ui.onmessage({
    type: "pluginSettingWillChange",
    key: "designCompiler",
    value: false,
  });
  for (
    let attempts = 0;
    attempts < 50 && messages.filter(({ type }) => type === "code").length < 2;
    attempts += 1
  )
    await wait(10);
  const compatibility = messages.filter(({ type }) => type === "code").at(-1);
  assert.match(compatibility.code, /You can still download assets/);
  assert.equal(compatibility.assets[0].id, second.id);
  page.selection = [];
  listeners.get("selectionchange")();
  assert.ok(messages.some(({ type }) => type === "empty"));
  console.log(
    "Bundled plugin smoke passed: stale selection suppressed, preview published, PNG and Vite ZIP returned, compatibility failure retained assets, empty selection cleared.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
