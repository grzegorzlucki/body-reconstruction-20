import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function verifyPages(directory, expectedBase) {
  const root = resolve(directory);
  const manifest = JSON.parse(
    readFileSync(resolve(root, "manifest.webmanifest"), "utf8"),
  );
  const base = expectedBase ?? manifest.start_url;
  if (typeof base !== "string" || !/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base))
    throw Error("Invalid Pages base path");
  if (
    manifest.id !== base ||
    manifest.scope !== base ||
    manifest.start_url !== base
  )
    throw Error("Manifest base paths do not match the deployment");
  const checked = new Set();
  const requireFile = (file) => {
    const absolute = resolve(file);
    if (!absolute.startsWith(root + sep))
      throw Error("Artifact reference leaves the output directory");
    if (
      !statSync(absolute, { throwIfNoEntry: false })?.isFile() ||
      statSync(absolute).size === 0
    )
      throw Error(`Missing or empty artifact: ${relative(root, absolute)}`);
    checked.add(absolute);
    return absolute;
  };
  const requireUrl = (value) => {
    const url = new URL(value, "https://pages.invalid" + base);
    if (
      url.origin !== "https://pages.invalid" ||
      !url.pathname.startsWith(base)
    )
      throw Error(`Invalid local artifact URL: ${value}`);
    const path =
      decodeURIComponent(url.pathname.slice(base.length)) || "index.html";
    return requireFile(resolve(root, path));
  };
  const html = readFileSync(requireFile(resolve(root, "index.html")), "utf8");
  let scripts = 0;
  for (const tag of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const attribute = tag[1].toLowerCase() === "script" ? "src" : "href";
    const value = tag[0].match(
      new RegExp(`\\b${attribute}=["']([^"']+)["']`, "i"),
    )?.[1];
    if (!value) continue;
    requireUrl(value);
    if (attribute === "src") scripts++;
  }
  if (!scripts || html.includes("/src/main.tsx") || html.includes("%BASE_URL%"))
    throw Error("index.html is not a built application entry point");
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 2)
    throw Error("Missing PWA icons");
  for (const icon of manifest.icons) {
    const image = readFileSync(requireUrl(icon.src));
    const size = Number(icon.sizes.split("x")[0]);
    if (
      !image
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      image.readUInt32BE(16) !== size ||
      image.readUInt32BE(20) !== size
    )
      throw Error(`Invalid PNG dimensions: ${icon.src}`);
  }
  for (const name of [
    "icon.svg",
    "favicon-32.png",
    "apple-touch-icon.png",
    "connection.txt",
  ])
    requireFile(resolve(root, name));
  const worker = readFileSync(requireFile(resolve(root, "sw.js")), "utf8");
  const files = JSON.parse(
    worker.match(/const FILES=(\[[\s\S]*?\]);/)?.[1] ?? "null",
  );
  if (!Array.isArray(files) || !files.length)
    throw Error("Missing service worker precache manifest");
  for (const value of files) requireUrl(value);
  for (const name of [
    "icon.svg",
    "favicon-32.png",
    "icon-192.png",
    "icon-512.png",
    "apple-touch-icon.png",
    "manifest.webmanifest",
  ])
    if (!files.includes(base + name))
      throw Error(`Offline cache is missing ${name}`);

  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const file = resolve(directory, entry.name);
      const name = relative(root, file).split(sep).join("/");
      if (entry.isSymbolicLink())
        throw Error(`Unexpected artifact symlink: ${name}`);
      if (
        /(^|\/)(?:\.env(?:\..*)?|node_modules|src|\.github|\.tools|package(?:-lock)?\.json)(\/|$)/.test(
          name,
        )
      )
        throw Error(`Source or environment file in publication: ${name}`);
      if (entry.isDirectory()) {
        visit(file);
        continue;
      }
      if (!/\.(?:js|css)$/.test(entry.name)) continue;
      const source = readFileSync(file, "utf8");
      if (/sb_secret_[A-Za-z0-9_-]{16,}/.test(source))
        throw Error("Privileged Supabase key detected in a public artifact");
      for (const reference of source.matchAll(
        /["'](\.\/[^"'\s?#]+\.(?:js|css))["']/g,
      ))
        requireFile(resolve(dirname(file), reference[1]));
    }
  };
  visit(root);
  return checked.size;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(
      `Verified ${verifyPages(process.argv[2] ?? "dist", process.argv[3])} local Pages artifact references.`,
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Invalid Pages output",
    );
    process.exitCode = 1;
  }
}
