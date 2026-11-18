import { openTab, confirmInApp } from "./helpers";
import { test, expect } from "@playwright/test";
test("unilateral timer switches sides before resting and preserves its configuration", async ({ page }) => {
  await page.goto("./");
  await openTab(page, "Zegar HSR");
  await page.getByLabel("Przygotowanie przed pierwszą serią", { exact: true }).fill("1");
  await page.getByLabel("Ruch 1", { exact: true }).fill("1");
  await page.getByLabel("Zatrzymanie", { exact: true }).fill("0");
  await page.getByLabel("Ruch 2", { exact: true }).fill("0");
  await page.getByLabel("Powtórzenia w serii", { exact: true }).fill("5");
  await page.getByLabel("Liczba serii", { exact: true }).fill("2");
  await page.getByLabel("Przerwa między seriami", { exact: true }).fill("7");
  await page.getByLabel("Ćwiczenie jednostronne — obie strony po kolei").check();
  await page.getByLabel("Przygotowanie przy zmianie strony (s)").fill("2");
  await page.getByLabel("Pierwsza strona").selectOption("P");
  await page.getByLabel("Dźwięk", { exact: true }).selectOption("silent");
  await expect(page.locator(".timer-summary")).toContainText("00:32");
  await page.reload();
  await openTab(page, "Zegar HSR");
  await expect(page.getByLabel("Ćwiczenie jednostronne — obie strony po kolei")).toBeChecked();
  await page.clock.install();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(1000);
  await expect(page.locator(".timer-side")).toHaveText("Prawa strona");
  await page.clock.runFor(5000);
  await expect(page.getByRole("heading", { name: "Przygotowanie — zmiana strony", exact: true })).toBeVisible();
  await expect(page.locator(".timer-side")).toHaveText("Lewa strona");
  await page.getByRole("button", { name: "Pauza", exact: true }).click();
  const paused = await page.getByRole("timer").textContent();
  await page.clock.runFor(10000);
  await expect(page.getByRole("timer")).toHaveText(paused!);
  await page.getByRole("button", { name: "Wznów", exact: true }).click();
  await page.clock.runFor(2000);
  await expect(page.getByRole("heading", { name: "Ruch 1", exact: true })).toBeVisible();
  await page.clock.runFor(5000);
  await expect(page.getByRole("heading", { name: "Przerwa", exact: true })).toBeVisible();
  await page.clock.runFor(2000);
  await expect(page.getByRole("heading", { name: "Przygotowanie", exact: true })).toBeVisible();
  await expect(page.locator(".timer-side")).toHaveText("Prawa strona");
  await page.clock.runFor(17000);
  await expect(page.getByRole("heading", { name: "Koniec", exact: true })).toBeVisible();
});
test("timer settings, exact phases, pause, navigation and completion", async ({
  page,
}) => {
  await page.goto("./");
  await openTab(page, "Zegar HSR");
  await page.getByLabel("Przygotowanie przed pierwszą serią", { exact: true }).fill("2");
  await page.getByLabel("Ruch 1", { exact: true }).fill("2");
  await page.getByLabel("Zatrzymanie", { exact: true }).fill("0");
  await page.getByLabel("Ruch 2", { exact: true }).fill("1");
  await page.getByLabel("Powtórzenia w serii", { exact: true }).fill("2");
  await page.getByLabel("Liczba serii", { exact: true }).fill("2");
  await page.getByLabel("Przerwa między seriami", { exact: true }).fill("3");
  await page.getByLabel("Dźwięk", { exact: true }).selectOption("silent");
  await expect(page.locator(".timer-summary")).toContainText("00:17");
  await page.reload();
  await openTab(page, "Zegar HSR");
  await expect(
    page.getByLabel("Przygotowanie przed pierwszą serią", { exact: true }),
  ).toHaveValue("2");
  await page.clock.install();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Przygotowanie", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(2000);
  await expect(
    page.getByRole("heading", { name: "Ruch 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pauza", exact: true }).click();
  const paused = await page.getByRole("timer").textContent();
  await page.clock.runFor(10000);
  await expect(page.getByRole("timer")).toHaveText(paused!);
  await page.getByRole("button", { name: "Wznów", exact: true }).click();
  await page.clock.runFor(2000);
  await expect(
    page.getByRole("heading", { name: "Ruch 2", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dzisiaj", exact: true }).click();
  await page.clock.runFor(4000);
  await openTab(page, "Zegar HSR");
  await expect(
    page.getByRole("heading", { name: "Przygotowanie", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(9000);
  await expect(
    page.getByRole("heading", { name: "Koniec", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText("00:00");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBeTruthy();
});

test("rejects all zero phases and allows skipping first phase", async ({
  page,
}) => {
  await page.goto("./");
  await openTab(page, "Zegar HSR");
  for (const label of ["Przygotowanie przed pierwszą serią", "Ruch 1", "Zatrzymanie", "Ruch 2"])
    await page.getByLabel(label, { exact: true }).fill("0");
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Ruch 2", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ruch 2", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zakończ", exact: true }).click();
  await confirmInApp(page);
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
});

test("beeps once per second and stays silent while paused", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const calls = { beeps: 0 };
    Object.assign(window, {
      timerAudioCalls: calls,
      AudioContext: class {
        state = "running";
        currentTime = 0;
        destination = {};
        resume() {
          return Promise.resolve();
        }
        close() {
          return Promise.resolve();
        }
        createOscillator() {
          return {
            frequency: { value: 0 },
            connect() {},
            disconnect() {},
            start() {
              calls.beeps++;
            },
            stop() {},
            onended: null,
          };
        }
        createGain() {
          return {
            gain: {
              setValueAtTime() {},
              linearRampToValueAtTime() {},
              exponentialRampToValueAtTime() {},
            },
            connect() {},
            disconnect() {},
          };
        }
      },
    });
  });
  await page.goto("./");
  await openTab(page, "Zegar HSR");
  await page.clock.install();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(3000);
  const beeps = () =>
    page.evaluate(
      () =>
        (window as unknown as { timerAudioCalls: { beeps: number } })
          .timerAudioCalls.beeps,
    );
  expect(await beeps()).toBe(3);
  await page.getByRole("button", { name: "Pauza", exact: true }).click();
  await page.clock.runFor(5000);
  expect(await beeps()).toBe(3);
  await page.getByRole("button", { name: "Wznów", exact: true }).click();
  await page.clock.runFor(1000);
  expect(await beeps()).toBe(4);
});
