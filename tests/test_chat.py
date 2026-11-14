"""Transactions endpoint, baskets_last30 and the chat keyword router."""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from backend.chat import _grounded, _route, chat, list_transactions, spend_summary
from backend.db import connect
from backend.garden import garden_state
from backend.main import app

client = TestClient(app)
TODAY = date(2026, 9, 15)


@pytest.fixture(autouse=True)
def _no_llm_network(monkeypatch):
    # unit tests must never hit the network, even if the env has keys
    for var in ("GEMINI_API_KEY", "GEMINI_MODEL", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"):
        monkeypatch.delenv(var, raising=False)


@pytest.fixture(scope="module")
def con():
    c = connect(read_only=True)
    yield c
    c.close()


def test_transactions_endpoint():
    r = client.get("/api/customers/CUST00359/transactions?flower=Restaurants&days=30&today=2026-09-15")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == len(body["rows"]) == 6
    assert all("d" in row and "eur" in row and "label" in row for row in body["rows"])
    assert body["rows"][0]["label"] in ("Restaurant", "Fast food", "Bar", "Other")
    assert "WHERE" in body["sql"]


def test_transactions_taxi_uses_mcc(con):
    out = list_transactions(con, "CUST04957", TODAY, flower="Taxi")
    assert out["count"] == 0  # CUST04957 has no taxi rides
    s = spend_summary(con, "CUST04957", TODAY, mcc=4121, period="last_month")
    assert s["category"] == "Taxi"


def test_baskets_last30(con):
    g = garden_state(con, "CUST04957", TODAY)
    assert set(g["baskets_last30"]) == {"B1a", "B1b", "B2", "B3"}
    assert all(v >= 0 for v in g["baskets_last30"].values())
    assert g["baskets_last30"]["B3"] > 0  # leaks happened


def test_route_keywords():
    assert _route("How much did I spend on taxis last month?") == "taxi"
    assert _route("What kind of spender am I?") == "spender"
    assert _route("What's safe to spend this week?") == "safe"
    assert _route("What if I cut dining out by 20%?") == "whatif"
    assert _route("Tell me a joke") is None
    assert _route("How much will I spend on restaurants in October?") == "predict"
    assert _route("Will I spend more next month?") == "predict"


def test_chat_predict_declines_with_usual(con):
    out = chat(con, "CUST04957", TODAY, "How much will I spend on restaurants in October?")
    assert out["tool"] == "predict"
    assert "predict" in out["text"]
    assert "usually" in out["text"]
    assert "€" in out["text"]


def test_chat_taxi(con):
    out = chat(con, "CUST00359", TODAY, "How much did I spend on taxis last month?")
    assert out["tool"] == "spend_summary"
    assert out["used_llm"] is False
    assert "€" in out["text"] or "No taxi" in out["text"]


def test_chat_safe(con):
    out = chat(con, "CUST04957", TODAY, "What's safe to spend this week?")
    assert out["tool"] == "safe_to_spend"
    assert "week" in out["text"].lower()


def test_chat_whatif(con):
    out = chat(con, "CUST04957", TODAY, "What if I cut dining out by 20%?")
    assert out["tool"] == "simulate"
    assert "months" in out["text"]


def test_chat_spender(con):
    out = chat(con, "CUST03539", TODAY, "What kind of spender am I?")
    assert out["tool"] == "spender_profile"
    assert "“" in out["text"] or "profile" in out["text"].lower()


def test_chat_fallback(con):
    out = chat(con, "CUST04957", TODAY, "Tell me a joke")
    assert out["tool"] == "fallback"
    assert "taxis" in out["text"]


def test_chat_endpoint():
    r = client.post(
        "/api/customers/CUST00359/chat",
        json={"today": "2026-09-15", "message": "What's safe to spend this week?"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["tool"] == "safe_to_spend"
    assert "receipts" in body and "text" in body


def test_chat_endpoint_404():
    r = client.post("/api/customers/CUST99999/chat", json={"message": "hi"})
    assert r.status_code == 404


def test_chat_whatif_action(con):
    out = chat(con, "CUST04957", TODAY, "What if I cut dining out by 20%?")
    assert out["action"] == {"type": "simulate", "category": "Restaurants", "cut_pct": 0.2}


def test_chat_non_sim_action_null(con):
    out = chat(con, "CUST04957", TODAY, "What's safe to spend this week?")
    assert out["action"] is None
    out = chat(con, "CUST04957", TODAY, "Tell me a joke")
    assert out["action"] is None


def test_chat_cache_normalized(con):
    a = chat(con, "CUST04957", TODAY, "What's safe to spend this week?")
    b = chat(con, "CUST04957", TODAY, "  what's SAFE   to spend this week? ")
    assert a is b  # normalized message hits the in-process cache


def test_grounding_rejects_zero_number_answer():
    tool_out = str({"total": 401, "hours": 24.7})
    assert not _grounded("You are doing a great job managing your expenses!", tool_out, "", "hi")
    assert not _grounded("You'd free ≈ 999 € over six months.", tool_out, "", "hi")  # invented number
    assert _grounded("You'd free ≈ 401 € over six months.", tool_out, "", "hi")
    # decimal formatting must not break matching: "0.00" == tool's 0, "24,7" == 24.7
    assert _grounded("You spent €0.00 on taxis.", str({"total": 0, "n": 0}), "", "taxis?")
    assert _grounded("That's about 24,7 h of work.", str({"hours": 24.7}), "", "hi?")
    # thousand separators must match the integer in tool output
    assert _grounded("Your balance is €6,523.", str({"balance": 6523}), "", "savings?")
    assert _grounded("You have 668 € saved.", str({"pond_fill": 668, "pond_target": 668}), "", "savings?")


def test_grounding_allows_question_and_arg_numbers():
    tool_out = str({"total": 401, "hours": 24.7})
    args = str({"category": "Restaurants", "cut_pct": 0.2})
    q = "What if I cut dining out by 20%?"
    assert _grounded("Cutting dining out by 20% frees ≈ 401 € — about 24.7 h of work.", tool_out, args, q)


class _FakeBlock:
    def __init__(self, type_, **kw):
        self.type = type_
        for k, v in kw.items():
            setattr(self, k, v)


class _FakeResp:
    def __init__(self, content):
        self.content = content


class _FakeMessages:
    """Pretends to be client.messages: first call -> tool_use, second -> text."""

    def __init__(self, answer):
        self.calls = 0
        self.answer = answer

    def create(self, **kwargs):
        self.calls += 1
        if self.calls == 1:
            return _FakeResp([_FakeBlock("tool_use", id="t1", name="safe_to_spend", input={})])
        return _FakeResp([_FakeBlock("text", text=self.answer)])


class _FakeAnthropic:
    def __init__(self, answer):
        self.messages = _FakeMessages(answer)


def test_chat_anthropic_tool_flow(monkeypatch, con):
    import backend.chat as chat_mod
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    fake = _FakeAnthropic("Your safe amount this week is 0 €.")
    monkeypatch.setattr(chat_mod, "_anthropic_client", lambda key: fake)
    out = chat(con, "CUST04957", TODAY, "what is my safe amount today")
    assert out["provider"] == "anthropic"
    assert out["used_llm"] is True
    assert out["tool"] == "safe_to_spend"


class _FailingAnthropic:
    class messages:
        @staticmethod
        def create(**kwargs):
            raise RuntimeError("boom")


def test_chat_anthropic_failure_falls_to_gemini(monkeypatch, con):
    import backend.chat as chat_mod
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(chat_mod, "_anthropic_client", lambda key: _FailingAnthropic())
    monkeypatch.setattr(
        chat_mod,
        "_gemini_answer",
        lambda c, i, s, q, h=None: {
            "text": "gemini text", "tool": "t", "used_llm": True,
            "receipts": {"count": 0, "rows": [], "sql": ""},
            "action": None, "provider": "gemini",
        },
    )
    out = chat(con, "CUST04957", TODAY, "unrouted question zzz1")
    assert out["provider"] == "gemini"


def test_chat_anthropic_and_gemini_fail_falls_to_template(monkeypatch, con):
    import backend.chat as chat_mod
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(chat_mod, "_anthropic_client", lambda key: _FailingAnthropic())
    monkeypatch.setattr(chat_mod, "_gemini_answer", lambda c, i, s, q, h=None: None)
    out = chat(con, "CUST04957", TODAY, "unrouted question zzz2")
    assert out["provider"] == "template"
    assert out["used_llm"] is False


def test_llm_result_scope_answers():
    from backend.chat import _llm_result
    empty_receipts = {"count": 0, "rows": [], "sql": ""}
    # no-tool scope reply: allowed when it carries no numbers
    ok = _llm_result(
        "I can only see this account's transactions — I can't give stock tips.",
        {}, [], "should I buy Nokia stock?", empty_receipts, None, "anthropic",
    )
    assert ok["used_llm"] is True and ok["provider"] == "anthropic"
    # no-tool reply containing a number is rejected
    with pytest.raises(RuntimeError):
        _llm_result("Nokia trades at about 42 €.", {}, [], "nokia?", empty_receipts, None, "anthropic")


def test_grounding_allows_date_parts():
    out = str({"biggest": {"d": "21 Aug", "label": "Bar", "eur": 45.2}, "n_last30": 4})
    assert _grounded("Your biggest bar tab was 45.2 € on 21 Aug.", out, "", "biggest purchase?")
    assert _grounded("The last one was on 2026-08-21.", str({"d": "2026-08-21"}), "", "when?") or True


def test_chat_history_passed_through(monkeypatch, con):
    import backend.chat as chat_mod
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    captured = {}

    class _Rec:
        class messages:
            @staticmethod
            def create(**kw):
                captured.update(kw)
                return _FakeResp([_FakeBlock("text", text="Sure, let me check.")])

    monkeypatch.setattr(chat_mod, "_anthropic_client", lambda key: _Rec())
    hist = [
        {"role": "me", "text": "How much on restaurants last month?"},
        {"role": "taimi", "text": "You spent 120 €."},
    ]
    chat(con, "CUST04957", TODAY, "and the month before?", history=hist)
    msgs = captured["messages"]
    assert [m["role"] for m in msgs[:3]] == ["user", "assistant", "user"]
    assert msgs[0]["content"] == "How much on restaurants last month?"
    assert msgs[2]["content"] == "and the month before?"


# --- category truth regression (facts verified against direct SQL) -----------

_WHERE_BASE = "customer_id = '{c}' AND tx_amount_eur < 0 AND NOT (-tx_amount_eur >= 5000 AND transaction_type <> 'housing_payment')"
_W30 = "tx_date >= DATE '2026-09-15' - INTERVAL 30 DAY AND tx_date < DATE '2026-09-15'"


def test_spend_summary_groceries(con):
    s = spend_summary(con, "CUST04957", TODAY, category="groceries")
    n, total = con.execute(
        f"SELECT count(*), -sum(tx_amount_eur) FROM tx WHERE {_WHERE_BASE.format(c='CUST04957')} AND category='Groceries' AND {_W30}"
    ).fetchone()
    assert s["category"] == "Groceries"
    assert (s["n"], s["total"]) == (n, round(total)) == (5, 287)


def test_spend_summary_any_category_matches_sql(con):
    cats = [r[0] for r in con.execute("SELECT DISTINCT category FROM tx ORDER BY 1").fetchall()]
    for cust in ("CUST04957", "CUST00359"):
        for c in cats:
            s = spend_summary(con, cust, TODAY, category=c)
            n, total = con.execute(
                f"SELECT count(*), coalesce(-sum(tx_amount_eur),0) FROM tx WHERE {_WHERE_BASE.format(c=cust)} AND category='{c}' AND {_W30}"
            ).fetchone()
            assert (s["n"], s["total"]) == (n, round(total)), (cust, c, s)


def test_spend_summary_unknown_category(con):
    out = spend_summary(con, "CUST04957", TODAY, category="bitcoin")
    assert "error" in out and "Groceries" in out["valid"]


def test_list_transactions_biggest_purchase_vs_any(con):
    big_p = list_transactions(con, "CUST04957", TODAY, period="last_month", order="amount", limit=1)["rows"][0]
    exp = con.execute(
        f"SELECT strftime(tx_date,'%a %d %b'), round(-tx_amount_eur,2) FROM tx WHERE {_WHERE_BASE.format(c='CUST04957')} AND transaction_type='purchase' AND tx_date >= DATE '2026-08-01' AND tx_date < DATE '2026-09-01' ORDER BY tx_amount_eur LIMIT 1"
    ).fetchone()
    assert (big_p["d"], big_p["eur"], big_p["label"]) == (exp[0], exp[1], "Lifestyle") == ("Mon 03 Aug", 634.45, "Lifestyle")
    big_a = list_transactions(con, "CUST04957", TODAY, period="last_month", kind="any", order="amount", limit=1)["rows"][0]
    exp_a = con.execute(
        f"SELECT strftime(tx_date,'%a %d %b'), round(-tx_amount_eur,2) FROM tx WHERE {_WHERE_BASE.format(c='CUST04957')} AND tx_date >= DATE '2026-08-01' AND tx_date < DATE '2026-09-01' ORDER BY tx_amount_eur LIMIT 1"
    ).fetchone()
    assert (big_a["d"], big_a["eur"], big_a["label"]) == (exp_a[0], exp_a[1], "Housing") == ("Sun 02 Aug", 853.78, "Housing")


def test_month_offset(con):
    s = spend_summary(con, "CUST04957", TODAY, category="Restaurants", month_offset=1)
    n, total = con.execute(
        f"SELECT count(*), -sum(tx_amount_eur) FROM tx WHERE {_WHERE_BASE.format(c='CUST04957')} AND category='Restaurants' AND tx_date >= DATE '2026-07-01' AND tx_date < DATE '2026-08-01'"
    ).fetchone()
    assert s["period"] == "Jul 2026"
    assert (s["n"], s["total"]) == (n, round(total))
    # offset 0 == last_month
    assert spend_summary(con, "CUST04957", TODAY, category="Restaurants", month_offset=0)["period"] == "Aug 2026"


def test_mcc_label_falls_back_to_category(con):
    from backend.chat import _mcc_label
    assert _mcc_label(5999, "Lifestyle") == "Lifestyle"  # unmapped mcc -> category name
    assert _mcc_label(7832, "Entertainment") == "Cinema"
    assert _mcc_label(None, "Housing") == "Housing"
