import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1024, 1440, 1920]) {
  test(`English screens stay within the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./?view=profile&section=preferences");
    await page.getByLabel("Język aplikacji", { exact: true }).selectOption("en");
    await expect(page.getByRole("status")).toContainText("Language saved.");
    for (const route of ["diary", "analytics", "profile&section=personal", "profile&section=preferences"]) {
      await page.goto(`./?view=${route}`);
      await expect(page.locator(".shell")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test("language persists, translates lazy views and preserves stored labels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("./?view=profile&section=preferences");
  const language = page.getByLabel("Język aplikacji", { exact: true });
  await language.selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("status")).toContainText("Language saved.");
  await expect(
    page.getByRole("heading", { name: "Preferences", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "Diary", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Diary", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Measurement time", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Pain rating: Achilles", exact: true }),
  ).toBeVisible();
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "Analytics", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Analytics", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Post-workout response", exact: true }),
  ).toBeVisible();
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "Calendar", exact: true })
    .click();
  await expect(page.locator(".weekday").first()).toHaveText("Mon");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});

test("English mobile navigation and bilingual exercise search", async ({
  page,
}) => {
  await page.goto("./?view=profile&section=preferences");
  await page.getByLabel("Język aplikacji", { exact: true }).selectOption("en");
  await page
    .locator(".phone-nav")
    .getByRole("button", { name: "Plans", exact: true })
    .click();
  await page.getByRole("button", { name: "New plan", exact: true }).click();
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  await page.getByRole("searchbox").fill("Romanian");
  await expect(page.locator(".exercise-results")).toContainText(
    "Romanian deadlift",
  );
  await page.getByRole("searchbox").fill("Rumuński");
  await expect(page.locator(".exercise-results")).toContainText(
    "Romanian deadlift",
  );
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});

test("automatic language changes preserve a running timer and preparation phase", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("./?view=timer");
  await page
    .getByLabel("Przygotowanie przed pierwszą serią", { exact: true })
    .fill("0");
  await page.getByLabel("Ruch 1", { exact: true }).fill("1");
  await page.getByLabel("Zatrzymanie", { exact: true }).fill("0");
  await page.getByLabel("Ruch 2", { exact: true }).fill("0");
  await page.getByLabel("Powtórzenia w serii", { exact: true }).fill("1");
  await page.getByLabel("Liczba serii", { exact: true }).fill("2");
  await page.getByLabel("Przerwa między seriami", { exact: true }).fill("90");
  await page.getByLabel("Dźwięk", { exact: true }).selectOption("silent");
  await page.clock.install();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(1000);
  await expect(
    page.getByRole("heading", { name: "Przerwa", exact: true }),
  ).toBeVisible();
  const before = await page.getByRole("timer").textContent();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["en-GB"],
    });
    window.dispatchEvent(new Event("languagechange"));
  });
  await expect(
    page.getByRole("heading", { name: "Rest", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText(before!);
  await page.clock.runFor(85000);
  await expect(
    page.getByRole("heading", { name: "Get ready", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText("00:05");
});

test("a browser language change preserves an unsaved plan", async ({
  page,
}) => {
  await page.goto("./?view=plans");
  await page.getByRole("button", { name: "Nowy plan", exact: true }).click();
  await page.getByLabel("Nazwa planu").fill("Mój własny plan <test>");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["en-GB"],
    });
    window.dispatchEvent(new Event("languagechange"));
  });
  await expect(page.getByLabel("Plan name")).toHaveValue(
    "Mój własny plan <test>",
  );
  await expect(
    page.getByRole("button", { name: "Save plan", exact: true }),
  ).toBeVisible();
});
