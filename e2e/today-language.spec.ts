import { test, expect } from "@playwright/test";

test("Today greeting follows live language changes and the saved account preference", async ({ page }) => {
  await page.goto("./?view=profile&section=personal");
  await page.getByLabel("Nazwa wyświetlana").fill("Ada");
  await page.getByRole("button", { name: "Zapisz zmiany", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Profil zapisany");
  await page.locator(".phone-nav").getByRole("button", { name: "Dzisiaj", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cześć, Ada!", exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "languages", { configurable: true, value: ["en-GB"] });
    window.dispatchEvent(new Event("languagechange"));
  });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Hi, Ada!", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your week at a glance", exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "languages", { configurable: true, value: ["pl-PL"] });
    window.dispatchEvent(new Event("languagechange"));
  });
  await expect(page.getByRole("heading", { name: "Cześć, Ada!", exact: true })).toBeVisible();
  await page.goto("./?view=profile&section=preferences");
  await page.getByLabel("Język aplikacji", { exact: true }).selectOption("en");
  await expect(page.getByRole("status")).toContainText("Language changed.");
  await page.locator(".phone-nav").getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hi, Ada!", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hi, Ada!", exact: true })).toBeVisible();
});
