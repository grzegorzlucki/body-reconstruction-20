# Weryfikacja aplikacji

Zasoby Pages i PWA: `node --test scripts/verify-pages.test.mjs` sprawdza kompletny build oraz odrzucanie brakującego skryptu wejściowego/lazy chunku, złej ścieżki bazowej, błędnego rozmiaru PNG i przypadkowych plików środowiska/kluczy uprzywilejowanych. `e2e/pages-assets.spec.ts` sprawdza manifest, favikony, ikony PWA, angielski plik diagnostyczny i odczyt ikony/strony offline pod `/body-reconstruction-20/`. `npm run verify:pages -- /body-reconstruction-20/` jest wykonywane w CI przed i po skopiowaniu plików publikacji.

Reset formularza i potwierdzenia zapisu: `e2e/diary-feedback.spec.ts` sprawdza czyszczenie ocen/kontekstu/komentarza po dodaniu i edycji, zachowanie wybranego dnia, tworzenie kolejnego odrębnego wpisu oraz zachowanie szkicu po symulowanym błędzie IndexedDB. Powiadomienie jest sprawdzane na telefonie i desktopie: brak przechwytywania kliknięć, pozycja nad mobilną nawigacją, zanikanie, usunięcie po czasie i nowy czas widoczności przy identycznym kolejnym zapisie. Scenariusze analiz oczekują teraz nowego, pustego pomiaru po zapisaniu zamiast pozostawania w edycji.

Wersje PL/EN: `src/i18n/*.test.ts` sprawdzają wybór języka, pary tłumaczeń i interpolacje, odmianę liczebników, formatowanie, izolację cache i odmowę storage, kolejność zapisów RPC oraz migrację Dexie v7→v8. `src/db.test.ts` sprawdza zachowanie preferencji po imporcie kopii v6. `e2e/i18n.spec.ts` sprawdza trwałość wyboru, angielskie lazy views, wyszukiwanie ćwiczeń PL/EN oraz przełączenie bez resetu zegara i bez utraty szkicu planu. Polskie scenariusze mają jawne `locale: pl-PL`; nowe konta mogą używać automatycznej detekcji. Zdalne RLS i dostarczanie e-maili wymagają osobnego odbioru opisanym w `docs/I18N_PL_EN_DEPLOYMENT.md`.

Skalowanie formularzy: `e2e/rehab-layout.spec.ts` sprawdza ustawienia przy 320, 390, 768, 1024, 1440 i 1920 px, w tym checkbox obok tekstu, rozmiar i brak obcięcia przycisków, brak nadmiarowego marginesu desktopowego i nierozciągnięte pozycje nawigacji. Po poprawce skalowania: TypeScript/build, 34 testy jednostkowe i 15 scenariuszy przeglądarkowych zaliczone; wygląd formularza sprawdzony na zrzutach mobilnym i desktopowym.

Układ desktopowy: `e2e/responsive-navigation.spec.ts` sprawdza karty treningu i pomiaru obok siebie przy 1440×650, dostęp do zegara z przewijanej nawigacji oraz brak poziomego przewijania przy szerokościach 320–1440 px. Test profilu sprawdza również, że po zmianie nazwy strona Dzisiaj wita użytkownika nową nazwą, a mobilny profil jest dostępny przez Więcej. Weryfikacja tej zmiany: TypeScript/build, 34 testy jednostkowe i 10 wybranych testów przeglądarkowych zakończone powodzeniem.

Tryb jednostronny HSR: `src/intervalTimer.test.ts` sprawdza kolejność stron, dodatkowe przygotowanie, przerwę po obu stronach, czas całkowity, granice faz i zgodność dawnych ustawień. `src/plans.test.ts` sprawdza kopię ustawień do sesji. `e2e/timer.spec.ts` obejmuje konfigurację, zapis lokalny, zmianę strony, pauzę, przygotowanie przed następną serią i zakończenie.

Profil konta: `e2e/account-profile.spec.ts` sprawdza zapis nazwy w lokalnej bazie, ochronę niezapisanych zmian, powrót między sekcjami oraz rozwijane menu konta i Escape na komputerze. Testy nawigacji i aktualizacji uwzględniają Profil w menu Więcej i mobilne odświeżanie w sekcji Aplikacja. Testy lokalne nie potwierdzają działania Supabase Auth/Storage ani serwerowego usuwania konta. Po zastosowaniu `20261119_account_profile.sql` i wdrożeniu funkcji przetestuj zmianę e-maila/hasła, zdjęcie i odmowę dostępu drugiego konta oraz usunięcie jednorazowego konta z syntetycznymi danymi.

Tryb konta Supabase wymaga osobnego sprawdzenia po zastosowaniu migracji SQL: rejestracja i potwierdzenie e-mail, reset hasła, utworzenie profilu, zapis treningu oraz pomiaru, import lokalnego profilu i odmowa dostępu do danych innego konta. Lokalne testy Vitest nie uruchamiają prawdziwej bazy Supabase ani polityk RLS.

