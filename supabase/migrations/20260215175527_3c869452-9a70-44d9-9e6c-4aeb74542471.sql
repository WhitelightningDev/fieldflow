
-- Add priority to job_cards
ALTER TABLE public.job_cards ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

-- Create storage bucket for job photos
INSERT INTO storage.buckets (id, name, public) VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for job photos
CREATE POLICY "Authenticated users can upload job photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'job-photos');

CREATE POLICY "Authenticated users can view job photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'job-photos');

CREATE POLICY "Authenticated users can delete own job photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'job-photos');

-- RLS for job_photos table (ensure tech can insert/view photos for their jobs)
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view job photos for their company jobs"
ON public.job_photos FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_cards jc
    WHERE jc.id = job_photos.job_card_id
    AND jc.company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users can insert job photos for their company jobs"
ON public.job_photos FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.job_cards jc
    WHERE jc.id = job_photos.job_card_id
    AND jc.company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users can delete job photos for their company jobs"
ON public.job_photos FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_cards jc
    WHERE jc.id = job_photos.job_card_id
    AND jc.company_id = public.get_user_company_id(auth.uid())
  )
);

-- RLS for job_time_entries
ALTER TABLE public.job_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view time entries for their company jobs"
ON public.job_time_entries FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_cards jc
    WHERE jc.id = job_time_entries.job_card_id
    AND jc.company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users can insert time entries for their company jobs"
ON public.job_time_entries FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.job_cards jc
    WHERE jc.id = job_time_entries.job_card_id
    AND jc.company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users can update time entries for their company jobs"
ON public.job_time_entries FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_cards jc
    WHERE jc.id = job_time_entries.job_card_id
    AND jc.company_id = public.get_user_company_id(auth.uid())
  )
);

-- RLS for site_material_usage
ALTER TABLE public.site_material_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view material usage for their company"
ON public.site_material_usage FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_cards jc
    WHERE jc.id = site_material_usage.job_card_id
    AND jc.company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Users can insert material usage for their company"
ON public.site_material_usage FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.job_cards jc
    WHERE jc.id = site_material_usage.job_card_id
    AND jc.company_id = public.get_user_company_id(auth.uid())
  )
);
