-- User onboarding tutorial progress (per-user-per-company-per-tutorial)

create table if not exists public.user_onboarding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  company_id uuid not null,
  tutorial_key text not null,
  current_step int not null default 0,
  is_completed boolean not null default false,
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.user_onboarding
  add constraint user_onboarding_unique_user_company_tutorial
  unique (user_id, company_id, tutorial_key);

alter table public.user_onboarding enable row level security;

drop policy if exists "user_onboarding_select_own" on public.user_onboarding;
create policy "user_onboarding_select_own"
  on public.user_onboarding
  for select
  using (user_id = auth.uid());

drop policy if exists "user_onboarding_insert_own" on public.user_onboarding;
create policy "user_onboarding_insert_own"
  on public.user_onboarding
  for insert
  with check (user_id = auth.uid());

drop policy if exists "user_onboarding_update_own" on public.user_onboarding;
create policy "user_onboarding_update_own"
  on public.user_onboarding
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Keep updated_at fresh automatically
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_onboarding_updated_at on public.user_onboarding;
create trigger set_user_onboarding_updated_at
before update on public.user_onboarding
for each row
execute function public.set_updated_at();

