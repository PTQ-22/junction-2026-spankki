import json
import duckdb

TODAY = "2026-09-15"
PERSONAS = ["CUST04957", "CUST00359", "CUST00095", "CUST03539"]
ids = ",".join(f"'{p}'" for p in PERSONAS)

con = duckdb.connect()
con.execute(f"""
CREATE TABLE t AS SELECT *, strptime(tx_timestamp, '%d%b%y:%H:%M:%S') ts,
  CASE
    WHEN transaction_type IN ('housing_payment', 'utilities_payment') OR mcc_code = 4111 THEN 'B1a'
    WHEN category IN ('Restaurants', 'Entertainment', 'Lifestyle', 'Travel') OR mcc_code = 4121 THEN 'B3'
    WHEN category IN ('Health', 'Home & Tech') OR (category = 'Transportation' AND -tx_amount_eur > 300) THEN 'B2'
    WHEN category IN ('Groceries', 'Transportation') THEN 'B1b'
  END basket,
  CASE WHEN mcc_code = 4121 THEN 'Taxi' ELSE category END flower
FROM read_csv_auto('data/spankki/tx_junction_transactions.csv', header=true)
WHERE customer_id IN ({ids}) AND tx_date < DATE '{TODAY}'
  AND NOT (tx_amount_eur < 0 AND -tx_amount_eur >= 5000 AND transaction_type <> 'housing_payment')
""")
con.execute("CREATE TABLE c AS SELECT * FROM read_csv_auto('data/spankki/tx_customers_junction.csv', header=true)")
one = lambda sql: con.execute(sql).fetchone()
rows = lambda sql: [dict(zip([d[0] for d in con.description], r)) for r in con.execute(sql).fetchall()]

