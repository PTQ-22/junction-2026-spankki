"""Ask Taimi — tool-backed answers. The LLM (Gemini) only phrases; every
number comes from a tool. Without GEMINI_API_KEY a keyword router answers
the four brief questions deterministically.

Tools (the LLM never counts):
  spend_summary(category|mcc, period)   -> {total, n, period_label, sql}
  list_transactions(filter, period, n)  -> receipt rows
  safe_to_spend(state)                  -> from garden_state
  simulate(state, category, cut)        -> deterministic
  spender_profile(con, customer, today) -> deterministic profile
"""

from __future__ import annotations

import os
import re
from datetime import date

from .benchmarks import BASKET_ORDER, FLOWER_ORDER, peer_benchmarks
from .garden import garden_state
from .simulate import simulate

MCC_LABELS = {
    4121: "Taxi", 4111: "Phone/internet", 5812: "Restaurant", 5814: "Fast food",
    5813: "Bar", 7832: "Cinema", 7922: "Theatre/events", 7996: "Amusement park",
    5691: "Clothing", 5541: "Fuel", 5542: "Fuel", 7523: "Parking",
    5912: "Pharmacy", 8011: "Doctor", 5732: "Electronics", 5712: "Furniture",
}

# Free-tier friendly lite models (15 RPM / 500 RPD each). GEMINI_MODEL overrides.
DEFAULT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]
_CACHE: dict[tuple, dict] = {}
# Aliases map to dataset categories (SELECT DISTINCT category FROM tx) + 'Taxi'.
_CAT_ALIAS = {
    "restaurant": "Restaurants", "dining": "Restaurants", "eating out": "Restaurants",
    "fast food": "Restaurants", "bar": "Restaurants",
    "grocer": "Groceries", "food": "Groceries", "supermarket": "Groceries",
    "entertain": "Entertainment", "cinema": "Entertainment", "movie": "Entertainment", "fun": "Entertainment",
    "lifestyle": "Lifestyle", "shopping": "Lifestyle", "cloth": "Lifestyle",
    "travel": "Travel", "trip": "Travel", "holiday": "Travel",
    "taxi": "Taxi", "ride": "Taxi", "uber": "Taxi", "bolt": "Taxi",
    "rent": "Housing", "housing": "Housing",
    "home": "Home & Tech", "tech": "Home & Tech", "furniture": "Home & Tech", "electronic": "Home & Tech",
    "utilit": "Utilities", "electricity": "Utilities", "bill": "Utilities",
    "health": "Health", "pharmacy": "Health", "doctor": "Health",
    "transport": "Transportation", "fuel": "Transportation", "parking": "Transportation",
    "invest": "Invest Deposit", "salary": "Salary", "income": "Other Income",
}
MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

_VALID_CATS: list[str] | None = None


def _valid_categories(con) -> list[str]:
    """Distinct dataset categories + 'Taxi' (mcc 4121 split of Transportation)."""
    global _VALID_CATS
    if _VALID_CATS is None:
        _VALID_CATS = [r[0] for r in con.execute("SELECT DISTINCT category FROM tx ORDER BY 1").fetchall()]
        _VALID_CATS.append("Taxi")
    return _VALID_CATS


def _canon_category(con, cat) -> tuple[str | None, dict | None]:
    """-> (canonical category, None) or (None, error dict for the model to retry)."""
    if cat is None or str(cat).strip() == "":
        return None, None
    valid = _valid_categories(con)
    cl = str(cat).strip().lower()
    for v in valid:
        if v.lower() == cl:
            return v, None
    for k, v in _CAT_ALIAS.items():
        if k in cl:
            return v, None
    return None, {"error": f"unknown category {cat!r}", "valid": valid}


def _mcc_label(mcc, category: str | None = None):
    if mcc is not None:
        return MCC_LABELS.get(mcc) or category or "Other"
    return category or "Other"


def _month_window(today: date, offset: int) -> tuple[date, date, str]:
    """offset 0 = last full month, 1 = the month before that, … max 12."""
    k = max(0, min(12, int(offset)))
    y, m = today.year, today.month - 1 - k
    while m < 1:
        m += 12
        y -= 1
    start = date(y, m, 1)
    end = date(y + (m == 12), m % 12 + 1, 1)
    return start, end, f"{MONTHS_EN[m - 1]} {y}"


