import { test, expect } from "@playwright/test";
import { newSession } from "../src/domain";

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`calendar and day details fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./?view=calendar");
    await expect(page.locator(".calendar-grid")).toBeVisible();
    await expect(page.locator(".calendar-details")).toHaveCount(0);
    await page.locator(".calendar-day.today").click();
    await expect(page.locator(".calendar-details")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pomiary bólu", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    if (width >= 1440) {
      const month = await page.locator(".calendar-month").boundingBox();
      const detail = await page.locator(".calendar-details").boundingBox();
      expect(detail!.x).toBeGreaterThanOrEqual(month!.x + month!.width);
      expect(month!.width).toBeLessThan(detail!.width);
    }
    await page.getByRole("button", { name: "Wróć do kalendarza" }).click();
    await expect(page.locator(".calendar-details")).toHaveCount(0);
    await expect(page.locator(".calendar-day.today")).toBeFocused();
  });
}

test("all daily measurements are shown and edit opens the exact selected record", async ({
  page,
}) => {
  await page.goto("./?view=calendar");
  await expect(page.locator(".calendar-grid")).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("body-reconstruction-v1");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const tx = database.transaction(["profiles", "logs"], "readwrite");
        const profiles = tx.objectStore("profiles").getAll();
        profiles.onsuccess = () => {
          const now = new Date();
          const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          for (const [index, value] of [2, 8].entries()) {
            const at = new Date(date + `T0${index + 1}:00:00`).toISOString();
            tx.objectStore("logs").put({
              id: `calendar-log-${index}`,
              profileId: profiles.result[0].id,
              date,
              at,
              values: [{ siteId: "achilles", value }],
              context: "",
              note: `Synthetic note ${index}`,
              measurementPhase: "daily",
            });
          }
        };
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => {
          database.close();
          reject(tx.error);
        };
      };
    });
  });
  await page.reload();
  await page.locator(".calendar-day.today").click();
  await expect(page.locator(".calendar-pain-values")).toHaveCount(2);
  await expect(page.locator(".calendar-details")).toContainText("2/10");
  await expect(page.locator(".calendar-details")).toContainText("8/10");
  await page
    .getByRole("button", { name: "Edytuj ten pomiar", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/view=diary/);
  await expect(page.locator("textarea")).toHaveValue("Synthetic note 0");
});

test("keyboard navigation opens details and future days cannot create entries", async ({
  page,
}) => {
  await page.goto("./?view=calendar");
  const today = page.locator(".calendar-day.today");
  await today.focus();
  await today.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Dodaj trening", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Dodaj pomiar", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("#calendar-day-heading")).toBeFocused();
});

test("early workout details show actual sets and English labels without translating user text", async ({
  page,
}) => {
  await page.goto("./?view=calendar");
  await expect(page.locator(".calendar-grid")).toBeVisible();
  const now = new Date();
  const session = newSession(
    {},
    new Date(now.getTime() - 600000).toISOString(),
  );
  session.ended = now.toISOString();
  session.planName = "Synthetic custom plan";
  session.note = "Synthetic workout note";
  session.sets = session.sets.map((row, index) => ({
    ...row,
    done: index === 0,
  }));
  session.exerciseProgress = [
    ...new Set(session.sets.map((row) => row.exerciseId)),
  ].map((exerciseId) => ({ exerciseId, status: "finishedEarly" }));
  await page.evaluate(async (session) => {
    localStorage.setItem("rehab-ui-language-v1:guest", "en");
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("body-reconstruction-v1");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result,
          tx = database.transaction(["profiles", "sessions"], "readwrite");
        const profiles = tx.objectStore("profiles").getAll();
        profiles.onsuccess = () => {
          const profile = profiles.result[0];
          tx.objectStore("profiles").put({
            ...profile,
            preferredLanguage: "en",
          });
          tx.objectStore("sessions").put({ ...session, profileId: profile.id });
        };
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => {
          database.close();
          reject(tx.error);
        };
      };
    });
  }, session);
  await page.reload();
  await page.locator(".calendar-day.today").click();
  await expect(page.locator(".calendar-details")).toContainText(
    "Workout ended early",
  );
  await expect(page.locator(".calendar-details")).toContainText(
    "Synthetic custom plan",
  );
  await expect(
    page.getByRole("heading", { name: "Pain measurements", exact: true }),
  ).toBeVisible();
  await page.getByText("Exercises and sets", { exact: true }).click();
  await expect(page.locator(".calendar-exercise").first()).toBeVisible();
  await page.getByRole("button", { name: "Edit workout", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Workout note", exact: true })).toHaveValue(
    "Synthetic workout note",
  );
});
