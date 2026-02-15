-- Ensure PostgREST (authenticated role) can access new dashboard tables.
-- RLS still governs row-level access; these grants enable the REST endpoints.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.sites,
  public.teams,
  public.team_members,
  public.site_team_assignments,
  public.job_time_entries,
  public.job_photos,
  public.site_material_usage,
  public.site_documents,
  public.solar_projects,
  public.solar_batteries,
  public.solar_project_batteries,
  public.solar_panel_models,
  public.solar_project_panels,
  public.solar_project_checklist_items,
  public.solar_project_signoffs
TO authenticated;

-- Future-proof: new tables created in public by privileged roles should also
-- be reachable via PostgREST for authenticated users.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

