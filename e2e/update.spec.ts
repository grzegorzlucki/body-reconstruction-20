import { openTab } from "./helpers";
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

test("aktualizacja w otwartej aplikacji zachowuje zapisany trening i działa ponownie offline", async ({
  page,
  context,
}) => {
  const htmlPath = "dist/index.html",
    workerPath = "dist/sw.js";
  const html = readFileSync(htmlPath, "utf8"),
    worker = readFileSync(workerPath, "utf8");
  try {
    await page.goto("./");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await page.getByRole("button", { name: "Trening", exact: true }).click();
    await page
      .getByRole("button", { name: "Zatwierdź dawki i rozpocznij" })
      .click();
    const first = page.getByRole("checkbox").first();
    await first.click();
    await expect(first).toBeChecked();
    await expect(first).toBeEnabled();
    await openTab(page, "Aplikacja");
    await context.setOffline(true);
    await page
      .getByRole("button", { name: "Odśwież aplikację", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Brak połączenia");
    await context.setOffline(false);
    const marker = "Aktualizacja testowa " + Date.now();
    writeFileSync(
      htmlPath,
      html.replace(
        "<title>Body Reconstruction</title>",
        `<title>${marker}</title>`,
      ),
    );
    writeFileSync(
      workerPath,
      worker.replace(
        /const CACHE=PREFIX\+[^;]+;/,
        `const CACHE=PREFIX+${JSON.stringify(marker)};`,
      ),
    );
    await page
      .getByRole("button", { name: "Odśwież aplikację", exact: true })
      .click();
    await expect(page).toHaveTitle(marker);
    await page.getByRole("button", { name: "Trening", exact: true }).click();
    await expect(first).toBeChecked();
    await expect(page.getByRole("checkbox")).toHaveCount(12);
    await openTab(page, "Plany");
    await expect(
      page.getByRole("heading", { name: "Plan początkowy", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload();
    await expect(page).toHaveTitle(marker);
    await page.getByRole("button", { name: "Trening", exact: true }).click();
    await expect(first).toBeChecked();
  } finally {
    writeFileSync(htmlPath, html);
    writeFileSync(workerPath, worker);
  }
});

test("aktualizacja mobilna jest dostępna w sekcji Aplikacja", async ({
  page,
}) => {
  await page.goto("./");
  const button = page.getByRole("button", {
    name: "Odśwież aplikację",
    exact: true,
  });
  await expect(button).not.toBeVisible();
  await openTab(page, "Aplikacja");
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await page.getByRole("button", { name: "Trening", exact: true }).click();
  await expect(button).not.toBeVisible();
  await openTab(page, "Plany");
  await expect(button).not.toBeVisible();
  await openTab(page, "Aplikacja");
  await expect(button).toBeVisible();
});
