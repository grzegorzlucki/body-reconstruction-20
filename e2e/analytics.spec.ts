import { test, expect } from "@playwright/test";
import { confirmInApp } from "./helpers";

for (const width of [320, 390, 1024, 1920]) {
  test(`analytics filters and subviews stay usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 850 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("./?view=analytics");
    await expect(
      page.getByRole("heading", { name: "Analizy", exact: true }),
    ).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Widoki analiz" });
    await nav.getByRole("button", { name: "Oś czasu", exact: true }).click();
    await expect(page).toHaveURL(/analysis=timeline/);
    const comparison = page.getByRole("region", { name: "Nakładanie danych", exact: true });
    await expect(comparison).toBeVisible();
    await comparison.getByRole("combobox", { name: "Dane treningowe", exact: true }).selectOption("sets");
    await expect(comparison.getByRole("combobox", { name: "Dane treningowe", exact: true })).toHaveValue("sets");
    const overlay = comparison.getByRole("slider");
    await overlay.focus();
    await overlay.press("Home");
    await expect(overlay).toHaveAttribute("aria-valuenow", "0");
    await overlay.press("ArrowRight");
    await expect(overlay).toHaveAttribute("aria-valuenow", "1");
    await comparison.getByRole("checkbox", { name: "Treningi", exact: true }).uncheck();
    await expect(comparison.locator("svg rect")).toHaveCount(0);
    await comparison.getByRole("checkbox", { name: "Treningi", exact: true }).check();
    await expect(
      page.getByRole("heading", { name: "Ból · cały wybrany zakres" }),
    ).toBeVisible();
    await nav
      .getByRole("button", { name: "Reakcja po treningu", exact: true })
      .click();
    await expect(
      page.getByText("Wybierz trening z listy.", { exact: false }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      nav.getByRole("button", { name: "Oś czasu", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.locator(".analytics-filter-disclosure summary").click();
    await page.getByLabel("Od", { exact: true }).fill("2026-01-01");
    await expect(page).toHaveURL(/from=2026-01-01/);
    await nav
      .getByRole("button", { name: "Dawka i regularność", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Dawka i regularność", exact: true }),
    ).toBeVisible();
    await nav
      .getByRole("button", { name: "Obszary i kontuzje", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Obszary i epizody kontuzji" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  });
}

test("two reports on the same day remain independent when editing by ID", async ({
  page,
}) => {
  await page.goto("./?view=diary");
  await expect(
    page.getByRole("heading", { name: "Dziennik", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Godzina pomiaru").fill("00:00:00");
  for (const range of await page.locator('input[type="range"]').all()) {
    await range.focus();
    await range.press("Home");
  }
  await page
    .getByRole("button", { name: "Zapisz pomiar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Nowy pomiar", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Godzina pomiaru").fill("00:00:01");
  for (const range of await page.locator('input[type="range"]').all()) {
    await range.focus();
    await range.press("End");
  }
  await page
    .getByRole("button", { name: "Zapisz pomiar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edytuj ten pomiar", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Edytuj ten pomiar", exact: true })
    .first()
    .click();
  await expect(page.locator('input[type="range"]').first()).toHaveValue("0");
  await page
    .getByLabel("Notatka (opcjonalnie)")
    .fill("Edycja pierwszego wpisu");
  await page
    .getByRole("button", { name: "Zapisz pomiar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edytuj ten pomiar", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Edytuj ten pomiar", exact: true })
    .last()
    .click();
  await expect(page.locator('input[type="range"]').first()).toHaveValue("10");
  await expect(page.getByLabel("Notatka (opcjonalnie)")).toHaveValue("");
});

test("a partial workout saves a linked post report and accepts a separate follow-up", async ({
  page,
}) => {
  await page.goto("./?view=workout");
  await page
    .getByRole("button", { name: "Uruchom plan", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Twój trening trwa" }),
  ).toBeVisible();
  const set = page.locator('.set-row input[type="checkbox"]').first();
  await set.click();
  await expect(set).toBeChecked();
  await expect(set).toBeEnabled();
  await page
    .getByLabel("Powód wcześniejszego zakończenia (opcjonalnie)")
    .selectOption("time");
  await page.getByLabel("Zapisz pomiar bólu razem z treningiem").check();
  for (const range of await page.locator('input[type="range"]').all()) {
    await range.focus();
    await range.press("Home");
  }
  await page
    .getByRole("button", { name: "Zakończ trening", exact: true })
    .click();
  await confirmInApp(page);
  await expect(
    page.getByText("Trening i pomiar bólu zapisane.", { exact: true }),
  ).toBeVisible();
  await page.goto("./?view=analytics&analysis=response");
  await expect(
    page.getByRole("region", {
      name: "Reakcja po treningu — tabela przewijana",
    }),
  ).toContainText("Powiązanie zapisane");
  await page
    .getByRole("button", { name: "Dodaj pomiar do tego treningu", exact: true })
    .click();
  await expect(page.getByLabel("Rodzaj pomiaru")).toHaveValue("followup");
  for (const range of await page.locator('input[type="range"]').all()) {
    await range.focus();
    await range.press("Home");
  }
  await page
    .getByRole("button", { name: "Zapisz pomiar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Nowy pomiar", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edytuj ten pomiar", exact: true }),
  ).toHaveCount(2);
  await page.goto("./?view=history");
  await page.locator("details.panel > summary").first().click();
  await page.getByRole("button", { name: "Analiza reakcji", exact: true }).click();
  await expect(page).toHaveURL(/analysis=response/);
  await expect(page).toHaveURL(/session=/);
  await expect(page.getByRole("region", { name: "Reakcja po treningu — tabela przewijana" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("timeline includes all 20 daily measurements instead of silently truncating to 14", async ({
  page,
}) => {
  await page.goto("./?view=analytics");
  await expect(
    page.getByRole("heading", { name: "Analizy", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("body-reconstruction-v1");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result,
          transaction = database.transaction(["profiles", "logs"], "readwrite");
        const profiles = transaction.objectStore("profiles").getAll();
        profiles.onsuccess = () => {
          for (let index = 1; index <= 20; index++) {
            const at = new Date();
            at.setDate(at.getDate() - index);
            const date = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
            transaction.objectStore("logs").put({
              id: `log-${index}`,
              profileId: profiles.result[0].id,
              date,
              at: at.toISOString(),
              values: [{ siteId: "achilles", value: index % 11 }],
              context: "",
              note: "",
            });
          }
        };
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error);
        };
      };
    });
  });
  await page.goto("./?view=analytics&analysis=timeline");
  await expect(page.locator(".pain-chart circle")).toHaveCount(20);
  await expect(page.locator(".pain-chart")).toContainText("Mediana dnia");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
