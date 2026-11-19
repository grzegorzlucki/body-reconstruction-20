# Plan wdrożenia polskiej i angielskiej wersji aplikacji

Status: implementacja PL/EN dodana 18.11.2026. Kod, migracja SQL i szablony e-mail są przygotowane; wdrożenie zdalnej migracji i szablonów oraz odbiór realnego Supabase pozostają krokami wdrożeniowymi. Szczegóły, decyzje względem planu i zakres weryfikacji: `docs/I18N_PL_EN_DEPLOYMENT.md`. Bez commita ani pusha. Zastane zmiany w `.gitignore` pozostają poza zakresem.

## 1. Cel i decyzje produktu

Aplikacja ma działać w całości po polsku i angielsku, także przed zalogowaniem, po ponownym uruchomieniu i przy korzystaniu z wcześniej pobranej wersji PWA. Zmiana języka nie może restartować treningu, zegara, formularza ani sesji Auth.

Decyzje dla pierwszego wdrożenia:

| Obszar | Decyzja |
|---|---|
| Języki UI | `pl` i `en` |
| Formatowanie | `pl-PL` i `en-GB`; angielski wariant europejski |
| Tydzień i jednostki | poniedziałek; kg i sekundy w obu wersjach |
| Waluta | niezależna od języka; nie dodajemy płatności ani automatycznej zmiany PLN na GBP/USD |
| Wybór | „Polski”, „English”, „Automatycznie / Automatic” |
| Przełącznik przed logowaniem | na ekranie logowania/rejestracji/resetu, dostępny także po błędzie inicjalizacji sesji |
| Przełącznik po logowaniu | Profil → Preferencje; na mobile Więcej → Profil → Preferencje |
| Sposób zmiany | od razu, bez przeładowania strony, z osobną informacją o ewentualnym błędzie zapisu preferencji |
| Domyślny język dotychczasowych profili | polski, żeby aktualizacja nie przełączyła istniejących użytkowników przypadkiem |
| Nowe profile | `auto`, chyba że użytkownik świadomie wybrał język przy rejestracji |
| Obsługa innych języków przeglądarki | pierwszy obsługiwany język z `navigator.languages`; gdy brak PL/EN — PL |
| Adresy stron | pozostają istniejące `?view=...`, `?section=...`; bez ścieżek `/pl/` i `/en/` |
| Dane użytkownika | nie tłumaczymy automatycznie nazw planów, obszarów, kontuzji, kontekstów i notatek |
| Zakres merytoryczny | tłumaczenie nie dodaje diagnozy, progresji, porad medycznych ani innych obietnic |

Wersja EN musi obejmować także etykiety dostępności, komunikaty walidacji, błędy, potwierdzenia, wykresy, eksporty użytkowe i wiadomości Auth — nie tylko duże nagłówki.

## 2. Co wymaga zmiany w obecnym kodzie

