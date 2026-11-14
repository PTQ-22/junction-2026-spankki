# Handoff: S-Pankki „AI coach z ogrodem” (Junction 2026, 13–15.11.2026)

Ten plik przekazuje pełny kontekst między sesjami agentów i jest **planem przed implementacją**.
Notatki z researchu: `IDEAS.md` (sekcje „DECYZJA: S-Pankki”, „Runda 6”). Stałe informacje o repo: `AGENTS.md`.
Wersja 2 (14.11, wieczór): poprawione koszyki, backtest miesięczny, persony, zweryfikowane open data, luki.

## 1. Decyzja i zadanie
Challenge **S-Pankki „Personal Economic Trainer”**. Inne challenge są odrzucone – nie wracać do nich.

Zadanie (skrót): AI, które pozwala rozmawiać z własnymi pieniędzmi. Przykładowe pytania z briefu:
(Q1) „How much did I spend on taxis last month?”, (Q2) „What kind of spender am I?”,
(Q3) „What is safe for me to spend this week?”, (Q4) „How much could I save if I reduced dining out by 20%?”.
Pedagogika: 3 koszyki – obowiązkowe regularne / obowiązkowe nieregularne / codzienne, które „uciekają”.
Duch MyData: użytkownik sam eksploruje dane, nie gotowe wykresy banku. Open data (Statistics Finland) mile widziane.
Insight: AI tłumaczy pojęcia prostym językiem, symuluje „what if”, safe-to-spend i safe-to-save.
Output: aplikacja mobilna lub web app do osadzenia w aplikacji mobilnej. Bonus: PSD2 (widok wielu banków).
Ocena (po 20%): pedagogika, oryginalność integracji AI, czytelność mobilnego UX, wykonalność, integracja z S-mobiili.

## 2. Koncepcja: ogród jako twarz AI coacha, „który wie, czego nie wie”
Sam ogród NIE jest oryginalny (Money Garden, EverPlant, Pastizal, Fortune City, Devpost: Minty, SavingsGarden,
Sprout…). Oryginalność = AI wokół ogrodu + uczciwość prognozy (pokazujemy, co wiemy, a czego nie) + 3 koszyki S-Pankki.

| Element ogrodu | Koszyk / dane | Co pokazuje | Pewność (backtest, §3.4) |
|---|---|---|---|
| Pory roku / grządki | B1a rachunki | czynsz, media, bilet: „już zapłacone / jeszcze przed Tobą” | wysoka: błąd 5,8%/mies. |
| Pogoda = safe-to-spend | budżet cyklu płacowego (pensja − rachunki − niezbędne − „odłóż najpierw”) minus już wydane; burza, gdy saldo nie pokrywa rachunków | „Zostało 73 € do wypłaty (ok. 5 €/dzień). Na początku października burza (czynsz 800 €)” | przeliczane codziennie (§8 pkt 2) |
| Deszcz w weekend | B3, dzień tygodnia | „w weekend przelotne opady (restauracje)” – sobota 3,4× poniedziałek | wzorzec potwierdzony |
| Staw = bufor | B2 nieregularne | „Twój staw pokrywa typowy miesiąc niespodzianek (ok. 570 €)” | P90 z roku 1 wystarczył w 84% mies. roku 2 |
| Kwiaty | B3 wycieki | kwitną/więdną względem WŁASNEJ normy; klik → liczby + „= 6 h Twojej pracy” | opis przeszłości, bez prognozy |
| Drzewo | investment_deposit / withdrawal | rośnie co miesiąc; wypłata = „zebrane owoce”, nie kara | fakt z danych |
| Płot / mgła | salary_sweep | „Część Twojego ogrodu jest poza płotem” → PSD2 | fakt z danych |
| „Ty decydujesz” | B3 × suwak | dwa ogrody za 6 mies.: „bez zmian” vs „−20% restauracji” | deterministyczna symulacja, NIE predykcja |
| Ogrodnik (czat) | wszystkie | odpowiedzi na Q1–Q4 i dowolne pytania | LLM liczy TYLKO narzędziami SQL |
| Jedno zobowiązanie | — | „Odkładaj automatycznie 1% z każdej wypłaty / podwyżki” | Save More Tomorrow 3,5% → 13,6% |

