-- What the language model read in a posting: visa and relocation facts with their quotes, and required languages.
-- One row per posting text, prompt version and model, so models and prompts can be compared on the same postings.
create table extraction (
  id bigserial primary key,
  posting_id int not null references posting (id),
  content_hash text not null,
  prompt_version text not null,
  requested text not null, -- the model alias asked for (haiku, sonnet, opus)
  model text not null, -- the model that answered
  visa text not null,
  visa_quote text,
  relocation text not null,
  relocation_quote text,
  languages text[] not null default '{}',
  dropped jsonb, -- what the model said when its quote wasn't in the text (the fact is then stored as silent)
  created_at timestamptz not null default now(),
  unique (posting_id, content_hash, prompt_version, requested)
);

-- One row per call, to see how much of the subscription's limits extraction uses.
create table extraction_call (
  id bigserial primary key,
  requested text not null,
  model text,
  prompt_version text not null,
  postings int not null,
  ms int,
  input_tokens int,
  output_tokens int,
  cache_read_tokens int,
  cache_write_tokens int,
  cost_usd numeric, -- what the same call would cost on the API; the subscription isn't billed per call
  error text,
  created_at timestamptz not null default now()
);