Profile: `src/db.test.ts` sprawdza rozdzielenie danych między profilami oraz import zastępujący dane tylko wybranego profilu. Migracja IndexedDB do wersji 3 przypisuje dotychczasowe dane do profilu głównego.

Testy używają danych syntetycznych. Nie zawierają dokumentacji ani indywidualnego profilu użytkownika.

Zakres: monitor bólu i brakujące pomiary, walidacja importu, odtworzenie bazy, wspólna edycja serii, zgodność starszego formatu, daty historyczne, niedozwolone nakładanie treningów, kalendarz, zapis po odświeżeniu oraz działanie offline.

Komendy: `npm test`, `npm run build`, `npx playwright test`.

Playwright uruchamia podgląd na porcie 4176. Zmienna `VITE_BASE_PATH=/body-reconstruction-20/` umożliwia sprawdzenie tego samego podkatalogu co w GitHub Pages. Przed testem należy zbudować aplikację z tą samą zmienną i zakończyć wcześniejszy serwer testowy. Pobieranie kopii JSON wymaga wolnego miejsca w katalogu tymczasowym systemu; w razie potrzeby ustaw `TEMP` i `TMP` na katalog z wolnym miejscem przed uruchomieniem testów.

Chromium z emulacją telefonu nie zastępuje testu Safari na rzeczywistym iPhonie. Testy weryfikują zachowanie oprogramowania, nie skuteczność medyczną planu ani progów.


Szablony i migracja: `src/plans.test.ts`, `src/db.test.ts` i `e2e/plans.spec.ts` sprawdzają zmienną liczbę serii, kopię planu w sesji, zamianę bez przenoszenia obciążeń, filtrowanie bazy, tworzenie/kopiowanie/edycję/usunięcie szablonu, import/eksport v2 i aktualizację rzeczywistej bazy IndexedDB v1 bez usuwania starego treningu.

W środowisku chmurowym można użyć zainstalowanego systemowego Chromium przez lokalną konfigurację `.tools/playwright.cloud.config.ts`: `CI=1 npx playwright test --config .tools/playwright.cloud.config.ts`. Emulacja telefonu nie potwierdza działania na fizycznym Safari.


`e2e/update.spec.ts` sprawdza rzeczywistą instalację i aktywację nowej wersji service workera w otwartej aplikacji, zachowanie treningu i planu, ponowne działanie offline oraz dostępność przycisku aktualizacji z paska bocznego lub nad treścią na telefonie. Test tymczasowo zmienia wygenerowane pliki `dist` i przywraca je w `finally`; testy uruchamiamy z jednym workerem.

`e2e/responsive-navigation.spec.ts` sprawdza nawigację, Wstecz, potwierdzenie opuszczenia niezapisanego planu i brak poziomego przewijania przy 320, 390, 768, 1024 i 1440 px. `e2e/profiles.spec.ts` sprawdza, że pomiar zapisany w jednym lokalnym profilu nie pojawia się w drugim po przełączeniu. Test planów sprawdza również, że anulowanie usunięcia zachowuje plan.


`e2e/pain-charts.spec.ts` sprawdza trzy osobne wykresy, brak danych i pojedynczy punkt, rzeczywiste odstępy dat, luki w pomiarach, obsługę klawiatury i przesuwanie palcem przez zdarzenia dotykowe Chromium (CDP). Testy używają wyłącznie danych syntetycznych. Działanie na fizycznym Safari wymaga sprawdzenia na urządzeniu.
# Analytics expansion checks

Mobile date/avatar/loading regressions: `npx playwright test e2e/mobile-controls.spec.ts` checks 320–1440px control bounds (relative to labels/cards), More avatar geometry, populated/empty date fields, initial full-screen loading, reduced motion and lazy-view loading with navigation retained. `src/authSession.test.ts` covers signed-out resolution, rejected reads/retry, timeout, late results, password recovery precedence and unmount cleanup. Chromium emulation does not verify physical Safari or installed iOS PWA behavior; WebKit is not installed in the current environment.

`src/analytics.test.ts` covers daily weighting/median, real zero vs missing data, unilateral group counting, actual dose, time windows across midnight/DST, context/ownership, confirmed-vs-candidate matching, intervening training and backup compatibility. `src/db.test.ts` checks linked-report import remapping and report preservation on session deletion.

`e2e/analytics.spec.ts` checks five subviews, URL filters/back navigation and overflow at 320/390/1024/1920px, plus independent same-day report editing. Run `npx playwright test e2e/analytics.spec.ts` against a local configuration without Supabase credentials. SQL/RLS acceptance requires the staging checks in `docs/supabase/README.md`.