| Znalezione miejsce | Obecna sytuacja | Planowana zmiana |
|---|---|---|
| `src/app/navigation.ts` | typ `Tab` i część warunków biznesowych używa `Dzisiaj`, `Trening`, `Plany` itd.; URL ma już angielskie slugi | stabilne ID niezależne od etykiet, potem tłumaczone nazwy |
| `src/main.tsx`, `AuthGate.tsx`, `app/LoadingScreen.tsx` | teksty startowe, sesji i widoków na sztywno | provider tłumaczeń ponad AuthGate i App, obie wersje dostępne od startu |
| `src/views/AccountProfileView.tsx` | Preferencje są sekcją informacyjną/linkami | rzeczywiste ustawienie języka z niezależnym zapisem |
| `src/domain.ts` | polskie komunikaty Zod, domyślne obszary/konteksty i mapy etykiet faz | kody walidacji i prezentacja przez słownik; teksty danych oddzielone od UI |
| `src/catalog.ts` | `name`, `detail`, `equipment` są polskimi tekstami | tłumaczenia nazw/opisów/sprzętu po niezmiennym `exerciseId` |
| `src/Plans.tsx` | wyszukiwanie normalizuje teksty pod PL | indeks nazw PL/EN i aliasów; dopasowanie nie zależy od przetłumaczonego ID |
| `SessionFields.tsx`, `intervalTimer.ts` | `L/P`, `L+P`, „Lewa strona” itp. | dane `L/P/both` bez zmiany; angielski wyświetla Left/Right/Both lub L/R |
| `Calendar.tsx`, `PainCharts.tsx`, widoki i analizy | liczne `toLocale...("pl-PL")` | wspólne formatery locale-aware, bez zmiany dat/UTC/stref |
| `SetNumberInput.tsx` | `Number(text)` na wartości kontrolki | audyt wpisywania przecinka/kropki, bez parsowania sformatowanych etykiet jako danych |
| `app/errorMessages.tsx` | dopasowanie treści błędów i zwracanie gotowego PL | normalizacja do kodów, tłumaczenie podczas renderowania |
| `app/useConfirmation.tsx` | modal przechowuje już złożony tekst | deskryptor komunikatu; zmiana języka nie rozwiązuje ponownie Promise |
| `profile/DeleteAccount.tsx` i Edge `delete-account` | polska fraza `USUŃ KONTO` jest też kontraktem wysyłanym na serwer | zlokalizowana fraza wpisywana przez użytkownika, stały token protokołu |
| `db.ts`, `cloudDb.ts`, `account/accountRepository.ts` | brak pola preferowanego języka | skupiony zapis jednego pola, bez resubmisji rehabilitacji |
| `index.html`, `vite.config.ts` | `lang="pl"`, opis PL i manifest `lang: pl` | runtime `html.lang`/opis; jasna polityka manifestu i cache |
| `e2e/`, `src/*.test.ts` | selektory i oczekiwania głównie po polsku | scenariusze PL/EN i testy zgodności danych, URL oraz formularzy |

Nie wykonujemy masowego zamieniania wszystkich polskich napisów w bazie ani w JSON eksportu. To zmieniłoby dane, a nie wyłącznie interfejs.

## 3. Warstwa i18n i struktura modułów

Rekomendacja: `i18next` + `react-i18next`, z wersjami dobranymi do React 19/TypeScript i zapisanymi w lockfile przy implementacji. Nie budujemy własnego silnika odmiany/liczb mnogich. Automatyczne wykrywanie języka można zrobić małą funkcją dla dwóch locale; nie dodawać pakietu detectora, jeśli jego dodatkowe mechanizmy nie są potrzebne.

Planowane nowe pliki:

```text
src/i18n/
  config.ts                 # jedna instancja; supportedLngs, fallback, zasoby
  types.ts                  # Language, LanguagePreference i typy kluczy
  resources.ts              # statyczne importy PL/EN
  LanguageProvider.tsx      # kolejność źródeł, aktualizacja HTML, stan zapisu
  languageStorage.ts        # walidowany cache gościa/per-konto; odporność na brak storage
  formatters.ts             # daty, czas, liczby, zakresy; cache Intl
  messages.ts               # deskryptory komunikatów i mapowanie błędów
  catalogLabels.ts           # label/details/equipment po exerciseId
  locales/pl/{common,auth,profile,workouts,diary,analytics,errors,catalog}.json
  locales/en/{common,auth,profile,workouts,diary,analytics,errors,catalog}.json
src/profile/LanguageSettings.tsx
```

Obie wersje początkowo bundlowane statycznie. Przy dwóch językach i aplikacji PWA zmniejsza to ryzyko oczekiwania na słownik, błędu sieci i migania kluczy podczas startu. Zmierzyć rozmiar gzip przed/po; dopiero rzeczywisty problem uzasadnia lazy-loading tłumaczeń i dodatkową obsługę offline. Same cięższe widoki nadal mogą ładować się leniwie.

Klucze semantyczne, np. `workouts.finish.confirmIncomplete`, zamiast polskich zdań użytych jako klucze. Pełne zdania z parametrami, np. `completed` i `planned`, zamiast sklejania kilku przetłumaczonych fragmentów. Nazwy użytkownika przekazywane jako tekst przez React, bez `dangerouslySetInnerHTML` i bez parsowania notatek jako tłumaczeń.

Fallback PL jest zabezpieczeniem produkcji, nie zgodą na niepełne EN. CI ma blokować brakujące treści. W dev pokazywać brakujące klucze bez wysyłania danych użytkownika do zewnętrznego serwisu tłumaczeniowego.

