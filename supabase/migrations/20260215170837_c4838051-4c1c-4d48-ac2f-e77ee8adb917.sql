
-- Add missing columns
ALTER TABLE public.job_cards ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);

-- Create job_time_entries table
CREATE TABLE IF NOT EXISTS public.job_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id uuid NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  technician_id uuid REFERENCES public.technicians(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  minutes integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.job_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company job time entries" ON public.job_time_entries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.job_cards jc WHERE jc.id = job_card_id AND jc.company_id = get_user_company_id(auth.uid()))
  );
CREATE POLICY "Users can create company job time entries" ON public.job_time_entries
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.job_cards jc WHERE jc.id = job_card_id AND jc.company_id = get_user_company_id(auth.uid()))
  );
CREATE POLICY "Users can delete company job time entries" ON public.job_time_entries
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.job_cards jc WHERE jc.id = job_card_id AND jc.company_id = get_user_company_id(auth.uid()))
  );

-- Create job_photos table
CREATE TABLE IF NOT EXISTS public.job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id uuid NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'before',
  storage_path text NOT NULL,
  taken_at timestamptz,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company job photos" ON public.job_photos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.job_cards jc WHERE jc.id = job_card_id AND jc.company_id = get_user_company_id(auth.uid()))
  );
CREATE POLICY "Users can create company job photos" ON public.job_photos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.job_cards jc WHERE jc.id = job_card_id AND jc.company_id = get_user_company_id(auth.uid()))
  );
CREATE POLICY "Users can delete company job photos" ON public.job_photos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.job_cards jc WHERE jc.id = job_card_id AND jc.company_id = get_user_company_id(auth.uid()))
  );

-- Create site_material_usage table
CREATE TABLE IF NOT EXISTS public.site_material_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  job_card_id uuid NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id),
  quantity_used integer NOT NULL DEFAULT 1,
  notes text,
  used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_material_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company site material usage" ON public.site_material_usage
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND s.company_id = get_user_company_id(auth.uid()))
  );
CREATE POLICY "Users can create company site material usage" ON public.site_material_usage
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND s.company_id = get_user_company_id(auth.uid()))
  );
CREATE POLICY "Users can delete company site material usage" ON public.site_material_usage
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND s.company_id = get_user_company_id(auth.uid()))
  );

-- Create site_documents table
CREATE TABLE IF NOT EXISTS public.site_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  job_card_id uuid REFERENCES public.job_cards(id),
  kind text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  storage_path text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company site documents" ON public.site_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND s.company_id = get_user_company_id(auth.uid()))
  );
CREATE POLICY "Users can create company site documents" ON public.site_documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND s.company_id = get_user_company_id(auth.uid()))
  );
CREATE POLICY "Users can delete company site documents" ON public.site_documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND s.company_id = get_user_company_id(auth.uid()))
  );

-- Create storage buckets for photos and documents
INSERT INTO storage.buckets (id, name, public) VALUES ('job-photos', 'job-photos', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('site-documents', 'site-documents', false) ON CONFLICT (id) DO NOTHING;

-- Storage policies for job-photos
CREATE POLICY "Users can upload job photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can view job photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete job photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);

-- Storage policies for site-documents
CREATE POLICY "Users can upload site documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'site-documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can view site documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-documents' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete site documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'site-documents' AND auth.uid() IS NOT NULL);
