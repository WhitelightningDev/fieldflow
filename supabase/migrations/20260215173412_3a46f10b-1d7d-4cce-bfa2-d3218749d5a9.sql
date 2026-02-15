
-- First update app_role enum to include office_staff if not present (it already exists)
-- Add helper function: check if user is a technician and get their technician record
CREATE OR REPLACE FUNCTION public.get_user_technician_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.technicians WHERE user_id = _user_id LIMIT 1
$$;

-- ============================================
-- SITES: Replace dev policy with proper ones
-- ============================================
DROP POLICY IF EXISTS "dev_select_sites" ON public.sites;

CREATE POLICY "Company users can view sites"
  ON public.sites FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Owner/admin/office can create sites"
  ON public.sites FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner')
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'office_staff')
    )
  );

CREATE POLICY "Owner/admin/office can update sites"
  ON public.sites FOR UPDATE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner')
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'office_staff')
    )
  );

CREATE POLICY "Owner/admin can delete sites"
  ON public.sites FOR DELETE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner')
      OR has_role(auth.uid(), 'admin')
    )
  );

-- ============================================
-- TEAMS: Replace dev policy with proper ones
-- ============================================
DROP POLICY IF EXISTS "dev_select_teams" ON public.teams;

CREATE POLICY "Company users can view teams"
  ON public.teams FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Owner/admin/office can create teams"
  ON public.teams FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner')
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'office_staff')
    )
  );

CREATE POLICY "Owner/admin/office can update teams"
  ON public.teams FOR UPDATE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner')
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'office_staff')
    )
  );

CREATE POLICY "Owner/admin can delete teams"
  ON public.teams FOR DELETE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner')
      OR has_role(auth.uid(), 'admin')
    )
  );

-- ============================================
-- TEAM_MEMBERS: Replace dev policy
-- ============================================
DROP POLICY IF EXISTS "dev_select_team_members" ON public.team_members;

CREATE POLICY "Company users can view team members"
  ON public.team_members FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Owner/admin/office can create team members"
  ON public.team_members FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner')
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'office_staff')
    )
  );

CREATE POLICY "Owner/admin/office can update team members"
  ON public.team_members FOR UPDATE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner')
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'office_staff')
    )
  );

CREATE POLICY "Owner/admin can delete team members"
  ON public.team_members FOR DELETE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner')
      OR has_role(auth.uid(), 'admin')
    )
  );

-- ============================================
-- SITE_TEAM_ASSIGNMENTS: Replace dev policy
-- ============================================
DROP POLICY IF EXISTS "dev_select_site_team_assignments" ON public.site_team_assignments;

CREATE POLICY "Company users can view site assignments"
  ON public.site_team_assignments FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Owner/admin/office can create site assignments"
  ON public.site_team_assignments FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner')
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'office_staff')
    )
  );

CREATE POLICY "Owner/admin/office can update site assignments"
  ON public.site_team_assignments FOR UPDATE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner')
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'office_staff')
    )
  );

CREATE POLICY "Owner/admin can delete site assignments"
  ON public.site_team_assignments FOR DELETE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner')
      OR has_role(auth.uid(), 'admin')
    )
  );

-- ============================================
-- JOB_CARDS: Add technician-scoped SELECT policy
-- (Existing policies are company-wide for owner/admin/office)
-- Techs can only see jobs assigned to them
-- ============================================
DROP POLICY IF EXISTS "Users can view company jobs" ON public.job_cards;

CREATE POLICY "Owner/admin/office can view all company jobs"
  ON public.job_cards FOR SELECT
  USING (
    company_id = get_user_company_id(auth.uid())
    AND (
      has_role(auth.uid(), 'owner')
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'office_staff')
    )
  );

CREATE POLICY "Technicians can view assigned jobs"
  ON public.job_cards FOR SELECT
  USING (
    company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'technician')
    AND technician_id = get_user_technician_id(auth.uid())
  );

-- Technicians can update their assigned jobs (status changes)
CREATE POLICY "Technicians can update assigned jobs"
  ON public.job_cards FOR UPDATE
  USING (
    company_id = get_user_company_id(auth.uid())
    AND has_role(auth.uid(), 'technician')
    AND technician_id = get_user_technician_id(auth.uid())
  );

-- ============================================
-- INVENTORY: Techs get read-only access
-- ============================================
DROP POLICY IF EXISTS "Users can view company inventory" ON public.inventory_items;

CREATE POLICY "Company users can view inventory"
  ON public.inventory_items FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

-- ============================================
-- CUSTOMERS: Techs get read-only access
-- ============================================
DROP POLICY IF EXISTS "Users can view company customers" ON public.customers;

CREATE POLICY "Company users can view customers"
  ON public.customers FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));

-- ============================================
-- TECHNICIANS: Techs can view company technicians (for team info)
-- ============================================
DROP POLICY IF EXISTS "Users can view company technicians" ON public.technicians;

CREATE POLICY "Company users can view technicians"
  ON public.technicians FOR SELECT
  USING (company_id = get_user_company_id(auth.uid()));
