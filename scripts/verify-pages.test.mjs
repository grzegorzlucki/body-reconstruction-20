import { test, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  lstatSync,
  readFileSync,
  utimesSync,
} from "node:fs";
import { resolve, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPages } from "./verify-pages.mjs";
import { spawnSync } from "node:child_process";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const tools = resolve(workspace, ".tools");
mkdirSync(tools, { recursive: true });
const fixtures = mkdtempSync(join(tools, "pages-check-"));
after(() => {
  if (
    !resolve(fixtures).startsWith(tools + sep + "pages-check-") ||
    lstatSync(fixtures).isSymbolicLink()
  )
    throw Error("Unsafe fixture cleanup path");
  rmSync(fixtures, { recursive: true, force: true });
});
function fixture(name) {
  const directory = join(fixtures, name);
  mkdirSync(join(directory, "assets"), { recursive: true });
  const base = "/body-reconstruction-20/";
  writeFileSync(
    join(directory, "index.html"),
    `<link rel="manifest" href="${base}manifest.webmanifest"><script type="module" src="${base}assets/main.js"></script>`,
  );
  writeFileSync(join(directory, "assets/main.js"), 'import "./lazy.js";');
  writeFileSync(
    join(directory, "assets/lazy.js"),
    "export const ready = true;",
  );
  const manifest = {
    id: base,
    start_url: base,
    scope: base,
    icons: [192, 512].map((size) => ({
      src: base + `icon-${size}.png`,
      sizes: `${size}x${size}`,
    })),
  };
  writeFileSync(
    join(directory, "manifest.webmanifest"),
    JSON.stringify(manifest),
  );
  for (const file of [
    "icon.svg",
    "favicon-32.png",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png",
    "connection.txt",
  ])
    copyFileSync(join(workspace, "public", file), join(directory, file));
  const files = [
    "index.html",
    "icon.svg",
    "favicon-32.png",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png",
    "manifest.webmanifest",
    "assets/main.js",
    "assets/lazy.js",
  ];
  writeFileSync(
    join(directory, "sw.js"),
    `const FILES=${JSON.stringify(files.map((file) => base + file))};`,
  );
  return directory;
}
test("accepts a coherent Pages build with matching icon sizes and lazy chunks", () => {
  assert.ok(verifyPages(fixture("valid"), "/body-reconstruction-20/") > 5);
});

test("publication requires content comparison rather than size/mtime alone", () => {
  const workflow = readFileSync(join(workspace, ".github/workflows/pages.yml"), "utf8");
  assert.match(workflow, /rsync -a --checksum --delete --exclude='\.git'/);
});

test("checksum copy repairs stale same-size same-mtime HTML and preserves the worktree", (t) => {
  if (spawnSync("rsync", ["--version"]).status !== 0) {
    t.skip("rsync is unavailable locally; Ubuntu CI executes this regression");
    return;
  }
  const source = fixture("copy-source"), target = fixture("copy-target");
  const html = readFileSync(join(source,"index.html"),"utf8");
  writeFileSync(join(target,"index.html"),html.replace("main.js","gone.js"));
  copyFileSync(join(target,"assets/main.js"),join(target,"assets/gone.js"));
  writeFileSync(join(target,".git"),"synthetic worktree marker");
  const stamp = new Date("2026-01-01T00:00:00Z");
  for (const directory of [source,target]) utimesSync(join(directory,"index.html"),stamp,stamp);
  const copy = (checksum) => {
    const result = spawnSync("rsync", ["-a", ...(checksum ? ["--checksum"] : []), "--delete", "--exclude=.git", source+"/", target+"/"], {encoding:"utf8"});
    assert.equal(result.status,0,result.stderr);
  };
  copy(false);
  assert.throws(()=>verifyPages(target),/Missing or empty artifact/);
  copy(true);
  assert.ok(verifyPages(target)>5);
  assert.equal(readFileSync(join(target,".git"),"utf8"),"synthetic worktree marker");
});
test("rejects HTML referring to an absent hashed JavaScript entry", () => {
  const directory = fixture("missing-entry");
  writeFileSync(
    join(directory, "index.html"),
    '<script src="/body-reconstruction-20/assets/old-hash.js"></script>',
  );
  assert.throws(() => verifyPages(directory), /Missing or empty artifact/);
});
test("rejects a missing lazy-loaded chunk", () => {
  const directory = fixture("missing-lazy");
  writeFileSync(join(directory, "assets/main.js"), 'import "./missing.js";');
  assert.throws(() => verifyPages(directory), /Missing or empty artifact/);
});
test("rejects the wrong Pages base", () => {
  assert.throws(() => verifyPages(fixture("base"), "/"), /Manifest base paths/);
});
test("rejects mismatched PNG dimensions", () => {
  const directory = fixture("dimensions");
  copyFileSync(
    join(directory, "icon-192.png"),
    join(directory, "icon-512.png"),
  );
  assert.throws(() => verifyPages(directory), /Invalid PNG dimensions/);
});
test("rejects publication of environment files and privileged keys", () => {
  const directory = fixture("environment");
  writeFileSync(join(directory, ".env"), "PRIVATE_CONFIG=fixture");
  assert.throws(() => verifyPages(directory), /Source or environment file/);
  const keyDirectory = fixture("secret");
  writeFileSync(
    join(keyDirectory, "assets/main.js"),
    'const key="sb_' + "secret_" + "x".repeat(32) + '";',
  );
  assert.throws(() => verifyPages(keyDirectory), /Privileged Supabase key/);
});