## 4. Język gościa, konta i sytuacje wyścigu

### Przed uwierzytelnieniem

1. Bezpiecznie odczytać świadomy wybór gościa z wersjonowanego klucza, np. `rehab-ui-language-v1`.
2. Dla `auto` dopasować po kolei `navigator.languages`: `pl-*` → PL, `en-*` → EN; w pozostałym przypadku PL.
3. Zainicjalizować zasoby przed pierwszym renderem AuthGate/loadera. Ustawić `document.documentElement.lang` na efektywny `pl`/`en` i `dir=ltr`.
4. Brak uprawnienia do localStorage nie blokuje aplikacji: preferencja działa w pamięci, a UI nie wpada w pętlę błędu.

### Po uwierzytelnieniu

Preferencja konta jest źródłem prawdy. Cache per `auth.user.id` przyspiesza start; nie należy używać preferencji poprzedniego konta jako ustawienia nowego konta. Tymczasowy wybór na ekranie logowania służy ekranowi logowania, a po pobraniu profilu obowiązuje zapisany język konta.

Ręczna zmiana w zalogowanej aplikacji ma pierwszeństwo nad spóźnionym odczytem profilu. Provider śledzi `accountId` oraz rewizję ręcznej zmiany. Zapisy serializowane per konto albo deduplikowane do ostatniej wartości; samo ignorowanie starej odpowiedzi UI nie wystarcza, jeśli stare żądanie mogłoby nadpisać nowe na serwerze.

Przepływ zmiany:

1. Natychmiast zmienić UI i bieżący cache konta.
2. Zapisać tylko preferencję języka przez skupione RPC.
3. Po sukcesie oznaczyć cache jako zapisany; nie odświeżać całego profilu/treningów i nie remontować App.
4. Po błędzie pozostawić wybrany język na urządzeniu, wyświetlić w nim informację „Nie zapisano języka na koncie” i Retry. Jawnie oznaczyć lokalny stan oczekujący; nie udawać synchronizacji.
5. Po wylogowaniu anulować niewysłane zapisy starego konta i ignorować odpowiedzi, które już nie dotyczą aktywnego konta. Nie odtwarzać starej preferencji z opóźnionego odczytu.

Nowe konto może odziedziczyć świadomy wybór z rejestracji jako zwalidowaną wskazówkę, bez nadpisywania preferencji istniejących kont. `user_metadata.ui_language` może pomagać w mailach, ale nie jest drugim, konkurującym źródłem prawdy ani mechanizmem uprawnień.

## 5. Baza, Dexie i kopie danych

Plan migracji: `supabase/migrations/20261122_profile_language.sql` — nazwa robocza; numer dopasować do faktycznej kolejności wdrożenia.

1. Dodać `public.profiles.preferred_language` z wartościami `pl`, `en`, `auto`.
2. Przy pierwszym dodaniu kolumny przyjąć dla istniejących rekordów `pl`. Następnie ustawić domyślną wartość nowych rekordów na `auto`. Idempotentny rerun nie może ponownie ustawiać istniejących kont na PL ani nadpisywać świadomego wyboru `auto`.
3. Dodać CHECK i RPC `update_profile_language(language_preference text)` działające jako SECURITY INVOKER z pustym search_path. Walidacja enum, aktualizacja wyłącznie profilu `owner_user_id = auth.uid()`, RLS bez zmian. Nie przyjmować dowolnego owner ID od klienta.
4. `cloudDb.profiles` odczytuje pole i toleruje brak kolumny przed migracją jako PL. Nowy zapis bez RPC daje czytelną informację o brakującej migracji, a nie cichy sukces.
5. `accountRepository.ts` dostaje osobną funkcję zapisu. Nie dopisywać języka do całego payloadu ustawień rehabilitacji ani nie zmieniać RPC avatar/name/timezone tylko dla tej preferencji.
6. Dexie v8: zachować stores/klucze, uzupełnić brakujące pole istniejących profili na PL; nowo tworzone profile otrzymują `auto` lub świadomy wybór z tworzenia. Pole należy do Profile/preferencji aplikacji, nie do rekordów pomiarów.
7. Nowe domyślne nazwy obszarów/kontekstów/startera tworzyć w efektywnym języku użytkownika. Aktualny cloud RPC tworzenia profilu ma własne seedy — trzeba rozszerzyć go o opcjonalny, walidowany parametr locale z kompatybilnym domyślnym zachowaniem, a nie zakładać, że tłumaczenie w JS zmieni seed SQL.

