
-- Solar projects
CREATE TABLE public.solar_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  title TEXT NOT NULL,
  site_id UUID REFERENCES public.sites(id),
  status TEXT NOT NULL DEFAULT 'planning',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.solar_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company users can view solar projects" ON public.solar_projects FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company users can create solar projects" ON public.solar_projects FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company users can update solar projects" ON public.solar_projects FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company users can delete solar projects" ON public.solar_projects FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

-- Solar batteries (company-level battery registry)
CREATE TABLE public.solar_batteries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  serial TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  capacity_kwh NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.solar_batteries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company users can view solar batteries" ON public.solar_batteries FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company users can create solar batteries" ON public.solar_batteries FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company users can update solar batteries" ON public.solar_batteries FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company users can delete solar batteries" ON public.solar_batteries FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

-- Solar project batteries (link batteries to projects)
CREATE TABLE public.solar_project_batteries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.solar_projects(id) ON DELETE CASCADE,
  battery_id UUID NOT NULL REFERENCES public.solar_batteries(id),
  status TEXT NOT NULL DEFAULT 'allocated',
  installed_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.solar_project_batteries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company users can view project batteries" ON public.solar_project_batteries FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_batteries.project_id AND sp.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "Company users can create project batteries" ON public.solar_project_batteries FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_batteries.project_id AND sp.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "Company users can update project batteries" ON public.solar_project_batteries FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_batteries.project_id AND sp.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "Company users can delete project batteries" ON public.solar_project_batteries FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_batteries.project_id AND sp.company_id = get_user_company_id(auth.uid())));

-- Solar panel models (company-level panel catalogue)
CREATE TABLE public.solar_panel_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  manufacturer TEXT,
  model TEXT NOT NULL,
  wattage INTEGER,
  sku TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.solar_panel_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company users can view panel models" ON public.solar_panel_models FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company users can create panel models" ON public.solar_panel_models FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company users can update panel models" ON public.solar_panel_models FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company users can delete panel models" ON public.solar_panel_models FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

-- Solar project panels (panel allocation per project)
CREATE TABLE public.solar_project_panels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.solar_projects(id) ON DELETE CASCADE,
  panel_model_id UUID NOT NULL REFERENCES public.solar_panel_models(id),
  quantity_allocated INTEGER NOT NULL DEFAULT 0,
  quantity_installed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, panel_model_id)
);
ALTER TABLE public.solar_project_panels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company users can view project panels" ON public.solar_project_panels FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_panels.project_id AND sp.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "Company users can create project panels" ON public.solar_project_panels FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_panels.project_id AND sp.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "Company users can update project panels" ON public.solar_project_panels FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_panels.project_id AND sp.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "Company users can delete project panels" ON public.solar_project_panels FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_panels.project_id AND sp.company_id = get_user_company_id(auth.uid())));

-- Solar project checklist items
CREATE TABLE public.solar_project_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.solar_projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.solar_project_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company users can view checklist items" ON public.solar_project_checklist_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_checklist_items.project_id AND sp.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "Company users can create checklist items" ON public.solar_project_checklist_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_checklist_items.project_id AND sp.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "Company users can update checklist items" ON public.solar_project_checklist_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_checklist_items.project_id AND sp.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "Company users can delete checklist items" ON public.solar_project_checklist_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_checklist_items.project_id AND sp.company_id = get_user_company_id(auth.uid())));

-- Solar project signoffs
CREATE TABLE public.solar_project_signoffs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.solar_projects(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  signed_by UUID,
  signed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, step)
);
ALTER TABLE public.solar_project_signoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company users can view signoffs" ON public.solar_project_signoffs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_signoffs.project_id AND sp.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "Company users can create signoffs" ON public.solar_project_signoffs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_signoffs.project_id AND sp.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "Company users can update signoffs" ON public.solar_project_signoffs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_signoffs.project_id AND sp.company_id = get_user_company_id(auth.uid())));
CREATE POLICY "Company users can delete signoffs" ON public.solar_project_signoffs FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.solar_projects sp WHERE sp.id = solar_project_signoffs.project_id AND sp.company_id = get_user_company_id(auth.uid())));
