import duckdb

con = duckdb.connect()
con.execute("CREATE TABLE t AS SELECT * FROM read_csv_auto('data/spankki/tx_junction_transactions.csv', header=true)")
con.execute("ALTER TABLE t ADD COLUMN ts TIMESTAMP")
con.execute("UPDATE t SET ts = strptime(tx_timestamp, '%d%b%y:%H:%M:%S')")
con.execute("CREATE TABLE c AS SELECT * FROM read_csv_auto('data/spankki/tx_customers_junction.csv', header=true)")
q = lambda title, sql: (print(f"\n### {title}"), con.sql(sql).show(max_rows=40, max_width=220))

# B1a rachunki: stałe co do kwoty (czynsz, media, bilet komunikacji)
# B1b codzienne niezbędne: regularne, ale zmienne (spożywcze, paliwo, parking, inny transport <= 300 €)
# B2 nieregularne obowiązkowe: zdrowie, dom/sprzęt, transport > 300 € (np. naprawa auta)
# B3 wycieki: restauracje, rozrywka, lifestyle, podróże, taxi
con.execute("""
CREATE TABLE b AS
SELECT customer_id, tx_date, date_trunc('month', tx_date) mo, -tx_amount_eur amt, category, mcc_code,
  CASE
    WHEN transaction_type IN ('housing_payment', 'utilities_payment') OR mcc_code = 4111 THEN 'B1a_bills'
    WHEN category IN ('Restaurants', 'Entertainment', 'Lifestyle', 'Travel') OR mcc_code = 4121 THEN 'B3_leaks'
    WHEN category IN ('Health', 'Home & Tech') OR (category = 'Transportation' AND -tx_amount_eur > 300) THEN 'B2_irregular'
    WHEN category IN ('Groceries', 'Transportation') THEN 'B1b_essentials'
    ELSE 'other'
  END basket
FROM t WHERE tx_amount_eur < 0 AND transaction_type NOT IN ('salary_sweep', 'investment_deposit') AND -tx_amount_eur < 5000
""")

q("Udział koszyków w wydatkach (mediana klienta) + co zostało w 'other'", """
WITH s AS (SELECT customer_id, basket, sum(amt) v FROM b GROUP BY ALL),
     p AS (SELECT customer_id, basket, v / sum(v) OVER (PARTITION BY customer_id) share FROM s)
SELECT basket, round(median(share), 3) median_share, count(*) customers FROM p GROUP BY 1 ORDER BY 1""")

con.execute("""
CREATE TABLE y AS
SELECT customer_id, basket,
  sum(amt) FILTER (WHERE tx_date < '2025-10-01') y1,
  sum(amt) FILTER (WHERE tx_date >= '2025-10-01') y2
FROM b WHERE basket <> 'other' GROUP BY ALL
""")

q("Backtest roczny: rok 1 → rok 2 (|błąd| sumy rocznej)", """
SELECT basket, round(median(abs(y2 - y1) / y2), 3) mape_year,
  round(avg((abs(y2 - y1) / y2 <= 0.15)::INT), 3) within_15, round(avg((abs(y2 - y1) / y2 <= 0.25)::INT), 3) within_25
FROM y WHERE y1 > 0 AND y2 > 0 GROUP BY 1 ORDER BY 1""")

con.execute("""
CREATE TABLE mo AS
WITH grid AS (SELECT DISTINCT customer_id, basket, m.mo FROM (SELECT DISTINCT customer_id, basket FROM b WHERE basket <> 'other')
              CROSS JOIN (SELECT DISTINCT mo FROM b) m),
     s AS (SELECT customer_id, basket, mo, sum(amt) v FROM b GROUP BY ALL)
SELECT g.*, coalesce(s.v, 0) v,
  avg(coalesce(s.v, 0)) OVER (PARTITION BY g.customer_id, g.basket ORDER BY g.mo ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) p3
FROM grid g LEFT JOIN s USING (customer_id, basket, mo)
""")

q("Backtest miesięczny: prognoza = średnia z 3 poprzednich mies. (to widzi pogoda)", """
SELECT basket, round(median(abs(v - p3) / v), 3) mape_month, round(avg((abs(v - p3) / v <= 0.15)::INT), 3) within_15,
  round(median(abs(v - p3))) median_abs_err_eur
FROM mo WHERE mo >= '2025-01-01' AND v > 0 GROUP BY 1 ORDER BY 1""")

q("Staw: bufor = P90 miesięcznych wydatków B2 z roku 1. W ilu miesiącach roku 2 wystarczył?", """
WITH p AS (SELECT customer_id, quantile_cont(v, 0.9) pond FROM mo WHERE basket = 'B2_irregular' AND mo < '2025-10-01' GROUP BY 1),
     s AS (SELECT customer_id, any_value(pond) pond, avg((v <= pond)::INT) covered
           FROM mo JOIN p USING (customer_id) WHERE basket = 'B2_irregular' AND mo >= '2025-10-01' GROUP BY 1)
SELECT round(median(pond)) median_pond_eur, round(avg(covered), 3) share_months_covered FROM s""")