Zdanie na pitch (poprawione, uczciwe): „Twoje rachunki przewidujemy z błędem ok. 6% w skali miesiąca.
Wydatków na przyjemności nie przewidzi nikt – w naszych danych trend trafia kierunek w 52%, jak rzut monetą.
Dlatego zamiast wróżyć, pokazujemy oba ogrody, a decyzja należy do Ciebie.”
NIE używać „92% dokładności” (to była mediana błędu sumy ROCZNEJ starego koszyka 1).

Ton: nigdy nie zawstydzać (Monzo „Year in Monzo” – skarga do ombudsmana 2026). Zwiędły kwiat odrasta.
Żadna kategoria nie jest „zła”; porównujemy z własną normą, nie z ideałem. Burza = zapowiedź, nie wyrzut.

## 3. Dane z datasetu (lokalnie, NIE commitować)

### 3.1 Pliki i kolumny, z których korzystamy
`data/spankki/` (z https://github.com/hackjunction/Junction-2026-S-pankki, LFS zweryfikowany sha256), UTF-8 BOM.

| Plik / kolumna | Do czego |
|---|---|
| `tx_junction_transactions.csv` (3,63 mln wierszy, 5100 klientów, 2024-10-01 … 2026-09-30) | wszystko |
| `customer_id` | filtr – aplikacja zawsze działa na jednym kliencie |
| `bank_account_id` | nieużywane (1 konto na klienta) |
| `tx_date`, `tx_timestamp` | miesiące, dzień tygodnia, daty czynszu/pensji. UWAGA: `tx_timestamp` to tekst `03OCT24:09:04:04` → parsować `strptime(..., '%d%b%y:%H:%M:%S')`, inaczej sortowanie jest alfabetyczne (był przez to błąd w saldach końcowych) |
| `category` | koszyki, kwiaty, czat |
| `tx_amount_eur` | kwoty; ujemne = wydatki |
| `balance_after_eur` | saldo „dziś”, staw, burze (100% spójne z kwotami) |
| `transaction_type` | salary (pensja → „godziny pracy”), housing_payment/utilities_payment (B1a), investment_deposit/withdrawal (drzewo), salary_sweep (PSD2), other_income |
| `mcc_code` | taxi 4121 (Q1), komunikacja 4111, fast food 5814 / restauracje 5812 / bary 5813 (podkwiaty), paliwo 5541/5542, parking 7523, apteka 5912, lekarz 8011, elektronika 5732, meble 5712 |
| `merchant_id` | tylko liczenie „ile różnych miejsc” (brak nazw) |
| `tx_customers_junction.csv`: `customer_age`, `customer_postal_code` | benchmark rówieśników (wiek ±5) i join z Paavo (kod pocztowy) |
| `mtg_*.csv` (200 klientów z wnioskiem hipotecznym) | nieużywane w MVP (ew. stretch: „drzewo-dom”) |

### 3.2 Koszyki v2 (`experiments/spankki_backtest.py`)
Kolejność reguł ma znaczenie (pierwsza pasująca wygrywa). Wykluczone: salary_sweep, investment_deposit, kwoty ≥ 5000 €.
- **B1a rachunki** (obowiązkowe regularne, stała kwota): housing_payment, utilities_payment, MCC 4111.
- **B3 wycieki**: Restaurants, Entertainment, Lifestyle, Travel (każda kwota – podróż nie jest obowiązkowa), MCC 4121.
- **B2 nieregularne obowiązkowe**: Health, Home & Tech, Transportation > 300 € (np. naprawa auta).
- **B1b codzienne niezbędne** (obowiązkowe regularne, zmienna kwota): Groceries, reszta Transportation (paliwo, parking).
Pedagogicznie to nadal 3 koszyki S-Pankki; B1 ma dwie warstwy: „rachunki” (pewne) i „codzienne niezbędne” (przedział).

### 3.3 Udział koszyków (mediana klienta)
B1a 42%, B1b 23%, B2 10%, B3 24%. Koszyk „other” jest pusty.

### 3.4 Backtest v2 (wszyscy klienci; „rok 1” = 2024-10…2025-09, „rok 2” = 2025-10…2026-09)
| Koszyk | Błąd sumy rocznej | ≤15% klientów | Błąd miesięczny (średnia z 3 poprz.) | ≤15% | Mediana błędu € / mies. |
|---|---|---|---|---|---|
| B1a rachunki | **3,5%** | 88% | **5,8%** | 83% | 69 € |
| B1b codzienne | 25% | 32% | 49% | 16% | 268 € |
| B2 nieregularne | 35% | 23% | 60% | 12% | 163 € |
| B3 wycieki | 25% | 32% | 49% | 16% | 279 € |
- Staw: P90 miesięcznych B2 z roku 1 (mediana 571 €) wystarczył w **84%** miesięcy roku 2.
- „Wolne pieniądze” miesiąca (przychody − sweep − inwestycje − B1a − B1b − B2): mediana 784 €, błąd prognozy 423 €;
  w 11% miesięcy są ujemne. Wniosek: miesięczna prognoza safe-to-spend jest za mało dokładna – dlatego pogoda
  **przelicza się codziennie z prawdziwego salda** i pokazuje przedział, a B1b liczymy konserwatywnie (P75).
- Kierunek zmiany B3 z trendu roku 1: 51,9% = rzut monetą. 21% klientów zmienia B3 o > 50% rok do roku –
  skoki wyglądają na zmianę „trybu” generatora na granicy roku (październik 2025). Mówić „w tych danych”.
- Daty: czynsz – kwota stała (zmienność 3%), dzień ±2,3 dnia (rozpiętość ok. 7 dni); pensja – kwota ±8%,
  dzień ±5,9 dnia (rozpiętość ok. 16 dni). → Burze i wypłata zawsze jako okno dat; safe-to-spend liczony do
  NAJPÓŹNIEJSZEJ możliwej wypłaty (konserwatywnie); pensji nie wliczamy, dopóki nie wpłynie.
  Przy dacie „dziś” = 15.09 okno wypłaty person to np. 15–29 / 15–30, więc dni do wypłaty to 14–15.

### 3.5 Pułapki danych syntetycznych
- Średnia kwota nie zależy od MCC (~40 € fast food i restauracja) → nie mówić „fast food jest tańszy”.
- Brak sezonowości miesięcznej (B3 całej populacji płaskie ±7%) → „pory roku” to metafora rachunków, nie sezony.
- Absurdalne pojedyncze kwoty (np. restauracja 20 536 €) → odfiltrowane > 5000 €.
- Pojedyncze miesiące bez czynszu (np. CUST03673 2026-03) → nie traktować jako „brak rachunków”; okno + tolerancja.
- Saldo wielokrotnie „odbija się” od tej samej wartości ujemnej (np. −423 €) → prawdopodobnie limit debetu generatora.
- Kwoty netto/brutto pensji nieznane → „godziny pracy” = kwota / (mediana pensji z 12 mies. / 160 h), opisane jako przybliżenie.

### 3.6 Persony do demo (zweryfikowane miesiąc po miesiącu, saldo końcowe na 2026-09-30)
| Persona | Kto | Historia ogrodu |
|---|---|---|
| **CUST04957** – główna | 18 l., Espoo 02680, pensja ~2,6 tys. €, wycieki 302 → 795 €/mies., saldo 8,2 tys. € | „Słońce i duży staw, ale kwiaty zaczynają więdnąć” – najlepsza do suwaka „−20%” |
| **CUST00359** – burza | 18 l., Vantaa 01840, ~1,5 tys. €/mies., wycieki 227 → 476 €, czynsz ~720 €, saldo 110 €, w 2026 kilka razy pod zero | „Przed czynszem burza” – safe-to-spend bliski zera, staw pusty |
| **CUST00095** – sukces | 21 l., Vantaa 01900, wycieki 586 → 66 €/mies., saldo 2 → 13,8 tys. € | „Ogród, który odrósł” |
| **CUST03539** – wzór | 25 l., Helsinki 00950, inwestuje 205–271 € co miesiąc, saldo 4,3 → 9,9 tys. € | „Rosnące drzewo” |
| **CUST02948** – PSD2 | 48 l., Helsinki 00190, ~94% pensji odpływa (salary_sweep), brak czynszu w danych, saldo −293 € | „Widzę tylko część Twojego ogrodu” |
Wcześniejszy opis CUST04957 („saldo pod zero, burza”) był błędny – pod zero tylko raz (−22 €, 01.2025).

## 4. Otwarte dane (zweryfikowane przez API 14.11.2026; licencja CC BY 4.0, bez klucza)
API: `https://pxdata.stat.fi/PxWeb/api/v1/en/{baza}/{tabela}.px` – GET = metadane, POST JSON = dane
(limit 300 tys. komórek na zapytanie). Plan: pobrać raz do `data/opendata/*.json`, w demo działać offline.

| Priorytet | Źródło | Ścieżka API | Co daje | Użycie w aplikacji |
|---|---|---|---|---|
| 1 | Badanie budżetów gospodarstw (kulutustutkimus) | `StatFin/ktutk/14q4.px` (wg wieku: 17–24, 25–34…); `14ph` (typ gospodarstwa) | 510 kategorii COICOP, lata 2012/2016/2022, €/rok na gospodarstwo i na jednostkę konsumpcji | „Finowie 17–24 wydają na restauracje X €/mies.” obok własnej normy i rówieśników z datasetu |
| 2 | Paavo (dane wg kodu pocztowego) | `Postinumeroalueittainen_avoin_tieto/2026/12f1_ja2026.px` (dochody mieszkańców), `12f3` (gospodarstwa) | średni/mediana dochodu, 3019 kodów pocztowych, 2010–2024 | „Mediana dochodu w Twojej okolicy (02680)” – kontekst, bez rankingów |
| 3 | CPI miesięczne | `StatFin/khi/15b5.px` | indeks wg COICOP, 1995M01–2026M10 (pokrywa cały dataset) | „Twoje zakupy spożywcze +X%, ceny żywności +Y%” → oddziela inflację od nawyku |
| 4 | Dochód rozporządzalny wg wieku | `StatFin/tjt/11py.px` | mediana dochodu wg wieku, do 2024 | „godziny pracy” i kontekst dochodu rówieśników |
| 5 | Dłużnicy w egzekucji | `StatFin/uloa/11q7.px` | liczba dłużników i dług wg wieku (15–24…), 2008–2025 | pedagogika przy „burzy” (ostrożnie, bez straszenia) |
| 6 | Czynsze | `StatFin/asvu/15fa.px`, `15fc.px` | czynsze za m² wg obszaru (kwartalnie 2025Q1–2026Q3); **wersji wg kodu pocztowego (13eb) już nie ma** | stretch: „Twój czynsz vs średnia w regionie” – brak m² w danych, więc tylko orientacyjnie |
| 7 | Święta w Finlandii | `https://date.nager.at/api/v3/PublicHolidays/2026/FI` | daty świąt | wyjaśnienie skoków (juhannus, Boże Narodzenie) – w danych brak sezonowości, więc niska wartość |
Mapowanie kategorii → COICOP (do weryfikacji przy pobieraniu): Groceries→01.1, Restaurants→11.1, Transportation→07,
Utilities→04.4–04.5, Housing→04.1, Health→06, Entertainment→09, Home & Tech→05+08, Lifestyle→03+13, Travel→09.6+11.2.
Niezweryfikowane/odrzucone: stopa oszczędności gospodarstw (tabela w `StatFin/vtp`, ID nieustalone), Eurostat HBS (fallback),
Helsinki Region Infoshare (drobniejsze obszary – niepotrzebne), Kela, HSL (ceny biletu – stała w kodzie).
Uwaga do benchmarków: HBS jest z 2022 (starszy niż dataset) → przeliczyć CPI do 2026 albo podpisać „dane 2022”.

## 5. Funkcje (high level)

### 5.1 Ekrany aplikacji (Expo)
1. **Ogród (home)**: pogoda (safe-to-spend dziś + okno najbliższej burzy), staw, kwiaty B3, drzewo, płot (PSD2).
   Każdy element klikalny → karta z liczbami, transakcjami i „= X h Twojej pracy”.
2. **Ogrodnik (czat)**: pytania wolne + podpowiedzi Q1–Q4. Pod odpowiedzią: „na podstawie N transakcji” → lista;
   pod rozwinięciem „jak to policzyłem” (SQL / nazwa narzędzia) – dla jury i ducha MyData.
3. **Ty decydujesz**: suwaki −X% na kategorie B3 → dwa ogrody za 6 mies. + oszczędność w € i w godzinach pracy;
   badge „rachunki: błąd ~6%, przyjemności: Twoja decyzja”.
4. **Porównanie** (stretch w MVP pkt 6): Ty vs Twoja norma vs rówieśnicy z datasetu vs Finowie w Twoim wieku (HBS).
5. **Zobowiązanie**: jeden przycisk „Odkładaj automatycznie 1%…” (mock, tylko stan).
6. **Ekran w kształcie widgetu**: pogoda + jedna liczba (na demo zamiast prawdziwego WidgetKit).
Data „dziś” w demo: **2026-09-15** (dane do 30.09) → można pokazać „prognoza na resztę miesiąca vs co się stało”.

### 5.2 Backend (FastAPI + DuckDB) – endpointy
`GET /customers/{id}/garden?today=` (cały stan ogrodu), `/weather` (safe-to-spend + burze), `/pond`, `/flowers`,
`/tree`, `POST /simulate` (kategorie × %, horyzont), `POST /chat` (LLM + narzędzia), `GET /benchmarks`.

### 5.3 Narzędzia LLM (tool-calling; LLM nigdy sam nie liczy)
- `spend_summary(category|mcc|basket, period)` → Q1 (taxi = MCC 4121) i większość pytań.
- `list_transactions(filter, period, limit)` → dowód pod odpowiedzią.
- `safe_to_spend(today)` → Q3.
- `simulate(changes, months)` → Q4.
- `spender_profile()` → Q2: deterministyczny profil (udziały koszyków vs norma i rówieśnicy, regularność, weekendowość);
  LLM nadaje mu tylko język i nazwę („Weekendowy towarzyski”), bez oceniania.
- `benchmark(category)` → rówieśnicy z datasetu + HBS.
- `explain_concept(term)` – bez danych; prosty słownik (bufor, safe-to-spend, procent składany) jako kontekst promptu.
Ograniczenia: narzędzia zawsze filtrują po `customer_id` z sesji (LLM nie podaje ID); do promptu tylko agregaty.

### 5.4 Pokrycie briefu i kryteriów
| Wymaganie | Gdzie |
|---|---|
| Q1–Q4 | czat + narzędzia (§5.3), Q3 też pogoda, Q4 też „Ty decydujesz” |
| 3 koszyki (pedagogika) | ogród = koszyki (grządki/pogoda, staw, kwiaty); karta „dlaczego to burza” |
| MyData | czat + klikalne elementy + „na podstawie N transakcji” zamiast gotowych wykresów |
| Open data | HBS 14q4, Paavo, CPI (§4) |
| safe-to-spend / safe-to-save | pogoda / zobowiązanie + drzewo |
| PSD2 (bonus) | płot dla salary_sweep (CUST02948), mock „podłącz inny bank” |
| Oryginalność AI | coach z kalibrowaną pewnością (pokazuje błąd backtestu), dowody pod odpowiedzią |
| Mobile UX / S-mobiili | Expo iOS + web build do WebView; mapowanie: Omat ostot → kwiaty, Säästäjä → staw/zobowiązanie |
| Wykonalność | dane lokalne, deterministyczne liczenie, LLM tylko jako warstwa językowa |

## 6. Stack (ustalony)
- Frontend: **Expo (React Native) + expo-router**, animacje `react-native-reanimated` + `react-native-svg`
  (Skia tylko jeśli SVG nie wystarczy). Jeden kod → iOS (symulator iPhone 18 Pro), web (`expo export --platform web`).
- Widget iOS: tylko stretch (`@bacons/apple-targets` + Swift).
- Backend: Python **FastAPI + DuckDB** (uv). Na starcie: CSV → plik `.duckdb` z tabelą transakcji, `ts` jako TIMESTAMP
  i kolumną `basket` (jednorazowo, ok. 1–2 min; potem zapytania per klient w ms).
- LLM: Gemini z function calling (dodatkowo tech challenge „Best Use of Gemini API”) – **brak klucza w `.env`** (§8).
- Środowisko: Xcode 27.2, symulatory iPhone 18 Pro / 18 Pro Max / 17 / 17e / Air, Node 24, uv.

## 7. MVP na niedzielę (kolejność) i stretch
1. Backend: `.duckdb` + koszyki v2 + garden/weather/pond/flowers/tree/simulate dla dowolnego klienta i daty „dziś”.
2. Ekran ogrodu w Expo dla CUST04957 w symulatorze (statyczne SVG + proste animacje), przełącznik person.
3. Czat z narzędziami (§5.3) i dowodem „na podstawie N transakcji”.
4. „Ty decydujesz”: suwak −X% → dwa ogrody za 6 mies.
5. „Godziny pracy” jako druga waluta w kartach i czacie.
6. Benchmark: rówieśnicy z datasetu (wiek ±5) + HBS 14q4 (pobrany offline).
Stretch: Paavo i CPI, storm warning B2, przycisk zobowiązania, mock PSD2, FI/SV/EN, prawdziwy widget iOS.

Krok 0 – prototyp designu (skill `.devin/skills/frontend-ui-prototype`). **Obowiązuje `prototype/taimi/`** (port 4175,
`?persona=&theme=`, opis w `prototype/taimi/DESIGN.md`, dane `prototype/taimi/persona-data.json` z `experiments/proto_data.py`).
Historia (stare prototypy usunięte): 3 kierunki grafiki → „AI slop”; 10 koncepcji UI (Forecast, Diorama, Coach's note,
Conversation, Inside S-mobiili, Panorama, Greenhouse, Stories, Companion, Plot map) → najlepsza Diorama; potem wersja wg
referencji użytkownika (aplikacja nawykowa z postacią-roślinką) → „za dziecinne i za podobne” → Taimi v2.
**Taimi v2 (wybrany kierunek):** dorosły, nordycki krajobraz (świerki, jezioro, brzozy) na cały ekran = interfejs;
Taimi = elegancka roślina rosnąca etapami (1 Seed, 2 Sprout, 3 Sapling, 4 Young tree; etap = 1 + pełny staw + inwestuje +
budżet > 0), nastrój tylko postawą liści; drewniana barierka z tabliczką czynszu = rachunki, kwiaty przy barierce = wycieki,
staw = bufor, brzoza/jarząb = inwestycje; jedna liczba na niebie; karty „Ask Taimi” / „You decide”; tab bar Home · Spending ·
Goals · Profile; Figtree, zieleń S-Pankki tylko jako akcent. „You decide” = scena dziś vs za 6 mies. (kwiat, staw, etap
zmieniają się z suwakiem) + wykres skumulowanej oszczędności 6 mies. + godziny pracy. Grafika nadal placeholder SVG
(docelowo Gemini Image / Kenney; w Expo mapa slotów flower/{kategoria}/{stan}, pond/{poziom}, taimi/{etap}/{nastrój}, weather/{typ}).

### Decyzje z 14.11 (start implementacji)
- „Save first” (odłóż najpierw) = ustawienie użytkownika, domyślnie 0% (param API `save_first_pct`, w Profile/Goals).
- LLM = Gemini (`GEMINI_API_KEY` w `.env` – dodaje użytkownik); czat w kolejnym etapie, po backendzie i Home.
- Implementację robi agent w całości; zespół: pitch/grafiki.
- Architektura: `backend/` (FastAPI + DuckDB, `data/spankki.duckdb` budowany z CSV: `uv run python -m backend.db`;
  serwer `uv run uvicorn backend.main:app --port 8000`), endpointy `GET /api/personas`,
  `GET /api/customers/{id}/garden?today=&save_first_pct=`, `POST /api/customers/{id}/simulate`; testy `uv run pytest`
  (regresja vs `prototype/taimi/persona-data.json` przy save_first 0.1). `app/` = Expo (expo-router, react-native-svg),
  grafika przez mapę slotów `app/src/garden/assets.tsx`; zakładki Home · Spending · Goals · Profile (Profile = wybór
  persony, data „dziś”, % save first – kontrolki demo).
- Norma kwiatów = mediana 6 pełnych miesięcy przed bieżącym (prototyp liczył luty–lipiec – błąd, dane prototypu są zamrożone).

### Stan implementacji (15.11)
- **Backend gotowy**: `data/spankki.duckdb` z CSV (`uv run python -m backend.db`); endpointy `/api/health`,
  `/api/personas`, `GET /api/customers/{id}/garden`, `POST /simulate`, `GET /transactions?flower=&days=&today=`
  (wiersze + etykieta merchant z MCC + tekst SQL), `POST /chat` {today, message, save_first_pct} → {text, receipts{count,
  rows, sql}, tool, used_llm}. Czat: narzędzia spend_summary / safe_to_spend / simulate / spender_profile; bez
  `GEMINI_API_KEY` keyword-router dla 4 pytań demo + fallback; z kluczem Gemini function-calling (`google-genai==3.0.0`,
  domyślnie `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` – free tier, `GEMINI_MODEL` nadpisuje; timeout 15 s,
  bez retry SDK, max 3 rundy narzędzi, cache odpowiedzi w procesie), LLM tylko redaguje – liczby w odpowiedzi ⊆
  liczb z narzędzia, inaczej fallback na szablon. `action: {type:"simulate",category,cut_pct}` przy symulacji
  → aplikacja pokazuje „Show me in my garden”. `/simulate` zwraca też `monthly_pond`/`monthly_pocket`.
  `baskets_last30` (B1a/B1b/B2/B3 za 30 dni) w JSON ogrodu. Testy: `uv run pytest -q` → 42 passed.
- **App (`app/`, Expo SDK 58 + expo-router)**: UX „one question, one number, one next step”: intro 3 slajdy
  (`introSeen` w pamięci, `?intro=0` skip, `?intro=N` do screenshota); Home = nagłówek (4 przypadki: storm / 0 € /
  payday dziś / zwykły) + scena z etykietami-pigułkami (Bills/Fun spending/Savings/Investments) + „?”→legenda +
  dolny panel (coach note 1 zdanie + CTA, 3 kafelki Bills/Savings/Fun·30d → Spending); Spending = stacked bar 4
  koszyków + wiersze z podpisem „In your garden” + kwiaty z paskiem vs norma → `FlowerSheet` (paragony + SQL);
  Symulacja dzieje się NA ogrodzie (zakładka „What if” usunięta): `?sim=1&category=X&cut=0.2[&month=N&autoplay=1]`
  → nagłówek „What if you spent N% less…”, panel z chipami 5 kwiatów + suwak + scrubber miesięcy + ▶ Play 6
  months + Set as goal/Done, animacje: glow wybranego kwiatu, monetki do stawu/kieszeni, poziom wody, +N €,
  wzrost Taimi; wejścia: coach note, FlowerSheet „Try a what-if”, Ask „Show me in my garden”.
  Ask = czat + `?q=` auto-send (3. zakładka); Profile = „Your
  settings” (save first) + „Demo — for the hackathon jury” (persona/data) + „Show intro again”.
  Persona: `EXPO_PUBLIC_PERSONA`, picker i deep link `exp://<host>:8081/--/?persona=CUST…`.
- **Jak odpalić**: uvicorn `uv run --env-file .env uvicorn backend.main:app --port 8000 --host 0.0.0.0`; Metro `cd app && npx expo start`
  (bez `--ios` – osascript crashuje), potem `xcrun simctl openurl booted exp://<lan-ip>:8081`; screenshota
  `xcrun simctl io booted screenshot <path>`; persona przez `…/--/?persona=CUST00359`; ekran przez
  `…/--/goals|spending|ask?persona=…`. Metro NIE uruchamiać z `CI=1` (wyłącza przeładowanie). Symulator: `xcrun simctl boot "iPhone 18 Pro"`.
- **Zweryfikowane w symulatorze (15.11 rano)**: Home dla 4 person (`app/.screenshots/home-*.png`), Spending, Goals, Ask
  (`*-CUST04957.png`); `npx tsc --noEmit` czysto; czat bez klucza odpowiada na Q1–Q4 (router).
- Poprawione rano: tabliczka czynszu (3 linie, mieści się), „payday is due today” przy ≤1 dniu do wypłaty, czat
  „X € over this cycle's fun budget”.
- **Otwarte**: (1) FlowerSheet nie zweryfikowany zrzutem (wymaga tapnięcia w symulatorze); (2) Gemini niepodłączony –
  brak `GEMINI_API_KEY` w `.env` (czat działa na routerze Q1–Q4); (3) grafika nadal placeholder SVG (Gemini Image /
  Kenney); (4) widget iOS, benchmark rówieśników, Statistics Finland – nie zaczęte; (5) pitch/demo script.

## 8. Luki, ryzyka i otwarte decyzje (do zamknięcia przed/na starcie implementacji)
| # | Luka / ryzyko | Propozycja |
|---|---|---|
| 1 | **Brak klucza LLM** (w `.env` tylko Exa, Valio, Context.dev) | zdobyć klucz Gemini (partner tech challenge) albo inny; fallback: gotowe odpowiedzi dla Q1–Q4 w demo |
| 2 | **Wzór safe-to-spend – wstępna wersja jest w `experiments/proto_data.py`, bez backtestu.** Odkrycie: liczony z SALDA zachęca do przejadania oszczędności (CUST04957: 6,5 tys. € na koncie → „160 €/dzień”); liczony z BUDŻETU CYKLU daje inny obraz (ten sam klient: −368 € ponad budżet miesiąca) | przyjęte w prototypie: budżet cyklu = pensja − czynsz − media − P75 niezbędnych − inwestycje − 10% „odłóż najpierw”, minus wydane od ostatniej pensji (B2+B3); burza = saldo < należne rachunki + niezbędne do wypłaty; dzielone przez dni do najpóźniejszej wypłaty. Do zrobienia: backtest (jak często budżet cyklu ≥ 0 na koniec cyklu), decyzja zespołu, czy 10% „odłóż najpierw” zostaje |
| 3 | Grafika ogrodu (największe ryzyko czasu i „wow”) | zdecydować: gotowe assety SVG/Lottie (licencja!) vs proste kształty; jedna osoba tylko na to |
| 4 | Kto w zespole robi co (frontend / backend / LLM / pitch) | ustalić; backend i ogród mogą iść równolegle po ustaleniu JSON-a `garden` |
| 5 | Kontrakt API `garden` | spisać schemat JSON przed kodowaniem (front może startować na mocku) |
| 6 | Definicja „własnej normy” dla kwiatów | mediana ostatnich 6 mies. danej kategorii; więdnie > +25%, kwitnie ≤ normy (do strojenia na personach) |
| 7 | Q2 „What kind of spender am I?” – brak archetypów | 4–5 deterministycznych profili z udziałów koszyków i weekendowości; sprawdzić rozkład na 5100 klientach |
| 8 | Język aplikacji | EN na demo (jury), FI/SV jako stretch |
| 9 | Prywatność / bezpieczeństwo czatu | narzędzia z ID z sesji, brak surowego SQL od LLM (tylko parametryzowane narzędzia), w UI pokazujemy SQL wygenerowany przez narzędzie |
| 10 | Dane syntetyczne mają skoki na granicy roku | demo opierać na personach, nie na trendach całej populacji; w pitchu „w tych danych” |
| 11 | HBS z 2022 | przeliczyć CPI albo podpisać rok |
| 12 | Wymagania submission (wideo, repo, deadline) | sprawdzić w Hacker Dashboard |

## 9. Scenariusz demo (3 min, szkic)
0:00 hook (3,5 mln klientów, dane, których nie rozumieją) → 0:20 ogród CUST04957: słońce, duży staw, więdnące kwiaty,
klik → „restauracje 795 €/mies. vs Twoja norma 300 € = 30 h pracy” → 0:50 czat „ile wydałem na taxi w zeszłym
miesiącu?” z dowodem → 1:20 suwak −20% restauracji, dwa ogrody + zdanie o uczciwości prognozy → 1:50 przełączenie na
CUST00359: burza przed czynszem, safe-to-spend bliski zera, bez zawstydzania → 2:15 przycisk zobowiązania + płot
PSD2 (CUST02948) + integracja z S-mobiili (Omat ostot → kwiaty, Säästäjä → staw) → koniec.

## 10. Gotowy prompt dla kolejnej sesji
```
Przeczytaj HANDOFF.md, AGENTS.md w /Users/ptq-22/code/junction.
Robimy challenge S-Pankki: AI coach z ogrodem „który wie, czego nie wie”. Koncepcja, dane, koszyki v2, persony,
stack, MVP i luki są w HANDOFF.md – nie proponuj innych challenge'y ani nowych pomysłów.
Zacznij od luk z §8 pkt 2 i 5 (wzór safe-to-spend + backtest, schemat JSON `garden`), potem MVP pkt 1–2:
backend FastAPI + DuckDB i szkielet Expo z ekranem ogrodu dla CUST04957 w symulatorze iPhone 18 Pro.
Nie commituj danych ani .env. Przed większymi decyzjami pokaż plan.
```
