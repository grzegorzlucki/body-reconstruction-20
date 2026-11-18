import { test, expect, type Page } from "@playwright/test";
import { openTab } from "./helpers";

async function expectDateBounds(page: Page) {
  const controls = page.locator(
    'input[type="date"], input[type="time"], input[type="datetime-local"]',
  );
  expect(await controls.count()).toBeGreaterThan(0);
  for (const input of await controls.all()) {
    const geometry = await input.evaluate((element) => {
      const rect = element.getBoundingClientRect(),
        label = element.closest("label")!.getBoundingClientRect();
      const card = element
        .closest(".panel, .injury-config")
        ?.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        labelLeft: label.left,
        labelRight: label.right,
        cardLeft: card?.left ?? 0,
        cardRight: card?.right ?? innerWidth,
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(geometry.labelLeft - 1);
    expect(geometry.right).toBeLessThanOrEqual(geometry.labelRight + 1);
    expect(geometry.left).toBeGreaterThanOrEqual(geometry.cardLeft);
    expect(geometry.right).toBeLessThanOrEqual(geometry.cardRight);
    expect(geometry.width).toBeGreaterThan(90);
    expect(geometry.height).toBeGreaterThanOrEqual(44);
  }
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
}

for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
  test(`native date and time fields stay inside cards at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("./?view=diary");
    await expect(
      page.getByRole("heading", { name: "Dziennik", exact: true }),
    ).toBeVisible();
    await expectDateBounds(page);
    await page.getByLabel("Godzina pomiaru", { exact: true }).fill("12:34:56");
    await page.getByLabel("Dzień", { exact: true }).fill("");
    await expectDateBounds(page);
    await page.goto("./?view=history");
    await page
      .getByRole("button", { name: "Dodaj trening historyczny" })
      .click();
    await expectDateBounds(page);
  });
}

test("More profile avatar remains circular and profile controls fit on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("./");
  await page.getByRole("button", { name: "Więcej widoków" }).click();
  const profile = page
    .getByRole("dialog", { name: "Więcej widoków" })
    .getByRole("button", { name: "Profil", exact: true });
  const avatar = profile.locator(".profile-avatar");
  const rect = await avatar.boundingBox();
  expect(rect).not.toBeNull();
  expect(Math.abs(rect!.width - rect!.height)).toBeLessThanOrEqual(1);
  expect(rect!.width).toBe(32);
  expect((await profile.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await profile.click();
  const overview = page.locator(".profile-overview .profile-avatar");
  const size = await overview.boundingBox();
  expect(size!.width).toBe(size!.height);
  await openTab(page, "Ustawienia");
  await page
    .getByRole("button", { name: "Dodaj kontuzję", exact: true })
    .click();
  await expectDateBounds(page);
});

test("startup uses a full-screen reduced-motion loader before local records resolve", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const original = indexedDB.open.bind(indexedDB);
    const descriptor = Object.getOwnPropertyDescriptor(
      IDBRequest.prototype,
      "onsuccess",
    )!;
    indexedDB.open = (...args: Parameters<IDBFactory["open"]>) => {
      const request = original(...args);
      Object.defineProperty(request, "onsuccess", {
        set(handler: ((event: Event) => void) | null) {
          descriptor.set!.call(
            request,
            handler
              ? (event: Event) =>
                  setTimeout(() => handler.call(request, event), 1500)
              : null,
          );
        },
      });
      return request;
    };
  });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  const loader = page.locator(".loading-screen-full");
  await expect(loader).toHaveText("Wczytywanie…");
  await expect(page.locator(".shell")).toHaveCount(0);
  expect(
    await loader
      .locator(".loading-ring")
      .evaluate((ring) => getComputedStyle(ring).animationName),
  ).toBe("none");
  await expect(page.getByRole("heading", { name: /^Cześć/ })).toBeVisible();
  await expect(loader).toHaveCount(0);
});

test("lazy view loading keeps navigation and uses the shared content loader", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/assets/AnalyticsView-*.js", async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto("./?view=analytics", { waitUntil: "domcontentloaded" });
  try {
    await expect(page.locator(".shell .loading-screen")).toHaveText(
      "Wczytywanie…",
    );
    await expect(page.locator(".loading-screen-full")).toHaveCount(0);
    await expect(page.locator(".phone-nav")).toBeVisible();
  } finally {
    release();
  }
  await expect(
    page.getByRole("heading", { name: "Analizy", exact: true }),
  ).toBeVisible();
});
