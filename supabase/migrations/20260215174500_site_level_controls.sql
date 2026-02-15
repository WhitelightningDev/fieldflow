-- Site-level control tables:
-- - Which team is at which site?
-- - Time tracking per job
-- - Photos before/after
-- - Material usage per site
-- - COC documentation storage for electrical dashboards

-- Enums
CREATE TYPE public.photo_kind AS ENUM ('before', 'after');
CREATE TYPE public.document_kind AS ENUM ('coc', 'other');

-- Sites (scoped to company)
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teams (scoped to company)
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

-- Team members (joins teams <> technicians)
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  technician_id UUID REFERENCES public.technicians(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, technician_id)
);

-- Which team is at which site (time-ranged)
CREATE TABLE public.site_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

-- Link jobs to a site (optional)
ALTER TABLE public.job_cards
ADD COLUMN site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL;

-- Time tracking per job
CREATE TABLE public.job_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID REFERENCES public.job_cards(id) ON DELETE CASCADE NOT NULL,
  technician_id UUID REFERENCES public.technicians(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at),
  CHECK (minutes IS NULL OR minutes >= 0)
);

-- Photos before/after (metadata; files live in Storage)
CREATE TABLE public.job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID REFERENCES public.job_cards(id) ON DELETE CASCADE NOT NULL,
  kind public.photo_kind NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  taken_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Material usage per site (optionally tied to a job)
CREATE TABLE public.site_material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE NOT NULL,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE RESTRICT NOT NULL,
  job_card_id UUID REFERENCES public.job_cards(id) ON DELETE SET NULL,
  quantity_used INTEGER NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (quantity_used > 0)
);

-- Site documents (COC for electrical dashboards, etc; files live in Storage)
CREATE TABLE public.site_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE NOT NULL,
  job_card_id UUID REFERENCES public.job_cards(id) ON DELETE SET NULL,
  kind public.document_kind NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at triggers
CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX sites_company_id_idx ON public.sites(company_id);
CREATE INDEX teams_company_id_idx ON public.teams(company_id);
CREATE INDEX team_members_team_id_idx ON public.team_members(team_id);
CREATE INDEX site_team_assignments_site_id_idx ON public.site_team_assignments(site_id);
CREATE INDEX job_time_entries_job_card_id_idx ON public.job_time_entries(job_card_id);
CREATE INDEX job_photos_job_card_id_idx ON public.job_photos(job_card_id);
CREATE INDEX site_material_usage_site_id_idx ON public.site_material_usage(site_id);
CREATE INDEX site_documents_site_id_idx ON public.site_documents(site_id);
CREATE INDEX job_cards_site_id_idx ON public.job_cards(site_id);

-- Enable RLS
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_documents ENABLE ROW LEVEL SECURITY;

-- RLS: Sites - company-scoped
CREATE POLICY "Users can view company sites"
  ON public.sites FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create company sites"
  ON public.sites FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update company sites"
  ON public.sites FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete company sites"
  ON public.sites FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS: Teams - company-scoped
