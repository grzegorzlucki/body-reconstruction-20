import type { Page } from "@playwright/test";

export async function confirmInApp(page: Page) {
  await page.getByRole("alertdialog", { name: "Potwierdź działanie" })
    .getByRole("button", { name: "Potwierdź" }).click();
}

export async function openTab(page: Page, name: "Historia" | "Kalendarz" | "Zegar HSR" | "Dane" | "Ustawienia" | "Plany" | "Profil" | "Aplikacja") {
  if (["Profil", "Ustawienia", "Aplikacja"].includes(name)) {
    const desktop = page.locator(".account-trigger");
    if (await desktop.isVisible()) {
      await desktop.click();
      await page.locator(".account-dropdown").getByRole("button", { name: name === "Profil" ? "Mój profil" : name === "Ustawienia" ? "Rehabilitacja" : "Aplikacja", exact: true }).click();
    } else {
      await page.locator(".phone-nav").getByRole("button", { name: "Profil", exact: true }).click();
      if (name !== "Profil") await page.locator(".profile-sections").getByRole("button", { name: name === "Ustawienia" ? "Rehabilitacja" : "Aplikacja", exact: true }).click();
    }
    return;
  }
  const direct = page.locator(".desktop-nav").getByRole("button", { name, exact: true });
  if (await direct.isVisible()) {
    await direct.click();
    return;
  }
  if (await page.locator(".account-trigger").isVisible() && name === "Dane") {
    await page.locator(".account-trigger").click();
    await page.locator(".account-dropdown").getByRole("button", { name: "Moje dane", exact: true }).click();
    return;
  }
  await page.getByRole("button", { name: "Więcej widoków" }).click();
  await page.getByRole("dialog", { name: "Więcej widoków" })
    .getByRole("button", { name, exact: true }).click();
}
