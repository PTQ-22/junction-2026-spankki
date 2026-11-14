# Junction 2026 – pomysły

## Exa: agent pilnujący cen kupionych rzeczy (rekomendowany pod Exa)

Użytkownik dodaje zakup (link / paragon + cena + data). Agent pilnuje, czy cena spadła, czy weszła promocja
albo czy pojawił się lepszy / nowszy model, i przygotowuje gotowe pismo do sklepu o zwrot różnicy.

Przepływ:
1. Przy dodaniu zakupu: Exa Agent (`/agent/runs`, `effort: auto`, `outputSchema` z ofertami) -> oferty z URL,
   promocje, lepsza alternatywa, zasady zwrotu / gwarancji ceny.
2. Codziennie: `/contents` z `maxAgeHours: 0` na zapisanych URL ofert -> własna historia cen w DB
   (Exa Snapshot wymaga płatnego planu: `SNAPSHOT_NOT_ON_PLAN`).
3. Spadek ceny -> Agent generuje werdykt + wiadomość do sklepu, ze źródłami (`output.grounding`).
4. Exa Monitors -> premiery nowszych modeli / kampanie (Black Friday).

Wyniki testów (13.11.2026, `experiments/`, surowe JSON w `data/experiments/`):
- Sony XM5 (kupione 379 €): 6 ofert FI z URL, najtaniej 242,78 € (Hobby Hall), wskazał XM6 za 339 €. 85 s, 0,29 $.
- iPhone 16 (899 € Gigantti): obecnie 799 €, analiza prawa zwrotu, alternatywa iPhone 17. 76 s, 0,47 $.
- Ryzyka: ceny częściowo z cache (weryfikować live crawlem przed alertem), część twierdzeń prawnych do sprawdzenia,
  provider `affiliate` prawdopodobnie nie został użyty (`data_sources: null`).
- Tech challenges do podpięcia: Gemini API, Oxylabs, Context.dev.

## Exa: inteligentny budzik (ruch / remonty / wypadki)

Budzik przesuwa pobudkę zależnie od sytuacji na trasie.
- Exa Agent wieczorem dobrze łapie zaplanowany kontekst (zamknięcie Tapiolansilta, roboty Keilaniemi, pogoda,
  demonstracje, że jutro sobota) i rekomenduje bufor ze źródłami. 69 s, 0,36 $.
- Exa NIE daje real-time (wypadki, czas przejazdu; strona HSL live = `CRAWL_EMPTY_CONTENT`).
- Real-time: Digitraffic (Fintraffic, darmowe, bez klucza: 463 roboty drogowe, 12 komunikatów), HSL Digitransit,
  API czasu przejazdu.
- Minus: Exa nie jest rdzeniem produktu; na iOS aplikacja nie ustawi systemowego budzika (Skróty / własna appka).

## Context.dev: The Web Is Your Real-Time Database

Konto: 51 000 kredytów (JUNCTION26), plan free → max 10 monitorów, interwał monitora min. 10 min, 50 równoległych req.
Klucz w `.env` jako `CONTEXT_DEV_API_KEY`, SDK `context.dev` (Python). Nagrody: 2000 € / 500 € / swag
+ osobny tech challenge „Best Use of Context.dev” (750 € / 250 €) – ten sam projekt.
Ceny: scrape 1 kr. (+4 JSON extraction), news 1 kr./10 wyników, search 1 kr./10, monitor run 1–10 kr., answers 10/100.

Testy (14.11.2026 ~00:30):
- News API: 0,5 s; dla zapytań po domenie najnowsze artykuły mają 14–36 min (nvidia/tesla/openai/rockstar).
  Zapytania naturalne rankują po trafności → mieszają artykuły sprzed roku (trzeba filtrów dat).
- Scrape: Hilma search 2,4 s (43k znaków, 1502 ogłoszeń + link CSV), Polymarket event page 6 s,
  HSL liikennetiedotteet = pusta treść (JS) – jak w Exa.
