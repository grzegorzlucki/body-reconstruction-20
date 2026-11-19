import { test, expect } from "@playwright/test";

test("Pages metadata and icons resolve inside the application base and remain available offline", async ({
  page,
  context,
  baseURL,
}) => {
  await page.goto("./");
  const root = new URL(baseURL!);
  const manifestUrl = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  const response = await page.request.get(new URL(manifestUrl!, root).href);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.scope).toBe(root.pathname);
  expect(manifest.start_url).toBe(root.pathname);
  expect(manifest.id).toBe(root.pathname);
  for (const icon of manifest.icons) {
    expect(icon.purpose).toBe("any maskable");
    const asset = await page.request.get(new URL(icon.src, root).href);
    expect(asset.ok()).toBe(true);
    const png = await asset.body();
    const size = Number(icon.sizes.split("x")[0]);
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }
  for (const link of await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .all()) {
    const asset = await page.request.get(
      new URL((await link.getAttribute("href"))!, root).href,
    );
    expect(asset.ok()).toBe(true);
  }
  const diagnostic = await page.request.get(
    new URL("connection.txt", root).href,
  );
  expect(await diagnostic.text()).toContain(
    "does not verify authentication or the Supabase connection",
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        );
      });
  });
  await context.setOffline(true);
  const offlineIcon = await page.evaluate(async (url) => {
    const result = await fetch(url);
    return { ok: result.ok, size: (await result.blob()).size };
  }, new URL("icon-192.png", root).href);
  expect(offlineIcon.ok).toBe(true);
  expect(offlineIcon.size).toBeGreaterThan(100);
  await page.reload();
  await expect(page).toHaveTitle("Body Reconstruction");
  await expect(page.locator("#root")).not.toBeEmpty();
});
