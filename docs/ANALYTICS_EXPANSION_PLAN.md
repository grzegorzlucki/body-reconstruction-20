# Plan rozbudowy analiz bólu i treningów

Status: wdrożono podstawowy zakres analiz, metadane raportów, niezależną edycję, backup v6 i migrację `20261121_analytics_links.sql`. Bez commita. Podstawa: przegląd `src/analytics.ts`, `src/views/AnalyticsView.tsx`, `src/PainCharts.tsx`, `src/domain.ts` i akcji zapisu dziennika/treningu.

## Stan implementacji

- Dostępne: pięć podwidoków, filtry URL i Wstecz/Dalej, pełny zakres wykresów, dzienne mediany/surowe pomiary, liczebności i pokrycie, sesje puste/częściowe/w toku, tygodniowe serie/powtórzenia i dawka per sesja, kontrolne okna czasu z oznaczeniem źródła i innych sesji.
- Dziennik tworzy wiele pomiarów dziennie i edytuje po ID. Relacje sesji i fazy są zapisywane lokalnie/w chmurze; powód zakończenia jest opcjonalny. Import v1–v6 i usuwanie sesji zachowują pomiary. Dzisiaj i Historia otwierają analizę wybranej sesji.
- Migracja jest przygotowana do ręcznego zastosowania; lokalne testy nie potwierdzają polityk na działającym projekcie Supabase. Procedura odbioru dla dwóch kont jest w `docs/supabase/README.md`.
- Opcjonalne rozszerzenia: osobna strona monitorowanego obszaru i jawne mapowanie ćwiczenie–obszar. Obecna wersja nie wyciąga tych powiązań z nazw, kontuzji ani zegara. Nie dodano wykresu korelacji ani rekomendacji medycznych.
- Odczyt nadal korzysta ze wspólnego profilu już załadowanego przez aplikację; nie dodaje osobnego pobierania dla każdego podwidoku. Paginacja prezentacji ogranicza liczbę wierszy DOM. Przenoszenie zakresów/agregacji na serwer wymaga osobnej zmiany współdzielonego repozytorium, gdy wielkość danych to uzasadni.

## 1. Faktyczne ograniczenia obecnego rozwiązania

1. Analizy prezentują liczbę zakończonych sesji, raporty, średnie ocen obszarów, wykresy i listę kontekstów. Nie łączą dawki rzeczywiście wykonanego treningu z późniejszymi pomiarami.
2. `PainCharts` ogranicza dane do 14 ostatnich wpisów. Wybranie 90 lub 365 dni nie oznacza, że cały ten okres jest widoczny na wykresie.
3. Średnia jest liczona po wpisach. Dzień z wieloma pomiarami waży więcej niż dzień z jednym pomiarem. Mieszane są konteksty i pory pomiaru.
4. Kontuzja/obszar filtrują raporty, a licznik sesji pozostaje globalny (obecnie podpisany jako treningi profilu). Nowe widoki muszą jawnie określać zakres każdej statystyki.
5. Pomiar po treningu używa ID sesji jako ID raportu, pustego kontekstu i notatki tekstowej. Nie istnieje jawny klucz sesji ani typ pomiaru. To za mało do niezawodnych relacji.
6. `savePain` wybiera i zastępuje ostatni raport z daty; `editDate` też otwiera ostatni. Użytkownik może przez to zmienić pomiar potreningowy zamiast utworzyć niezależny pomiar dzienny.
7. `painMonitor` bierze najnowszy raport z następnego dnia kalendarzowego, nie pomiar najbliższy 24/48 godzinom. Nazwa "poranek" również nie wynika z ograniczenia godziny.
8. Sesja z `ended` jest liczona jako trening nawet przy zerowej liczbie wykonanych serii. Trzeba odróżnić sesje otwarte/zakończone/puste/częściowe i faktyczną aktywność.
9. Brakuje jawnego związku ćwiczenia z monitorowanym obszarem. Samo wystąpienie bólu po planie nie identyfikuje ćwiczenia, które miałoby go powodować.
10. Brakuje niezależnych testów `src/analytics.ts`.

## 2. Relacje, które warto pokazywać

