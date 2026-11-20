import { test, expect } from "@playwright/test";

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`dashboard metrics and actions fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./");
    await expect(
      page.getByRole("heading", {
        name: "Twój tydzień w skrócie",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".dashboard-metric")).toHaveCount(4);
    await expect(page.getByText("TWÓJ PLAN", { exact: true })).toHaveCount(0);
    await expect(page.locator(".dashboard-chart-empty")).toHaveCount(3);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    for (const metric of await page.locator(".dashboard-metric").all()) {
      const box = await metric.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    }
    await page
      .getByRole("button", { name: "Zapisz pomiar bólu", exact: true })
      .click();
    await expect(page).toHaveURL(/view=diary/);
  });
}

test("pain mini chart preserves gaps, zero scores and median aggregation", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator(".today-dashboard")).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("body-reconstruction-v1");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result,
          tx = database.transaction(["profiles", "logs"], "readwrite");
        const profiles = tx.objectStore("profiles").getAll();
        profiles.onsuccess = () => {
          for (const [index, offset, score] of [
            [0, -2, 2],
            [1, -2, 6],
            [2, 0, 0],
          ]) {
            const date = new Date();
            date.setDate(date.getDate() + offset);
            date.setHours(0, 0, index, 0);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            tx.objectStore("logs").put({
              id: `dashboard-report-${index}`,
              profileId: profiles.result[0].id,
              date: key,
              at: date.toISOString(),
              values: [{ siteId: "achilles", value: score }],
              note: "",
              context: "",
            });
          }
        };
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => {
          database.close();
          reject(tx.error);
        };
      };
    });
  });
  await page.reload();
  const area = page
    .locator(".dashboard-area")
    .filter({
      has: page.getByRole("heading", { name: "Achilles", exact: true }),
    });
  await expect(area.locator(".dashboard-pain-score strong")).toHaveText("0");
  await expect(area.locator(".dashboard-sparkline circle")).toHaveCount(2);
  await expect(area.locator(".spark-line")).toHaveCount(0);
  await expect(area.locator(".sr-only")).toContainText("4/10");
  await expect(area.locator(".sr-only")).toContainText("0/10");
  await expect(
    page.locator(".dashboard-metric").nth(1).locator(".dashboard-ring strong"),
  ).toHaveText("2");
  await page
    .getByRole("button", { name: "Zobacz analizy →", exact: true })
    .click();
  await expect(page).toHaveURL(/view=analytics/);
});