def _tx_where(customer_id: str, category: str | None, mcc: int | None, period: str,
              today: date, month_offset: int | None = None, kind: str = "any") -> tuple[str, str, str]:
    """WHERE clause + label for a transaction query (spending, no outliers).
    Window matches the app: [today-30, today) for last_30d, full calendar month otherwise."""
    T = f"DATE '{today.isoformat()}'"
    conds = [
        f"customer_id = '{customer_id}'",
        "tx_amount_eur < 0",
        "NOT (-tx_amount_eur >= 5000 AND transaction_type <> 'housing_payment')",
    ]
    label = "spending"
    if mcc is not None:
        conds.append(f"mcc_code = {mcc}")
        label = _mcc_label(mcc)
    elif category == "Taxi":
        conds.append("mcc_code = 4121")
        label = "Taxi"
    elif category:
        conds.append(f"category = '{str(category).replace(chr(39), chr(39) * 2)}'")
        label = category
    if kind == "purchase":
        conds.append("transaction_type = 'purchase'")
    if month_offset is not None:
        start, end, period_label = _month_window(today, month_offset)
        conds.append(f"tx_date >= DATE '{start.isoformat()}' AND tx_date < DATE '{end.isoformat()}'")
    elif period == "last_month":
        start, end, period_label = _month_window(today, 0)
        conds.append(f"tx_date >= DATE '{start.isoformat()}' AND tx_date < DATE '{end.isoformat()}'")
    else:
        days = int(period.replace("last_", "").replace("d", "")) if period != "last_30d" else 30
        conds.append(f"tx_date >= {T} - INTERVAL {days} DAY AND tx_date < {T}")
        period_label = f"last {days} days"
    return " AND ".join(conds), label, period_label


def spend_summary(con, customer_id, today: date, category: str | None = None,
                  mcc: int | None = None, period: str = "last_30d",
                  month_offset: int | None = None) -> dict:
    canon, err = _canon_category(con, category)
    if err:
        return err
    where, label, period_label = _tx_where(customer_id, canon, mcc, period, today, month_offset)
    sql = f"""SELECT count(*) AS n, -sum(tx_amount_eur) AS total
FROM transactions WHERE {where}"""
    n, total = con.execute(
        f"SELECT count(*), coalesce(-sum(tx_amount_eur), 0) FROM tx WHERE {where}"
    ).fetchone()
    return {"category": label, "period": period_label, "n": int(n), "total": round(total), "sql": sql}


def list_transactions(con, customer_id, today: date, category: str | None = None,
                      flower: str | None = None, mcc: int | None = None,
                      period: str = "last_30d", month_offset: int | None = None,
                      limit: int = 6, kind: str = "purchase", order: str = "date") -> dict:
    canon, err = _canon_category(con, category or flower)
    if err:
        return err
    k = "purchase" if str(kind).lower() == "purchase" else "any"
    where, label, period_label = _tx_where(customer_id, canon, mcc, period, today, month_offset, kind=k)
    direction = "tx_amount_eur" if str(order).lower() == "amount" else "tx_date DESC"
    sql = f"""SELECT tx_date, coalesce(mcc_code::VARCHAR, category) AS label, -tx_amount_eur AS eur
FROM transactions WHERE {where} ORDER BY {direction} LIMIT {limit}"""
    cur = con.execute(
        f"""SELECT strftime(tx_date, '%a %d %b'), mcc_code, category, round(-tx_amount_eur, 2)
            FROM tx WHERE {where} ORDER BY {direction} LIMIT ?""",
        [int(limit)],
    )
    rows = [{"d": r[0], "mcc": r[1], "label": _mcc_label(r[1], r[2]), "eur": r[3]} for r in cur.fetchall()]
    return {"rows": rows, "count": len(rows), "period": period_label, "kind": k, "sql": sql}


def safe_to_spend(state: dict) -> dict:
    return {
        "safe_today": state["safe_today"],
        "safe_week": state["safe_week"],
        "storm": state["storm"],
        "left_cycle": state["left_cycle"],
        "days_to_payday": state["days_to_payday"],
        "bills_due": state["bills_due"],
        "essentials_due": state["essentials_due"],
    }