| Relacja | Pytanie użytkownika | Warunki poprawnego porównania |
|---|---|---|
| Pomiar → czas | Jak zmieniają się moje oceny w tym obszarze? | Ten sam obszar i porównywalny kontekst; widoczna liczba dni/pomiarów |
| Sesja → przed/po | Jaka była zmiana oceny w okolicy tej sesji? | Jawna relacja albo oznaczony kandydat czasowy; osobno każdy obszar |
| Sesja → późniejsze dni | Jakie oceny zapisuję około dobę/dwie po treningu? | Rzeczywiste odstępy czasu; oznaczenie innych sesji w międzyczasie |
| Wykonane serie/powtórzenia → pomiary | Jakie wyniki zapisywałem po różnej dawce? | Dane wykonane, nie zaplanowane; ta sama wersja ćwiczenia/sprzętu |
| Przerwa między sesjami → pomiary | Jak wyglądają wpisy po krótszych i dłuższych odstępach? | Od poprzedniego zakończenia do kolejnego startu; bez etykiety "regeneracja zakończona" |
| Plan → reakcja | Jak wyglądały różne wykonania tego samego planu? | Snapshot ćwiczeń i dawki; uwzględnienie częściowych sesji i zmian planu |
| Kontuzja → obszary → raporty | Co zapisuję w czasie konkretnego epizodu? | Jawne powiązania, zachowanie historycznych nazw/obszarów |
| Kontekst → pomiary | Jak różnią się wpisy spoczynkowe i związane z ruchem? | Osobne rozkłady, bez mieszania różnych obszarów w jedną ocenę |

Zależność może działać w obie strony: większy ból mógł wpłynąć na zmniejszenie dawki lub wcześniejsze zakończenie treningu. Dodać opcjonalny powód wcześniejszego zakończenia sesji (ból/zmęczenie/brak czasu/inny/nie podano), zapisywany w sesji i backupie. Nie odgadywać go ze statusu finishedEarly. Niezapisane aktywności, sen czy zmiany leczenia pozostają nieznanymi czynnikami; aplikacja nie powinna twierdzić, że uwzględnia je w analizie.

Wyniki są opisem wpisów. Nie diagnozują, nie wskazują winnego ćwiczenia i nie wyznaczają bezpiecznej dawki. Nie dodawać automatycznych zaleceń zwiększenia obciążenia, terminów powrotu do sportu ani pozornie medycznego "wyniku gotowości".

## 3. Najpierw wiarygodne dane

### Raporty i relacje z sesją

- Rozszerzyć PainLog o opcjonalne `sessionId` i `measurementPhase`: daily/pre/during/post/followup/unspecified. Dla starych wpisów przyjąć unspecified; nie dopisywać historii na podstawie notatek.
- Post-workout tworzy nowy UUID raportu i jawne `sessionId`, `measurementPhase=post`. Kontekst pozostaje niezależny (np. spoczynek/spacer), podobnie powiązania z kontuzjami.
- Dziennik ma osobne akcje "Nowy pomiar" i "Edytuj ten pomiar". Edycja po ID; wybór daty nie wybiera automatycznie wpisu do nadpisania. Dopuszczać wiele pomiarów na dzień/fazę.
- Wprowadzić wybór typu pomiaru oraz opcjonalnego treningu. Zachować datę/godzinę i oceny użytkownika; zmiana relacji nie przepisuje wartości.
- Starszy raport z ID równym ID sesji można przedstawić jako propozycję powiązania, wyłącznie w tym samym profilu; nie traktować zgodności ID/notatki jako potwierdzonego źródła.
- Supabase: nullable `pain_logs.session_id`, nullable/znormalizowany typ pomiaru, indeks `(profile_id,session_id,measured_at)` i `(profile_id,measured_at)`. Własność relacji musi być wymuszona również w bazie; usunięcie sesji zachowuje raport i czyści relację. Zaprojektować FK/trigger bez zerowania `profile_id` przy SET NULL.
- Zaktualizować atomowe RPC zapisu/importu i czyszczenie konta; relacja nie może wskazywać sesji obcego konta. Weryfikować spójność fazy i znacznika czasu.
- Import mapuje `sessionId` do nowych ID sesji, nie do ID szablonu. Utracone referencje zachowują raport jako niepowiązany. Nowa wersja backupu z odczytem v1–v5; migracja Dexie uzupełnia tylko brakujące pola.