- Polymarket API (bez klucza): Gamma (rynki, opisy, zasady rozstrzygnięcia), CLOB (order book, historia cen
  godzinowa → backtest). 58% z top-200 rynków ma resolutionSource URL (głównie sport, binance, federalreserve.gov).
- Rynek „GTA 6 launch postponed again?” (1,15 mln $ wolumenu, koniec 20.11) – skok YES 0,85% → 1,85% o 22:31 UTC,
  bez widocznej przyczyny w newsach.

Polymarket – research:
- Dostęp: Finlandia NIE jest na liście ograniczeń Polymarket; Polska, Niemcy, Francja, Włochy, Belgia, UK = close-only.
  Lokalne prawo hazardowe osobno → na hackathonie tylko paper trading.
- Opóźnienie reakcji rynku: Vera (90 633 reakcji, IV–VI 2026) mediana 80 min do szczytu ruchu; Kronical (415 przypadków)
  4/5 bez ruchu 15 min po decydującej wiadomości; arXiv 2606.07811: niedoreakcja 0,64:1, większa przy niskiej
  płynności; ALE dane makro (CPI, Fed) wyceniane natychmiast.
- LLM-boty nie wygrywają: lmhtq/polymarket-ai-agent 25 dni paper trading = −25 $; Brier LLM ~0,10 vs rynek ~0,12
  nie pokrywa ~2% spreadu.
- Konkurencja: Polymarket/agents (oficjalne, 3,8k★, zarchiwizowane), Kronical (dopasowanie news→rynek w 24 s,
  X w 29 s), AlphaOracle (Agora Agents Hackathon 2026), polymarket-paper-trader, polymarket_mcp i wiele innych.

Przetargi – research: rynek zatłoczony – Hilma ma darmowy „hakuvahti” i darmowe API (avp-read), Mercell
(1452–4668 €/rok, w tym sygnały z protokołów gmin), Tendium, Cloudia, Jorpex ($49/mies.), Pienhankintavahti, Agentum.
Context.dev nie jest tu potrzebny do rdzenia (Hilma API) → słabe „use of Context”.

Budzik: Context.dev nie renderuje strony HSL; real-time daje Digitraffic/HSL API, nie Context → słaby fit.

LIMIT: plan free = 10 req/min na core API (+ concurrency). Batch API osobno (1000 jedn./min), monitory osobno.
→ poprosić mentorów Context.dev o podniesienie limitu; masowe skany robić przez Batch.
Uwaga: raw HTTP używa camelCase (`mainContentOnly`, `jsonParams`), SDK snake_case.

Nowe pomysły (research 14.11, testy w `experiments/context_capabilities.py`, wyniki `data/experiments/context/`):
1. Recall Radar – „wycofane, a nadal w sprzedaży”. OECD sweep: 87% z 1196 wycofanych/zakazanych produktów
   wciąż do kupienia online; Safety Gate 2025 = rekord 4671 ostrzeżeń; DSA: w ~75% przypadków produkt z ostrzeżeniem
   był dalej online. Narzędzie KE eSurveillance jest tylko dla urzędów; vahti.org = tylko maile o nowych recallach.
   TEST: Fenton AV440 (Tukes, wycofany 12.11.2026, ryzyko porażenia) → Context Search znalazł go w discoland.fi (FI)
   + Amazon DE/FR/ES/NL/BE + eBay UK + inne. Product extraction: Amazon OK (bez ceny/dostępności), discoland fail.
   Źródła: vaarallisettuotteet.fi (Tukes+STUK+Traficom…), ruokavirasto.fi/takaisinvedot, EU Safety Gate.
2. Wczesne wykrywanie zatruć z recenzji (FI). NYC DOHMH + Columbia na Yelp: 10 ognisk, 8523 skarg od 2012, F1 87%.
   Google Maps reviews parser działa (Savoy: 100 recenzji, najnowsza z wczoraj, 1 kredyt). Oiva (Ruokavirasto):
   brak API, ale Tietolaari daje wyniki per lokal do pobrania. Nie znalazłem fińskiego odpowiednika systemu NYC.
