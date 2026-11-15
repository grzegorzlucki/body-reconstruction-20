# Body Reconstruction

[Otwórz aplikację](https://grzegorzlucki.github.io/body-reconstruction-20/)

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

### Supabase

Jeśli po zalogowaniu pojawia się `new row violates row-level security policy for table "profiles"`, uruchom w Supabase SQL Editor kolejno `supabase/migrations/20261115_profiles_auth_users.sql` i `supabase/migrations/20261115_profiles_rls_repair.sql`. Drugi plik zastępuje wyłącznie polityki tabeli `profiles`; nie wymaga klucza `SUPABASE_SECRET_KEY` w przeglądarce. Po opublikowaniu kodu odśwież aplikację przyciskiem w panelu bocznym. Jeżeli błąd trwa, sprawdź w Supabase Authentication, czy konto jest aktywne, oraz w Table Editor, czy `profiles.owner_user_id` ma typ UUID i wskazuje identyfikator tego konta.

Komunikat `Could not find the function public.save_workout_template(payload)` oznacza brak funkcji w działającej bazie Supabase. Uruchom `20261115_atomic_writes.sql`, a potem `20261115_exercise_timers.sql` w SQL Editor. Błąd RLS przy zapisie `timer_settings` wymaga uruchomienia `20261115_timer_settings_rls_repair.sql` po migracji profili. Same pliki w repozytorium nie wykonują migracji na serwerze.

Przed włączeniem zapisu w chmurze zastosuj kolejno pliki SQL z `supabase/migrations/` w projekcie Supabase. Zawierają polityki RLS, katalog ćwiczeń i funkcje atomowego zapisu. Sprawdź ich zgodność z faktycznymi tabelami przed uruchomieniem. W Supabase Auth ustaw adres strony jako dozwolony adres przekierowania dla potwierdzenia e-mail i resetu hasła.

W GitHub **Settings → Secrets and variables → Actions → Variables** ustaw `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY`. Workflow wymaga obu wartości. Są publiczne i trafiają do kodu przeglądarki. Lokalnie skopiuj `.env.example` do `.env.local` i uzupełnij te same wartości. Nigdy nie przekazuj `SUPABASE_SECRET_KEY` do Vite ani GitHub Pages.

Po zalogowaniu w zakładce **Dane** można przenieść wybrany lokalny profil do profilu konta. Import zastępuje dane profilu docelowego w jednej transakcji; lokalna kopia pozostaje na urządzeniu. Wykonaj eksport JSON przed migracją. Brak sieci uniemożliwia zapis do Supabase; aplikacja wyświetla błąd zapisu.

Workflow `.github/workflows/pages.yml` testuje i buduje aplikację z bazą `/body-reconstruction-20/`, następnie zapisuje sam wynik w gałęzi `gh-pages` i zleca natywną budowę Pages. Konfiguracja repozytorium: **Settings → Pages → Source: Deploy from a branch → gh-pages → /(root)**. Publikacja uruchamia się po zmianach gałęzi main lub ręcznie w Actions. Plik `.nojekyll` wyłącza przetwarzanie gotowych plików przez Jekyll.

Darmowy GitHub Pages wymaga publicznego repozytorium. Adres aplikacji: [https://grzegorzlucki.github.io/body-reconstruction-20/](https://grzegorzlucki.github.io/body-reconstruction-20/). Sprawdź wynik workflow, jeśli nowa wersja nie jest jeszcze widoczna.

Na iPhonie otwórz adres HTTPS w Safari → Udostępnij → Dodaj do ekranu początkowego. Pliki aplikacji są dostępne offline, ale zapis danych konta wymaga połączenia z Supabase. Przycisk „Odśwież aplikację” na stałe na dole zakładki Dane sprawdza aktualizację, aktywuje nową wersję offline i przeładowuje aplikację bez kasowania lokalnej bazy. Wymaga internetu; podczas zapisu danych jest niedostępny. Przed odrzuceniem otwartego formularza pojawia się potwierdzenie. Zachowanie na rzeczywistym Safari wymaga sprawdzenia na urządzeniu.

## Korzystanie

W zakładce **Trening → Moje plany** można uruchomić zapisany plan albo wczytać go do dostosowania. Podczas edycji planu przy każdym ćwiczeniu można opcjonalnie włączyć zegar HSR i ustawić czasy ruchu, przygotowania, przerwy oraz dźwięk. Zegar używa liczby serii i powtórzeń zapisanych przy ćwiczeniu. Podczas wykonywania dostępne są pauza, wznowienie, wcześniejsze zakończenie i przerwanie ćwiczenia; niewykonane serie nie są automatycznie oznaczane jako wykonane. Konfiguracja zegara jest kopiowana do sesji, więc późniejsza edycja planu nie zmienia historii. Po ponownym otwarciu strony ukończone i przerwane ćwiczenia zachowują status, a rozpoczęte odliczanie trzeba uruchomić ponownie.

Przed opublikowaniem tej funkcji uruchom w Supabase SQL Editor `supabase/migrations/20261115_exercise_timers.sql` po wcześniejszych migracjach. Bez tej migracji zapisy planów i sesji z zegarem nie będą działać.

W zakładce **Trening** można ułożyć kolejność ćwiczeń, ustawić serie, ciężar, powtórzenia i notatki, nadać planowi nazwę i wybrać **Zapisz jako nowy plan**. Zapis nie rozpoczyna treningu. Wczytany plan można poprawić i wybrać **Zapisz zmiany w planie**. Plany należą do wybranego profilu i w trybie konta są przechowywane w Supabase. Rozpoczęcie treningu tworzy osobną kopię planu w historii.

- Plany: własne szablony (np. Lower A / Lower B), kopiowanie, kolejność ćwiczeń, 1–10 serii, powtórzenia, ciężar i notatki. Dotychczasowy zestaw pozostaje jako „Plan początkowy”.
- Baza: 30 ćwiczeń nóg z wyszukiwarką i filtrem sprzętu. Ćwiczenia z gumą mają pole notatki na opis oporu; ćwiczenia jednostronne opisują powtórzenia na stronę.
- Trening: wybór szablonu i modyfikacje tylko na tę sesję; zamiana jest dostępna również po rozpoczęciu. Nowe ćwiczenie po zamianie ma puste obciążenie i powtórzenia — nie przenosimy kilogramów z innej maszyny. Wpisy serii dla obu kończyn są wspólne; rozpoczętą sesję można wznowić.
- Każda sesja zachowuje własną kopię planu. Edycja lub usunięcie szablonu nie zmienia historii. Obciążenia ustawia się ręcznie. Przed rozpoczęciem widać monitor bólu po ostatnim ukończonym treningu: check-in przed treningiem z tego samego dnia i poranne wpisy z dwóch kolejnych dni (około 24 i 48 h). Braki są oznaczone jako brak danych. Odstęp między treningami jest widoczny, ale nie blokuje rozpoczęcia ani zapisu.
- Historia: dodawanie wcześniejszych treningów, edycja i usuwanie zapisów oraz filtr według ćwiczenia. Trzy osobne wykresy liniowe bólu (ostatnie 14 pomiarów, skala 0–10) pozwalają odczytywać datę, godzinę i wartość przesunięciem palca, myszą lub strzałkami. Odstępy na osi odpowiadają dniom; linia przerywana oznacza lukę w pomiarach.
- Kalendarz: zielona kropka oznacza ukończony trening, pomarańczowa pomiar, obwódka trening w trakcie. Wybrany dzień otwiera formularze.
- Dziennik: codzienna ocena z datą, godziną i kontekstem. Wpisy można poprawić lub usunąć.
- Zegar HSR: konfigurowalne przygotowanie, trzy fazy (Ruch 1 / Zatrzymanie / Ruch 2), powtórzenia, serie i przerwy. Wartość 0 pomija fazę; co najmniej jedna faza musi trwać dłużej niż 0 s. Piknięcia co sekundę lub cisza, pauza i wznowienie, automatyczny zapis ustawień na urządzeniu. Odliczanie trwa po zmianie zakładki aplikacji, ale nie jest wznawiane po zamknięciu lub przeładowaniu strony. Przygotowanie przed pierwszą serią i w końcówce każdej przerwy, bez przerwy po ostatniej. Zegar nie zapisuje wykonanych serii w dzienniku treningu. Podczas używania pozostaw aplikację na ekranie; dźwięk i podtrzymywanie ekranu na rzeczywistym iPhonie wymagają próby na urządzeniu. Ogólne ustawienia zegara nie wchodzą do eksportu; ustawienia przypisane do ćwiczeń w planach i sesjach są eksportowane.
- Profile: kilka osób na jednym urządzeniu może mieć osobne treningi, pomiary, plany i ustawienia zegara. Po zalogowaniu profile konta są przechowywane w Supabase. Istniejące lokalne wpisy można przenieść ręcznie. Dane: eksport JSON v3 obejmuje dane wybranego profilu. Import przyjmuje również kopie v1 i v2 i zastępuje wyłącznie dane wybranego profilu po potwierdzeniu.

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

Po teście usuń zmienną poleceniem `Remove-Item Env:VITE_BASE_PATH`, aby wrócić do lokalnej ścieżki głównej. Szczegóły w [TESTOWANIE.md](TESTOWANIE.md).