Backup v6 pozostaje formatem danych rehabilitacji. UI language nie musi wejść do niego: import ma pozostawić aktualną preferencję konta/urządzenia. To świadoma decyzja zgodna z oddzieleniem ustawień konta od historii. Nie podnosimy wersji backupu tylko z powodu tłumaczeń i nie zmieniamy identyfikatorów ani zapisanych wartości.

## 6. Teksty systemowe a treści zapisane przez użytkownika

### Tłumaczymy

- przyciski, nawigację, nagłówki, puste stany i podpowiedzi;
- opisy faz zegara, stron, statusów treningu i powodów zakończenia;
- etykiety faz pomiaru, filtry, nazwy serii i podpisy wykresów;
- systemowy katalog ćwiczeń i sprzętu po stałym ID;
- etykiety dostępności, modalne potwierdzenia i komunikaty operacji;
- generowane od nowa domyślne etykiety przy zakładaniu nowego profilu.

### Nie tłumaczymy automatycznie

- nazwy profilu i imienia, nazw planów i kontuzji, własnych nazw obszarów;
- treści notatek, opisów oporu gumy/ustawień maszyny i własnych kontekstów;
- nazw i notatek w zaimportowanym JSON, nawet gdy wyglądają jak domyślne polskie napisy;
- historycznych tekstów zapisanych przez starsze wersje aplikacji.

Przykład: UI „Diary” może pokazywać nazwę obszaru „Lewe kolano”, jeśli tak nazwał go użytkownik. To poprawne działanie, nie brak tłumaczenia. Nie wolno uznać tekstu „Spacer” za systemowy wyłącznie dlatego, że zgadza się ze znaną etykietą — użytkownik mógł go świadomie zostawić/edytować. W pierwszym wdrożeniu istniejące zapisane etykiety pozostają danymi. Opcjonalny powrót do domyślnych nazw wymaga osobnej, jawnej akcji z podglądem, nie efektu ubocznego zmiany języka.

Katalog ćwiczeń ma stabilne `exerciseId`; etykiety UI renderować z tłumaczeń. Nie aktualizować masowo globalnej tabeli `exercises` do EN. SQL snapshot `session_exercises.exercise_name` zachować. Obecny adapter planu sesji i tak opiera UI na ID/katalogu; należy jawnie przetestować, że lokalizacja nie podmienia definicji ćwiczenia, wariantu ani sprzętu. Ewentualne udostępnienie historycznej zapisanej nazwy to dodatkowe pole odczytu, nie migracja jej treści.

## 7. Nawigacja niezależna od języka

Zamienić wewnętrzne `Tab` na identyfikatory, np. `today`, `workout`, `diary`, `calendar`, `history`, `analytics`, `plans`, `timer`, `profile`, `security`, `preferences`, `application`, `settings`, `data`, `session-editor`.

- `navigation.ts`: metadane `{id, labelKey, icon, url}`; sekcje profilu też korzystają z kluczy etykiet.
- `main.tsx`, `AppShell`, `AppNavigation`, `AccountMenu`, `useNavigation` i wywołania z widoków porównują ID, nie `t(...)` i nie napisy PL.
- Zachować istniejące angielskie slugi i `?view=profile&section=...`. Nie tłumaczyć `analysis`, `area`, `session`, faz i innych wartości parametrów.
- Nie zmieniać wartości kontekstów `spacer/cwiczenie/spoczynek/inne` w danych/filtrach tylko dlatego, że UI jest angielskie.
- Wstecz/Dalej, link do reakcji konkretnej sesji i dirty guard zachowują się identycznie w obu językach.
- Nie dodawać języka do `key` komponentu App/Workout/Timer ani nie zmieniać routing state podczas samej zmiany locale.

## 8. Komunikaty, walidacja i operacje w toku