CREATE POLICY "Users can view company teams"
  ON public.teams FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create company teams"
  ON public.teams FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can update company teams"
  ON public.teams FOR UPDATE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete company teams"
  ON public.teams FOR DELETE
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- RLS: Team members - scoped via team.company_id
CREATE POLICY "Users can view company team members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND t.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can create company team members"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND t.company_id = public.get_user_company_id(auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.technicians tech
      WHERE tech.id = technician_id
        AND tech.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can delete company team members"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND t.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- RLS: Site team assignments - scoped via site.company_id
CREATE POLICY "Users can view company site team assignments"
  ON public.site_team_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id
        AND s.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can create company site team assignments"
  ON public.site_team_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id
        AND s.company_id = public.get_user_company_id(auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND t.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can update company site team assignments"
  ON public.site_team_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id
        AND s.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can delete company site team assignments"
  ON public.site_team_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id
        AND s.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- RLS: Job time entries - scoped via job_cards.company_id
CREATE POLICY "Users can view company job time entries"
  ON public.job_time_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_cards j
      WHERE j.id = job_card_id
        AND j.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can create company job time entries"
  ON public.job_time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_cards j
      WHERE j.id = job_card_id
        AND j.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can delete company job time entries"
  ON public.job_time_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_cards j
      WHERE j.id = job_card_id
        AND j.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- RLS: Job photos - scoped via job_cards.company_id
CREATE POLICY "Users can view company job photos"
  ON public.job_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_cards j
      WHERE j.id = job_card_id
        AND j.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can create company job photos"
  ON public.job_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_cards j
      WHERE j.id = job_card_id
        AND j.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can delete company job photos"
  ON public.job_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_cards j
      WHERE j.id = job_card_id
        AND j.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- RLS: Material usage - scoped via site.company_id + inventory_items.company_id
CREATE POLICY "Users can view company material usage"
  ON public.site_material_usage FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id
        AND s.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can create company material usage"
  ON public.site_material_usage FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id
        AND s.company_id = public.get_user_company_id(auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.inventory_items i
      WHERE i.id = inventory_item_id
        AND i.company_id = public.get_user_company_id(auth.uid())
    )
    AND (
      job_card_id IS NULL OR EXISTS (
        SELECT 1 FROM public.job_cards j
        WHERE j.id = job_card_id
          AND j.company_id = public.get_user_company_id(auth.uid())
      )
    )
  );

CREATE POLICY "Users can delete company material usage"
  ON public.site_material_usage FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id
        AND s.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- RLS: Site documents - scoped via site.company_id
CREATE POLICY "Users can view company site documents"
  ON public.site_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id
        AND s.company_id = public.get_user_company_id(auth.uid())
    )
  );

CREATE POLICY "Users can create company site documents"
  ON public.site_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id
        AND s.company_id = public.get_user_company_id(auth.uid())
    )
    AND (
      job_card_id IS NULL OR EXISTS (
        SELECT 1 FROM public.job_cards j
        WHERE j.id = job_card_id
          AND j.company_id = public.get_user_company_id(auth.uid())
      )
    )
  );

CREATE POLICY "Users can delete company site documents"
  ON public.site_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id
        AND s.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- Storage buckets + policies (best-effort; no-op if storage schema isn't present)
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('job-photos', 'job-photos', false)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO storage.buckets (id, name, public)
    VALUES ('site-documents', 'site-documents', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF to_regclass('storage.objects') IS NOT NULL THEN
    -- Convention: object name must be prefixed with "<company_id>/..."
    BEGIN
      EXECUTE $pol$
        CREATE POLICY "Company can read job photos"
          ON storage.objects FOR SELECT TO authenticated
          USING (
            bucket_id = 'job-photos'
            AND split_part(name, '/', 1) = (public.get_user_company_id(auth.uid()))::text
          );
      $pol$;
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
      EXECUTE $pol$
        CREATE POLICY "Company can write job photos"
          ON storage.objects FOR INSERT TO authenticated
          WITH CHECK (
            bucket_id = 'job-photos'
            AND split_part(name, '/', 1) = (public.get_user_company_id(auth.uid()))::text
          );
      $pol$;
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
      EXECUTE $pol$
        CREATE POLICY "Company can delete job photos"
          ON storage.objects FOR DELETE TO authenticated
          USING (
            bucket_id = 'job-photos'
            AND split_part(name, '/', 1) = (public.get_user_company_id(auth.uid()))::text
          );
      $pol$;
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
      EXECUTE $pol$
        CREATE POLICY "Company can read site documents"
          ON storage.objects FOR SELECT TO authenticated
          USING (
            bucket_id = 'site-documents'
            AND split_part(name, '/', 1) = (public.get_user_company_id(auth.uid()))::text
          );
      $pol$;
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
      EXECUTE $pol$
        CREATE POLICY "Company can write site documents"
          ON storage.objects FOR INSERT TO authenticated
          WITH CHECK (
            bucket_id = 'site-documents'
            AND split_part(name, '/', 1) = (public.get_user_company_id(auth.uid()))::text
          );
      $pol$;
    EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN
      EXECUTE $pol$
        CREATE POLICY "Company can delete site documents"
          ON storage.objects FOR DELETE TO authenticated
          USING (
            bucket_id = 'site-documents'
            AND split_part(name, '/', 1) = (public.get_user_company_id(auth.uid()))::text
          );
      $pol$;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
