CREATE OR REPLACE FUNCTION public.get_executive_summary_kpis(_current_month integer, _current_year integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH
  won_deals AS (
    SELECT value, expected_close_date, segment, account_id
    FROM public.deals
    WHERE stage IN ('po_secured', 'invoice_issued')
      AND expected_close_date IS NOT NULL
  ),
  mtd_won AS (
    SELECT * FROM won_deals
    WHERE EXTRACT(MONTH FROM expected_close_date) = _current_month
      AND EXTRACT(YEAR FROM expected_close_date) = _current_year
  ),
  ytd_won AS (
    SELECT * FROM won_deals
    WHERE EXTRACT(YEAR FROM expected_close_date) = _current_year
  ),
  all_invoices AS (
    SELECT net_sales, gross_profit, issue_date, paid_date, segment, account_id
    FROM public.invoices
  ),
  mtd_inv AS (
    SELECT * FROM all_invoices
    WHERE EXTRACT(MONTH FROM issue_date::date) = _current_month
      AND EXTRACT(YEAR FROM issue_date::date) = _current_year
  ),
  all_deals AS (
    SELECT value, probability, expected_close_date, stage, segment
    FROM public.deals
  ),
  open_deals AS (
    SELECT * FROM all_deals
    WHERE stage NOT IN ('po_secured', 'invoice_issued', 'canceled', 'lost')
  ),
  monthly_targets AS (
    SELECT revenue_target FROM public.targets
    WHERE month = _current_year || '-' || LPAD(_current_month::text, 2, '0')
  ),
  yearly_targets AS (
    SELECT revenue_target FROM public.targets
    WHERE month LIKE _current_year || '-%'
  ),
  kpi_agg AS (
    SELECT
      (SELECT COALESCE(SUM(value), 0) FROM mtd_won) AS revenue_mtd,
      (SELECT COALESCE(SUM(gross_profit), 0) FROM mtd_inv) AS gp_mtd,
      (SELECT COALESCE(SUM(value), 0) FROM ytd_won) AS revenue_ytd,
      (SELECT COALESCE(SUM(revenue_target), 0) FROM monthly_targets) AS monthly_target,
      (SELECT COALESCE(SUM(revenue_target), 0) FROM yearly_targets) AS yearly_target,
      (SELECT COALESCE(SUM(net_sales), 0) FROM all_invoices WHERE paid_date IS NULL) AS outstanding_ar,
      (SELECT COALESCE(SUM(value), 0) FROM open_deals
        WHERE expected_close_date::date <= (CURRENT_DATE + INTERVAL '30 days')
      ) AS pipeline_30,
      (SELECT COALESCE(SUM(value), 0) FROM open_deals
        WHERE expected_close_date::date > (CURRENT_DATE + INTERVAL '30 days')
          AND expected_close_date::date <= (CURRENT_DATE + INTERVAL '60 days')
      ) AS pipeline_60,
      (SELECT COALESCE(SUM(value * probability / 100.0), 0) FROM open_deals) AS weighted_forecast
  )
  SELECT jsonb_build_object(
    'revenue_mtd', k.revenue_mtd,
    'gp_mtd', k.gp_mtd,
    'revenue_ytd', k.revenue_ytd,
    'total_target', k.monthly_target,
    'yearly_target', k.yearly_target,
    'outstanding_ar', k.outstanding_ar,
    'pipeline_30', k.pipeline_30,
    'pipeline_60', k.pipeline_60,
    'weighted_forecast', k.weighted_forecast,
    'segment_revenue', (
      SELECT jsonb_agg(jsonb_build_object('segment', seg, 'revenue', rev))
      FROM (
        SELECT segment AS seg, COALESCE(SUM(value), 0) AS rev
        FROM mtd_won
        GROUP BY segment
      ) sr
    ),
    'customer_revenue', (
      SELECT jsonb_agg(jsonb_build_object('account_id', aid, 'revenue', rev))
      FROM (
        SELECT account_id AS aid, SUM(value) AS rev
        FROM ytd_won
        GROUP BY account_id
        ORDER BY rev DESC
        LIMIT 10
      ) cr
    ),
    'region_revenue', (
      SELECT jsonb_agg(jsonb_build_object('region', r, 'revenue', rev))
      FROM (
        SELECT COALESCE(a.region, 'Unknown') AS r, SUM(d.value) AS rev
        FROM ytd_won d
        LEFT JOIN public.accounts a ON a.id = d.account_id
        GROUP BY COALESCE(a.region, 'Unknown')
        HAVING COALESCE(a.region, 'Unknown') != ''
        ORDER BY rev DESC
      ) rr
    ),
    'monthly_trend', (
      SELECT jsonb_agg(jsonb_build_object('month_num', mn, 'segment', seg, 'revenue', rev))
      FROM (
        SELECT EXTRACT(MONTH FROM expected_close_date)::int AS mn, segment AS seg, SUM(value) AS rev
        FROM ytd_won
        GROUP BY mn, seg
        ORDER BY mn, seg
      ) mt
    )
  ) INTO result
  FROM kpi_agg k;

  RETURN result;
END;
$function$;