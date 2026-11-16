import type { Page } from "@playwright/test";

export async function confirmInApp(page: Page) {
  await page.getByRole("alertdialog", { name: "Potwierdź działanie" })
    .getByRole("button", { name: "Potwierdź" }).click();
}

export async function openTab(page: Page, name: "Historia" | "Kalendarz" | "Zegar HSR" | "Dane") {
  const direct = page.locator(".desktop-nav").getByRole("button", { name, exact: true });
  if (await direct.isVisible()) {
    await direct.click();
    return;
  }
  await page.getByRole("button", { name: "Więcej widoków" }).click();
  await page.getByRole("dialog", { name: "Więcej widoków" })
    .getByRole("button", { name, exact: true }).click();
}