def spender_profile(con, customer_id: str, today: date, state: dict) -> dict:
    """Deterministic profile from basket shares, weekend share and leaks vs norm."""
    T = f"DATE '{today.isoformat()}'"
    b3 = con.execute(
        f"""SELECT count(*), coalesce(-sum(tx_amount_eur), 0),
                   avg((dayofweek(tx_date) IN (0,5,6))::INT)
            FROM tx WHERE customer_id = '{customer_id}' AND basket = 'B3'
              AND tx_date < {T} AND tx_date >= {T} - INTERVAL 6 MONTH"""
    ).fetchone()
    shares = {
        r[0]: round(r[1])
        for r in con.execute(
            f"""SELECT basket, -sum(tx_amount_eur) FROM tx
                WHERE customer_id = '{customer_id}' AND basket IS NOT NULL
                  AND tx_date < {T} AND tx_date >= {T} - INTERVAL 6 MONTH
                GROUP BY 1"""
        ).fetchall()
    }
    total_b = sum(shares.values()) or 1
    shares_pct = {k: round(100 * v / total_b) for k, v in shares.items()}
    weekend = b3[2] or 0
    leaks30 = sum(f["last30"] for f in state["flowers"])
    norm_m = state["leaks_norm_month"] or 1
    top = state["top_flower"]
    top_share = next((f["last30"] for f in state["flowers"] if f["flower"] == top), 0) / max(leaks30, 1)

    if weekend >= 0.55:
        name = "Weekend social"
        why = f"{round(weekend * 100)}% of your fun spending lands Fri–Sun"
    elif leaks30 <= 0.6 * norm_m:
        name = "Regrowing garden"
        why = f"leaks run at {round(100 * leaks30 / norm_m)}% of your usual — well under"
    elif top_share >= 0.5:
        name = "One big leak"
        why = f"{top} alone is {round(top_share * 100)}% of the last 30 days"
    else:
        name = "Everyday mixer"
        why = "spending is spread across categories, no single leak dominates"
    return {
        "profile": name,
        "why": why,
        "basket_share_pct": shares_pct,
        "weekend_share": round(weekend, 2),
        "leaks_vs_norm": round(leaks30 / norm_m, 2) if norm_m else None,
        "tx_6m_b3": int(b3[0]),
    }


def category_breakdown(con, customer_id: str, today: date, state: dict,
                       period: str = "last_30d", month_offset: int | None = None) -> dict:
    """Per fun-category totals + per-basket totals for a period, with usuals."""
    where, _, period_label = _tx_where(customer_id, None, None, period, today, month_offset)
    norms = {f["flower"]: f["norm"] for f in state["flowers"]}
    cats = [
        {"category": r[0], "n": int(r[1]), "total": r[2], "usual_month": norms.get(r[0], 0)}
        for r in con.execute(
            f"""SELECT flower, count(*), round(-sum(tx_amount_eur)) FROM tx
                WHERE {where} AND flower IS NOT NULL GROUP BY 1 ORDER BY 3 DESC"""
        ).fetchall()
    ]
    baskets = {
        r[0]: round(r[1])
        for r in con.execute(
            f"""SELECT basket, -sum(tx_amount_eur) FROM tx
                WHERE {where} AND basket IS NOT NULL GROUP BY 1"""
        ).fetchall()
    }
    return {"period": period_label, "categories": cats, "baskets": baskets}


def compare_to_usual(con, customer_id: str, today: date, state: dict, category: str) -> dict:
    """One category vs its usual: last 30d, monthly norm, count, biggest tx, weekend share."""
    canon, err = _canon_category(con, category)
    if err:
        return err
    flower = next((f for f in state["flowers"] if f["flower"] == canon), None)
    where, _, _ = _tx_where(customer_id, canon, None, "last_30d", today)
    n, total, wknd = con.execute(
        f"""SELECT count(*), coalesce(-sum(tx_amount_eur), 0),
                   avg((dayofweek(tx_date) IN (0,5,6))::INT)
            FROM tx WHERE {where}"""
    ).fetchone()
    big = con.execute(
        f"""SELECT strftime(tx_date, '%a %d %b'), mcc_code, category, round(-tx_amount_eur, 2)
            FROM tx WHERE {where} ORDER BY tx_amount_eur LIMIT 1"""
    ).fetchone()
    out = {
        "category": canon, "last30": round(total), "usual_month": flower["norm"] if flower else None,
        "n_last30": int(n),
        "biggest": ({"d": big[0], "label": _mcc_label(big[1], big[2]), "eur": big[3]} if big else None),
        "weekend_share": round(wknd or 0, 2),
        "sql": f"SELECT count(*), -sum(tx_amount_eur) FROM transactions WHERE {where}",
    }
    if not flower:
        out["note"] = "no usual monthly amount tracked for this category"
    return out


def bills_overview(state: dict) -> dict:
    """Rent + utilities + what's still due this cycle."""
    return {
        "rent": state["rent"], "rent_window": state["rent_window"],
        "rent_paid": state["rent_paid"], "next_rent_window": state["next_rent_window"],
        "utilities_month": state["utilities_month"], "bills_due": state["bills_due"],
    }


