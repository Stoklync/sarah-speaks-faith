-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table if not exists social_tokens (
  id uuid default gen_random_uuid() primary key,
  user_key text not null,
  platform text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz default now(),
  unique(user_key, platform)
);

-- Enable RLS (optional - service role bypasses it)
alter table social_tokens enable row level security;

-- Policy: only service role can access (API uses service role key)
create policy "Service role only" on social_tokens
  for all using (auth.role() = 'service_role');
