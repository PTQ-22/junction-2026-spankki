"""One-time DuckDB build from the S-Pankki CSVs + read-only connections.

Build:  uv run python -m backend.db   (~1-2 min, only if the file is missing)
Tables: tx (all CSV columns + ts TIMESTAMP + basket + flower), customers.
"""

from pathlib import Path

import duckdb

REPO = Path(__file__).resolve().parent.parent
CSV_DIR = REPO / "data" / "spankki"
DB_PATH = REPO / "data" / "spankki.duckdb"

# Baskets v2 (HANDOFF §3.2). First matching rule wins. Spending amounts are
# negative. salary_sweep and investment_deposit get basket NULL.
BASKET_CASE = """
CASE
    WHEN transaction_type IN ('salary_sweep', 'investment_deposit') THEN NULL
    WHEN transaction_type IN ('housing_payment', 'utilities_payment') OR mcc_code = 4111 THEN 'B1a'
    WHEN category IN ('Restaurants', 'Entertainment', 'Lifestyle', 'Travel') OR mcc_code = 4121 THEN 'B3'
    WHEN category IN ('Health', 'Home & Tech') OR (category = 'Transportation' AND -tx_amount_eur > 300) THEN 'B2'
    WHEN category IN ('Groceries', 'Transportation') THEN 'B1b'
END
"""


def build(db_path: Path = DB_PATH) -> Path:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(db_path))
    con.execute(
        f"""
        CREATE OR REPLACE TABLE tx AS
        SELECT *,
            strptime(tx_timestamp, '%d%b%y:%H:%M:%S') AS ts,
            {BASKET_CASE} AS basket,
            CASE WHEN mcc_code = 4121 THEN 'Taxi' ELSE category END AS flower
        FROM read_csv_auto('{CSV_DIR}/tx_junction_transactions.csv', header=true)
        """
    )
    con.execute(
        f"""
        CREATE OR REPLACE TABLE customers AS
        SELECT * FROM read_csv_auto('{CSV_DIR}/tx_customers_junction.csv', header=true)
        """
    )
    con.execute("CREATE INDEX IF NOT EXISTS idx_tx_cust ON tx(customer_id, ts)")
    con.close()
    return db_path


def connect(read_only: bool = True) -> duckdb.DuckDBPyConnection:
    if not DB_PATH.exists():
        build()
    return duckdb.connect(str(DB_PATH), read_only=read_only)


def customer_exists(con: duckdb.DuckDBPyConnection, customer_id: str) -> bool:
    return (
        con.execute("SELECT count(*) FROM customers WHERE customer_id = ?", [customer_id]).fetchone()[0]
        > 0
    )


if __name__ == "__main__":
    p = build()
    con = duckdb.connect(str(p), read_only=True)
    n = con.execute("SELECT count(*) FROM tx").fetchone()[0]
    print(f"built {p} — {n:,} transactions")