def balance_overview(state: dict) -> dict:
    """Account balance, savings pond, salary, payday, investments."""
    return {
        "balance": state["balance"], "pond_fill": state["pond_fill"],
        "pond_target": state["pond_target"], "salary": state["salary"],
        "payday_window": state["payday_window"], "days_to_payday": state["days_to_payday"],
        "invest_total": state["invest_total"],
    }


_BASKET_ALIAS = {
    "b1a": "B1a", "bills": "B1a", "rent": "B1a",
    "b1b": "B1b", "essentials": "B1b", "everyday": "B1b", "groceries": "B1b",
    "b2": "B2", "irregular": "B2", "pond": "B2", "buffer": "B2",
    "b3": "B3", "fun": "B3", "leaks": "B3", "flowers": "B3",
}


def benchmark(con, customer_id: str, today: date, category: str | None = None) -> dict:
    """You vs age peers (±5 y): median €/month over the last 6 complete months,
    per fun flower or basket. category optional — omit for the full table."""
    data = peer_benchmarks(con, customer_id, today)
    base = {
        "peers_count": data["peers_count"],
        "peers": f"customers within ±{data['age_band']} years of your age",
        "window": f"{data['window']['start']} to {data['window']['end']} (median €/month)",
    }
    if category is None or str(category).strip() == "":
        return {**base, "flowers": data["flowers"], "baskets": data["baskets"]}
    cl = str(category).strip()
    b = _BASKET_ALIAS.get(cl.lower())  # basket words win: "fun"->B3, "bills"->B1a
    if b:
        row = next(r for r in data["baskets"] if r["basket"] == b)
        return {**base, "basket": b,
                "you_eur_month": row["me"], "peers_eur_month": row["peers"]}
    canon, _ = _canon_category(con, cl)
    if canon:
        row = next((f for f in data["flowers"] if f["flower"] == canon), None)
        if row:
            return {**base, "category": canon,
                    "you_eur_month": row["me"], "peers_eur_month": row["peers"]}
        return {**base, "category": canon,
                "note": "peer benchmarks exist only for fun categories "
                        "(Restaurants, Entertainment, Lifestyle, Travel, Taxi) "
                        "and baskets (B1a bills, B1b essentials, B2 irregular, B3 fun)"}
    return {**base, "error": f"unknown benchmark category {category!r}",
            "valid": FLOWER_ORDER + BASKET_ORDER}


# -----------------------------------------------------------------------------


def _euro(n: float) -> str:
    return f"{round(n):,} €".replace(",", " ")


QUESTIONS = {
    "taxi": "How much did I spend on taxis last month?",
    "spender": "What kind of spender am I?",
    "safe": "What's safe to spend this week?",
    "whatif": "What if I cut dining out by 20%?",
}


def _route(question: str) -> str | None:
    q = question.lower()
    if "taxi" in q or "4121" in q:
        return "taxi"
    if "kind of spender" in q or "spender am i" in q or "profile" in q:
        return "spender"
    if "safe" in q or "this week" in q or "afford" in q:
        return "safe"
    if re.search(
        r"\b(will i|going to spend|predict|forecast|next (week|month|year)|"
        r"in (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)\b",
        q,
    ):
        return "predict"
    if "cut" in q or "reduce" in q or "less on" in q or "what if" in q or "whatif" in q or "save" in q:
        return "whatif"
    return None


