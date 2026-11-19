import { test, expect, type Page } from "@playwright/test";

async function rateAreas(page: Page) {
  for (const slider of await page.getByRole("slider").all()) {
    await slider.focus();
    await slider.press("Home");
  }
}

test("saving and editing a measurement clears its draft without overwriting the next entry", async ({
  page,
}) => {
  await page.goto("./?view=diary");
  await expect(
    page.getByRole("heading", { name: "Dziennik", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Godzina pomiaru").fill("00:00:00");
  await page.getByLabel("Kontekst pomiaru").selectOption("spacer");
  await page.getByLabel("Rodzaj pomiaru").selectOption("pre");
  await page.getByLabel("Notatka (opcjonalnie)").fill("Pierwszy komentarz");
  await rateAreas(page);
  const selectedDate = await page
    .getByLabel("Dzień", { exact: true })
    .inputValue();
  await page
    .getByRole("button", { name: "Zapisz pomiar", exact: true })
    .click();
  await expect(page.locator(".toast-region")).toContainText("Pomiar zapisany");
  await expect(page.getByLabel("Notatka (opcjonalnie)")).toHaveValue("");
  await expect(page.getByLabel("Kontekst pomiaru")).toHaveValue("");
  await expect(page.getByLabel("Rodzaj pomiaru")).toHaveValue("daily");
  await expect(page.getByLabel("Godzina pomiaru")).toHaveValue("08:00");
  await expect(page.getByLabel("Dzień", { exact: true })).toHaveValue(
    selectedDate,
  );
  await expect(page.locator('[data-pain-unrated="true"]')).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Usuń pomiar", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edytuj ten pomiar", exact: true })
    .click();
  await expect(page.getByLabel("Notatka (opcjonalnie)")).toHaveValue(
    "Pierwszy komentarz",
  );
  await page.getByLabel("Notatka (opcjonalnie)").fill("Poprawiony komentarz");
  await page
    .getByRole("button", { name: "Zapisz pomiar", exact: true })
    .click();
  await expect(page.getByLabel("Notatka (opcjonalnie)")).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Edytuj ten pomiar", exact: true }),
  ).toHaveCount(1);
  await page.getByLabel("Godzina pomiaru").fill("00:00:01");
  await rateAreas(page);
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
  await expect(page.getByLabel("Notatka (opcjonalnie)")).toHaveValue(
    "Poprawiony komentarz",
  );
});

for (const width of [390, 1440]) {
  test(`confirmation is passive, expires and restarts for identical saves at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./?view=diary");
    await expect(
      page.getByRole("heading", { name: "Dziennik", exact: true }),
    ).toBeVisible();
    await page.clock.install();
    await page.getByLabel("Godzina pomiaru").fill("00:00:00");
    await rateAreas(page);
    await page
      .getByRole("button", { name: "Zapisz pomiar", exact: true })
      .click();
    const toast = page.locator(".toast-region");
    await expect(toast).toContainText("Pomiar zapisany");
    await expect(toast).toHaveCSS("pointer-events", "none");
    await expect(toast.locator("button, a, input, [tabindex]")).toHaveCount(0);
    const box = (await toast.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThan(450);
    if (width < 700) {
      const navigation = (await page.locator(".phone-nav").boundingBox())!;
      expect(box.y + box.height).toBeLessThan(navigation.y);
    }
    // Click at the toast location: it must pass through without dismissing the message.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(toast).toContainText("Pomiar zapisany");
    await page.clock.runFor(2500);
    await page
      .getByRole("button", { name: "Edytuj ten pomiar", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Zapisz pomiar", exact: true })
      .click();
    await expect(toast).toContainText("Pomiar zapisany");
    await page.clock.runFor(2000);
    await expect(toast.locator(".toast-message")).not.toHaveClass(
      /toast-leaving/,
    );
    await page.clock.runFor(2000);
    await expect(toast.locator(".toast-message")).toHaveClass(/toast-leaving/);
    await page.clock.runFor(400);
    await expect(toast).toBeEmpty();
    await page.getByLabel("Godzina pomiaru").fill("00:00:01");
    await rateAreas(page);
    await page
      .getByRole("button", { name: "Zapisz pomiar", exact: true })
      .click();
    await expect(toast).toContainText("Pomiar zapisany");
    await expect(toast.locator(".toast-message")).not.toHaveClass(
      /toast-leaving/,
    );
    await page.clock.runFor(4400);
    await expect(toast).toBeEmpty();
  });
}

test("a failed measurement write keeps ratings, context and comment", async ({
  page,
}) => {
  await page.goto("./?view=diary");
  await expect(
    page.getByRole("heading", { name: "Dziennik", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Godzina pomiaru").fill("00:00:00");
  await page.getByLabel("Notatka (opcjonalnie)").fill("Zachowaj ten komentarz");
  await page.getByLabel("Kontekst pomiaru").selectOption("spacer");
  await rateAreas(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "logs")
        throw new DOMException("Simulated write failure", "QuotaExceededError");
      return Reflect.apply(original, this, args);
    };
  });
  await page
    .getByRole("button", { name: "Zapisz pomiar", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Notatka (opcjonalnie)")).toHaveValue(
    "Zachowaj ten komentarz",
  );
  await expect(page.getByLabel("Kontekst pomiaru")).toHaveValue("spacer");
  await expect(page.getByRole("slider").first()).toHaveValue("0");
  await expect(page.locator(".toast-region")).toBeEmpty();
  await expect(
    page.getByRole("button", { name: "Edytuj ten pomiar", exact: true }),
  ).toHaveCount(0);
});
