-- Which languages other than English a role requires, for every open posting, with the sentence that says so.
-- One row per posting text, prompt version and model. Postings with nothing about languages, written in English,
-- get a row without a model call (model 'none'): they ask for no other language.
create table language_check (
  id bigserial primary key,
  posting_id int not null references posting (id),
  content_hash text not null,
  prompt_version text not null,
  requested text not null,
  model text not null,
  languages text[] not null default '{}',
  quote text, -- verified in the posting's text; null when only the posting's own language is the reason
  written_in text, -- the posting's language, when it isn't English
  dropped jsonb, -- what the model said when its quote wasn't in the text
  created_at timestamptz not null default now(),
  unique (posting_id, content_hash, prompt_version, requested)
);