3. Polymarket Evidence Radar (wyżej).
4. Podwyżki subskrypcji PRZED obciążeniem: brand by_transaction działa (Netflix, Wolt, HSL ✓; K-Market, VR ✗);
   konkurencja (Rocket Money, FYN, Forfe, Halfway, KeepMySubs) wykrywa dopiero po obciążeniu.
5. Sitemap leak radar: zajęte w B2B (Seeto, RivalPenguin, webmonitors.io, RivalSweeper); rockstargames.com ma tylko
   31 URL w mapie (w tym /VI/launch-trailer) → słaby sygnał.
PREFERENCJE USERA: fun / wow-demo, nie nudne, nie zajęte, tylko Context.dev.

Runda 4 – „Paste any Polymarket link → live resolution tracker” (rynki rozstrzygane przez publiczne dane z sieci):
- Polymarket ma ~500 aktywnych rynków „Views” i „YouTube” + rynki „mention” („What will MrBeast say…”,
  earnings calls – CEO Coinbase specjalnie wypowiadał słowa z rynku na callu).
- Test Context.dev YouTube scrape: oficjalny „GTA VI: Pre-Load Now” = 12 067 821 views (13.11 23:23 UTC), 1 kredyt,
  zwraca też transkrypt z timestampami. Rynek week-1 views: 10–20M = 84,5%, 20–30M = 13,5%, koniec 18.11 04:59 UTC.
- „What will MrBeast say during his next YouTube video?” – koniec 15.11 04:59 UTC (w trakcie hackathonu),
  słowa: Insane 50%, Challenge 52%, Karl 52%, Feastables 28%, AI 20%, „Dollar 10+ times” 34%…
- „# of views of next MrBeast video on week 1?” 110M+ = 46%, koniec 22.11.
- Konkurencja: PolyHelper „MrBeast Intel” (tylko widoki MrBeasta, odświeżanie 10 min), PolyBackTest (historia).
  Nie znalazłem ogólnego narzędzia, które samo czyta zasady dowolnego rynku i stawia tracker, ani trackera
  mention-markets z transkryptów.

Odrzucone przez usera: Recall Radar (nie wiadomo komu), zatrucia (słabe), subskrypcje (wystarczy skaner maili).

Runda 3:
A. Wolt vs kasa – narzut cen w aplikacjach dostaw. Praca Åbo Akademi (200 restauracji, 5 miast FI): średnio +7%
   (+1,01 €), najwyższy względny narzut na tanich daniach; HU: pizza 11 € → 18 € na Wolt/Foodora; KKV zniosło klauzulę
   parytetu cen Wolta → narzuty legalne. Test: Wolt menu przez JSON extraction działa (29 pozycji, 8 s, 5 kr.,
   część cen null); własne menu małych restauracji trudno znaleźć → zacząć od sieci (McD, Hesburger, Kotipizza…).
B. Wykrywacz fałszywych ogłoszeń najmu (zdjęcia z Airbnb kopiowane na Qasa/Oikotie). Yle/IS X 2026: Kalasatama
   i Tapiola, ~10 ofiar w jednej serii, ~3000 € strat, poliisi: kilka przypadków miesięcznie w Helsinkach, celem
   młodzi i obcokrajowcy. Test: Context scrape Airbnb search (97 zdjęć) i Oikotie (307 zdjęć) działa → porównanie
   perceptual hash zdjęć. Pasuje też do Hostinger „Decode the Noise” (bad actors / Trust the source).
Sprawdzone i zajęte: sentyment graczy (Levellr, Diimsum, Retrace), alerty Tori/Vinted (DealFinder, Swoopa),
„aplikuj pierwszy” (LandEarly, ApplyAll, Barbed Hire; dane: <12 h = 1,7% vs 1,12% interview rate).