Przechowywać komunikat jako `{key, params}` lub błąd `{code, params, cause}`, nie jako gotowy tekst wygenerowany w momencie kliknięcia. Dzięki temu widoczny toast/modal przetłumaczy się po przełączeniu bez uruchamiania operacji drugi raz.

Plan modułów:

- `messages.ts`: typ deskryptora, mapowanie błędów Auth/PostgREST/DOMException i nieznanego błędu.
- `errorMessages.tsx`: render w locale, opcjonalne oryginalne szczegóły techniczne; nie wystawiać surowego błędu jako podstawowego komunikatu.
- `domain.ts`/Zod: stabilne kody problemów; mapper tłumaczy znane issue code + path + parametry. Nie używać globalnego przełączania języka schematów, które mogłoby zmienić zachowanie walidacji lub testów poza React.
- Akcje `usePainLogActions`, `useWorkoutActions`, import/eksport, konto, updater: komunikaty i potwierdzenia przekazywane przez deskryptory. Nazwy użytkownika/planów są parametrami tekstowymi.
- `useConfirmation`: zmiana języka nie zamyka dialogu, nie podwaja resolwera i nie gubi focusu.
- Backend: dodawać stabilne kody tam, gdzie brak wystarczająco precyzyjnych kodów błędu. Sam SQLSTATE `23503` nie oznacza zawsze „braku ćwiczenia”, a `22023` nie identyfikuje konkretnej walidacji. Dla starszych wdrożeń mapowanie legacy + neutralny fallback; nie tłumaczyć przez kruche szukanie jednego polskiego zdania.

**Usuwanie konta:** w EN użytkownik wpisuje `DELETE ACCOUNT`, w PL `USUŃ KONTO`. Klient weryfikuje aktualnie pokazaną frazę i dopiero potem wysyła obecny kanoniczny token protokołu `USUŃ KONTO`, tak długo jak funkcja Edge oczekuje tego kontraktu. Token nie jest widoczną etykietą i nie jest głównym zabezpieczeniem — pozostają hasło/reauth oraz walidacja użytkownika. Zmiana języka unieważnia i czyści jedynie wpisaną frazę potwierdzenia, z informacją dla użytkownika; inne formularze i dane nie są resetowane.

## 9. Daty, czas, liczby i odmiana

Nowe formatery przyjmują locale jawnie; memoizować instancje `Intl.DateTimeFormat`, `Intl.NumberFormat` i ewentualnie `Intl.RelativeTimeFormat` według locale/opcji. Nie tworzyć nowej instancji dla każdej komórki tabeli przy każdym ticku zegara.

1. **Data kalendarzowa** `YYYY-MM-DD`: formatować bez przejścia przez UTC, które mogłoby zmienić dzień; użyć bezpiecznego lokalnego punktu w dacie jak dotychczas. W inputach nadal ISO, nie `18/11/2026`.
2. **Moment w czasie**: w bazie UTC ISO, na ekranie zgodnie z istniejącą konwencją danego widoku. Profil pokazujący strefę konta nadal ją respektuje; dziennik/kalendarz nie przechodzą przy okazji na inną strefę. Ujednolicenie stref całej aplikacji to osobna zmiana biznesowa.
3. **Godzina:** EN-GB i PL używają 24h; sekundy w Dzienniku i dokładny `sourceAt` nadal zachowane. Nie zmieniać pomiaru podczas samej edycji notatki/przełączenia języka.
4. **Liczby:** na ekranie `12,5 kg` w PL i `12.5 kg` w EN; dane nadal numeric. Test `SetNumberInput` dla przecinka/kropki oraz realnych zachowań natywnego type=number. Ewentualny parser ma działać tylko na wejściu i jawnie odrzucać niejednoznaczne separatory, bez zmiany skali/zaokrągleń.
5. **Czas zegara:** `MM:SS` pozostaje licznikiem, bez formatowania datą ani dodawania lokalnych separatorów.
6. **Liczba mnoga:** systemowe formy przez `count`/Intl.PluralRules; PL `one/few/many/other`, EN `one/other`. Testować 0, 1, 2, 5, 12, 22, 25 oraz ułamki tam, gdzie mają sens. Nie sklejać „liczba + stałe słowo seria”.
7. **Sortowanie:** ISO/ID nadal sortowane technicznie jak dotychczas. `Intl.Collator` tylko dla prezentowanych nazw; język nie może zmienić chronologii ani dopasowań raportów.
8. **Wyszukiwanie ćwiczeń:** aktualna nazwa, nazwa drugiego języka i aliasy; zachować wyszukiwanie bez znaków diakrytycznych. Nie tłumaczyć w ten sposób nazw wpisanych przez użytkownika.