out = {}
for cid in PERSONAS:
    w = f"customer_id = '{cid}'"
    age, zip_ = one(f"SELECT customer_age, customer_postal_code FROM c WHERE {w}")
    bal = one(f"SELECT arg_max(balance_after_eur, ts) FROM t WHERE {w}")[0]
    sal_med, sal_d0, sal_d1 = one(f"""SELECT median(tx_amount_eur), quantile_disc(day(tx_date), 0.1), quantile_disc(day(tx_date), 0.9)
        FROM t WHERE {w} AND transaction_type = 'salary' AND tx_date >= DATE '{TODAY}' - INTERVAL 12 MONTH""")
    sal_this = one(f"SELECT count(*) FROM t WHERE {w} AND transaction_type = 'salary' AND tx_date >= DATE '2026-09-01'")[0]
    rent, rent_d0, rent_d1 = one(f"""SELECT median(-tx_amount_eur), quantile_disc(day(tx_date), 0.1), quantile_disc(day(tx_date), 0.9)
        FROM t WHERE {w} AND transaction_type = 'housing_payment' AND tx_date >= DATE '{TODAY}' - INTERVAL 12 MONTH""")
    rent_paid = one(f"SELECT count(*) FROM t WHERE {w} AND transaction_type = 'housing_payment' AND tx_date >= DATE '2026-09-01'")[0] > 0
    util_m = one(f"""SELECT coalesce(sum(-tx_amount_eur), 0) / 6 FROM t WHERE {w} AND basket = 'B1a' AND transaction_type <> 'housing_payment'
        AND tx_date >= DATE '{TODAY}' - INTERVAL 6 MONTH""")[0]
    util_paid = one(f"""SELECT coalesce(sum(-tx_amount_eur), 0) FROM t WHERE {w} AND basket = 'B1a' AND transaction_type <> 'housing_payment'
        AND tx_date >= DATE '2026-09-01'""")[0]
    ess_p75 = one(f"""WITH m AS (SELECT date_trunc('month', tx_date) mo, sum(-tx_amount_eur) v FROM t WHERE {w} AND basket = 'B1b'
        AND tx_date >= DATE '2026-03-01' AND tx_date < DATE '2026-09-01' GROUP BY 1) SELECT quantile_cont(v, 0.75) FROM m""")[0]
    pond = one(f"""WITH g AS (SELECT range mo FROM range(DATE '2025-09-01', DATE '2026-09-01', INTERVAL 1 MONTH)),
        m AS (SELECT date_trunc('month', tx_date) mo, sum(-tx_amount_eur) v FROM t WHERE {w} AND basket = 'B2' GROUP BY 1)
        SELECT quantile_cont(coalesce(v, 0), 0.9) FROM g LEFT JOIN m USING (mo)""")[0]

    # konserwatywnie: do NAJPÓŹNIEJSZEGO dnia okna wypłaty
    days_to_pay = max((sal_d1 - 15) if not sal_this else (30 - 15 + sal_d1), 1)
    bills_due = (0 if rent_paid else (rent or 0)) + max(util_m - util_paid, 0)
    ess_due = ess_p75 / 30 * days_to_pay
    inv_m = one(f"""SELECT coalesce(sum(-tx_amount_eur), 0) / 6 FROM t WHERE {w} AND transaction_type = 'investment_deposit'
        AND tx_date >= DATE '{TODAY}' - INTERVAL 6 MONTH""")[0]
    # budżet miesiąca (nie całe saldo): pensja − rachunki − P75 niezbędnych − inwestycje − 10% „odłóż najpierw”
    month_free = sal_med - (rent or 0) - util_m - ess_p75 - inv_m - 0.1 * sal_med
    spent_cycle = one(f"""SELECT coalesce(sum(-tx_amount_eur), 0) FROM t WHERE {w} AND basket IN ('B2', 'B3')
        AND tx_date > (SELECT max(tx_date) FROM t WHERE {w} AND transaction_type = 'salary')""")[0]
    spent_week = one(f"""SELECT coalesce(sum(-tx_amount_eur), 0) FROM t WHERE {w} AND basket = 'B3'
        AND tx_date >= DATE '{TODAY}' - INTERVAL 7 DAY""")[0]
    left_cycle = month_free - spent_cycle
    storm = bal - bills_due - ess_due < 0
    safe_day = 0 if storm else max(min(left_cycle, bal - bills_due - ess_due), 0) / days_to_pay
    pond_fill = max(min(bal - bills_due - ess_due - max(left_cycle, 0), pond), 0)
    hourly = sal_med / 160

    flowers = rows(f"""
      WITH cur AS (SELECT flower, sum(-tx_amount_eur) v, count(*) n FROM t WHERE {w} AND basket = 'B3'
                   AND tx_date >= DATE '{TODAY}' - INTERVAL 30 DAY GROUP BY 1),
           g AS (SELECT range mo FROM range(DATE '2026-02-01', DATE '2026-08-01', INTERVAL 1 MONTH)),
           f AS (SELECT DISTINCT flower FROM t WHERE {w} AND basket = 'B3'),
           m AS (SELECT flower, date_trunc('month', tx_date) mo, sum(-tx_amount_eur) v FROM t WHERE {w} AND basket = 'B3' GROUP BY ALL),
           norm AS (SELECT f.flower, median(coalesce(m.v, 0)) norm FROM f CROSS JOIN g LEFT JOIN m ON m.flower = f.flower AND m.mo = g.mo GROUP BY 1)
      SELECT flower, round(coalesce(cur.v, 0)) last30, coalesce(cur.n, 0) n, round(norm) norm FROM norm LEFT JOIN cur USING (flower)
      ORDER BY norm DESC""")
    for f in flowers:
        r = f["last30"] / f["norm"] if f["norm"] else (2 if f["last30"] > 20 else 1)
        f["state"] = "wilting" if r > 1.25 else ("blooming" if r <= 1.0 else "ok")
        f["hours"] = round(f["last30"] / hourly, 1)
    top = max(flowers, key=lambda f: f["last30"] - f["norm"])
    flt = "mcc_code = 4121" if top["flower"] == "Taxi" else f"category = '{top['flower']}' AND coalesce(mcc_code, 0) <> 4121"
    top_tx = rows(f"""SELECT strftime(tx_date, '%a %d %b') d, mcc_code mcc, round(-tx_amount_eur, 2) eur FROM t
        WHERE {w} AND {flt} AND tx_date >= DATE '{TODAY}' - INTERVAL 30 DAY ORDER BY tx_date DESC LIMIT 6""")
    rest = next((f for f in flowers if f["flower"] == "Restaurants"), None)
    rest_tx = rows(f"""SELECT strftime(tx_date, '%a %d %b') d, mcc_code mcc, round(-tx_amount_eur, 2) eur FROM t
        WHERE {w} AND category = 'Restaurants' AND tx_date >= DATE '{TODAY}' - INTERVAL 30 DAY ORDER BY tx_date DESC LIMIT 6""")
    weekend = one(f"""SELECT avg((dayofweek(tx_date) IN (0, 5, 6))::INT) FROM t WHERE {w} AND category = 'Restaurants'
        AND tx_date >= DATE '{TODAY}' - INTERVAL 6 MONTH""")[0]
    inv_total, inv_months, inv_last = one(f"""SELECT coalesce(sum(-tx_amount_eur), 0), count(DISTINCT date_trunc('month', tx_date)),
        coalesce(arg_max(-tx_amount_eur, ts), 0) FROM t WHERE {w} AND transaction_type = 'investment_deposit'""")
    b3_norm_m = sum(f["norm"] for f in flowers)
    rest_norm = rest["norm"] if rest else 0
    out[cid] = dict(
        id=cid, age=age, zip=zip_, today=TODAY, balance=round(bal), salary=round(sal_med), hourly=round(hourly, 2),
        payday_window=[int(sal_d0), int(sal_d1)], salary_received_this_month=bool(sal_this), days_to_payday=int(days_to_pay),
        rent=round(rent or 0), rent_window=[int(rent_d0 or 0), int(rent_d1 or 0)], rent_paid=rent_paid,
        bills_due=round(bills_due), essentials_due=round(ess_due), pond_target=round(pond), pond_fill=round(pond_fill),
        safe_today=round(safe_day), safe_week=round(safe_day * 7), month_free=round(month_free), spent_cycle=round(spent_cycle),
        left_cycle=round(left_cycle), spent_week_leaks=round(spent_week), storm=storm, invest_month=round(inv_m),
        essentials_p75_month=round(ess_p75), utilities_month=round(util_m), flowers=flowers, restaurants_tx=rest_tx, top_flower=top["flower"], top_flower_tx=top_tx, restaurants_weekend_share=round(weekend or 0, 2),
        invest_total=round(inv_total), invest_months=inv_months, invest_last=round(inv_last), leaks_norm_month=round(b3_norm_m),
        sim_minus20_restaurants_6m=round(rest_norm * 0.2 * 6), sim_minus20_hours=round(rest_norm * 0.2 * 6 / hourly, 1),
    )

print(json.dumps(out, indent=1, default=str))