Odrzucone (zatłoczone): hiring tracker (Barbed Hire, Scanr, HyperSignal, Nordic-Signals), ceny żywności FI
(ruoanhinta.fi z API i indeksem, Kauppavainu, Hintavertailija w S-mobiili).

## Hostinger: Decode the Noise

Ocena: detekcja 40% (precyzja, FPR, wyjaśnialność), wdrożenie na Hostinger 25%, oryginalność 20%, demo 15%.
Zasoby: VPS KVM2 (2 vCPU, 8 GB, Docker, domena), AI Router (150+ modeli), mentorzy.

Research kierunków:
- Name the technique: gotowe dane SemEval-2020 T11 (EN, spany, 14 technik) i SemEval-2023 T3 (23 techniki,
  9 języków, w tym POLSKI; 1612 artykułów, 37k spanów) → łatwo zmierzyć F1, ale najbardziej oczywisty kierunek
  (LLM klasyfikator) = tłok.
- Spot the swarm: TwiBot-22 tylko na mail instytucjonalny; IRA Twitter dataset; badania Reddit brigading;
  SOTA F1 ~84–87%. Ciężko o świeże dane z X (API).
- Clean the traffic (rekomendacja): nowy serwer dostaje pierwsze skanowanie w < 1 min (Sophos: 52 s SSH,
  ~13 prób/min), BBC/Cybereason: web po 71 min, 17% scrapery, 37% szukanie podatności, 29% brute force.
  Boty = 57,5% ruchu (Cloudflare 2026); AI crawlery: mediana 1,57% pasma, 99. percentyl 90% (Kinsta);
  małe firmy: 3,1 req AI crawlerów na 1 Googlebota; 43% stron blokuje AI crawlera, tylko 7% w robots.txt.
  Stealth crawling: Cloudflare vs Perplexity (UA Chrome macOS, rotacja IP/ASN, 3–6 mln req/dzień).
  Konkurencja: Known Agents (dawniej Dark Visitors – analityka zadeklarowanych AI botów, 5000+ stron),
  CrowdSec, fail2ban, Cloudflare Bot Management, GoAccess, lista ai.robots.txt.
- Trust the source: częściowo pokrywa pomysł z fałszywymi ogłoszeniami najmu.

PROPAGANDA – „Pravda Tracer” (sieć Portal Kombat / Pravda):
- VIGINUM (Francja) zidentyfikował sieć w II 2024; publikuje listę 370 domen/subdomen jako open data
  (ostatnia aktualizacja 10.04.2025) + listę RRN/Doppelgänger. Sieć: ~150–180+ domen, 49 krajów, 3,6 mln artykułów
  w 2024, do 650 artykułów/h na stronę, bez własnych treści (kopiuje RT, RIA, Telegram), słabe maszynowe tłumaczenia.
- Wersje: pravda-fi.com / finland.news-pravda.com (od 20.03.2024), pravda-pl.com i inne.
- „LLM grooming”: NewsGuard – 10 czołowych chatbotów powtarzało narracje sieci w 33,55% odpowiedzi;
  Faktabaari/NORDIS: ChatGPT, Copilot, Gemini po fińsku linkują do Pravdy bez ostrzeżenia.
- Fiński ekosystem „prania” narracji: MV-lehti, UVMedia, Murkut.org, Naapuriseura, Magneettimedia (UNITED24).
- Istniejące narzędzia: modelpoisoning.com source checker (tylko porównanie domeny ze statyczną listą),
  NewsGuard (płatny, ręczny), raporty DFRLab/GLOBSEC/Check First (jednorazowe).
- Pomysł: wykrywać NIEZNANE jeszcze klony i „pranie” treści po kopiowaniu tekstu, tempie publikacji,
  artefaktach tłumaczenia i szablonie HTML; pomiar: część listy VIGINUM ukryta jako test vs legalne media
  (Yle, HS, Onet…) → precyzja / recall / FPR. Demo: odpowiedź chatbota po fińsku → skan cytowanych źródeł
  → łańcuch pochodzenia (strona → Pravda → Telegram/RT).

