# Mapa architektury

Przewodnik po repozytorium Body Reconstruction: gdzie szukać kodu dla głównych funkcji i jak przepływają dane. Aplikacja jest klientową aplikacją React + TypeScript, budowaną przez Vite. Dane użytkownika są przechowywane lokalnie w IndexedDB (Dexie); aplikacja nie ma backendu ani synchronizacji.

## Szybka nawigacja

| Jeśli zmieniasz… | Zacznij tutaj | Powiązane miejsca |
|---|---|---|
| Widok, nawigację, formularze, zapis/edycję danych lub import/eksport | `src/main.tsx` | `src/SessionFields.tsx`, `src/Plans.tsx`, `src/Calendar.tsx`, `src/PainCharts.tsx` |
| Reguły treningu, walidację, format kopii, monitor bólu lub operacje na sesjach | `src/domain.ts` | `src/domain.test.ts`, `src/editing.test.ts` |
| Tabele IndexedDB, migrację bazy lub odczyt/zapis kopii | `src/db.ts` | `src/db.test.ts` |
| Ćwiczenia, sprzęt, etykiety i początkowy dobór ćwiczeń | `src/catalog.ts` | `src/domain.ts`, `src/Plans.tsx` |
| Edycję pól serii albo liczbowy input | `src/SessionFields.tsx` | `src/SetNumberInput.tsx` |
| Tworzenie i edycję planów, wybór ćwiczeń | `src/Plans.tsx` | `src/catalog.ts`, `src/domain.ts`, `src/plans.test.ts` |
| Kalendarz i nawigację z dnia do formularza | `src/Calendar.tsx` | `src/main.tsx` |
| Wykresy bólu, podpowiedzi/obsługę punktów | `src/PainCharts.tsx` | `src/main.tsx`, `e2e/pain-charts.spec.ts` |
| Logikę i interfejs zegara HSR | `src/intervalTimer.ts`, `src/IntervalTimer.tsx` | `src/intervalTimer.test.ts`, `e2e/timer.spec.ts` |
| Aktualizację aplikacji/offline i service workera | `src/AppUpdater.tsx`, `vite.config.ts` | `src/main.tsx`, `e2e/update.spec.ts` |
| Wygląd globalny | `src/style.css` | JSX w `src/*.tsx` |

## Moduły i odpowiedzialności

- **`src/main.tsx` — składarka aplikacji.** Inicjalizuje React, otwiera/odświeża dane, utrzymuje stan widoku i formularzy, koordynuje zapis przez `db` i renderuje zakładki: Dzisiaj, Trening, Dziennik, Kalendarz, Historia, Plany, Zegar HSR oraz Dane. Obsługuje też edytor treningu historycznego. Jeśli zmieniasz zachowanie widoku lub przepływ między ekranami, tu znajduje się główna integracja.
- **Komponenty UI:** `SessionFields.tsx` edytuje serie bieżącego i historycznego treningu; `SetNumberInput.tsx` jest współdzielonym polem liczbowym; `Plans.tsx` zawiera wybór ćwiczeń, edytor planu i listę szablonów; `Calendar.tsx` prezentuje dni z treningami i pomiarami; `PainCharts.tsx` rysuje trzy wykresy bólu; `IntervalTimer.tsx` obsługuje ustawienia, przebieg, pauzę i dźwięk zegara; `AppUpdater.tsx` obsługuje aktualizację service workera.
- **`src/domain.ts` — typy i logika domenowa.** Zawiera schematy Zod i typy planów, sesji, serii, pomiarów oraz kopii; funkcje walidujące, tworzące sesję, grupujące serie, zamieniające ćwiczenie, obsługujące datę lokalną i wyznaczające wpisy monitora bólu. Tu umieszczaj reguły niezależne od React i IndexedDB.
- **`src/catalog.ts` — katalog ćwiczeń.** Definiuje zestaw ćwiczeń początkowych i pełny katalog do wyboru, w tym sprzęt, stronność i domyślne wartości. `exerciseById` jest używane przez logikę domenową do rozwiązywania identyfikatorów.
- **`src/db.ts` — trwałość danych.** Definiuje bazę Dexie `body-reconstruction-v1`, tabele `logs`, `sessions`, `templates`, migrację schematu do wersji 2 oraz transakcyjny eksport/import JSON. Import waliduje dane schematem z `domain.ts` i zastępuje całą lokalną bazę.
- **Zegar:** `src/intervalTimer.ts` jest czystą logiką ustawień, walidacji, obliczania pozycji i formatowania; `IntervalTimer.tsx` realizuje interakcję. Ustawienia zegara są w `localStorage`, poza kopią bazy treningowej.
- **Styl i zasoby:** `src/style.css` zawiera globalne style. `public/` zawiera ikony, manifest źródłowy i pliki statyczne. `index.html` jest dokumentem startowym.

