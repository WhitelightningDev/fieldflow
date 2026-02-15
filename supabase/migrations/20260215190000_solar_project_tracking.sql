-- Solar Project Tracking (Electrical dashboard)
-- Features:
-- - Battery serial tracking
-- - Panel allocation per site
-- - Installation checklist compliance
-- - Sign-off workflow

-- Enums
CREATE TYPE public.solar_project_status AS ENUM ('planned', 'in-progress', 'installed', 'commissioned', 'closed');
CREATE TYPE public.solar_battery_status AS ENUM ('in_stock', 'allocated', 'installed', 'removed');
CREATE TYPE public.solar_signoff_step AS ENUM ('installer', 'supervisor', 'customer');
CREATE TYPE public.solar_signoff_status AS ENUM ('pending', 'signed', 'rejected');

-- Solar projects (scoped to company, linked to a site)
CREATE TABLE public.solar_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status public.solar_project_status NOT NULL DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Batteries (serial-tracked, scoped to company)
CREATE TABLE public.solar_batteries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  serial TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  capacity_kwh NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, serial)
);

-- Batteries assigned to a project
CREATE TABLE public.solar_project_batteries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.solar_projects(id) ON DELETE CASCADE NOT NULL,
  battery_id UUID REFERENCES public.solar_batteries(id) ON DELETE RESTRICT NOT NULL,
  status public.solar_battery_status NOT NULL DEFAULT 'allocated',
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  installed_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, battery_id)
);

-- Panel models (allocation tracked per project; serial tracking can be added later)
CREATE TABLE public.solar_panel_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  manufacturer TEXT,
  model TEXT NOT NULL,
  wattage INTEGER,
  sku TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, model, wattage)
);

-- Panel allocation per project/site
CREATE TABLE public.solar_project_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.solar_projects(id) ON DELETE CASCADE NOT NULL,
  panel_model_id UUID REFERENCES public.solar_panel_models(id) ON DELETE RESTRICT NOT NULL,
  quantity_allocated INTEGER NOT NULL,
  quantity_installed INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (quantity_allocated >= 0),
  CHECK (quantity_installed >= 0),
  CHECK (quantity_installed <= quantity_allocated),
  UNIQUE (project_id, panel_model_id)
);

-- Installation checklist compliance (simple per-project checklist items)
CREATE TABLE public.solar_project_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.solar_projects(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sign-off workflow (3-step default)
CREATE TABLE public.solar_project_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.solar_projects(id) ON DELETE CASCADE NOT NULL,
  step public.solar_signoff_step NOT NULL,
  status public.solar_signoff_status NOT NULL DEFAULT 'pending',
  signed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, step)
);

-- Updated_at triggers
CREATE TRIGGER update_solar_projects_updated_at
  BEFORE UPDATE ON public.solar_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_solar_project_signoffs_updated_at
  BEFORE UPDATE ON public.solar_project_signoffs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX solar_projects_company_id_idx ON public.solar_projects(company_id);
CREATE INDEX solar_projects_site_id_idx ON public.solar_projects(site_id);
CREATE INDEX solar_batteries_company_id_idx ON public.solar_batteries(company_id);
CREATE INDEX solar_project_batteries_project_id_idx ON public.solar_project_batteries(project_id);
CREATE INDEX solar_panel_models_company_id_idx ON public.solar_panel_models(company_id);
CREATE INDEX solar_project_panels_project_id_idx ON public.solar_project_panels(project_id);
CREATE INDEX solar_project_checklist_items_project_id_idx ON public.solar_project_checklist_items(project_id);
CREATE INDEX solar_project_signoffs_project_id_idx ON public.solar_project_signoffs(project_id);

-- Enable RLS
ALTER TABLE public.solar_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_batteries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_project_batteries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_panel_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_project_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_project_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_project_signoffs ENABLE ROW LEVEL SECURITY;

-- RLS: Solar projects - company-scoped
CREATE POLICY "Users can view company solar projects"
  ON public.solar_projects FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create company solar projects"
  ON public.solar_projects FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update company solar projects"
  ON public.solar_projects FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete company solar projects"
  ON public.solar_projects FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS: Batteries + panel models - company-scoped
CREATE POLICY "Users can view company solar batteries"
  ON public.solar_batteries FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create company solar batteries"
  ON public.solar_batteries FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update company solar batteries"
  ON public.solar_batteries FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete company solar batteries"
  ON public.solar_batteries FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can view company solar panel models"
  ON public.solar_panel_models FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create company solar panel models"
  ON public.solar_panel_models FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update company solar panel models"
  ON public.solar_panel_models FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete company solar panel models"
  ON public.solar_panel_models FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS: Join tables and per-project tables (scoped via solar_projects.company_id)
CREATE POLICY "Users can view company solar project batteries"
  ON public.solar_project_batteries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can create company solar project batteries"
  ON public.solar_project_batteries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.solar_batteries b
      WHERE b.id = battery_id
        AND b.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can update company solar project batteries"
  ON public.solar_project_batteries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can delete company solar project batteries"
  ON public.solar_project_batteries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can view company solar project panels"
  ON public.solar_project_panels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can create company solar project panels"
  ON public.solar_project_panels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.solar_panel_models m
      WHERE m.id = panel_model_id
        AND m.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can update company solar project panels"
  ON public.solar_project_panels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can delete company solar project panels"
  ON public.solar_project_panels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can view company solar checklist"
  ON public.solar_project_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can create company solar checklist"
  ON public.solar_project_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can update company solar checklist"
  ON public.solar_project_checklist_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can delete company solar checklist"
  ON public.solar_project_checklist_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can view company solar signoffs"
  ON public.solar_project_signoffs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can create company solar signoffs"
  ON public.solar_project_signoffs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can update company solar signoffs"
  ON public.solar_project_signoffs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can delete company solar signoffs"
  ON public.solar_project_signoffs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solar_projects p
      WHERE p.id = project_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