## Runda 5 (user: ma być pewne, że zadziała, fun, inne niż dotąd; Pravda Tracer odrzucony jako ryzykowny)

- Hostinger / Context.dev: „Comment Swarm X-ray” – link do wątku Reddit / TikTok / YouTube → klastry
  skopiowanych/sparafrazowanych komentarzy, wybuchy w czasie, świeże konta. Pomiar: wstrzyknięte syntetyczne roje
  (LLM-parafrazy) w prawdziwe wątki → precyzja/FPR. Context parsery: reddit-post (do 1000 komentarzy), tiktok-comments.
- Fake reviews Google Maps: Revdict już to robi (score 0–100); Fakespot zamknięty 1.07.2025; Google usunął 292 mln
  recenzji w 2025 → sam checker zajęty, ewentualnie sieci „farm recenzji” między firmami.
- Context.dev: „Kebab / Lounas Index” – żywy indeks cen jedzenia w Helsinkach z menu Wolt (ekstrakcja działa).
- S-Pankki: „Pogoda finansowa” (prognoza salda jak pogoda + safe-to-spend; saldo w danych w 100% spójne) +
  „Godziny życia” (każdy zakup przeliczony na godziny pracy z pensji klienta). Uwaga: „Wrapped” robi Monzo od 2018,
  w 2026 skarga do ombudsmana za „shaming” → unikać złośliwego tonu.

## DECYZJA: S-Pankki – „AI coach z ogrodem, który wie, czego nie wie" (14.11.2026)

> Nieaktualne liczby i persony poniżej – obowiązuje HANDOFF.md v2 (koszyki v2, backtest miesięczny,
> „92%” wycofane, CUST04957 to nie „burza”, nowa persona CUST00359).

Backtest (experiments/spankki_backtest.py, wszyscy klienci, rok 1 → rok 2, suma roczna):
- Koszyk 1 stałe (housing, utilities, groceries, MCC 4111): 60% wydatków, mediana błędu 8,4%, 75% klientów ≤15%, 91% ≤25%.
- Koszyk 2 nieregularne (Health, Home&Tech, Lifestyle/Travel/Transport >300 €): 16%, błąd 32%, 25% ≤15%.
- Koszyk 3 wycieki (Restaurants, Entertainment, Lifestyle, Travel, taxi): 18%, błąd 26%, 30% ≤15%.
- Kierunek zmiany wycieków z trendu roku 1: 51,6% trafień = rzut monetą → NIE sprzedawać „AI przewiduje nawyki".
Koncepcja: pogoda = safe-to-spend (pewne, bo koszyk 1 przewidywalny), staw = bufor na koszyk 2 (przedział),
kwiaty = wycieki vs własna norma, „Ty decydujesz" = deterministyczna symulacja dwóch ogrodów (obecny poziom vs −X%),
czat z narzędziami SQL i pokazanym zapytaniem, jeden przycisk zobowiązania (Save More Tomorrow).
Persony demo: CUST04957 (18 l., wycieki 259 → 714 €/mies.), CUST00095 (21 l., 555 → 66 €/mies.),
CUST03539 (25 l., inwestuje co miesiąc), CUST02948 (salary_sweep co miesiąc → PSD2).

## Runda 6 – raporty 3 agentów badawczych (14.11.2026)

S-Pankki – „AI coach z ogrodem" (ogród = tylko UI):
- Dowody: Save More Tomorrow (Thaler & Benartzi 2004) 3,5% → 13,6% oszczędności; meta-analiza strategii samokontroli
  d = 0,57; sama edukacja finansowa d ≈ 0,09 (World Bank, 126 badań) → pedagogika musi być w akcji, nie w lekcjach;
  „ostrich effect" → pozytywny ton, jedna liczba.
- Brak aplikacji łączącej metaforę + czat z transakcjami + walidowaną prognozę what-if (Cleo bez metafory/backtestu;
  safe-to-spend istnieje od lat w PocketGuard/Simple → nie sprzedawać jako nowości).