### Strony i obszary

- Nie wyciągać strony pomiaru ze strony kontuzji ani z ustawienia zegara.
- Jeżeli potrzebne są osobne porównania lewej/prawej strony, dodać opcjonalną stronę do definicji monitorowanego obszaru. Stare obszary pozostają nieokreślone; rozdzielenie tworzy odrębne obszary bez przepisywania dawnych ocen.
- Opcjonalnie mapować ćwiczenia na obszary w ustawieniach planu, z kopią mapowania w snapshotach sesji. Powiązanie opisuje zakres treningu, nie dowodzi mechanizmu bólu.

## 4. Jednoznaczne zasady obliczeń

1. Każda ocena dotyczy konkretnego obszaru. Nie liczyć wspólnej "średniej zdrowia" ze wszystkich ścięgien.
2. Domyślny trend długoterminowy: jedna reprezentatywna wartość dzienna (propozycja: mediana ocen w wybranym kontekście). Użytkownik może obejrzeć wszystkie surowe pomiary. Pokazać zastosowaną metodę.
3. Porównania okresów: ten sam obszar, kontekst, faza i metoda agregacji; równy czas okresów. Pokazać dni z danymi, liczbę pomiarów i procent pokrycia. Brak wartości nie jest zerem.
4. Różnice ocen podawać w punktach skali 0–10, nie jako procent "poprawy". Brak interpolacji przez luki; brak zielonego statusu dla pustych danych.
5. Liczba wykonanych serii: ukończone grupy, zgodne z aktualnym modelem L/P. Dla ekspozycji na stronę można osobno zliczać wpisy L i P, ale nie podwajać ich w liczniku serii treningu.
6. Powtórzenia/objętość liczyć tylko dla `done=true` z poprawnymi powtórzeniami. Nie używać czasu ukończonego zegara jako dowodu wykonania serii.
7. `kg × powtórzenia` pokazywać tylko dla tego samego ćwiczenia i porównywalnego wariantu/sprzętu; jest to zapisany ciężar dodatkowy. Nie sumować maszyn, gum i ćwiczeń z masą ciała do jednego wskaźnika obciążenia ścięgna.
8. Czas sesji to różnica zapisanych znaczników, obejmująca pauzy/pozostawioną aplikację. Nie nazywać go aktywnym czasem ćwiczeń. Brak danych o faktycznej aktywności pozostaje jawny.
9. Dla filtrów czasu sesje przypisywać konsekwentnie według startu, z widocznym statusem zakończenia. Sesje puste, częściowe i w toku pokazywać oddzielnie.
10. Wyniki po filtrze kontuzji/obszaru liczyć wyłącznie z jawnych powiązań. Jeżeli licznik dotyczy całego profilu, oznaczyć to zamiast udawać filtr.

### Dopasowanie pomiaru do treningu

- Powiązania zapisane przez użytkownika mają pierwszeństwo. Brak jawnej relacji daje wyłącznie oznaczonego kandydata czasowego.
- Kandydat "przed": najbliższy wcześniejszy pomiar z tego obszaru i porównywalnego kontekstu, maksymalnie 24 h przed startem. Nie używać pomiaru po/during jako domyślnego spoczynkowego baseline.
- Bezpośrednio "po": preferować jawny post dla tej sesji. Przy braku nie dopowiadać wartości z dowolnego późniejszego dnia.
- Około 24/48 h: propozycja okien produktu 18–30 i 42–54 h od końca sesji; najbliższy celowi pomiar, z czasem rzeczywistym i źródłem dopasowania. Są to reguły organizacji danych, nie progi medyczne.
- "Następnego ranka" stanowi osobny tryb kalendarzowy, nie synonim 24 h. Pokazać rzeczywisty odstęp, np. 13 h.
- Przy kolejnym treningu przed pomiarem oznaczyć nakładanie ekspozycji. Nie przypisywać wyniku wyłącznie pierwszej sesji. Domyślnie wykluczać takie przypadki z prostego porównania dawek, pozostawiając je na osi czasu.
- Nie używać tego samego raportu jako niezależnego dowodu reakcji na kilka sesji. Kandydaty/konflikty muszą być widoczne i możliwe do skorygowania.

