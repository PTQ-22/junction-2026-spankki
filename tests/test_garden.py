"""Regression: backend garden_state vs the frozen prototype numbers.

save_first_pct=0.1, today=2026-09-15 (the numbers in persona-data.json were
produced by experiments/proto_data.py with the 10% 'save first' slice).
Flower norms legitimately differ (the prototype used Feb-Jul; the backend
uses the 6 complete months before today's month = Mar-Aug) and are checked
independently instead.
"""

import json
from datetime import date
from pathlib import Path

import pytest

from backend.db import connect
from backend.garden import garden_state

REPO = Path(__file__).resolve().parent.parent
PERSONA_JSON = json.load(open(REPO / "prototype" / "taimi" / "persona-data.json"))
TODAY = date(2026, 9, 15)
# utilities_month legitimately differs too (prototype: rolling 6 months; backend: 6 complete months), so the
# utilities-dependent fields (bills_due, month_free, left_cycle, safe_today) are checked by formula instead.
FIELDS = [
    "balance", "salary", "days_to_payday", "rent", "rent_paid",
    "essentials_p75_month", "spent_cycle", "storm", "pond_target", "pond_fill",
]


@pytest.fixture(scope="module")
def con():
    c = connect(read_only=True)
    yield c
    c.close()


@pytest.mark.parametrize("pid", PERSONA_JSON.keys())
def test_regression_vs_frozen(con, pid):
    got = garden_state(con, pid, TODAY, save_first_pct=0.1)
    exp = PERSONA_JSON[pid]
    for f in FIELDS:
        if isinstance(exp[f], bool):
            assert got[f] == exp[f], f"{pid}.{f}: {got[f]} != {exp[f]}"
        else:
            assert abs(got[f] - exp[f]) <= 1, f"{pid}.{f}: {got[f]} != {exp[f]}"
    assert got["payday_window"] == exp["payday_window"], f"{pid}.payday_window"


@pytest.mark.parametrize("pid", PERSONA_JSON.keys())
@pytest.mark.parametrize("pct", [0.0, 0.1])
def test_budget_formula(con, pid, pct):
    g = garden_state(con, pid, TODAY, save_first_pct=pct)
    month_free = g["salary"] - g["rent"] - g["utilities_month"] - g["essentials_p75_month"] - g["invest_month"] - pct * g["salary"]
    assert abs(g["month_free"] - month_free) <= 2
    assert abs(g["left_cycle"] - (g["month_free"] - g["spent_cycle"])) <= 1
    if g["storm"]:
        assert g["safe_today"] == 0


def test_flower_norm_independent(con):
    """Norm = median monthly B3 spend over Mar-Aug 2026 (6 complete months)."""
    pid = "CUST04957"
    got = garden_state(con, pid, TODAY)
    vals = con.execute(
        f"""WITH g AS (SELECT range mo FROM range(DATE '2026-03-01', DATE '2026-09-01', INTERVAL 1 MONTH)),
            m AS (SELECT date_trunc('month', tx_date) mo, sum(-tx_amount_eur) v FROM tx
                  WHERE customer_id = '{pid}' AND basket = 'B3' AND flower = 'Entertainment'
                  AND tx_date < DATE '2026-09-15' GROUP BY 1)
            SELECT median(coalesce(v, 0)) FROM g LEFT JOIN m USING (mo)"""
    ).fetchone()[0]
    ent = next(f for f in got["flowers"] if f["flower"] == "Entertainment")
    assert abs(ent["norm"] - round(vals)) <= 1


def test_flowers_always_five(con):
    got = garden_state(con, "CUST00359", TODAY)
    assert [f["flower"] for f in got["flowers"]] == [
        "Restaurants", "Entertainment", "Lifestyle", "Travel", "Taxi",
    ]