- MVP: ogród 2D (Expo + web), czat tool-calling z widocznym SQL, safe-to-spend jako pogoda, what-if suwak + badge
  trafności backtestu (rok 1 → rok 2), benchmark rówieśników z datasetu, „godziny pracy" jako druga waluta.
- Stretch: Statistics Finland PxWeb (tabele ktutk 14q4 wiek, 14ph typ gospodarstwa), „storm warning" koszyka 2,
  przycisk commitment (+1% przy następnej wypłacie), mock PSD2 (salary_sweep), FI/SV/EN.
- Wzorce zwycięzców (wg agenta): Junction 2020 OP → Saavi (zdrowie finansowe, wygrał też cały event), 2017 Nordea →
  Kompis (prostota), 2025 Bank of Finland → Bureaucracy Buster (zrozumienie problemu + demo + solidna architektura).

Context.dev – top 3 agenta: Slush-o-Meter (radar sygnałów startupów przed Slush; Seeto/StartupHub częściowo),
Press Conference of the Internet (rzecznik AI odpowiada widowni z danych sprzed minut, auto-branding),
Rumour Mill Live (fact-check plotek gamingowych z wykresem wiarygodności w czasie).
Też: Helsinki Vibe Index, Tonight in Helsinki, Patch Notes Panic, Creator Crisis Clock.
Odrzucone przez agenta (zatłoczone): bilety, sneakersy, sentyment meme-stocków, generator brand-kitu.

Hostinger – top 3 agenta: Black Friday Trap Scanner (fałszywe sklepy; ScamSniffer 358k domen, OpenPhish,
negatywy z Tranco; BF 27.11), SlopScope (AI-slop content farms; benchmark RAID 10M dokumentów),
Troll Farm Time Machine (koordynacja na 2,97M tweetów IRA od fivethirtyeight + świeże dane z Context.dev).
Też: Reply-Guy Radar (boty Bluesky z firehose), Drainer Buster (zatłoczone), Log Janitor, Meme Propaganda X-ray
(SemEval-2021 Task 6: 950 memów, 22 techniki).
Uwaga: liczby i dostępność zbiorów podane przez agentów – do weryfikacji przed startem.

## Valio Aimo: Trusted Trade Agents (rekomendowany główny challenge)

Materiały: `data/valio/` (product data JSON 87 MB, schema, delivery reliability CSV, carbon footprint CSV, openapi.json).
Klucz API w `.env` jako `VALIO_API_KEY`. Portal: https://junction26.valioaimo.fi/ (hasło na platformie Junction).

