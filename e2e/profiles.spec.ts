import { test, expect } from "@playwright/test";

test("switching profiles keeps pain entries isolated", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: /Wracaj do ruchu/ })).toBeVisible();
  const profile = page.locator(".profile-bar select");
  const firstId = await profile.inputValue();

  await page.getByText("Opcje profilu").click();
  await page.getByRole("button", { name: "Dodaj profil" }).click();
  await page.getByRole("dialog", { name: "Dodaj profil" })
    .getByRole("textbox", { name: "Nazwa profilu" }).fill("Drugi profil");
  await page.getByRole("button", { name: "Zapisz profil" }).click();
  await expect.poll(() => profile.inputValue()).not.toBe(firstId);
  const secondId = await profile.inputValue();
  expect(secondId).not.toBe(firstId);

  await page.getByRole("button", { name: "Zapisz ból" }).click();
  await page.getByLabel("Godzina pomiaru").fill(new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw",
  }));
  for (const select of await page.locator(".pain-row select").all())
    await select.selectOption("2");
  await page.getByRole("button", { name: "Zapisz pomiar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Pomiar zapisany");

  await profile.selectOption(firstId);
  await expect(page.getByRole("heading", { name: /Wracaj do ruchu/ })).toBeVisible();
  await expect(page.getByText("Brak wpisu", { exact: true })).toBeVisible();
  await profile.selectOption(secondId);
  await expect(page.getByText("Zapisany", { exact: true })).toBeVisible();
});
