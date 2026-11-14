"""garden_state — the full money-garden state for one customer on one day.

Generalises experiments/proto_data.py (which hardcoded 15 Sep 2026 and the
10% "save first" slice). Only transactions with tx_date < today are used,
with the outlier filter (spending >= 5000 EUR unless housing_payment).
"""

from __future__ import annotations

import calendar
from datetime import date

STAGES = ["Seed", "Sprout", "Sapling", "Young tree"]
FLOWER_ORDER = ["Restaurants", "Entertainment", "Lifestyle", "Travel", "Taxi"]
MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _shift_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    return date(d.year + m // 12, m % 12 + 1, 1)


def flower_state(last30: float, norm: float) -> str:
    if norm == 0 and last30 == 0:
        return "dormant"
    if (norm > 0 and last30 > 1.25 * norm) or (norm == 0 and last30 > 20):
        return "wilting"
    if last30 <= norm:
        return "blooming"
    return "ok"


def garden_state(con, customer_id: str, today: date, save_first_pct: float = 0.0) -> dict:
    T = f"DATE '{today.isoformat()}'"
    mo_start = today.replace(day=1)                      # first day of today's month
    mo6 = _shift_months(mo_start, -6)                    # start of the 6 complete months before
    mo12 = _shift_months(mo_start, -12)                  # start of the 12 complete months before
    days_in_month = calendar.monthrange(today.year, today.month)[1]

    # filtered working view: this customer, strictly before today, no outliers
    con.execute(
        f"""CREATE OR REPLACE TEMP VIEW t AS SELECT * FROM tx
            WHERE customer_id = '{customer_id}' AND tx_date < {T}
              AND NOT (tx_amount_eur < 0 AND -tx_amount_eur >= 5000 AND transaction_type <> 'housing_payment')"""
    )
    one = lambda sql: con.execute(sql).fetchone()
    rows = lambda sql: [dict(zip([d[0] for d in con.description], r)) for r in con.execute(sql).fetchall()]

    age, zip_ = one(
        f"SELECT customer_age, customer_postal_code FROM customers WHERE customer_id = '{customer_id}'"
    )
    bal = one("SELECT arg_max(balance_after_eur, ts) FROM t")[0] or 0

    sal_med, sal_d0, sal_d1 = one(
        f"""SELECT median(tx_amount_eur), quantile_disc(day(tx_date), 0.1), quantile_disc(day(tx_date), 0.9)
            FROM t WHERE transaction_type = 'salary' AND tx_date >= {T} - INTERVAL 12 MONTH"""
    )
    sal_med = sal_med or 0
    sal_this = one(
        f"""SELECT count(*) FROM t WHERE transaction_type = 'salary'
            AND tx_date >= DATE '{mo_start.isoformat()}'"""
    )[0]
    rent, rent_d0, rent_d1 = one(
        f"""SELECT median(-tx_amount_eur), quantile_disc(day(tx_date), 0.1), quantile_disc(day(tx_date), 0.9)
            FROM t WHERE transaction_type = 'housing_payment' AND tx_date >= {T} - INTERVAL 12 MONTH"""
    )
    rent_paid = (
        one(
            f"""SELECT count(*) FROM t WHERE transaction_type = 'housing_payment'
                AND tx_date >= DATE '{mo_start.isoformat()}'"""
        )[0]
        > 0
    )
    util_m = (
        one(
            f"""SELECT coalesce(sum(-tx_amount_eur), 0) / 6 FROM t WHERE basket = 'B1a'
                AND transaction_type <> 'housing_payment'
                AND tx_date >= DATE '{mo6.isoformat()}' AND tx_date < DATE '{mo_start.isoformat()}'"""
        )[0]
        or 0
    )
    util_paid = one(
        f"""SELECT coalesce(sum(-tx_amount_eur), 0) FROM t WHERE basket = 'B1a'
            AND transaction_type <> 'housing_payment' AND tx_date >= DATE '{mo_start.isoformat()}'"""
    )[0]
    ess_p75 = (
        one(
            f"""WITH m AS (SELECT date_trunc('month', tx_date) mo, sum(-tx_amount_eur) v FROM t
                    WHERE basket = 'B1b' AND tx_date >= DATE '{mo6.isoformat()}'
                      AND tx_date < DATE '{mo_start.isoformat()}' GROUP BY 1)
                SELECT quantile_cont(v, 0.75) FROM m"""
        )[0]
        or 0
    )
    pond_target = (
        one(
            f"""WITH g AS (SELECT range mo FROM range(DATE '{mo12.isoformat()}', DATE '{mo_start.isoformat()}', INTERVAL 1 MONTH)),
                m AS (SELECT date_trunc('month', tx_date) mo, sum(-tx_amount_eur) v FROM t
                      WHERE basket = 'B2' GROUP BY 1)
                SELECT quantile_cont(coalesce(v, 0), 0.9) FROM g LEFT JOIN m USING (mo)"""
        )[0]
        or 0
    )

    # conservative: to the LATEST day of the payday window
    days_to_pay = max(
        (sal_d1 - today.day) if not sal_this else (days_in_month - today.day + sal_d1), 1
    )
    bills_due = (0 if rent_paid else (rent or 0)) + max(util_m - util_paid, 0)
    ess_due = ess_p75 / 30 * days_to_pay
    inv_m = (
        one(
            f"""SELECT coalesce(sum(-tx_amount_eur), 0) / 6 FROM t
                WHERE transaction_type = 'investment_deposit' AND tx_date >= {T} - INTERVAL 6 MONTH"""
        )[0]
        or 0
    )
    month_free = sal_med - (rent or 0) - util_m - ess_p75 - inv_m - save_first_pct * sal_med
    spent_cycle = one(
        f"""SELECT coalesce(sum(-tx_amount_eur), 0) FROM t WHERE basket IN ('B2', 'B3')
            AND tx_date > (SELECT max(tx_date) FROM t WHERE transaction_type = 'salary')"""
    )[0]
    spent_week = one(
        f"""SELECT coalesce(sum(-tx_amount_eur), 0) FROM t WHERE basket = 'B3'
            AND tx_date >= {T} - INTERVAL 7 DAY"""
    )[0]
    left_cycle = month_free - spent_cycle
    storm = bal - bills_due - ess_due < 0
    safe_day = 0 if storm else max(min(left_cycle, bal - bills_due - ess_due), 0) / days_to_pay
    pond_fill = max(min(bal - bills_due - ess_due - max(left_cycle, 0), pond_target), 0)
    hourly = sal_med / 160 if sal_med else 0

    # ---- flowers: always 5, fixed order -------------------------------------
    flowers = rows(
        f"""WITH cur AS (SELECT flower, sum(-tx_amount_eur) v, count(*) n FROM t
                    WHERE basket = 'B3' AND tx_date >= {T} - INTERVAL 30 DAY GROUP BY 1),
            g AS (SELECT range mo FROM range(DATE '{mo6.isoformat()}', DATE '{mo_start.isoformat()}', INTERVAL 1 MONTH)),
            f AS (SELECT unnest(['Restaurants','Entertainment','Lifestyle','Travel','Taxi']::VARCHAR[]) flower),
            m AS (SELECT flower, date_trunc('month', tx_date) mo, sum(-tx_amount_eur) v FROM t
                  WHERE basket = 'B3' GROUP BY ALL),
            norm AS (SELECT f.flower, median(coalesce(m.v, 0)) norm FROM f CROSS JOIN g
                     LEFT JOIN m ON m.flower = f.flower AND m.mo = g.mo GROUP BY 1)
        SELECT norm.flower, round(coalesce(cur.v, 0)) last30, coalesce(cur.n, 0) n, round(coalesce(norm, 0)) norm
        FROM norm LEFT JOIN cur ON cur.flower = norm.flower
        ORDER BY case norm.flower when 'Restaurants' then 0 when 'Entertainment' then 1
                 when 'Lifestyle' then 2 when 'Travel' then 3 else 4 end"""
    )
    for fl in flowers:
        fl["state"] = flower_state(fl["last30"], fl["norm"])
        fl["hours"] = round(fl["last30"] / hourly, 1) if hourly else 0.0

    top = max(flowers, key=lambda f: f["last30"] - f["norm"])
    flt = (
        "mcc_code = 4121"
        if top["flower"] == "Taxi"
        else f"category = '{top['flower']}' AND coalesce(mcc_code, 0) <> 4121"
    )
    top_tx = rows(
        f"""SELECT strftime(tx_date, '%a %d %b') d, mcc_code mcc, round(-tx_amount_eur, 2) eur FROM t
            WHERE {flt} AND tx_date >= {T} - INTERVAL 30 DAY ORDER BY tx_date DESC LIMIT 6"""
    )
    rest_tx = rows(
        f"""SELECT strftime(tx_date, '%a %d %b') d, mcc_code mcc, round(-tx_amount_eur, 2) eur FROM t
            WHERE category = 'Restaurants' AND tx_date >= {T} - INTERVAL 30 DAY
            ORDER BY tx_date DESC LIMIT 6"""
    )
    weekend = (
        one(
            f"""SELECT avg((dayofweek(tx_date) IN (0, 5, 6))::INT) FROM t
                WHERE category = 'Restaurants' AND tx_date >= {T} - INTERVAL 6 MONTH"""
        )[0]
        or 0
    )
    inv_total, inv_months, inv_last = one(
        f"""SELECT coalesce(sum(-tx_amount_eur), 0), count(DISTINCT date_trunc('month', tx_date)),
            coalesce(arg_max(-tx_amount_eur, ts), 0) FROM t WHERE transaction_type = 'investment_deposit'"""
    )
    b3_norm_m = sum(f["norm"] for f in flowers)
    rest_norm = next((f["norm"] for f in flowers if f["flower"] == "Restaurants"), 0)
    baskets_last30 = {
        b: 0 for b in ("B1a", "B1b", "B2", "B3")
    } | {
        r["basket"]: round(r["v"]) if r["v"] else 0
        for r in rows(
            f"""SELECT basket, sum(-tx_amount_eur) v FROM t WHERE basket IS NOT NULL
                AND tx_date >= {T} - INTERVAL 30 DAY GROUP BY 1"""
        )
    }

    stage = (
        1
        + (1 if pond_target > 0 and pond_fill >= pond_target else 0)
        + (1 if inv_total > 0 else 0)
        + (1 if left_cycle > 0 else 0)
    )
    mood = "storm" if storm else "cloud" if left_cycle <= 0 else "sun"
    weather = "storm" if storm else "cloud" if left_cycle <= 0 else "partly" if safe_day < 10 else "sun"

    nxt_mo = mo_start if not rent_paid else _shift_months(mo_start, 1)
    next_rent_window = {
        "month": MONTHS_EN[nxt_mo.month - 1],
        "d0": int(rent_d0 or 0),
        "d1": int(rent_d1 or 0),
    }

    return dict(
        id=customer_id,
        age=age,
        zip=zip_,
        today=today.isoformat(),
        balance=round(bal),
        salary=round(sal_med),
        hourly=round(hourly, 2),
        payday_window=[int(sal_d0 or 0), int(sal_d1 or 0)],
        salary_received_this_month=bool(sal_this),
        days_to_payday=int(days_to_pay),
        rent=round(rent or 0),
        rent_window=[int(rent_d0 or 0), int(rent_d1 or 0)],
        rent_paid=rent_paid,
        next_rent_window=next_rent_window,
        bills_due=round(bills_due),
        essentials_due=round(ess_due),
        pond_target=round(pond_target),
        pond_fill=round(pond_fill),
        safe_today=round(safe_day),
        safe_week=round(safe_day * 7),
        month_free=round(month_free),
        spent_cycle=round(spent_cycle),
        left_cycle=round(left_cycle),
        spent_week_leaks=round(spent_week),
        storm=storm,
        mood=mood,
        weather=weather,
        stage=stage,
        stage_name=STAGES[stage - 1],
        save_first_pct=save_first_pct,
        invest_month=round(inv_m),
        essentials_p75_month=round(ess_p75),
        utilities_month=round(util_m),
        flowers=flowers,
        restaurants_tx=rest_tx,
        top_flower=top["flower"],
        top_flower_tx=top_tx,
        restaurants_weekend_share=round(weekend, 2),
        invest_total=round(inv_total),
        invest_months=inv_months,
        invest_last=round(inv_last),
        leaks_norm_month=round(b3_norm_m),
        baskets_last30=baskets_last30,
        sim_minus20_restaurants_6m=round(rest_norm * 0.2 * 6),
        sim_minus20_hours=round(rest_norm * 0.2 * 6 / hourly, 1) if hourly else 0.0,
    )