API (mock): tylko `POST /api/price`, `POST /api/availability` (1–1000 produktów, nagłówek X-API-Key), download plików.
BRAK endpointu zamówienia / koszyka / zatwierdzeń – to całe „order + approval” budujemy sami (= sedno challenge'u).
Wymóg z dokumentacji: nie odpytywać cen/dostępności dla całego katalogu – najpierw zawęzić po danych statycznych.

Dane:
- 17 546 produktów, nazwy fi/en (prawie 100%), sv 92%; 349 kodów kategorii BEZ nazw; 83% ma dane GS1 Synkka
  (składniki, alergeny CONTAINS/FREE_FROM/MAY_CONTAIN, wartości odżywcze, oznaczenia: FREE_FROM_LACTOSE 4178,
  FREE_FROM_GLUTEN 3049, VEGAN 2959, Hyvää Suomesta 2057, EU organic 456, MSC 104, Fairtrade 92).
- Jednostki: salesUnit KI (karton) 46%, ST (sztuka) 32%… + `units` z przelicznikami (np. KI = 5 × 1 l); lot size.
- Zamienniki w danych: tylko 250 par (189 produktów, głównie warzywa) → good-better-best trzeba liczyć samemu.
- Delivery reliability: 4425 produktów (25%), średnio 0,97, są zera. CO2: 11 033 produkty (63%), średnie kategorii.

Pułapki w API (sprawdzone na losowych 300 produktach, dostawa 16.11.2026, „teraz” = 14.11 00:00):
- 19% produktów bez scheduleLines (nie da się dostarczyć), 3% availableAmount = 0.
- Terminal (dostawa od dostawcy, 40%): ilość zawsze 999999 = „nieznana”; Stock: też dziwne 9999999999 / 666666666.
- closingTime już minął dla 46% (np. Terminal cut-off 12.11, a availableDate nadal 16.11) → sprzeczność do obsłużenia.
- Najwcześniejsza data dostawy jest stała per produkt; żądanie wcześniejszej daty zwraca późniejszą.
- listPrice ≠ catalogPrice zawsze (rabat); 2% ma cenę netto klienta z validTo; 20% bez comparisonPrice.
- Sztuczka: litry/kg na jednostkę sprzedaży = catalogPrice / comparisonPrice (np. 31,31 / 1,57 ≈ 20 l = 2 × 10 l).
- Wyszukiwanie słowem „milk” łapie „milk chocolate drink”, „milk free wafer cones” → potrzebny semantyczny search.
- Mleko bez laktozy: 72 kandydatów; np. Valio Eila 3% 1 l = 1,40 €/l (cena netto), Eila 10 l novobox = 1,57 €/l.

Otwarte standardy do użycia (kryterium openness 15%):
- UCP (Universal Commerce Protocol, Google, `/.well-known/ucp`, checkout-sessions ze statusami incomplete /
  requires_escalation / ready_for_complete – idealne pod human approval), bindingi REST / MCP / A2A.
- AP2 (Agent Payments Protocol): mandaty (intent / cart / checkout) jako podpisane SD-JWT → uprawnienia agenta.
- MCP jako interfejs dla zewnętrznych agentów; OpenAPI; GS1 kody (GTIN, alergeny).

## S-Pankki: finansowy „Pou” (Personal Economic Trainer)

Stworek, którego stan odzwierciedla Twoje finanse, plus „wehikuł czasu”: jak będzie wyglądał za 6–12 miesięcy,
jeśli utrzymasz obecne nawyki, a jak po zmianie (np. −20% jedzenia na mieście).

Dane (`data/spankki/`, pobrane z GH, LFS plik zweryfikowany sha256):
- 3,63 mln transakcji, 5100 klientów, 1 konto/klient, 2024-10-01 … 2026-09-30 (24 mies.), 515 merchantów, 36 MCC.
- Klienci: wiek (18–90, mediana 44) + kod pocztowy (tylko Helsinki/Espoo/Vantaa: 00/01/02).
- Typy: purchase, utilities_payment, housing_payment, salary, salary_sweep (przelew pensji poza konto!),
  investment_deposit/withdrawal, other_income. Kolumna balance_after_eur.
- MCC pozwala rozdzielić: fast food 5814 (254k tx), restauracje 5812, bary 5813, taxi 4121,
  komunikacja 4111, paliwo 5541/5542, parking 7523, apteka 5912, lekarz 8011, elektronika 5732, meble 5712.
- Bonus: 200 klientów z historią wniosku hipotecznego (zdarzenia + decyzja, LTV, wymagany dochód).
- Statystyki: mediana dochodu 3210 €/mies., wydatków 2671 €/mies.; savings rate mediana 9%, 861 klientów (17%) wydaje
  więcej niż zarabia; 3526 klientów miało kiedyś ujemne saldo. Fast food: mediana 2 razy/mies., ~67 €/mies.
  Trend fast food (nachylenie > 2 €/mies.): 1217 rośnie, 1142 spada, 2741 płasko → jest co „przewidywać”.
- Uwagi: dane syntetyczne – średnia kwota w kategorii nie zależy od MCC, brak sezonowości (grudzień płaski),
  pojedyncze anomalie (np. restauracja 20 536 €) – trzeba je traktować jako „nieregularne”/odstające.

Research:
- Konkurencja: wiele hackathonowych „finance pet” (BudgetBuddy, FinPet, Penny, Finagotchi) + startup Rule (wiewiórka
  Nutty, beta: $100k oszczędności). Sam „zwierzak reaguje na wydatki” NIE jest oryginalny.
- Future self: Hershfield et al. 2011 (postarzone awatary → ~2x więcej na emeryturę w labie); replikacje mieszane;
  test terenowy w Meksyku (~50k osób): +16% wpłat jednorazowych (1,5% → 1,7%), mały, ale tani efekt.
  Efekt działa na długoterminowe oszczędzanie, słabiej na budżetowanie.
- S-mobiili już ma: „Omat ostot” (zakupy wg grup produktów, ślad węglowy), Hintavertailija, Säästäjä (mikrooszczędzanie
  z każdej płatności kartą / Bonusu).
- Benchmarki: Statistics Finland kulutustutkimus 2022 (COICOP2018, PxWeb, wg typu gospodarstwa / regionu).

Konkurencja (szczegóły):
- Hackathony (Devpost): Finagotchi (HackNC 2025), KashKitty (SheHacks V, nagroda Scotiabank), Penni (Level-Up Society,
  „Better Finance”), Pawket Change (Cursor Calgary; kot na ekranie blokady, LLM on-device), BudgetBuddy (Gemini + Nessie),
  FinPet, Penny („inspired by Pou”), Pet Wallet, PocketCats, Doggy Financier, MICA.
- Działające produkty: Cleo (czat z pieniędzmi + Roast Mode, 2,5 mln+ użytkowników, UK/US), Rule (wiewiórka Nutty),
  Bento Money (pet + bank linking + AI insights), Money Meow, WalletPet, Accompanied, FurFinancial.
- Junction 2025: challenge HEH „Financial Literacy” – wygrywały gry (np. „Broke No More!” – symulator doradcy z 34 AI NPC).
  Challenge Bank of Finland miał tylko 7 zgłoszeń (niszowe = mały tłok).

Dane vs funkcje (sprawdzone):
- Koszyk 1: housing 1x/mies., kwota stała (CV 0,03), dzień ±2 → łatwe wykrycie; utilities ~3x/mies., kwota zmienna.
- Koszyk 2: >500 € w Health/Home&Tech/Transport: mediana 1 na klienta / 24 mies., 37% klientów nie ma żadnego.
- Koszyk 3: „wycieki” (5812/5813/5814/4121 + Entertainment): mediana 13% wydatków, ~357 €/mies.; pik pt–sob.
- „Kawki” < 10 €: 67% to Restaurants – brak osobnego MCC kawiarni, brak subskrypcji (streaming) w danych.
- Saldo spójne (balance_after = poprzednie + kwota, 100%) → safe-to-spend / projekcja salda działa.
- Przewidywalność: korelacja wycieków rok 1 vs rok 2 = 0,74; ~29% klientów +25%, ~29% −25% → można zrobić backtest.
- Wiek: 18–25 (471 osób) – najwyższy udział restauracji 10,7%, najniższa stopa oszczędności 5%.
- PSD2: 264 klientów ma salary_sweep (część pieniędzy znika na inne konto) – realny case „niepełny obraz”.

Kierunek wyróżniający:
- Stan stworka = 3 koszyki S-Pankki, nie moralizowanie kategorii: koszyk 1 (stałe) = „dom”, koszyk 2 (nieregularne
  konieczne) = „parasol/zapas”, koszyk 3 (wycieki) = energia. Unikać „tyje od fast foodu” (body-shaming; S-Grupa sama
  prowadzi restauracje i sklepy).
- Wehikuł czasu: projekcja salda/bufora na 6–12 mies. per klient + suwak what-if.
- Rozmowa ze stworkiem: LLM z narzędziami SQL na danych klienta (MyData: użytkownik sam pyta, zamiast stałych wykresów).
- Tech challenges: Gemini API, Gemma (model lokalny, dane bankowe nie wychodzą), Verda (open-weight w EU),
  ElevenLabs (głos stworka).