def _templated(key: str, con, customer_id: str, state: dict, message: str = "") -> dict:
    if key == "predict":
        cl = message.lower()
        cat = next((f["flower"] for f in state["flowers"] if f["flower"].lower() in cl), None)
        if cat is None:
            cat = next((v for k, v in _CAT_ALIAS.items() if k in cl), "Restaurants")
        norm = next((f["norm"] for f in state["flowers"] if f["flower"] == cat), 0)
        text = (
            f"I don't predict fun spending — that part stays your choice. "
            f"You usually spend {_euro(norm)} a month on {cat.lower()}."
        )
        return {"text": text, "tool": "predict", "receipts": {"count": 0, "rows": [], "sql": ""}, "action": None, "provider": "template"}
    if key == "taxi":
        s = spend_summary(con, customer_id, state["_today"], mcc=4121, period="last_month")
        tx = list_transactions(con, customer_id, state["_today"], mcc=4121, period="last_month")
        text = (
            f"Taxis in {s['period']}: {_euro(s['total'])} across {s['n']} rides."
            if s["n"]
            else f"No taxi rides in {s['period']} — that seed stays quiet."
        )
        return {"text": text, "tool": "spend_summary", "receipts": {"count": tx["count"], "rows": tx["rows"], "sql": tx["sql"]}, "action": None, "provider": "template"}
    if key == "spender":
        prof = spender_profile(con, customer_id, state["_today"], state)
        share = ", ".join(f"{k} {v}%" for k, v in sorted(prof["basket_share_pct"].items()))
        text = (
            f"You read as a “{prof['profile']}” — {prof['why']}. "
            f"Last 6 months by basket: {share}. (Labels are descriptive, not judgement.)"
        )
        return {"text": text, "tool": "spender_profile", "receipts": {"count": prof["tx_6m_b3"], "rows": [], "sql": ""}, "action": None, "provider": "template"}
    if key == "safe":
        s = safe_to_spend(state)
        text = (
            f"About {_euro(s['safe_week'])} is safe this week (~{_euro(s['safe_today'])}/day until payday)."
            if s["safe_week"] > 0
            else f"Nothing extra this week — you're {_euro(abs(s['left_cycle']))} over this cycle's fun budget. "
                 f"Hold steady until payday; your pond is untouched."
        )
        return {"text": text, "tool": "safe_to_spend", "receipts": {"count": 0, "rows": [], "sql": ""}, "action": None, "provider": "template"}
    if key == "whatif":
        r = simulate(state, "Restaurants", 0.2)
        text = (
            f"Cutting dining out by 20% frees ≈ {_euro(r['total'])} over six months — "
            f"about {r['hours']} h of your work. Pond fills first, the rest stays in your pocket."
            if not r["disabled"]
            else "Your restaurants norm is already ~0 — there's nothing usual to trim there."
        )
        return {
            "text": text, "tool": "simulate", "receipts": {"count": 0, "rows": [], "sql": ""},
            "action": {"type": "simulate", "category": "Restaurants", "cut_pct": 0.2},
            "provider": "template",
        }
    return {"text": "", "tool": "fallback", "receipts": {"count": 0, "rows": [], "sql": ""}, "action": None, "provider": "template"}


def _numbers_of(text: str) -> set[float]:
    """Numeric values found in text ('1 433'->1433, '24,7'->24.7, '0.00'->0)."""
    nums: set[float] = set()
    for m in re.findall(r"\d[\d\s,.]*", text):
        s = m.replace(" ", "").rstrip("., ")
        if not s:
            continue
        if "," in s and "." not in s and len(s.rsplit(",", 1)[1]) != 3:
            s = s.replace(",", ".")  # decimal comma ("24,7")
        else:
            s = s.replace(",", "")  # thousand separators ("6,523" / "1,433.50")
        try:
            nums.add(float(s))
        except ValueError:
            continue
    return nums


def _grounded(text: str, tool_out: str, args_out: str, question: str) -> bool:
    """LLM text after tool calls is usable: every number in the text is allowed
    (tool outputs ∪ tool-call args ∪ the question); and when tool outputs contain
    numbers, at least one of them must appear in the text (no free-floating answers)."""
    if not text:
        return False
    text_nums = _numbers_of(text)
    tool_nums = _numbers_of(tool_out)
    allowed = tool_nums | _numbers_of(args_out) | _numbers_of(question)
    if not text_nums <= allowed:
        return False
    return not tool_nums or bool(text_nums & tool_nums)


SYSTEM = (
    "You are Taimi, a kind money coach. Answer in 1-3 short sentences, never shaming. "
    "Always write amounts in euros (€). Call the tools for EVERY number — never compute "
    "or invent amounts yourself. For any what-if / cut / reduce / save question, call "
    "simulate. What-ifs are based on the customer's usual monthly spending (norm), not "
    "the last 30 days. Mention the key numbers from the tool output (amount and hours). "
    "No praise or judgement words (great job, bad, too much) — describe, don't grade. "
    "If a tool says there's nothing to trim, say so plainly. If asked to predict future "
    "fun/discretionary spending, say you don't predict it and give the usual amount instead. "
    "If the question is outside this customer's own transactions (markets, advice on "
    "products), say what you can help with instead — but for 'how do I compare to "
    "others / people my age' questions, call benchmark and report both medians "
    "without ranking or judgement. Never give investment product advice."
)

