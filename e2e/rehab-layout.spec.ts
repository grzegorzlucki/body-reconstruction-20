import { test, expect } from "@playwright/test";
import { openTab } from "./helpers";

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`rehabilitation controls remain readable and aligned at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("./");
    await openTab(page, "Ustawienia");
    await expect(page.getByRole("heading", { name: "Rehabilitacja", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Dodaj kontuzję", exact: true }).click();
    await page.getByLabel("Nazwa lub rozpoznanie").fill("Długi opis testowej kontuzji lewej kończyny");
    const card = page.locator(".rehab-site-config").first();
    const toggle = card.getByLabel("Monitoruj", { exact: true });
    const checkbox = await toggle.boundingBox();
    const label = await card.locator(".profile-config-toggle").boundingBox();
    expect(checkbox).not.toBeNull(); expect(label).not.toBeNull();
    expect(checkbox!.width).toBeGreaterThanOrEqual(20);
    expect(checkbox!.width).toBeLessThanOrEqual(26);
    expect(Math.abs(checkbox!.y + checkbox!.height / 2 - (label!.y + label!.height / 2))).toBeLessThan(3);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const name of ["Dodaj kontuzję", "Dodaj obszar", "Dodaj kontekst"]) {
      const button = page.getByRole("button", { name, exact: true });
      const bounds = await button.boundingBox();
      expect(bounds!.width).toBeGreaterThanOrEqual(120);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeLessThan(100);
    }
    const clippedButtons = await page.locator(".profile-settings button").evaluateAll((buttons) => buttons.filter((button) =>
      button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1).map((button) => button.textContent));
    expect(clippedButtons).toEqual([]);
    if (width > 700) {
      const stretchedNavButtons = await page.locator(".desktop-nav button").evaluateAll((buttons) =>
        buttons.filter((button) => button.getBoundingClientRect().height > 60).map((button) => button.textContent));
      expect(stretchedNavButtons).toEqual([]);
      const sidebar = await page.locator("aside").boundingBox();
      const form = await page.locator(".profile-settings").boundingBox();
      expect(form!.x - (sidebar!.x + sidebar!.width)).toBeLessThanOrEqual(40);
    }
  });
}
