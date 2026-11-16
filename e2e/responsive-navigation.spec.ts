import { test, expect } from "@playwright/test";

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`navigation and layout at ${width}px`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: { width, height: 800 },
      timezoneId: "Europe/Warsaw" });
    const page = await context.newPage();
    try {
      await page.goto(baseURL!);
      await expect(page.getByRole("heading", { name: /Wracaj do ruchu/ })).toBeVisible();
      await expect.poll(() => page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width <= 700) {
        await expect(page.getByText("Na urządzeniu", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Więcej widoków" }).click();
        await expect(page.getByRole("dialog", { name: "Więcej widoków" })).toBeVisible();
        await page.getByRole("dialog").getByRole("button", { name: "Historia" }).click();
      } else {
        await page.locator(".desktop-nav").getByRole("button", { name: "Historia" }).click();
      }
      await expect(page).toHaveURL(/view=history/);
      await page.goBack();
      await expect(page.getByRole("heading", { name: /Wracaj do ruchu/ })).toBeVisible();
    } finally { await context.close(); }
  });
}

test("browser Back keeps an unsaved plan until the user confirms", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Plany", exact: true }).click();
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
  await expect(page.getByRole("heading", { name: /Wracaj do ruchu/ })).toBeVisible();
});
