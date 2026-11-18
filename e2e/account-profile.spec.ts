import { test, expect } from "@playwright/test";
import { openTab } from "./helpers";

test("mobile profile preserves unsaved data and persists identity separately", async ({ page }) => {
  await page.goto("./");
  await openTab(page, "Profil");
  await expect(page).toHaveURL(/view=profile/);
  const name = page.getByRole("textbox", { name: "Nazwa wyświetlana" });
  await name.fill("Profil testowy");
  await page.locator(".profile-sections").getByRole("button", { name: "Rehabilitacja", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Anuluj", exact: true }).click();
  await expect(name).toHaveValue("Profil testowy");
  await page.getByRole("button", { name: "Zapisz zmiany", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Profil zapisany");
  await page.reload();
  await expect(name).toHaveValue("Profil testowy");
  await page.locator(".profile-sections").getByRole("button", { name: "Rehabilitacja", exact: true }).click();
  await expect(page).toHaveURL(/section=rehabilitation/);
  await expect(page.getByRole("heading", { name: "Monitorowane ścięgna i obszary" })).toBeVisible();
  await page.goBack();
  await expect(name).toHaveValue("Profil testowy");
});

test("desktop account disclosure supports Escape and profile shortcuts", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("./");
  const trigger = page.locator(".account-trigger");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await openTab(page, "Profil");
  await expect(page.getByRole("heading", { name: "Mój profil", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
