"""peer_benchmarks — "you vs people your age" in one DuckDB query.

Peers = every other customer with customer_age within ±5 years of the active
customer. For each fun-spending flower (the five B3 flowers) and each basket
(B1a/B1b/B2/B3) we compare:

  me    = median of the customer's own monthly totals over the last 6
          complete calendar months (zero months count — same norm convention
          as garden_state)
  peers = median over peers of each peer's own monthly median over the same
          window (median of medians, zero months included)

Only spending counts (tx_amount_eur < 0), with the usual outlier filter
(spending >= 5000 EUR unless housing_payment). Baskets/flowers come from the
materialised tx.basket / tx.flower columns (rules in db.py, HANDOFF §3.2).
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

FLOWER_ORDER = ["Restaurants", "Entertainment", "Lifestyle", "Travel", "Taxi"]
BASKET_ORDER = ["B1a", "B1b", "B2", "B3"]
AGE_BAND = 5

# Statistics Finland Household Budget Survey 2022 (CC BY 4.0), €/month per
# consumption unit — fetched offline once, see hbs.json.
_HBS = json.loads((Path(__file__).parent / "hbs.json").read_text())
_FLOWER_HBS = {"Restaurants": ["Restaurants"], "Entertainment": ["Entertainment"],
               "Lifestyle": ["Lifestyle"], "Travel": ["Travel"], "Taxi": []}
_BASKET_HBS = {"B1a": ["Housing+Utilities"], "B1b": ["Groceries", "Transportation"],
               "B2": ["Health"], "B3": ["Restaurants", "Entertainment", "Lifestyle", "Travel"]}


def _shift_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    return date(d.year + m // 12, m % 12 + 1, 1)


def peer_benchmarks(con, customer_id: str, today: date, age_band: int = AGE_BAND) -> dict:
    mo_start = today.replace(day=1)  # current (incomplete) month — excluded
    mo6 = _shift_months(mo_start, -6)  # start of the 6 complete months before
    flowers_lit = "[" + ",".join(f"'{f}'" for f in FLOWER_ORDER) + "]"
    baskets_lit = "[" + ",".join(f"'{b}'" for b in BASKET_ORDER) + "]"

    rows = con.execute(
        f"""
        WITH me AS (
            SELECT customer_age AS age FROM customers WHERE customer_id = '{customer_id}'
        ),
        peers AS (
            SELECT c.customer_id FROM customers c JOIN me
              ON c.customer_age BETWEEN me.age - {int(age_band)} AND me.age + {int(age_band)}
            WHERE c.customer_id <> '{customer_id}'
        ),
        months AS (
            SELECT range::DATE AS mo
            FROM range(DATE '{mo6.isoformat()}', DATE '{mo_start.isoformat()}', INTERVAL 1 MONTH)
        ),
        dims AS (
            SELECT 'flower' AS dim, unnest({flowers_lit}::VARCHAR[]) AS key
            UNION ALL SELECT 'basket', unnest({baskets_lit}::VARCHAR[])
        ),
        txs AS (
            SELECT customer_id, date_trunc('month', tx_date) AS mo, 'flower' AS dim,
                   flower AS key, -tx_amount_eur AS eur
            FROM tx
            WHERE customer_id IN (SELECT customer_id FROM peers UNION ALL SELECT '{customer_id}')
              AND tx_amount_eur < 0 AND basket = 'B3'
              AND tx_date >= DATE '{mo6.isoformat()}' AND tx_date < DATE '{mo_start.isoformat()}'
              AND NOT (-tx_amount_eur >= 5000 AND transaction_type <> 'housing_payment')
            UNION ALL
            SELECT customer_id, date_trunc('month', tx_date), 'basket',
                   basket, -tx_amount_eur
            FROM tx
            WHERE customer_id IN (SELECT customer_id FROM peers UNION ALL SELECT '{customer_id}')
              AND tx_amount_eur < 0 AND basket IS NOT NULL
              AND tx_date >= DATE '{mo6.isoformat()}' AND tx_date < DATE '{mo_start.isoformat()}'
              AND NOT (-tx_amount_eur >= 5000 AND transaction_type <> 'housing_payment')
        ),
        monthly AS (
            SELECT customer_id, dim, key, mo, sum(eur) AS v FROM txs GROUP BY ALL
        ),
        grid AS (
            SELECT p.customer_id, d.dim, d.key, m.mo
            FROM (SELECT customer_id FROM peers UNION ALL SELECT '{customer_id}') p
            CROSS JOIN dims d CROSS JOIN months m
        ),
        filled AS (
            SELECT g.customer_id, g.dim, g.key, coalesce(mm.v, 0) AS v
            FROM grid g LEFT JOIN monthly mm
              ON mm.customer_id = g.customer_id AND mm.dim = g.dim
             AND mm.key = g.key AND mm.mo = g.mo
        ),
        per_cust AS (
            SELECT customer_id, dim, key, median(v) AS med FROM filled GROUP BY ALL
        )
        SELECT dim, key,
               max(med) FILTER (customer_id = '{customer_id}') AS me,
               median(med) FILTER (customer_id <> '{customer_id}') AS peers,
               count(*) FILTER (customer_id <> '{customer_id}') AS peers_count
        FROM per_cust GROUP BY dim, key
        """
    ).fetchall()

    by = {(r[0], r[1]): r for r in rows}
    peers_count = int(rows[0][4]) if rows else 0

    my_age = con.execute(
        "SELECT customer_age FROM customers WHERE customer_id = ?", [customer_id]
    ).fetchone()[0]
    hbs_group = _HBS["age_17_24" if my_age <= 29 else "age_25_34"]

    def pack(dim: str, order: list[str], label: str) -> list[dict]:
        hbs_map = _FLOWER_HBS if dim == "flower" else _BASKET_HBS
        out = []
        for k in order:
            r = by.get((dim, k))
            hbs_keys = hbs_map.get(k, [])
            out.append(
                {
                    label: k,
                    "me": round(r[2]) if r and r[2] is not None else 0,
                    "peers": round(r[3]) if r and r[3] is not None else 0,
                    "hbs": round(sum(hbs_group[x] for x in hbs_keys)) if hbs_keys else None,
                }
            )
        return out

    return {
        "id": customer_id,
        "today": today.isoformat(),
        "window": {"start": mo6.isoformat(), "end": mo_start.isoformat()},
        "age_band": int(age_band),
        "peers_count": peers_count,
        "hbs": {"group": "17-24" if my_age <= 29 else "25-34",
                "source": _HBS["source"], "unit": _HBS["unit"]},
        "flowers": pack("flower", FLOWER_ORDER, "flower"),
        "baskets": pack("basket", BASKET_ORDER, "basket"),
    }