## 5. Nowa struktura zakładki

Jedna zakładka Analizy z podwidokami, wspólnymi filtrami i linkami do szczegółów, zamiast wielu osobnych pozycji w głównej nawigacji.

### A. Przegląd

- Cztery karty: ostatnia ocena wybranego obszaru, zmiana dziennej mediany między okresami, wykonane serie i pokrycie pomiarami.
- Liczniki zawsze zawierają zakres i mianownik. Zakończone sesje puste nie podnoszą liczby treningów z wykonaną pracą.
- Lista ostatnich sesji z ocenami przed/po/24 h/48 h lub podpisem brak/niepowiązane/nakładający trening.
- Krótkie podsumowanie tylko opisowe: "Masz pomiary 24 h po 4 z 9 sesji". Bez automatycznego "plan jest bezpieczny".

### B. Oś czasu

- Pełny wybrany zakres; osobna seria ocen dla obszaru i pas znaczników treningów. Bez podwójnej osi sugerującej wspólne jednostki.
- Kliknięcie/palec/klawiatura otwiera raport lub snapshot treningu. Obok wykresu dostępna tabela z tymi samymi danymi.
- Rozróżnienie kontekstów/faz symbolem i tekstem; kolory nie są jedynym kodowaniem.
- Przy większym zakresie agregacja dzienna/tygodniowa z jawnym opisem; surowe dane dostępne po rozwinięciu. Nie ograniczać po cichu do 14 rekordów.

### C. Reakcja po treningu

- Wybór sesji; nazwa i data, rzeczywiście wykonane/zaplanowane serie, ćwiczenia i notatka.
- Tabela per obszar: przed, po, około 24 h, około 48 h, różnice w punktach i rzeczywiste godziny pomiarów.
- Powiązanie potwierdzone/proponowane, brak baseline i nakładające sesje są widoczne przy konkretnym wyniku.
- Akcja "Dodaj pomiar do tego treningu" otwiera Dziennik z relacją i fazą, bez wymyślania wartości ani wstecznej godziny.

### D. Dawka i regularność

- Wykonane serie i powtórzenia w tygodniu, udział częściowych sesji oraz odstępy między treningami.
- Filtr planu/ćwiczenia; porównywać snapshoty zamiast zakładać, że nazwa planu oznacza identyczny skład.
- Zestawienie rzeczywistej dawki z późniejszą oceną w porównywalnym kontekście. Najpierw tabela; wykres punktowy dopiero gdy dane są wystarczające do czytelnego przedstawienia.
- Nie liczyć domyślnie współczynnika korelacji ani "najgorszego ćwiczenia". Przy małej liczbie par pokazać same rekordy i liczbę dostępnych dopasowań; nie produkować oceny pewności bez uzasadnionej metody.

### E. Obszary i kontuzje

- Szczegóły konkretnego obszaru: okresy z raportami, porównywalne konteksty i powiązane epizody kontuzji.
- Rozdzielić aktywny/wstrzymany/zakończony status wpisany przez użytkownika od zaobserwowanych ocen. Zamknięcie kontuzji nie oznacza obliczonego wyleczenia.
- Obszary archiwalne nadal dostępne do analizy historii; nie znikają po usunięciu z formularza nowych pomiarów.

## 6. Usprawnienia wspólne UI

- Filtry w URL: podwidok, od/do, obszar, kontuzja, kontekst, faza, plan/ćwiczenie. Wstecz/Dalej i link do konkretnej sesji działają bez utraty filtrów.
- Gotowe zakresy 7/30/90/365 dni i własne daty. Wyświetlać wybraną strefę/prezentację dat, UTC przechowywać jako moment; dat historycznych dziennika nie przeliczać po cichu.
- Na komputerze filtry nad układem 2 kolumn; na telefonie jedna kolumna i rozwijane filtry z podsumowaniem aktywnych wyborów.
- Mniej kart na starcie; szczegóły po wyborze rekordu. Raporty stronicowane; szerokie tabele przewijane w swoim kontenerze, nie w całej stronie.
- Wszystkie dane wykresu dostępne tekstowo. Rozróżnić ładowanie, błąd pobrania, pusty zakres, brak baseline i brak sparowanych pomiarów.
- Komunikat "średnia spadła" musi mieć porównywalny filtr i liczebności; przy zmianie kontekstu zaznaczyć nieporównywalność.

