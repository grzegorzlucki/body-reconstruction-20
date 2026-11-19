import { defineConfig } from "vite";
import { writeFileSync, readdirSync, readFileSync } from "node:fs";
const requestedBase = process.env.VITE_BASE_PATH || "/";
const base = requestedBase.endsWith("/") ? requestedBase : requestedBase + "/";
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base))
  throw Error("Nieprawidłowa ścieżka VITE_BASE_PATH.");
const manifest = () => ({
  id: base,
  name: "Body Reconstruction",
  short_name: "Rehab",
  lang: "pl",
  start_url: base,
  scope: base,
  display: "standalone",
  background_color: "#E8F1EE",
  theme_color: "#E8F1EE",
  icons: [192, 512].map((size) => ({
    src: base + "icon-" + size + ".png",
    sizes: size + "x" + size,
    type: "image/png",
    purpose: "any maskable",
  })),
});
export default defineConfig({
  base,
  optimizeDeps: { entries: ["index.html"] },
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync("package.json", "utf8")).version) },
  preview: { headers: { "Cache-Control": "no-cache" } },
  plugins: [
    {
      name: "development-manifest",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const pathname = request.url?.split("?")[0];
          if (pathname !== base + "manifest.webmanifest" && pathname !== "/manifest.webmanifest") return next();
          response.setHeader("Content-Type", "application/manifest+json");
          response.setHeader("Cache-Control", "no-cache");
          response.end(JSON.stringify(manifest()));
        });
      },
    },
    {
      name: "offline-manifest",
      apply: "build",
      closeBundle() {
        const assets = readdirSync("dist/assets")
          .filter((x) => /\.(js|css)$/.test(x))
          .map((x) => base + "assets/" + x);
        writeFileSync(
          "dist/manifest.webmanifest",
          JSON.stringify(manifest()),
        );
        writeFileSync(
          "dist/sw.js",
          `const PREFIX=${JSON.stringify("rehab-" + base.replaceAll("/", "_") + "-")};const BASE=${JSON.stringify(base)};const CACHE=PREFIX+${JSON.stringify(String(Date.now()))};const FILES=${JSON.stringify([base, base + "index.html", base + "icon.svg", base + "favicon-32.png", base + "icon-192.png", base + "icon-512.png", base + "apple-touch-icon.png", base + "manifest.webmanifest", ...assets])};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(url=>new Request(url,{cache:'reload'}))))));self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')e.waitUntil(self.skipWaiting());});self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();const old=keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE);await Promise.all(old.map(k=>caches.delete(k)));await self.clients.claim();})()));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin||!new URL(e.request.url).pathname.startsWith(BASE))return;e.respondWith(caches.open(CACHE).then(c=>c.match(e.request,{ignoreVary:true,ignoreSearch:e.request.mode==='navigate'})).then(r=>r||fetch(e.request)));});`,
        );
      },
    },
  ],
});