_PARAMS_SCHEMA = {
    "type": "object",
    "properties": {
        "category": {"type": "string"}, "mcc": {"type": "integer"},
        "period": {"type": "string", "enum": ["last_30d", "last_month"]},
        "month_offset": {"type": "integer"},
        "limit": {"type": "integer"}, "cut_pct": {"type": "number"}, "flower": {"type": "string"},
        "kind": {"type": "string", "enum": ["purchase", "any"]},
        "order": {"type": "string", "enum": ["date", "amount"]},
    },
}

_TOOL_DESCS = {
    "spend_summary": "Total spent on a category (or MCC) in a period. Categories: Entertainment, Groceries, Health, Home & Tech, Housing, Invest Deposit, Lifestyle, Restaurants, Taxi, Transportation, Travel, Utilities (or 'last_30d'|'last_month' period; month_offset picks an earlier full month: 0=last month, 1=the month before). Use for 'how much did I spend on X' in any period.",
    "list_transactions": "List individual transactions (receipts) for a category/period. kind='purchase' (default) lists purchases only — rent/utilities bills are NOT purchases; kind='any' includes them. order='amount' sorts biggest first. Use for details, examples, or 'biggest purchase'.",
    "safe_to_spend": "How much is safe to spend today/this week given upcoming bills. Use for 'what can I afford'.",
    "simulate": "What-if: cut one fun category by a %, effect over 6 months. Use for cut/reduce/save questions.",
    "spender_profile": "Deterministic spending-profile label plus its stats. Use for 'what kind of spender am I'.",
    "category_breakdown": "Totals per category and per basket (bills, essentials, irregular, fun) for a period (month_offset: 0=last month, 1=the month before), each fun category with its usual monthly amount. Use for 'where does my money go' and overview questions.",
    "compare_to_usual": "One category vs its usual: last-30d total, usual monthly norm (fun categories only), count, biggest transaction, weekend share. Use for 'why did I spend so much on X' or 'am I spending more on X'. For comparisons to other people your age, use benchmark instead.",
    "bills_overview": "Rent amount and due window, monthly utilities, bills still due this cycle, next rent window. Use for rent/bill questions.",
    "balance_overview": "Account balance, savings pond fill/target, salary, payday window, investment total. Use for savings/balance/investment questions.",
    "benchmark": "You vs people your age: your median €/month over the last 6 complete months vs the median of customers within ±5 years of your age. Optional category: a fun flower (Restaurants, Entertainment, Lifestyle, Travel, Taxi) or a basket (B1a bills, B1b everyday essentials, B2 irregular, B3 fun); omit for the full table. Use for 'how do I compare to others', 'people my age', 'is that normal' questions.",
}

_ROUNDS = 3


def _make_tools(con, customer_id: str, state: dict) -> dict:
    today = state["_today"]
    return {
        "spend_summary": lambda category=None, mcc=None, period="last_30d", month_offset=None: spend_summary(con, customer_id, today, category, mcc, period, month_offset),
        "list_transactions": lambda category=None, flower=None, mcc=None, period="last_30d", month_offset=None, limit=6, kind="purchase", order="date": list_transactions(con, customer_id, today, category, flower, mcc, period, month_offset, limit, kind, order),
        "safe_to_spend": lambda: safe_to_spend(state),
        "simulate": lambda category="Restaurants", cut_pct=0.2: simulate(state, category, cut_pct),
        "spender_profile": lambda: spender_profile(con, customer_id, today, state),
        "category_breakdown": lambda period="last_30d", month_offset=None: category_breakdown(con, customer_id, today, state, period, month_offset),
        "compare_to_usual": lambda category="Restaurants": compare_to_usual(con, customer_id, today, state, category),
        "bills_overview": lambda: bills_overview(state),
        "balance_overview": lambda: balance_overview(state),
        "benchmark": lambda category=None: benchmark(con, customer_id, today, category),
    }


def _exec_tool(tools: dict, state: dict, name: str, raw_args: dict) -> tuple[dict, dict | None]:
    """Run one tool call; returns (output, simulate-action-or-None)."""
    args = dict(raw_args or {})
    act = None
    if name == "simulate":
        cat = str(args.get("category") or "Restaurants")
        canon = next(
            (f["flower"] for f in state["flowers"] if f["flower"].lower() == cat.lower()),
            None,
        )
        if canon is None:
            cl = cat.lower()
            canon = next((v for k, v in _CAT_ALIAS.items() if k in cl), cat)
        try:
            cut = float(args.get("cut_pct", 0.2))
        except (TypeError, ValueError):
            cut = 0.2
        if cut > 1:
            cut /= 100
        args["category"], args["cut_pct"] = canon, max(0.0, min(0.5, cut))
        act = {"type": "simulate", "category": args["category"], "cut_pct": args["cut_pct"]}
    fn = tools.get(name)
    try:
        out = fn(**args) if fn else {"error": f"no tool {name}"}
    except Exception as te:
        out = {"error": f"bad args: {te}"}
    return out, act


