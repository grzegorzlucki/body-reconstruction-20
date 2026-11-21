import { test, expect } from "@playwright/test";

test("external activities can be linked to a plan, counted separately and receive pain reports", async ({
  page,
}) => {
  await page.goto("./");
  async function add(name: string, offset: number, planned: boolean) {
    await page
      .getByRole("button", { name: "Dodaj inną aktywność", exact: true })
      .click();
    await page.getByLabel("Nazwa aktywności", { exact: true }).fill(name);
    const local = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    const end = new Date(Date.now() - offset * 3600000),
      start = new Date(end.getTime() - 1800000);
    await page
      .getByLabel("Początek treningu", { exact: true })
      .fill(local(start));
    await page.getByLabel("Koniec treningu", { exact: true }).fill(local(end));
    if (planned)
      await page
        .getByLabel("Przypisz do planu (opcjonalnie)", { exact: true })
        .selectOption({ index: 1 });
    await page
      .getByRole("button", { name: "Zapisz trening", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Historia procesu", exact: true }),
    ).toBeVisible();
  }
  await add("Synthetic running", 2, false);
  const activity = page
    .locator("details.panel")
    .filter({ hasText: "Synthetic running" });
  await activity.locator("summary").click();
  await expect(activity).toContainText("Aktywność poza celem treningowym");
  await activity
    .getByRole("button", { name: "Dodaj pomiar po aktywności", exact: true })
    .click();
  await expect(
    page.getByLabel("Powiązany trening (opcjonalnie)"),
  ).not.toHaveValue("");
  for (const slider of await page.getByRole("slider").all()) {
    await slider.focus();
    await slider.press("Home");
  }
  await page
    .getByRole("button", { name: "Zapisz pomiar", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Pomiar zapisany" }),
  ).toBeVisible();
  await page.goto("./");
  await add("Synthetic cycling", 4, true);
  await page.goto("./");
  await expect(
    page.locator(".dashboard-metric").first().locator(".dashboard-ring strong"),
  ).toHaveText("1");
  await expect(page.locator(".dashboard-metric").first()).toContainText(
    "Treningi z seriami: 0 · Inne aktywności: 2",
  );
  await page.reload();
  await expect(
    page.locator(".dashboard-metric").first().locator(".dashboard-ring strong"),
  ).toHaveText("1");
});

test("analysis selection has a contained focus outline and explicit selected state", async ({
  page,
}) => {
  await page.goto("./?view=analytics");
  const tab = page
    .getByRole("navigation", { name: "Widoki analiz" })
    .getByRole("button", { name: "Oś czasu", exact: true });
  await tab.click();
  await tab.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(tab).toHaveAttribute("aria-current", "page");
  expect(
    await tab.evaluate((element) => getComputedStyle(element).outlineOffset),
  ).toBe("-4px");
});
