import duckdb

con = duckdb.connect()
con.execute("CREATE TABLE t AS SELECT * FROM read_csv_auto('data/spankki/tx_junction_transactions.csv', header=true)")
q = lambda title, sql: (print(f"\n### {title}"), con.sql(sql).show(max_rows=40, max_width=220))

con.execute("""
CREATE TABLE b AS
SELECT customer_id, tx_date, date_trunc('month', tx_date) mo, -tx_amount_eur amt, category, mcc_code, transaction_type,
  CASE
    WHEN transaction_type IN ('housing_payment', 'utilities_payment') OR category = 'Groceries' OR mcc_code = 4111 THEN 'B1_fixed'
    WHEN category IN ('Health', 'Home & Tech') OR (category IN ('Lifestyle', 'Travel', 'Transportation') AND -tx_amount_eur > 300) THEN 'B2_irregular'
    WHEN category IN ('Restaurants', 'Entertainment', 'Lifestyle', 'Travel') OR mcc_code = 4121 THEN 'B3_leaks'
    ELSE 'other'
  END basket
FROM t WHERE tx_amount_eur < 0 AND transaction_type NOT IN ('salary_sweep', 'investment_deposit') AND -tx_amount_eur < 5000
""")

q("Udział 'other' i co w nim jest", """
SELECT category, mcc_code, count(*) n, round(sum(amt)) eur FROM b WHERE basket = 'other' GROUP BY ALL ORDER BY eur DESC LIMIT 8""")

q("Miesięczna prognoza B1 (średnia z 3 poprzednich mies.) – to potrzebuje pogoda", """
WITH m AS (SELECT customer_id, mo, sum(amt) v FROM b WHERE basket = 'B1_fixed' GROUP BY ALL),
     f AS (SELECT *, avg(v) OVER (PARTITION BY customer_id ORDER BY mo ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) p,
                  count(*) OVER (PARTITION BY customer_id ORDER BY mo ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) k FROM m)
SELECT round(median(abs(v - p) / v), 3) mape_month, round(avg((abs(v - p) / v <= 0.15)::INT), 3) within_15
FROM f WHERE k = 3 AND mo >= '2025-01-01'""")

q("Miesięczna prognoza B1 bez Groceries (czynsz + media + komunikacja)", """
WITH m AS (SELECT customer_id, mo, sum(amt) v FROM b WHERE basket = 'B1_fixed' AND category <> 'Groceries' GROUP BY ALL),
     f AS (SELECT *, avg(v) OVER (PARTITION BY customer_id ORDER BY mo ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) p,
                  count(*) OVER (PARTITION BY customer_id ORDER BY mo ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING) k FROM m)
SELECT round(median(abs(v - p) / v), 3) mape_month, round(avg((abs(v - p) / v <= 0.15)::INT), 3) within_15
FROM f WHERE k = 3 AND mo >= '2025-01-01'""")

q("Czynsz: dzień miesiąca i stałość kwoty (per klient)", """
WITH h AS (SELECT customer_id, day(tx_date) d, -tx_amount_eur a FROM t WHERE transaction_type = 'housing_payment'),
     s AS (SELECT customer_id, count(*) n, stddev(d) sd_day, stddev(a) / avg(a) cv_amt, mode(d) typical_day FROM h GROUP BY 1)
SELECT count(*) customers, round(median(n)) med_payments, round(median(sd_day), 2) med_sd_day,
  round(avg((sd_day <= 2)::INT), 3) share_day_stable_2d, round(median(cv_amt), 3) med_cv_amount,
  round(avg((n > 26)::INT), 3) share_multi_per_month FROM s""")

q("Pensja: dzień i stałość", """
WITH h AS (SELECT customer_id, day(tx_date) d, tx_amount_eur a FROM t WHERE transaction_type = 'salary'),
     s AS (SELECT customer_id, count(*) n, stddev(d) sd_day, stddev(a) / avg(a) cv_amt FROM h GROUP BY 1)
SELECT count(*) customers, round(median(n)) med_n, round(median(sd_day), 2) med_sd_day, round(median(cv_amt), 3) med_cv_amt FROM s""")

q("Zdrowie finansowe populacji: czy safe-to-spend nie będzie wszystkim 0?", """
WITH inc AS (SELECT customer_id, sum(tx_amount_eur) FILTER (WHERE tx_amount_eur > 0) i,
                    -sum(tx_amount_eur) FILTER (WHERE tx_amount_eur < 0) o,
                    min(balance_after_eur) mn, arg_max(balance_after_eur, tx_timestamp) last_bal FROM t GROUP BY 1),
     neg AS (SELECT customer_id, avg((balance_after_eur < 0)::INT) neg_share FROM t GROUP BY 1)
SELECT round(avg((o > i)::INT), 3) share_spend_gt_income, round(avg((mn < 0)::INT), 3) share_ever_negative,
  round(median(neg_share), 3) med_share_tx_negative, round(avg((neg_share > 0.25)::INT), 3) share_often_negative,
  round(median(last_bal)) med_last_balance, round(quantile_cont(last_bal, 0.1)) p10_last, round(quantile_cont(last_bal, 0.9)) p90_last
FROM inc JOIN neg USING (customer_id)""")

q("Czy jest wzorzec dnia tygodnia w restauracjach (dla 'w weekend opady')?", """
SELECT dayname(tx_date) dow, count(*) n, round(avg(amt), 1) avg_amt FROM b WHERE category = 'Restaurants' GROUP BY 1 ORDER BY n DESC""")

q("Sezonowość wycieków B3 (suma miesięczna, wszyscy)", """
SELECT strftime(mo, '%Y-%m') m, round(sum(amt) / 1e3) k_eur FROM b WHERE basket = 'B3_leaks' GROUP BY 1 ORDER BY 1""")

for cid in ['CUST04957', 'CUST00095', 'CUST03539', 'CUST02948']:
    q(f"Persona {cid}: miesiąc po miesiącu", f"""
    WITH m AS (SELECT strftime(mo, '%Y-%m') m,
        round(sum(amt) FILTER (WHERE basket = 'B1_fixed')) b1, round(sum(amt) FILTER (WHERE basket = 'B2_irregular')) b2,
        round(sum(amt) FILTER (WHERE basket = 'B3_leaks')) b3 FROM b WHERE customer_id = '{cid}' GROUP BY 1),
    x AS (SELECT strftime(date_trunc('month', tx_date), '%Y-%m') m,
        round(sum(tx_amount_eur) FILTER (WHERE tx_amount_eur > 0)) income,
        round(-sum(tx_amount_eur) FILTER (WHERE transaction_type = 'investment_deposit')) inv,
        round(-sum(tx_amount_eur) FILTER (WHERE transaction_type = 'salary_sweep')) sweep,
        round(min(balance_after_eur)) min_bal, round(arg_max(balance_after_eur, tx_timestamp)) end_bal
        FROM t WHERE customer_id = '{cid}' GROUP BY 1)
    SELECT * FROM m JOIN x USING (m) ORDER BY m""")
