-- The official salary minimums the site checks and shows, with their sources. A new row each January.
create table visa_rule (
  country text not null,
  rule text not null,
  amount numeric not null,
  currency text not null,
  period text not null check (period in ('year', 'month')),
  applies_from date not null,
  source_url text not null,
  checked_on date not null,
  primary key (country, rule, applies_from)
);

insert into visa_rule (country, rule, amount, currency, period, applies_from, source_url, checked_on) values
  -- Germany, EU Blue Card: the reduced minimum covers IT (ISCO 25), ICT managers and recent graduates, with the
  -- Federal Employment Agency's approval; IT specialists without a degree qualify at it with 3 years' experience.
  ('DE', 'blue_card', 50700, 'EUR', 'year', '2026-01-01',
    'https://www.bundesanzeiger.de/pub/publication/REViP4bN6jVdpGxPaiQ/content/REViP4bN6jVdpGxPaiQ/BAnz%20AT%2018.12.2025%20B3.pdf',
    '2026-10-24'),
  ('DE', 'blue_card_reduced', 45934.20, 'EUR', 'year', '2026-01-01',
    'https://www.bundesanzeiger.de/pub/publication/REViP4bN6jVdpGxPaiQ/content/REViP4bN6jVdpGxPaiQ/BAnz%20AT%2018.12.2025%20B3.pdf',
    '2026-10-24'),
  -- Netherlands: gross a month, without holiday allowance; the employer must be an IND recognised sponsor.
  ('NL', 'hsm_30_plus', 5942, 'EUR', 'month', '2026-01-01', 'https://ind.nl/en/required-amounts-income-requirements', '2026-10-24'),
  ('NL', 'hsm_under_30', 4357, 'EUR', 'month', '2026-01-01', 'https://ind.nl/en/required-amounts-income-requirements', '2026-10-24'),
  ('NL', 'hsm_reduced', 3122, 'EUR', 'month', '2026-01-01', 'https://ind.nl/en/required-amounts-income-requirements', '2026-10-24'),
  ('NL', 'blue_card', 5942, 'EUR', 'month', '2026-01-01', 'https://ind.nl/en/required-amounts-income-requirements', '2026-10-24'),
  ('NL', 'blue_card_reduced', 4754, 'EUR', 'month', '2026-01-01', 'https://ind.nl/en/required-amounts-income-requirements', '2026-10-24'),
  -- United Kingdom, Skilled Worker: this or the occupation's going rate, whichever is higher.
  ('GB', 'skilled_worker', 41700, 'GBP', 'year', '2025-07-22', 'https://www.gov.uk/skilled-worker-visa/your-job', '2026-10-24');

-- One answer per role, as the site shows it: the visa state (the five in docs/design-brief.md), relocation and
-- languages, each with its evidence. The posting's own words come first. For a posting that says nothing, the law:
-- a reviewed register entry still on the register (UK, Netherlands), or a posted salary at or over the reduced Blue
-- Card minimum (Germany; software roles fall under it). Extractions count for the posting's current text and the
-- prompts in use (extract-v1 with Opus, languages-v2 with Sonnet): a new prompt means a new version of this view.
create view role_answer as
with fact as (
  select distinct on (e.posting_id) e.posting_id, e.visa, e.visa_quote, e.relocation, e.relocation_quote,
    e.created_at as read_at
  from extraction e join posting p on p.id = e.posting_id and p.content_hash = e.content_hash
  where e.prompt_version = 'v1' and e.requested = 'opus'
  order by e.posting_id, e.created_at desc
), lang as (
  select distinct on (l.posting_id) l.posting_id, l.languages, l.quote, l.written_in, l.created_at as read_at
  from language_check l join posting p on p.id = l.posting_id and p.content_hash = l.content_hash
  where l.prompt_version = 'languages-v2' and l.requested = 'sonnet'
  order by l.posting_id, l.created_at desc
), review as (
  select r.*, r.verdict = 'listed'
    and exists (select 1 from register_entry x where x.register = r.register and x.name = r.entry_name) as listed
  from register_review r
), blue as (
  select amount from visa_rule
  where country = 'DE' and rule = 'blue_card_reduced' and applies_from <= current_date
  order by applies_from desc limit 1
), role as (
  select p.id, p.company_id, p.countries, p.last_seen_at,
    fact.visa as said, fact.visa_quote, fact.relocation, fact.relocation_quote, fact.read_at,
    lang.languages, lang.quote as language_quote, lang.written_in, lang.read_at as languages_read_at,
    uk.verdict as uk_verdict, uk.entry_name as uk_entry, uk.reviewed_at as uk_reviewed_at,
    nl.verdict as nl_verdict, nl.entry_name as nl_entry, nl.reviewed_at as nl_reviewed_at,
    'GB' = any(p.countries) and coalesce(uk.listed, false) as can_uk,
    'NL' = any(p.countries) and coalesce(nl.listed, false) as can_nl,
    'DE' = any(p.countries) and p.pay ->> 'currency' = 'EUR'
      and case p.pay ->> 'period'
        when 'year' then (p.pay ->> 'min')::numeric
        when 'month' then (p.pay ->> 'min')::numeric * 12
      end >= (select amount from blue) as can_de,
    (select amount from blue) as blue_card_minimum
  from posting p
  left join fact on fact.posting_id = p.id
  left join lang on lang.posting_id = p.id
  left join review uk on uk.company_id = p.company_id and uk.register = 'uk_worker'
  left join review nl on nl.company_id = p.company_id and nl.register = 'nl_ind'
)
select role.id as posting_id, role.company_id,
  case role.said
    when 'offers' then 'sponsors'
    when 'maybe' then 'may'
    when 'refuses' then 'wont'
    else case when role.can_uk or role.can_nl or coalesce(role.can_de, false) then 'can' else 'unknown' end
  end as visa,
  -- strongest first, as search sorts by default
  case role.said
    when 'offers' then 1
    when 'maybe' then 2
    when 'refuses' then 5
    else case when role.can_uk or role.can_nl or coalesce(role.can_de, false) then 3 else 4 end
  end as visa_rank,
  role.visa_quote, role.read_at,
  role.can_uk, role.can_nl, coalesce(role.can_de, false) as can_de, role.blue_card_minimum,
  role.uk_verdict, role.uk_entry, role.uk_reviewed_at, role.nl_verdict, role.nl_entry, role.nl_reviewed_at,
  case role.relocation when 'offers' then 'helps' when 'maybe' then 'may' when 'refuses' then 'no' else 'silent' end
    as relocation,
  role.relocation_quote,
  role.languages, role.language_quote, role.written_in, role.languages_read_at
from role;
