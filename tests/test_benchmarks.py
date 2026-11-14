"""Peer benchmarks: regression vs direct SQL on the same DuckDB + API."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from backend.benchmarks import BASKET_ORDER, FLOWER_ORDER, peer_benchmarks
from backend.chat import benchmark
from backend.db import connect
from backend.main import app

client = TestClient(app)
TODAY = date(2026, 9, 15)
MO6, MO_START = "2026-03-01", "2026-09-01"  # 6 complete months before Sep 2026
OUTLIER = "NOT (-tx_amount_eur >= 5000 AND transaction_type <> 'housing_payment')"


@pytest.fixture(autouse=True)
def _no_llm_network(monkeypatch):
    for var in ("GEMINI_API_KEY", "GEMINI_MODEL", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"):
        monkeypatch.delenv(var, raising=False)


@pytest.fixture(scope="module")
def con():
    c = connect(read_only=True)
    yield c
    c.close()


def _peer_median_sql(con, customer_id: str, dim: str, key: str) -> float:
    """Independent median-of-medians: peers = customers ±5 y of `customer_id`
    (excluding self), zero months included via a month grid."""
    col = "flower" if dim == "flower" else "basket"
    extra = "AND basket = 'B3'" if dim == "flower" else "AND basket IS NOT NULL"
    return con.execute(
        f"""WITH peers AS (
                SELECT p.customer_id FROM customers p JOIN customers me
                  ON p.customer_age BETWEEN me.customer_age - 5 AND me.customer_age + 5
                WHERE me.customer_id = '{customer_id}' AND p.customer_id <> '{customer_id}'),
            m AS (
                SELECT customer_id, date_trunc('month', tx_date) mo, sum(-tx_amount_eur) v
                FROM tx WHERE customer_id IN (SELECT customer_id FROM peers)
                  AND {col} = '{key}' {extra} AND tx_amount_eur < 0
                  AND tx_date >= DATE '{MO6}' AND tx_date < DATE '{MO_START}' AND {OUTLIER}
                GROUP BY ALL),
            g AS (
                SELECT p.customer_id, r.mo FROM peers p CROSS JOIN
                (SELECT range::DATE mo FROM range(DATE '{MO6}', DATE '{MO_START}', INTERVAL 1 MONTH)) r),
            pc AS (
                SELECT g.customer_id, median(coalesce(m.v, 0)) med
                FROM g LEFT JOIN m ON m.customer_id = g.customer_id AND m.mo = g.mo GROUP BY 1)
        SELECT median(med) FROM pc"""
    ).fetchone()[0]


def _me_median_sql(con, customer_id: str, dim: str, key: str) -> float:
    col = "flower" if dim == "flower" else "basket"
    extra = "AND basket = 'B3'" if dim == "flower" else "AND basket IS NOT NULL"
    return con.execute(
        f"""WITH m AS (
                SELECT date_trunc('month', tx_date) mo, sum(-tx_amount_eur) v
                FROM tx WHERE customer_id = '{customer_id}'
                  AND {col} = '{key}' {extra} AND tx_amount_eur < 0
                  AND tx_date >= DATE '{MO6}' AND tx_date < DATE '{MO_START}' AND {OUTLIER}
                GROUP BY ALL)
        SELECT median(coalesce(m.v, 0))
        FROM (SELECT range::DATE mo FROM range(DATE '{MO6}', DATE '{MO_START}', INTERVAL 1 MONTH)) g
        LEFT JOIN m USING (mo)"""
    ).fetchone()[0]


def test_benchmarks_structure(con):
    out = peer_benchmarks(con, "CUST04957", TODAY)
    assert out["id"] == "CUST04957"
    assert out["window"] == {"start": MO6, "end": MO_START}
    assert out["age_band"] == 5
    assert out["peers_count"] == 366  # 367 customers aged 13–23, minus self
    assert [f["flower"] for f in out["flowers"]] == FLOWER_ORDER
    assert [b["basket"] for b in out["baskets"]] == BASKET_ORDER


def test_benchmarks_regression_all_dims(con):
    """Every flower and basket, 'me' and 'peers', matches independent SQL."""
    for cust in ("CUST04957", "CUST03539"):
        out = peer_benchmarks(con, cust, TODAY)
        got = {(r["flower"] if "flower" in r else r["basket"]): r
               for r in out["flowers"] + out["baskets"]}
        for dim, keys in (("flower", FLOWER_ORDER), ("basket", BASKET_ORDER)):
            for k in keys:
                exp_peers = _peer_median_sql(con, cust, dim, k)
                exp_me = _me_median_sql(con, cust, dim, k)
                row = got[k]
                assert row["peers"] == round(exp_peers), (cust, dim, k, row, exp_peers)
                assert row["me"] == round(exp_me), (cust, dim, k, row, exp_me)


def test_benchmarks_me_matches_garden_norm(con):
    """'me' for a flower equals the garden's monthly norm (same window/zero rule)."""
    from backend.garden import garden_state
    g = garden_state(con, "CUST04957", TODAY)
    norms = {f["flower"]: f["norm"] for f in g["flowers"]}
    for f in peer_benchmarks(con, "CUST04957", TODAY)["flowers"]:
        assert f["me"] == norms[f["flower"]]


def test_benchmarks_endpoint():
    r = client.get("/api/customers/CUST04957/benchmarks?today=2026-09-15")
    assert r.status_code == 200
    b = r.json()
    assert b["peers_count"] >= 30
    assert len(b["flowers"]) == 5 and len(b["baskets"]) == 4
    rest = next(f for f in b["flowers"] if f["flower"] == "Restaurants")
    assert rest["me"] == 334 and rest["peers"] == 144


def test_benchmarks_endpoint_404():
    r = client.get("/api/customers/CUST99999/benchmarks")
    assert r.status_code == 404


def test_benchmark_tool_category(con):
    out = benchmark(con, "CUST04957", TODAY, "restaurants")
    assert out["category"] == "Restaurants"
    assert out["you_eur_month"] == 334 and out["peers_eur_month"] == 144
    assert out["peers_count"] == 366


def test_benchmark_tool_alias_and_basket(con):
    out = benchmark(con, "CUST04957", TODAY, "eating out")
    assert out["category"] == "Restaurants"
    out = benchmark(con, "CUST04957", TODAY, "fun")
    assert out["basket"] == "B3" and out["you_eur_month"] > 0


def test_benchmark_tool_all_and_unknown(con):
    out = benchmark(con, "CUST04957", TODAY)
    assert len(out["flowers"]) == 5 and len(out["baskets"]) == 4
    out = benchmark(con, "CUST04957", TODAY, "bitcoin")
    assert "error" in out and "Restaurants" in out["valid"]
    out = benchmark(con, "CUST04957", TODAY, "Health")
    assert "note" in out  # real category, but not a fun flower
    out = benchmark(con, "CUST04957", TODAY, "groceries")
    assert out["basket"] == "B1b"  # basket alias wins over the raw category


def test_benchmark_in_tool_schemas():
    """benchmark must be declared for both providers (with a category param)."""
    from backend.chat import _TOOL_DESCS
    assert "benchmark" in _TOOL_DESCS