## 10. Dostępność i układ mobilny

- Tłumaczyć aria-label/valuetext/describedby, podpisy SVG i komunikaty walidacji, nie tylko widoczny tekst. Numerów HTML id nie uzależniać od tłumaczeń.
- Wybór języka opisany nazwami języków, nie samymi flagami. `Polski`/`English` można oznaczyć odpowiednim `lang`; etykieta przełącznika w aktualnym języku.
- Zachować focus przy zmianie i nie przenosić przewijania na początek. Opcjonalne pojedyncze ogłoszenie o zmianie, bez wielokrotnego czytania całego widoku przez live region.
- Sprawdzić dłuższe angielskie etykiety przycisków i polskie odmiany: min-width 0, zawijanie, touch target min.44px, brak przycinania ramek dat i przycisków.
- Nie resetować pauzy/pozostałego czasu zegara ani suwaków. Nie przełączać istniejącego modala do innego stanu tylko z powodu nowej etykiety.
- Klinicznie wrażliwe opisy „na stronę”, „ciężar dodatkowy/całkowity”, „pomiar zgłoszony”, „kandydat czasowy” wymagają przeglądu znaczenia. EN nie może wzmacniać obietnic bezpieczeństwa/skuteczności.

## 11. Auth e-mail, PWA i wdrożenie

### Wiadomości Supabase

E-maile nie są tłumaczone przez React. Oddzielnie przygotować PL/EN dla potwierdzenia rejestracji, odzyskiwania hasła i zmiany adresu. Dla nowego konta użyć zwalidowanej wskazówki językowej w rejestracji; szablony mogą korzystać z udostępnianych przez Supabase metadanych.

Nie zakładać, że anonimowy reset hasła potrafi sam odczytać `profiles.preferred_language`. Przed wdrożeniem sprawdzić dane dostępne w każdym typie szablonu. Gdy nie można pewnie dobrać języka, stosować prostą wiadomość dwujęzyczną jako bezpieczny fallback. Nie wystawiać publicznego odczytu języka po e-mailu ani nie ujawniać, czy konto istnieje.

Jeżeli pełne dynamiczne dopasowanie wymaga Send Email Hook, potraktować je jako osobny mały backend: autoryzacja webhooka, walidacja języka, reguła fallback i test dostarczalności. Nie blokować działającego resetu hasła przez niedokończony system maili. Aktualizacje Auth metadata są tylko wskazówką; błąd synchronizacji nie cofa ustawienia profilu i nie wylogowuje.

### PWA, HTML i cache

- `index.html` zostaje bezpiecznym statycznym fallbackiem PL; provider ustawia rzeczywiste `html.lang` i lokalizowany opis po inicjalizacji. Nazwa marki może pozostać identyczna.
- Jeden neutralnie nazwany manifest dla dwóch wersji, bez dynamicznych blob URL. `manifest.lang` dotyczy tekstów manifestu, nie wymusza języka UI; opisać statyczny fallback i ograniczenia zmiany nazwy już zainstalowanej aplikacji.
- Statycznie importowane słowniki trafiają do bundla i obecnego precache JS. Jeśli później wydzielimy je jako JSON, trzeba jawnie dopisać je do precache — obecny Vite plugin zbiera tylko JS/CSS.
- Zmiana locale nie czyści cache, IndexedDB ani sesji. Aktualizacja aplikacji nadal przez istniejący AppUpdater. Test offline dopiero po pobraniu/aktywacji nowej wersji SW.
- Przy obecnym podkatalogu `/body-reconstruction-20/` sprawdzić importy słowników, recovery redirect i profile URL; nie tworzyć nowych tras wymagających konfiguracji serwera.

