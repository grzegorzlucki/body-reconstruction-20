import { expect, test } from "@playwright/test";
import { confirmInApp, openTab } from "./helpers";

test("overlaid areas retain zero and gaps, and can be toggled independently", async ({ page }) => {
  await page.goto("./");
  await openTab(page, "Dane");
  await page.locator('input[type="file"]').setInputFiles({
    name: "synthetic-overlay.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), sessions: [], logs: [
      { id: "a", date: "2026-10-01", at: "2026-10-01T08:00:00Z", values: [0, 4, 2], context: "", note: "" },
      { id: "b", date: "2026-10-03", at: "2026-10-03T08:00:00Z", values: [6, 2, 4], context: "", note: "" },
    ] })),
  });
  await confirmInApp(page);
  await expect(page.locator(".toast-region")).toContainText("Kopia odtworzona");
  await page.goto("./?view=analytics&analysis=timeline&from=2026-10-01&to=2026-10-03");
  const chart = page.getByRole("region", { name: "Nakładanie danych", exact: true });
  const slider = chart.getByRole("slider");
  await slider.focus();
  await slider.press("Home");
  await expect(chart.locator(".comparison-readout")).toContainText("Achilles: 0 / 10");
  await expect(chart.locator("svg circle")).toHaveCount(6);
  // No line bridges the day without measurements.
  await expect(chart.locator('svg line[stroke-width="2"]')).toHaveCount(0);
  await slider.press("ArrowRight");
  await expect(chart.locator(".comparison-readout")).toContainText("Achilles: Brak danych");
  await chart.getByRole("checkbox", { name: "Achilles", exact: true }).uncheck();
  await expect(chart.locator("svg circle")).toHaveCount(4);
  await expect(chart.locator(".comparison-readout")).not.toContainText("Achilles:");
});
