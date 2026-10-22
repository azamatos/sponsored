-- Companies whose job boards we read. status: new (not read yet), active (has engineering roles in Europe; read
-- every run), idle (board works, nothing for us; re-read weekly), gone (board not found; re-read monthly).
create table company (
  id serial primary key,
  ats text not null,
  slug text not null,
  eu boolean not null default false,
  name text,
  origin text not null,
  status text not null default 'new',
  checked_at timestamptz,
  ok_at timestamptz,
  error text,
  errors_in_row int not null default 0,
  total_jobs int,
  kept_jobs int,
  added_at timestamptz not null default now(),
  unique (ats, slug, eu)
);

-- Engineering roles in Europe only. The full text is kept privately for extraction and evaluation, never shown.
create table posting (
  id bigserial primary key,
  company_id int not null references company (id),
  external_id text not null,
  url text not null,
  title text not null,
  family text not null,
  seniority text not null,
  location_raw text not null,
  countries text[] not null,
  work_mode text not null,
  remote_scope text not null,
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  changed_at timestamptz,
  closed_at timestamptz,
  content_hash text not null,
  description text,
  salary_raw text,
  pay jsonb,
  signals jsonb,
  unique (company_id, external_id)
);
create index posting_open on posting (company_id) where closed_at is null;

-- Official sponsor registers: nl_ind (IND recognised sponsors), uk_worker (UK licensed sponsors, Skilled Worker).
create table register_entry (
  register text not null,
  name text not null,
  core text not null,
  extra jsonb,
  fetched_at timestamptz not null,
  primary key (register, name)
);
create index register_entry_core on register_entry (register, core text_pattern_ops);

create table company_register (
  company_id int not null references company (id),
  register text not null,
  entry_name text not null,
  method text not null,
  primary key (company_id, register, entry_name)
);

create table run (
  id serial primary key,
  kind text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb
);

create table source_result (
  run_id int not null references run (id),
  company_id int not null references company (id),
  ok boolean not null,
  ms int not null,
  total int,
  kept int,
  error text,
  primary key (run_id, company_id)
);