## 12. Batche implementacji — konkretne rezultaty i kolejność

| Batch | Zakres | Kryterium zakończenia |
|---|---|---|
| 0. Inwentaryzacja | wykaz tekstów UI i źródeł danych; glosariusz PL/EN; bazowe screenshoty i ścieżki krytyczne | ustalone nazewnictwo, brak mieszania opisów systemowych z danymi |
| 1. Fundament | zależności, i18n/config/resources/types, provider, wspólne formatery; startowo UI pozostaje PL | provider ponad AuthGate, brak nowego pobierania przy starcie, test wyboru/fallbacku |
| 2. Tożsamość nawigacji | stabilne ID, mapping labelKey i wszystkie wywołania navigate/guardów | stare URL i Wstecz/Dalej działają, etykiety mogą się zmieniać bez zmiany trasy |
| 3. Preferencja języka | LanguageSettings, lokalny cache, Dexie v8, migracja SQL i skupione RPC | nowe/stare konto, offline, błędy zapisu i dwa konta bez wzajemnego nadpisania |
| 4. Start i konto | AuthGate, LoadingScreen, shell/menu/More, profil, bezpieczeństwo, potwierdzenia, updater | pełna ścieżka login/reset/profile/delete po PL i EN; brak restartów |
| 5. Trening i katalog | Plans, SessionFields, WorkoutView, HSR/ExerciseTimer, strony i statusy | kompletny trening i zapis częściowy w EN; wyszukiwanie po obu nazwach |
| 6. Dziennik i historia | Diary, Calendar, History, PainSlider/Charts, formularze dat i liczb | dwa pomiary jednego dnia, poprawna edycja i formatowanie; identyczne zapisy |
| 7. Analizy i dane | wszystkie podwidoki analytics, filtry, statusy, raporty, DataView/import/eksport | brak PL tekstów systemowych w EN; dane i filtry identyczne dla obu locale |
| 8. Backend i e-maile | kody błędów/legacy mapping, obsługa frazy usuwania, szablony Auth/fallback | zgodność starych klientów, dostarczanie maili i bezpieczny recovery |
| 9. Odbiór i rollout | kompletność słowników, testy PL/EN, mobile, SW/offline, dokumentacja | spełniona lista odbioru, migracja przed frontendem, bez automatycznego commita |

Warstwy komunikatów i deskryptorów wprowadzać w batchu 1/4 przed masowym tłumaczeniem akcji. Nie wypuszczać publicznego wyboru EN w batchu 3, jeśli widoki 5–8 są jeszcze po polsku: do tego czasu feature flag lokalna/staging. Każdy batch utrzymuje działającą PL, bez otwartej połowy migracji.

Nie instalować bibliotek i nie wykonywać migracji w ramach samego planowania. W implementacji najpierw przygotować spójną migrację i kod tolerujący stare odczyty, wdrożyć DB, dopiero potem frontend. Rollback frontendu nie usuwa dodanej kolumny ani preferencji.

## 13. Testy i warunki odbioru

Planowane nowe testy:

- `src/i18n.test.ts`: rozpoznawanie języków/regionalnych wariantów, fallback, kompletność semantycznych kluczy i parametrów. Formy liczby mnogiej sprawdzane według reguł danego języka — nie wymagać identycznej listy surowych suffixów PL i EN.
- `src/localeFormatters.test.ts`: zero vs brak, ułamki, daty bez czasu, UTC/DST i różne strefy urządzeń; identyczna wartość mimo różnej prezentacji.
- `src/languagePreference.test.ts`: konto/gość, storage niedostępny, błąd RPC, szybkie PL→EN→PL, spóźnione pobranie profilu i zmiana konta.
- Rozszerzenie `src/db.test.ts`: Dexie v7→v8, niezmieniona historia/identyfikatory, zachowanie locale przy imporcie v1–v6.
- `e2e/localization.spec.ts`: zestaw ścieżek PL/EN — rejestracja/login na mockach, profil, trening częściowy, pomiar, historia, analizy i eksport/import. Osobny odbiór realnego Supabase dla Auth/mail/RLS.
- `e2e/localization-state.spec.ts`: przełączanie przy aktywnym zegarze, pauzie, niezapisanym planie, otwartym dialogu i błędzie; bez restartu timerów, utraty wartości i podwójnego zapisu.
- Rozszerzenie `e2e/mobile-controls.spec.ts`/account/navigation: 320, 360, 390, 430, 768, 1024, 1440, 1920px; PL/EN, długie własne nazwy, 200% zoom. Safari/WebKit osobno od Chromium.
- Scenariusz po aktywacji SW: włączyć offline, przełączyć PL/EN, ponownie otworzyć wcześniej dostępną stronę; bez brakujących słowników. Nie oczekiwać zapisu Supabase bez sieci.

