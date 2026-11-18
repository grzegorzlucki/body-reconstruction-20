import { test, expect } from "@playwright/test";
import { openTab } from "./helpers";

test("desktop keeps primary actions side by side and navigation usable in a short window", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 650 });
  await page.goto("./");
  const workout = await page.locator(".today-hero").boundingBox();
  const diary = await page.locator(".today-diary-action").boundingBox();
  expect(workout).not.toBeNull(); expect(diary).not.toBeNull();
  expect(Math.abs(workout!.y - diary!.y)).toBeLessThan(2);
  expect(diary!.x).toBeGreaterThan(workout!.x + workout!.width);
  await expect(page.getByRole("button", { name: "Zapisz pomiar bólu", exact: true })).toBeVisible();
  await page.locator(".desktop-nav").getByRole("button", { name: "Zegar HSR", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Zegar HSR", exact: true })).toBeVisible();
  await expect(page.locator(".account-trigger")).toBeVisible();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`navigation and layout at ${width}px`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: { width, height: 800 },
      timezoneId: "Europe/Warsaw" });
    const page = await context.newPage();
    try {
      await page.goto(baseURL!);
      await expect(page.getByRole("heading", { name: /^Cześć/ })).toBeVisible();
      await expect.poll(() => page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width <= 700) {
        await expect(page.locator(".phone-nav")).toBeVisible();
        await page.getByRole("button", { name: "Więcej widoków" }).click();
        await expect(page.getByRole("dialog", { name: "Więcej widoków" })).toBeVisible();
        await page.getByRole("dialog").getByRole("button", { name: "Historia" }).click();
      } else {
        await page.locator(".desktop-nav").getByRole("button", { name: "Historia" }).click();
      }
      await expect(page).toHaveURL(/view=history/);
      await page.goBack();
      await expect(page.getByRole("heading", { name: /^Cześć/ })).toBeVisible();
    } finally { await context.close(); }
  });
}

test("browser Back keeps an unsaved plan until the user confirms", async ({ page }) => {
  await page.goto("./");
  await openTab(page, "Plany");
  await expect(page).toHaveURL(/view=plans/);
  await page.getByRole("button", { name: "Nowy plan" }).click();
  await expect(page.getByRole("textbox", { name: "Nazwa planu" })).toBeVisible();

  await page.goBack();
  await page.getByRole("alertdialog", { name: "Potwierdź działanie" })
    .getByRole("button", { name: "Anuluj" }).click();
  await expect(page).toHaveURL(/view=plans/);
  await expect(page.getByRole("textbox", { name: "Nazwa planu" })).toBeVisible();

  await page.goBack();
  await page.getByRole("alertdialog", { name: "Potwierdź działanie" })
    .getByRole("button", { name: "Potwierdź" }).click();
  await expect(page.getByRole("heading", { name: /^Cześć/ })).toBeVisible();
});
