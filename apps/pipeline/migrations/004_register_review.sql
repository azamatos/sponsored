-- Whether a company is on a sponsor register, decided by review rather than by name matching: the register's name
-- for it and the evidence. Automatic matches (company_register, method 'auto') stay candidates only. A "listed"
-- review counts while its entry is still on the register, which reloads daily.
create table register_review (
  company_id int not null references company (id),
  register text not null, -- nl_ind | uk_worker
  verdict text not null check (verdict in ('listed', 'not_listed', 'unsure')),
  entry_name text, -- the register's name for the company, when listed
  evidence text not null, -- how we know: the legal name in its postings or on its site, a company registry number
  reviewed_by text not null, -- agent | owner
  reviewed_at timestamptz not null default now(),
  primary key (company_id, register),
  check ((verdict = 'listed') = (entry_name is not null))
);

-- Similar names, for finding candidates by hand ("Booking.com" → "Booking.com B.V.").
create extension if not exists pg_trgm;
create index register_entry_trgm on register_entry using gin (core gin_trgm_ops);
