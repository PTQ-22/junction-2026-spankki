# AGENTS.md

Junction 2026 hackathon workspace. Wybrany projekt: S-Pankki „AI coach z ogrodem” – pełny kontekst w `HANDOFF.md`,
notatki z researchu w `IDEAS.md`.

## Środowisko
- Python przez `uv` (`uv run ...`, `uv add ...`); jednorazowe narzędzia: `uv run --with duckdb python ...`.
- Node 24, Xcode 27.2 z symulatorami iOS (iPhone 18 Pro itd.) – frontend w Expo (React Native).
- Sekrety w `.env` (nie commitować, jest w `.gitignore`): `EXA_API_KEY`, `VALIO_API_KEY`, `CONTEXT_DEV_API_KEY`.
  Ładowanie: `python-dotenv` albo `uv run --env-file .env ...`.

## Dane (w `data/`, gitignored)
- `data/spankki/` – dataset S-Pankki (CSV z UTF-8 BOM → `encoding="utf-8-sig"`; DuckDB `read_csv_auto` działa wprost).
- `data/valio/`, `data/experiments/` – materiały z researchu innych challenge’y (nieużywane).

## Skrypty
- `experiments/spankki_backtest.py` – koszyki B1/B2/B3, backtest rok 1 → rok 2, wybór person do demo.
  Uruchom: `uv run --with duckdb python experiments/spankki_backtest.py` (z katalogu repo).
- `experiments/spankki_sanity.py` – szybkie testy sensowności (stare koszyki, daty, persony miesiąc po miesiącu).
- Pełny przebieg backtestu trwa ok. 3–4 min (wczytanie 363 MB CSV) – uruchamiać z timeoutem lub w tle.
- `tx_timestamp` to tekst (`03OCT24:09:04:04`) – do sortowania parsować `strptime(tx_timestamp, '%d%b%y:%H:%M:%S')`.
- `experiments/proto_data.py` – liczby person na dzień 15.09.2026 dla prototypu; wynik zapisać do
  `prototype/taimi/persona-data.json` (`uv run --with duckdb python experiments/proto_data.py > prototype/taimi/persona-data.json`)
  i ponownie wkleić do `index.html` (dane są inline).
- `prototype/taimi/` – obowiązujący prototyp designu (`make serve` → port 4175). Zrzuty: headless Chrome
  (`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot=... --window-size=1440,900`).
- Pozostałe pliki w `experiments/` i `newsmon/` to testy z researchu (Exa, Context.dev) – nie są częścią projektu.

## Zasady
- LLM w aplikacji nigdy nie liczy sam – liczby wyłącznie z narzędzi (SQL/DuckDB).
- Ton bez zawstydzania (patrz HANDOFF.md, sekcja 2).
