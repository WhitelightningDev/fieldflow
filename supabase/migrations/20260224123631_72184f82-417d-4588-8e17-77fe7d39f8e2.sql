-- Enable realtime for remaining tables (notifications already added)
DO $$
DECLARE
  _tables text[] := ARRAY[
    'customers','technicians','inventory_items','sites','teams',
    'team_members','site_team_assignments','companies','job_cards',
    'invoices','invoice_payments','technician_locations',
    'job_time_entries','site_material_usage','chat_messages','chat_threads'
  ];
  _t text;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', _t);
    EXCEPTION WHEN duplicate_object THEN
      -- already a member, skip
    END;
  END LOOP;
END $$;