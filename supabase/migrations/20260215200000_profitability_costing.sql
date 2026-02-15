-- Profitability / gross margin inputs:
-- - Revenue per job
-- - Labour cost per technician (hourly)
-- - Unit cost per inventory item
-- - Wastage tracking for materials

ALTER TABLE public.technicians
ADD COLUMN IF NOT EXISTS hourly_cost_cents INTEGER,
ADD COLUMN IF NOT EXISTS hourly_bill_rate_cents INTEGER;

ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS unit_cost_cents INTEGER;

ALTER TABLE public.job_cards
ADD COLUMN IF NOT EXISTS revenue_cents INTEGER;

ALTER TABLE public.site_material_usage
ADD COLUMN IF NOT EXISTS quantity_wasted INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS waste_notes TEXT;

-- Allow recording wastage-only events.
ALTER TABLE public.site_material_usage
DROP CONSTRAINT IF EXISTS site_material_usage_quantity_used_check;

ALTER TABLE public.site_material_usage
ADD CONSTRAINT site_material_usage_quantities_check
CHECK (quantity_used >= 0 AND quantity_wasted >= 0 AND (quantity_used + quantity_wasted) > 0);

CREATE INDEX IF NOT EXISTS technicians_company_id_idx ON public.technicians(company_id);
CREATE INDEX IF NOT EXISTS inventory_items_company_id_idx ON public.inventory_items(company_id);
CREATE INDEX IF NOT EXISTS job_cards_company_id_idx ON public.job_cards(company_id);
