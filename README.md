# Body Reconstruction

## Dokumentacja i instrukcje pracy

Dokumentacja projektu znajduje się w `docs/`. Przed zmianą kodu przeczytaj [instrukcje repozytorium](docs/AGENTS.md), [mapę architektury](docs/architecture.md) i [zasady kodowania](docs/CODE_PRACTICES.md).

- [Weryfikacja aplikacji](docs/TESTOWANIE.md)
- [Konfiguracja i migracje Supabase](docs/supabase/README.md)
- [Plan zmian UI i wyniki weryfikacji](docs/UI_REFINEMENT_PLAN.md)

Lokalne skille znajdują się w `docs/skills/` i zachowują strukturę katalogów wraz z plikami pomocniczymi. Instrukcje `docs/AGENTS.md` trzeba wskazać narzędziu, jeśli automatycznie odczytuje ono wyłącznie `AGENTS.md` z katalogu głównego.

[Otwórz aplikację](https://grzegorzlucki.github.io/body-reconstruction-20/)

Profil konta otwiera się z menu użytkownika w prawym górnym rogu na komputerze lub przez **Więcej → Profil** na telefonie. Sekcje obejmują dane osobowe i zdjęcie, rehabilitację, bezpieczeństwo, preferencje, dane oraz aktualizacje aplikacji. Plany na telefonie są dostępne bezpośrednio w dolnym pasku i przez **Trening → Moje plany**. Strona „Dzisiaj” wita nazwą profilu i udostępnia trening oraz pomiar bólu obok siebie na szerokim ekranie. Przed wdrożeniem zapisu danych konta i awatara zastosuj `supabase/migrations/20261119_account_profile.sql`; usunięcie konta wymaga dodatkowo wdrożenia funkcji `delete-account`, zgodnie z [instrukcją Supabase](docs/supabase/README.md).

Osobisty dziennik aktywności: zapis serii, monitoring samopoczucia, historia oraz kalendarz miesięczny. React + TypeScript + Vite. Dane konta są przechowywane w Supabase; dotychczasowe dane lokalne można przenieść z IndexedDB.

## Prywatność

- Repozytorium i interfejs są publiczne. Nie zawierają indywidualnej dokumentacji medycznej ani danych użytkownika.
- Początkowe dawki są neutralnym szablonem (0 kg dodatkowego obciążenia). Własne wartości wpisuje się w aplikacji; nie są wysyłane do GitHuba.
- Po skonfigurowaniu Supabase wpisy konta są przechowywane w jego bazie danych. Wpisy z poprzedniej wersji mogą pozostać lokalnie w przeglądarce do czasu ich ręcznego usunięcia.
- Lokalna kopia i eksport JSON **nie są szyfrowane hasłem**. Nie publikuj eksportów ani nie przechowuj rzeczywistych wpisów na współdzielonym profilu przeglądarki.
- Dokumenty prywatne, eksporty, katalog narzędzi i dane testów są wyłączone z Git. Do hostingu trafia wyłącznie katalog `dist`.
- Zmiana adresu strony, telefonu lub przeglądarki oznacza inną lokalną bazę. Kopie JSON umożliwiają ręczne przeniesienie danych.

## Uruchomienie lokalne

Node.js 22.12 lub nowszy LTS:

```powershell
npm ci
npm run build
npm run preview -- --port 4173
```

Otwórz http://localhost:4173. Na komputerze, na którym przygotowano projekt, można też użyć `powershell -ExecutionPolicy Bypass -File .\START.ps1`. Tryb programistyczny: `npm run dev`.

## GitHub Pages

Zakładka **Analizy** porównuje zapisane raporty bólu i ukończone treningi; na stronie „Dzisiaj” dostępne jest ich krótkie podsumowanie. Kontuzje i ich powiązane obszary konfiguruje się w ustawieniach profilu, a raport można przypisać do jednej lub kilku kontuzji.

Widoki aplikacji używają adresów `?view=...`, dzięki czemu przycisk Wstecz działa między zakładkami. Na telefonie cztery główne widoki są w dolnej nawigacji, a Historia, Kalendarz, Zegar HSR i Dane znajdują się pod **Więcej**. Strona startowa oraz widoki otwarte z parametrem `view` działają także po ponownym uruchomieniu aplikacji offline, jeżeli nowa wersja została wcześniej pobrana.

### Supabase

Jeśli pojawia się błąd RLS, brak funkcji zapisu lub błąd klucza obcego ćwiczenia, zastosuj migracje opisane poniżej w podanej kolejności. Starsze pliki `*_rls_repair.sql` służyły do doraźnych napraw i nie należy ich uruchamiać po migracji `20261116_canonical_rls.sql`.

Przed włączeniem zapisu w chmurze zastosuj SQL zgodnie z [instrukcją bazy Supabase](docs/supabase/README.md). Opisuje osobno istniejącą bazę i nowy projekt oraz kolejność migracji. Nie uruchamiaj wszystkich plików alfabetycznie: starsze funkcje mogą nadpisać obsługę zegara. Przed wdrożeniem wersji z usuwaniem obszarów uruchom również migrację `20261118_rehab_site_archiving.sql`. W Supabase Auth ustaw adres strony jako dozwolony adres przekierowania dla potwierdzenia e-mail i resetu hasła.

W GitHub **Settings → Secrets and variables → Actions → Variables** ustaw `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY`. Workflow wymaga obu wartości. Są publiczne i trafiają do kodu przeglądarki. Lokalnie skopiuj `.env.example` do `.env.local` i uzupełnij te same wartości. Nigdy nie przekazuj `SUPABASE_SECRET_KEY` do Vite ani GitHub Pages.

Po zalogowaniu w zakładce **Dane** można przenieść wybrany lokalny profil do profilu konta. Import zastępuje dane profilu docelowego w jednej transakcji; lokalna kopia pozostaje na urządzeniu. Wykonaj eksport JSON przed migracją. Brak sieci uniemożliwia zapis do Supabase; aplikacja wyświetla błąd zapisu.

Workflow `.github/workflows/pages.yml` testuje i buduje aplikację z bazą `/body-reconstruction-20/`, następnie zapisuje sam wynik w gałęzi `gh-pages` i zleca natywną budowę Pages. Konfiguracja repozytorium: **Settings → Pages → Source: Deploy from a branch → gh-pages → /(root)**. Publikacja uruchamia się po zmianach gałęzi main lub ręcznie w Actions. Plik `.nojekyll` wyłącza przetwarzanie gotowych plików przez Jekyll.

Darmowy GitHub Pages wymaga publicznego repozytorium. Adres aplikacji: [https://grzegorzlucki.github.io/body-reconstruction-20/](https://grzegorzlucki.github.io/body-reconstruction-20/). Sprawdź wynik workflow, jeśli nowa wersja nie jest jeszcze widoczna.

Na iPhonie otwórz adres HTTPS w Safari → Udostępnij → Dodaj do ekranu początkowego. Pliki aplikacji są dostępne offline, ale zapis danych konta wymaga połączenia z Supabase. Przycisk „Odśwież aplikację” znajduje się w pasku bocznym na komputerze i nad treścią na telefonie. Sprawdza aktualizację, aktywuje nową wersję offline i przeładowuje aplikację bez kasowania lokalnej bazy. Wymaga internetu; podczas zapisu danych jest niedostępny. Profile settings are available in the Settings tab. Usuwanie danych i opuszczanie niezapisanych formularzy wymaga potwierdzenia w aplikacji; zamknięcie karty z niezapisanymi zmianami wywołuje ostrzeżenie przeglądarki. Zachowanie na rzeczywistym Safari wymaga sprawdzenia na urządzeniu.

## Korzystanie

Zegar HSR obsługuje tryb **Ćwiczenie jednostronne — obie strony po kolei**: wykonuje wszystkie powtórzenia na pierwszą stronę, odlicza przygotowanie do zmiany strony, wykonuje powtórzenia na drugą stronę i dopiero rozpoczyna przerwę. Można wybrać pierwszą stronę i czas przygotowania. Jedna seria obejmuje obie strony. Opcja jest dostępna także w zegarze ćwiczenia w planie. Dla zapisu ustawień samodzielnego zegara w Supabase uruchom `supabase/migrations/20261120_unilateral_timer.sql`.

W zakładce **Trening → Moje plany** można uruchomić zapisany plan albo wczytać go do dostosowania. Podczas edycji planu przy każdym ćwiczeniu można opcjonalnie włączyć zegar HSR i ustawić czasy ruchu, przygotowania, przerwy oraz dźwięk. Zegar używa liczby serii i powtórzeń zapisanych przy ćwiczeniu. Podczas wykonywania dostępne są pauza, wznowienie, wcześniejsze zakończenie i przerwanie ćwiczenia; niewykonane serie nie są automatycznie oznaczane jako wykonane. Konfiguracja zegara jest kopiowana do sesji, więc późniejsza edycja planu nie zmienia historii. Po ponownym otwarciu strony ukończone i przerwane ćwiczenia zachowują status, a rozpoczęte odliczanie trzeba uruchomić ponownie.

Przed opublikowaniem tej funkcji uruchom w Supabase SQL Editor `supabase/migrations/20261115_exercise_timers.sql` po wcześniejszych migracjach. Bez tej migracji zapisy planów i sesji z zegarem nie będą działać.

W zakladce Trening ukladasz plany nalezace do profilu konta. W Supabase plany sa przypisane do jednego profilu konta; lokalne profile mozna wybrac jako zrodlo migracji w zakladce Dane. Rozpoczecie treningu zapisuje osobna kopie planu w historii.

- Plany: własne szablony (np. Lower A / Lower B), kopiowanie, kolejność ćwiczeń, 1–10 serii, powtórzenia, ciężar i notatki. Dotychczasowy zestaw pozostaje jako „Plan początkowy”.
- Baza: 30 ćwiczeń nóg z wyszukiwarką i filtrem sprzętu. Ćwiczenia z gumą mają pole notatki na opis oporu; ćwiczenia jednostronne opisują powtórzenia na stronę.
- Trening: wybór szablonu i modyfikacje tylko na tę sesję; zamiana jest dostępna również po rozpoczęciu. Nowe ćwiczenie po zamianie ma puste obciążenie i powtórzenia — nie przenosimy kilogramów z innej maszyny. Wpisy serii dla obu kończyn są wspólne; rozpoczętą sesję można wznowić. Ćwiczenie bez zegara można zakończyć wcześniej. Trening można zapisać z mniejszą liczbą serii po potwierdzeniu podsumowania; niewykonane serie pozostają niezaznaczone w historii.
- Każda sesja zachowuje własną kopię planu. Edycja lub usunięcie szablonu nie zmienia historii. Obciążenia ustawia się ręcznie. Przed rozpoczęciem widać monitor bólu po ostatnim ukończonym treningu: check-in przed treningiem z tego samego dnia i poranne wpisy z dwóch kolejnych dni (około 24 i 48 h). Braki są oznaczone jako brak danych. Odstęp między treningami jest widoczny, ale nie blokuje rozpoczęcia ani zapisu.
- Historia: dodawanie wcześniejszych treningów, edycja i usuwanie zapisów oraz filtr według ćwiczenia. Trzy osobne wykresy liniowe bólu (ostatnie 14 pomiarów, skala 0–10) pozwalają odczytywać datę, godzinę i wartość przesunięciem palca, myszą lub strzałkami. Odstępy na osi odpowiadają dniom; linia przerywana oznacza lukę w pomiarach.
- Kalendarz: zielona kropka oznacza ukończony trening, pomarańczowa pomiar, obwódka trening w trakcie. Wybrany dzień otwiera formularze.
- Dziennik: codzienna ocena bólu suwakiem 0–10 z datą, godziną i kontekstem. Wpisy można poprawić lub usunąć. Przy kończeniu treningu można opcjonalnie ocenić ból w monitorowanych obszarach; pomiar zostanie dodany do Dziennika.
- Zegar HSR: konfigurowalne przygotowanie, trzy fazy (Ruch 1 / Zatrzymanie / Ruch 2), powtórzenia, serie i przerwy. Wartość 0 pomija fazę; co najmniej jedna faza musi trwać dłużej niż 0 s. Piknięcia co sekundę lub cisza, pauza i wznowienie, automatyczny zapis ustawień na urządzeniu. Odliczanie trwa po zmianie zakładki aplikacji, ale nie jest wznawiane po zamknięciu lub przeładowaniu strony. Przygotowanie przed pierwszą serią i w końcówce każdej przerwy, bez przerwy po ostatniej. Zegar nie zapisuje wykonanych serii w dzienniku treningu. Podczas używania pozostaw aplikację na ekranie; dźwięk i podtrzymywanie ekranu na rzeczywistym iPhonie wymagają próby na urządzeniu. Ogólne ustawienia zegara nie wchodzą do eksportu; ustawienia przypisane do ćwiczeń w planach i sesjach są eksportowane.
- Profile: each Supabase account has one database-backed profile with configurable name, weekly workout goal, check-in time, rehabilitation areas, diary contexts, and injury episodes. Reports can be linked to injuries. The Analyses tab summarizes diary and training data; the home screen shows a compact seven-day summary. JSON backup v5 includes profile settings, injuries, and report links; imports accept earlier versions too.

Aplikacja pokazuje zapisane pomiary bólu bez automatycznych sugestii progresji lub regresji. Decyzję o obciążeniu podejmuje użytkownik.

## Testowanie

```powershell
npm test
npm run build
npx playwright install chromium
npx playwright test
```

Test wersji z podkatalogiem GitHub Pages:

```powershell
$env:VITE_BASE_PATH = '/body-reconstruction-20/'
npm run build
npx playwright test
```

Po teście usuń zmienną poleceniem `Remove-Item Env:VITE_BASE_PATH`, aby wrócić do lokalnej ścieżki głównej. Szczegóły w [TESTOWANIE.md](docs/TESTOWANIE.md).
