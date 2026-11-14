"""simulate() — deterministic rules matching the prototype."""

from datetime import date

import pytest

from backend.db import connect
from backend.garden import garden_state
from backend.simulate import simulate

TODAY = date(2026, 9, 15)


@pytest.fixture(scope="module")
def con():
    c = connect(read_only=True)
    yield c
    c.close()


@pytest.fixture(scope="module")
def state(con):
    return garden_state(con, "CUST04957", TODAY)


def test_entertainment_20pct(state):
    norm = next(f["norm"] for f in state["flowers"] if f["flower"] == "Entertainment")
    r = simulate(state, "Entertainment", 0.2)
    assert r["total"] == round(norm * 0.2 * 6)
    assert r["monthly_cumulative"][-1] == round(norm * 0.2 * 6, 1)
    assert r["today"]["flower_state"] == "wilting"
    assert r["future"]["flower_state"] == "blooming"  # 20% >= 15% threshold
    # pond already full for this persona -> pocket line
    assert state["pond_fill"] >= state["pond_target"]
    assert any("pocket" in c["text"] for c in r["chips"])


def test_norm_zero_category_disabled(state):
    r = simulate(state, "Travel", 0.5)  # Travel norm = 0 for CUST04957
    assert r["disabled"] is True
    assert r["total"] == 0
    assert r["today"]["flower_state"] == r["future"]["flower_state"]


def test_cut_zero_identical(state):
    r = simulate(state, "Entertainment", 0.0)
    assert r["total"] == 0
    assert r["today"]["flower_state"] == r["future"]["flower_state"]
    assert r["today"]["pond_fill"] == r["future"]["pond_fill"]
    assert r["today"]["stage"] == r["future"]["stage"]
    assert all(v == 0 for v in r["monthly_cumulative"])


def test_thresholds(state):
    r5 = simulate(state, "Entertainment", 0.05)
    assert r5["future"]["flower_state"] == "ok"
    r10 = simulate(state, "Entertainment", 0.10)
    assert r10["future"]["flower_state"] == "ok"
    r15 = simulate(state, "Entertainment", 0.15)
    assert r15["future"]["flower_state"] == "blooming"


def test_stage_advance(state):
    # force an advance: large enough total vs pond_target or >= 300
    norm = next(f["norm"] for f in state["flowers"] if f["flower"] == "Entertainment")
    r = simulate(state, "Entertainment", 0.5)
    if norm * 0.5 * 6 >= 300:
        assert r["future"]["stage"] == min(4, r["today"]["stage"] + 1)
        assert any(c["kind"] == "stage" for c in r["chips"])


def test_eur_per_day(state):
    r = simulate(state, "Entertainment", 0.2)
    assert r["eur_per_day_now"] == round(max(state["month_free"], 0) / 30, 1)


def test_monthly_pond_pocket(state):
    r = simulate(state, "Entertainment", 0.2)
    assert len(r["monthly_pond"]) == len(r["monthly_pocket"]) == r["months"]
    assert r["monthly_pond"][-1] == r["future"]["pond_fill"]
    assert r["monthly_pocket"][-1] == r["future"]["pond_to_pocket"]
    # CUST04957 pond already full -> pocket accumulates from month 1
    assert r["monthly_pocket"][0] == round(state["pond_fill"] + r["monthly_cumulative"][0] - state["pond_target"])
    assert all(b >= a for a, b in zip(r["monthly_pocket"], r["monthly_pocket"][1:]))