## Przepływ danych

1. `src/main.tsx` po uruchomieniu pobiera sesje, pomiary i plany z `src/db.ts` (Dexie) i trzyma je w stanie React.
2. Interakcje użytkownika przechodzą przez obsługę widoków/formularzy w `main.tsx` i wyspecjalizowanych komponentów. Reguły oraz walidacja danych są w `src/domain.ts` (Zod); katalog ćwiczeń pochodzi z `src/catalog.ts`.
3. Zmiany są zapisywane w IndexedDB. Po operacjach zapisujących aplikacja odświeża lokalny stan z bazy. Sesja treningowa przechowuje własną kopię planu, więc późniejsze zmiany szablonu nie modyfikują historii.
4. Eksport tworzy JSON v2 zawierający pomiary, sesje i szablony. Import przyjmuje v1 i v2, waliduje zawartość, a następnie transakcyjnie zastępuje lokalne dane.
5. W produkcji `src/main.tsx` rejestruje service workera generowanego przez `vite.config.ts`. Konfiguracja Vite buduje manifest i cache offline z uwzględnieniem `VITE_BASE_PATH` (m.in. dla GitHub Pages).

## Testy i narzędzia

- Testy jednostkowe Vitest znajdują się obok kodu: `src/*.test.ts`. Pokrywają domenę, walidację i edycję (`domain.test.ts`, `editing.test.ts`), bazę i kopie (`db.test.ts`), plany (`plans.test.ts`) oraz obliczenia zegara (`intervalTimer.test.ts`). Vitest uruchamia pliki `src/**/*.test.ts`.
- Testy E2E Playwright są w `e2e/`; konfiguracja telefonu, strefy `Europe/Warsaw` i serwera podglądu jest w `playwright.config.ts`. Scenariusze obejmują aplikację, historię, ból, plany, trening/serie, zegar i aktualizację/offline.
- `TESTOWANIE.md` opisuje zakres testów i dodatkowe uwagi środowiskowe; `README.md` opisuje uruchomienie, hosting Pages, funkcje oraz prywatność.
- Polecenia z `package.json`: `npm run dev` uruchamia Vite, `npm run build` wykonuje sprawdzenie TypeScript i buduje `dist`, `npm run preview` serwuje build, `npm test` uruchamia Vitest. Dla E2E: zbuduj aplikację, następnie uruchom `npx playwright test`.

## Konfiguracja wdrożenia

- `vite.config.ts` ustala ścieżkę bazową z `VITE_BASE_PATH`, sprawdza jej format oraz generuje w `dist` manifest i service workera. Build do podkatalogu powinien używać tej samej ścieżki co konfiguracja Playwright.
- `vitest.config.ts` ogranicza testy jednostkowe do `src/**/*.test.ts`; `playwright.config.ts` wskazuje `e2e/` i uruchamia `npm run preview` na porcie 4176.
- `START.ps1` jest lokalnym skryptem startowym. `public/manifest.webmanifest` stanowi statyczny zasób manifestu, a manifest produkcyjny jest generowany dla buildu przez konfigurację Vite.