def _receipts_of(receipts: dict, out) -> dict:
    if isinstance(out, dict) and out.get("rows"):
        return {"count": out.get("count", len(out["rows"])), "rows": out["rows"], "sql": out.get("sql", "")}
    return receipts


_FINAL_NUDGE = "Answer now in 1-3 sentences using only the tool results above."


def _llm_result(text: str, used: dict, args_used: list, question: str, receipts: dict, action, provider: str) -> dict:
    text = text.replace("**", "").strip()  # RN renders markdown literally
    tool_out = " ".join(str(v) for v in used.values())
    args_out = " ".join(str(a) for a in args_used)
    if not used:
        # scope/clarifying replies are fine — but they must carry no numbers
        if _numbers_of(text):
            raise RuntimeError(f"no-tool llm answer contains numbers: {text[:160]!r}")
        return {"text": text, "tool": "llm", "used_llm": True, "receipts": receipts, "action": action, "provider": provider}
    if _grounded(text, tool_out, args_out, question):
        return {"text": text, "tool": "+".join(used), "used_llm": True, "receipts": receipts, "action": action, "provider": provider}
    raise RuntimeError(f"unverifiable or ungrounded llm answer: {text[:160]!r}")


def _history_anthropic(history: list | None) -> list:
    return [
        {"role": "user" if h.get("role") == "me" else "assistant", "content": str(h.get("text", ""))}
        for h in (history or [])[-6:]
    ]


def _anthropic_client(key: str):
    import anthropic
    return anthropic.Anthropic(api_key=key, timeout=15, max_retries=0)


