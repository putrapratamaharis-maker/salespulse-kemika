
-- Create kpi_category enum
CREATE TYPE public.kpi_category AS ENUM ('GROWTH', 'PROFITABILITY', 'COMPLIANCE', 'PRODUCTIVITY', 'DISCIPLINE');

-- Add new columns to kpi_master
ALTER TABLE public.kpi_master
  ADD COLUMN kpi_category public.kpi_category NULL,
  ADD COLUMN score_cap_pct numeric NOT NULL DEFAULT 100,
  ADD COLUMN green_threshold_pct numeric NOT NULL DEFAULT 100,
  ADD COLUMN yellow_threshold_pct numeric NOT NULL DEFAULT 90,
  ADD COLUMN red_threshold_pct numeric NOT NULL DEFAULT 0;

-- Migrate existing data: assign categories based on KPI name patterns
UPDATE public.kpi_master SET kpi_category = 'GROWTH', score_cap_pct = 120, green_threshold_pct = 100, yellow_threshold_pct = 90
WHERE kpi_name ILIKE '%Revenue%';

UPDATE public.kpi_master SET kpi_category = 'PROFITABILITY', score_cap_pct = 110, green_threshold_pct = 100, yellow_threshold_pct = 90
WHERE kpi_name ILIKE '%GP%' AND kpi_category IS NULL;

UPDATE public.kpi_master SET kpi_category = 'COMPLIANCE', score_cap_pct = 100, green_threshold_pct = 100, yellow_threshold_pct = 90
WHERE (kpi_name ILIKE '%Compliance%' OR kpi_name ILIKE '%Accuracy%' OR kpi_name ILIKE '%SOP%' OR kpi_name ILIKE '%On-Time%')
  AND kpi_category IS NULL;

UPDATE public.kpi_master SET kpi_category = 'PRODUCTIVITY', score_cap_pct = 120, green_threshold_pct = 100, yellow_threshold_pct = 90
WHERE (kpi_name ILIKE '%Active%' OR kpi_name ILIKE '%Accounts%')
  AND kpi_category IS NULL;

UPDATE public.kpi_master SET kpi_category = 'DISCIPLINE', score_cap_pct = 100, green_threshold_pct = 100, yellow_threshold_pct = 90
WHERE (kpi_name ILIKE '%Planning%' OR kpi_name ILIKE '%Discipline%')
  AND kpi_category IS NULL;