Nie zmieniać wszystkich testów na `data-testid`, żeby ominąć tłumaczenia. Krytyczne przyciski i pola sprawdzać po zlokalizowanej roli/nazwie; testid stosować dla geometrii lub obiektu bez dobrej semantycznej etykiety. Istniejące polskie scenariusze zachować jako regresję.

### Lista akceptacyjna

1. Każdy widoczny tekst systemowy oraz aria/wykres ma wersję PL i EN; brak surowych kluczy i JSON błędów w głównym komunikacie.
2. Po zmianie języka nie zmienia się żaden zapisany pomiar, ciężar, data, ID, nazwa użytkownika ani treść notatki.
3. Przełączenie nie robi reloadu, ponownego logowania ani restartu treningu/zegara i nie gubi draftu.
4. Existing profile pozostaje PL; nowy EN użytkownik otrzymuje angielski UI i właściwe nowe defaulty; inny browser/urządzenie odczytuje zapis konta.
5. Błąd zapisu języka nie blokuje pracy i nie jest przedstawiany jako sukces synchronizacji.
6. Angielska fraza usunięcia konta działa z kanonicznym kontraktem backendu, a niedopasowana fraza nie wysyła operacji.
7. Format PL/EN nie zmienia dnia ani liczby; liczba mnoga jest poprawna; L/P w danych nie zostaje zamienione na L/R w bazie.
8. RLS zapisu preferencji sprawdzone dla dwóch kont; ponowne wykonanie migracji nie resetuje wyborów.
9. Import/eksport v1–v6 działa i nie zmienia języka konta. PWA ma obie wersje offline po aktualizacji.
10. TypeScript, build, testy domeny/persistencji oraz PL/EN E2E przechodzą. Raport odbioru odróżnia emulator od realnego telefonu.

## 14. Dokumentacja i szacowanie prac

Przy implementacji aktualizować `docs/architecture.md` (provider, nawigacja, preferencja, nowy RPC, Dexie i testy), `docs/supabase/README.md` (migracja i konfiguracja maili), `docs/TESTOWANIE.md` oraz główny README (wybór języka i co pozostaje w języku danych).

Szacować po batchu 0 z inwentaryzacją kluczy i tekstów. Osobno wycenić: fundament/persistencję, wydzielenie tekstów, merytoryczny przegląd EN, migracje/e-mail i testy urządzeń. Nie traktować liczby widoków jako liczby prostych podmian tekstu: najwięcej ryzyka jest w danych, komunikatach i stanie w toku. Nie podawać gwarantowanej liczby dni przed tym przeglądem.

Najpierw wdrożyć pełną, poprawną wersję PL/EN istniejącego zakresu. Automatyczne tłumaczenie wpisów, inne języki, język raportu inny niż UI i rozbudowane ustawienia regionalne pozostają kolejnymi funkcjami.

## Źródła techniczne sprawdzone przy planowaniu

- [react-i18next — useTranslation](https://react.i18next.com/latest/usetranslation-hook): dostęp do tłumaczeń i zachowanie Suspense; uzasadnienie gotowych zasobów na starcie.
- [i18next — plurals](https://www.i18next.com/translation-function/plurals): odmiana przez `count` i reguły Intl.
- [Supabase — e-mail templates](https://supabase.com/docs/guides/auth/auth-email-templates): osobna konfiguracja wiadomości Auth; przy implementacji zweryfikować dane każdego flow.

Powyższe rozdziały zachowują pierwotne założenia planu. Aktualny opis wykonania i różnic struktury znajduje się w `docs/I18N_PL_EN_DEPLOYMENT.md`.