def _anthropic_answer(con, customer_id: str, state: dict, question: str, history: list | None = None) -> dict | None:
    """Claude (Haiku) tool-use path — primary provider."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    import json
    model = os.environ.get("ANTHROPIC_MODEL") or "claude-haiku-5-5"
    try:
        client = _anthropic_client(key)
    except Exception as e:
        print(f"[chat] anthropic init failed: {type(e).__name__}")
        return None
    tools = _make_tools(con, customer_id, state)
    defs = [
        {
            "name": n,
            "description": _TOOL_DESCS[n],
            "input_schema": {"type": "object", "properties": {}} if n in ("safe_to_spend", "spender_profile", "bills_overview", "balance_overview") else _PARAMS_SCHEMA,
        }
        for n in tools
    ]
    try:
        messages = _history_anthropic(history) + [{"role": "user", "content": question}]
        used: dict = {}
        args_used: list = []
        receipts = {"count": 0, "rows": [], "sql": ""}
        action = None
        for r in range(_ROUNDS):
            kwargs: dict = {
                "model": model, "max_tokens": 400, "system": SYSTEM,
                "tools": defs, "messages": messages,
            }
            if r == _ROUNDS - 1:
                kwargs["tool_choice"] = {"type": "none"}
                # final round: nudge the model into answering (Haiku can return empty text otherwise)
                last = messages[-1]
                if last["role"] == "user":
                    c = last["content"]
                    last["content"] = (c if isinstance(c, list) else [{"type": "text", "text": c}]) + [{"type": "text", "text": _FINAL_NUDGE}]
                else:
                    messages.append({"role": "user", "content": _FINAL_NUDGE})
                kwargs["messages"] = messages
            print(f"[chat] anthropic call model={model}")
            resp = client.messages.create(**kwargs)
            messages.append({"role": "assistant", "content": resp.content})
            calls = [b for b in resp.content if getattr(b, "type", None) == "tool_use"]
            if not calls:
                text = " ".join(getattr(b, "text", "") for b in resp.content if getattr(b, "type", None) == "text").strip()
                return _llm_result(text, used, args_used, question, receipts, action, "anthropic")
            results = []
            for c in calls:
                args = dict(getattr(c, "input", None) or {})
                args_used.append(args)
                out, act = _exec_tool(tools, state, c.name, args)
                used[c.name] = out
                if act:
                    action = act
                receipts = _receipts_of(receipts, out)
                results.append({"type": "tool_result", "tool_use_id": c.id, "content": json.dumps(out)})
            messages.append({"role": "user", "content": results})
        return None  # loop exhausted -> next provider / template
    except Exception as e:
        print(f"[chat] anthropic {model} failed: {type(e).__name__} {str(e)[:160]}")
        return None


def _gemini_answer(con, customer_id: str, state: dict, question: str, history: list | None = None) -> dict | None:
    """Gemini function-calling path — fallback provider."""
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return None
    models = [os.environ["GEMINI_MODEL"]] if os.environ.get("GEMINI_MODEL") else DEFAULT_MODELS
    try:
        client = genai.Client(
            api_key=key,
            http_options=types.HttpOptions(
                timeout=15000,
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )
        tools = _make_tools(con, customer_id, state)
        decls = [
            types.FunctionDeclaration(
                name=n,
                description=_TOOL_DESCS[n],
                parameters={"type": "object", "properties": {}} if n in ("safe_to_spend", "spender_profile", "bills_overview", "balance_overview") else _PARAMS_SCHEMA,
            )
            for n in tools
        ]
        cfg = types.GenerateContentConfig(
            tools=[types.Tool(function_declarations=decls)],
            system_instruction=SYSTEM,
        )
        cfg_final = types.GenerateContentConfig(
            tools=[types.Tool(function_declarations=decls)],
            system_instruction=SYSTEM,
            tool_config=types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(
                    mode=types.FunctionCallingConfigMode.NONE
                )
            ),
        )
        prior = [
            types.Content(
                role="user" if h.get("role") == "me" else "model",
                parts=[types.Part(text=str(h.get("text", "")))],
            )
            for h in (history or [])[-6:]
        ]
        for model in models:
            try:
                history = prior + [types.Content(role="user", parts=[types.Part(text=question)])]
                used: dict = {}
                args_used: list = []
                receipts = {"count": 0, "rows": [], "sql": ""}
                action = None
                for r in range(_ROUNDS):
                    if r == _ROUNDS - 1:
                        history.append(types.Content(role="user", parts=[types.Part(text=_FINAL_NUDGE)]))
                    print(f"[chat] gemini call model={model}")
                    resp = client.models.generate_content(
                        model=model, contents=history,
                        config=cfg if r < _ROUNDS - 1 else cfg_final,
                    )
                    cand = resp.candidates[0].content
                    history.append(cand)
                    calls = [p.function_call for p in (cand.parts or []) if p.function_call]
                    if not calls:
                        text = cand.parts[0].text if cand.parts and cand.parts[0].text else ""
                        return _llm_result(text, used, args_used, question, receipts, action, "gemini")
                    for fc in calls:
                        args = dict(fc.args or {})
                        args_used.append(args)
                        out, act = _exec_tool(tools, state, fc.name, args)
                        used[fc.name] = out
                        if act:
                            action = act
                        receipts = _receipts_of(receipts, out)
                        history.append(types.Content(role="user", parts=[types.Part(
                            function_response=types.FunctionResponse(name=fc.name, response={"result": out}))]))
                return None  # loop exhausted -> template fallback
            except Exception as e:
                print(f"[chat] gemini {model} failed: {type(e).__name__} {str(e)[:160]}")
                continue  # next model
        return None
    except Exception:
        return None


def _llm_answer(con, customer_id: str, state: dict, question: str, history: list | None = None) -> dict | None:
    """LLM path: Anthropic (primary) -> Gemini lite chain -> None (template)."""
    return (
        _anthropic_answer(con, customer_id, state, question, history)
        or _gemini_answer(con, customer_id, state, question, history)
    )


def chat(con, customer_id: str, today: date, message: str, save_first_pct: float = 0.0, history: list | None = None) -> dict:
    ck = (customer_id, today.isoformat(), save_first_pct, " ".join(str(message).lower().split()))
    if not history and ck in _CACHE:
        return _CACHE[ck]
    state = garden_state(con, customer_id, today, save_first_pct)
    state["_today"] = today
    key = _route(message)
    if key == "predict" and not history:
        # Taimi never forecasts fun spending — deterministic decline + usual amount
        out = _templated(key, con, customer_id, state, message)
        out["used_llm"] = False
    else:
        out = _llm_answer(con, customer_id, state, message, history)
    if not out:
        if key:
            out = _templated(key, con, customer_id, state, message)
            out["used_llm"] = False
        else:
            out = {
                "text": "I can answer: what you spent on taxis last month, what kind of spender you are, "
                        "what's safe to spend this week, and what cutting dining out by 20% would free.",
                "tool": "fallback",
                "used_llm": False,
                "receipts": {"count": 0, "rows": [], "sql": ""},
                "action": None,
                "provider": "template",
            }
    if not history:
        _CACHE[ck] = out
    return out