q("Wolne pieniądze w miesiącu = przychody − B1a − B1b − B2 − inwestycje; błąd prognozy w € (3 mies.)", """
WITH inc AS (SELECT customer_id, date_trunc('month', tx_date) mo, sum(tx_amount_eur) FILTER (WHERE tx_amount_eur > 0) i,
                    coalesce(-sum(tx_amount_eur) FILTER (WHERE transaction_type IN ('investment_deposit', 'salary_sweep')), 0) out
             FROM t GROUP BY ALL),
     fx AS (SELECT customer_id, mo, sum(v) FILTER (WHERE basket <> 'B3_leaks') must, sum(p3) FILTER (WHERE basket <> 'B3_leaks') must_p
            FROM mo GROUP BY ALL),
     f AS (SELECT customer_id, mo, i - out - must free_real,
                  avg(i - out) OVER (PARTITION BY customer_id ORDER BY mo ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) - must_p free_pred
           FROM inc JOIN fx USING (customer_id, mo))
SELECT round(median(abs(free_real - free_pred))) median_abs_err_eur, round(median(free_real)) median_free_eur,
  round(avg((free_real < 0)::INT), 3) share_months_negative_free
FROM f WHERE mo >= '2025-01-01'""")

q("Daty: czynsz i pensja (odchylenie dnia miesiąca, per klient)", """
WITH h AS (SELECT customer_id, transaction_type tt, day(tx_date) d, abs(tx_amount_eur) a FROM t
           WHERE transaction_type IN ('housing_payment', 'salary')),
     s AS (SELECT tt, customer_id, stddev(d) sd, max(d) - min(d) span, stddev(a) / avg(a) cv FROM h GROUP BY ALL)
SELECT tt, count(*) customers, round(median(sd), 1) med_sd_day, round(median(span)) med_span_days, round(median(cv), 3) med_cv_amount
FROM s GROUP BY 1""")

q("Kierunek: czy trend z roku 1 (H2 vs H1) przewiduje kierunek zmiany w roku 2? (B3)", """
WITH h AS (SELECT customer_id,
  sum(amt) FILTER (WHERE tx_date < '2025-04-01') h1, sum(amt) FILTER (WHERE tx_date >= '2025-04-01' AND tx_date < '2025-10-01') h2,
  sum(amt) FILTER (WHERE tx_date >= '2025-10-01') y2, sum(amt) FILTER (WHERE tx_date < '2025-10-01') y1
  FROM b WHERE basket = 'B3_leaks' GROUP BY 1)
SELECT count(*) n, round(avg(((h2 > h1) = (y2 > y1))::INT), 3) direction_hit_rate FROM h WHERE h1 > 0""")

q("Skok na granicy roku: udział klientów ze zmianą B3 > 50% rok do roku", """
SELECT round(avg((abs(y2 / y1 - 1) > 0.5)::INT), 3) share_big_change FROM y WHERE basket = 'B3_leaks' AND y1 > 0""")

con.execute("""
CREATE TABLE persona AS
WITH inc AS (SELECT customer_id, sum(tx_amount_eur) FILTER (WHERE tx_amount_eur > 0) / 24 inc_m,
               min(balance_after_eur) min_bal, arg_max(balance_after_eur, ts) end_bal,
               min(balance_after_eur) FILTER (WHERE tx_date >= '2026-07-01') min_bal_q3_26,
               count(*) FILTER (WHERE transaction_type = 'salary_sweep') sweeps,
               count(*) FILTER (WHERE transaction_type = 'investment_deposit') inv FROM t GROUP BY 1),
     yy AS (SELECT customer_id, max(y1) FILTER (WHERE basket = 'B3_leaks') l1, max(y2) FILTER (WHERE basket = 'B3_leaks') l2 FROM y GROUP BY 1),
     big AS (SELECT customer_id, max(amt) FILTER (WHERE basket = 'B2_irregular') max_irr FROM b GROUP BY 1)
SELECT c.customer_id, customer_age age, customer_postal_code zip, round(inc_m) inc_m, round(l1 / 12) leak_m_y1, round(l2 / 12) leak_m_y2,
  round(l2 / l1 - 1, 2) leak_change, round(max_irr) max_irr, round(min_bal) min_bal, round(min_bal_q3_26) min_bal_q3_26,
  round(end_bal) end_bal, sweeps, inv
FROM c JOIN inc USING (customer_id) JOIN yy USING (customer_id) JOIN big USING (customer_id)
""")

q("Persony z HANDOFF", "SELECT * FROM persona WHERE customer_id IN ('CUST04957', 'CUST00095', 'CUST03539', 'CUST02948') ORDER BY customer_id")
q("Kandydaci 'burza': młody, saldo pod zero w ostatnim kwartale, bez salary_sweep",
  "SELECT * FROM persona WHERE age < 30 AND min_bal_q3_26 < 0 AND sweeps = 0 ORDER BY leak_change DESC LIMIT 6")
q("Kandydaci 'więdnące kwiaty przy dużym stawie': młody, wycieki rosną, saldo > 3000",
  "SELECT * FROM persona WHERE age < 28 AND leak_change > 0.5 AND end_bal > 3000 AND sweeps = 0 ORDER BY leak_change DESC LIMIT 5")