## 7. Podsumowanie na Dzisiaj

- Ostatnia ocena wybranego obszaru wraz z czasem i kontekstem.
- "Po ostatnim treningu: pomiar zapisany / brak pomiaru" z linkiem do reakcji sesji.
- Wykonane serie w ostatnich 7 dniach i dni z pomiarami; bez jednej zbiorczej oceny rehabilitacji.
- Maksymalnie kilka skrótów. Nie powielać całej zakładki Analizy i nie podawać terminu "pełnej regeneracji".

## 8. Podział kodu i etapy

1. **Naprawy istniejących analiz bez migracji:** `src/analytics.ts`, `AnalyticsView.tsx`, `PainCharts.tsx`. Pełny zakres wykresów, jawne agregacje/liczniki, spójność filtrów, brak/pokrycie danych, sesje puste/częściowe. Dodać `src/analytics.test.ts`.
2. **Metadane i niezależne pomiary:** `src/domain.ts`, `src/db.ts`, `src/cloudDb.ts`, `usePainLogActions.ts`, `useWorkoutActions.ts`, `DiaryView.tsx`, import/export. Migracja SQL relacji, Dexie, nowa wersja backupu i odczyt poprzednich; oddzielny test własności FK i zachowania raportu po usunięciu sesji.
3. **Silnik dopasowania i oś czasu:** `src/analytics/matching.ts`, `metrics.ts`, `types.ts`, `AnalyticsTimeline.tsx`. Funkcje czyste, jawne reguły, indeksy Map po sesji/obszarze; bez zapytań sieciowych w renderze. Pobrać też margines czasu do follow-up poza końcem filtra sesji.
4. **Reakcja sesji:** `WorkoutResponseView.tsx`, `AnalyticsFilters.tsx`, `useAnalyticsNavigation.ts`; przejście z Historii i Dzisiaj, dodanie/potwierdzenie powiązań i dostępna tabela.
5. **Dawka, regularność, obszary:** `TrainingDoseView.tsx`, `AreaAnalysisView.tsx`. Wykonane dane, warianty, mapowania i pokrycie; brak rankingów przyczyn bólu.
6. **Wydajność i odbiór:** zakresy po stronie repozytorium, stronicowanie, agregacje, leniwe ładowanie podwidoków z czytelnym błędem; dopiero przy rzeczywistej potrzebie agregacje SQL. Aktualizacja `docs/architecture.md`, instrukcji migracji i testowania.

## 9. Kryteria odbioru

- Liczenie poprawne przy wielu pomiarach dziennie, 0 vs brak wartości, zmianie kontekstu, archiwizacji obszaru, częściowym/pustym treningu i starym backupie.
- Brak podwójnego liczenia grup L/P; zmiana szablonu nie przepisuje dawnej sesji; ukończenie zegara nie zwiększa wykonanej dawki.
- Czas poprawny przy sesji przez północ, zmianie czasu letniego, pomiarach na granicy okna i sesji tuż przed końcem zakresu.
- Dwa treningi w krótkim odstępie dają oznaczony konflikt, a nie dwie "pewne reakcje" z jednego raportu.
- Edycja raportu po ID nie zastępuje innego raportu dnia. Import zachowuje relacje po zmianie UUID, usunięcie sesji zachowuje ocenę bólu.
- Własność relacji sprawdzona dla dwóch kont w Supabase. Migracja i import są atomowe dla powiązanych rekordów.
- UI sprawdzone przy 320–1920 px, długich nazwach, dużej liczbie raportów, klawiaturą i bez rozpoznawania kolorów.
- Każda obserwacja zawiera źródło, liczebność i brakujące dane. Nie przedstawia związku czasowego jako dowodu przyczynowego.

Źródło wytycznych UI: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md. Reguły dopasowania czasowego w tym planie są propozycją produktu, nie zaleceniem klinicznym.
