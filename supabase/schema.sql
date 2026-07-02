-- Stems schema
-- Run this in Supabase > SQL Editor

-- Branches table
create table if not exists branches (
  id          text primary key,
  user_id     uuid references auth.users not null,
  name        text not null,
  color       text not null,
  created_at  timestamptz default now()
);

alter table branches enable row level security;

create policy "Users access own branches"
  on branches for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Logs table
create table if not exists logs (
  id          text primary key,
  user_id     uuid references auth.users not null,
  branch_id   text references branches(id) on delete set null,
  minutes     integer not null check (minutes > 0),
  note        text,
  ts          bigint not null,
  created_at  timestamptz default now()
);

alter table logs enable row level security;

create policy "Users access own logs"
  on logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes for common queries
create index if not exists logs_user_ts   on logs (user_id, ts desc);
create index if not exists logs_branch_id on logs (branch_id);
