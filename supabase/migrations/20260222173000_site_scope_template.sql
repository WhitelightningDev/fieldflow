alter table public.sites
add column if not exists scope_template jsonb null;

