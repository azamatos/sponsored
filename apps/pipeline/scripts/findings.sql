-- The numbers behind docs/findings.md. Run against the pipeline's database:
--   psql "$DATABASE_URL" -f apps/pipeline/scripts/findings.sql
\pset pager off
\echo '== boards'
select origin, status, count(*) from company group by 1, 2 order by 1, 2;
select ats, count(*) filter (where status='active') active, count(*) filter (where status='idle') idle,
  count(*) filter (where status='gone') gone, count(*) filter (where status not in ('active','idle','gone')) other,
  count(*) total, sum(total_jobs) filter (where status in ('active','idle')) all_jobs, sum(kept_jobs) kept
from company group by ats order by kept desc nulls last;
\echo '== roles'
select count(*) roles, count(distinct company_id) companies from posting where closed_at is null;
select family, count(*) from posting where closed_at is null group by 1 order by 2 desc;
select seniority, count(*) from posting where closed_at is null group by 1 order by 2 desc;
select work_mode, remote_scope, count(*) from posting where closed_at is null group by 1, 2 order by 3 desc;
\echo '== by country'
with p as (select unnest(case when cardinality(countries)=0 then array[remote_scope] else countries end) c, * from posting where closed_at is null)
select c, count(*) roles, count(distinct company_id) cos,
  round(100.0*count(*) filter (where signals->>'visa'='offers')/count(*)) offers_pct,
  round(100.0*count(*) filter (where signals->>'visa'='refuses')/count(*)) refuses_pct,
  round(100.0*count(*) filter (where jsonb_array_length(signals->'languages')>0)/count(*)) lang_req_pct,
  round(100.0*count(*) filter (where (signals->>'germanText')::boolean)/count(*)) german_text_pct,
  round(100.0*count(*) filter (where pay is not null)/count(*)) salary_pct
from p group by c order by roles desc limit 25;
\echo '== salary by board'
select c.ats, count(*), round(100.0*count(*) filter (where p.pay is not null)/count(*)) salary_pct,
  round(100.0*count(*) filter (where p.description is null or length(p.description) < 200)/count(*)) no_text_pct
from posting p join company c on c.id=p.company_id where p.closed_at is null group by 1 order by 2 desc;
\echo '== germany blue card'
select count(*) de_yearly_eur, count(*) filter (where (pay->>'min')::numeric >= 45934.2) min_clears_it,
  count(*) filter (where (pay->>'max')::numeric < 45934.2) max_below_it,
  round(percentile_cont(0.5) within group (order by (pay->>'min')::numeric)) median_min
from posting where closed_at is null and 'DE'=any(countries) and pay->>'currency'='EUR' and pay->>'period'='year';
\echo '== boilerplate: visa quotes repeated within a company'
with q as (select company_id, signals->'visaQuotes'->>0 quote from posting where closed_at is null and signals->>'visa'='offers')
select count(*) offers_roles, count(*) filter (where n >= 3) in_repeated_sentence,
  round(100.0*count(*) filter (where n >= 3)/nullif(count(*),0)) pct
from (select company_id, quote, count(*) over (partition by company_id, quote) n from q) x;
\echo '== text size for the cost estimate'
select count(*) with_text, round(avg(length(description))) avg_chars,
  round(avg((select coalesce(sum(length(l)),0) from regexp_split_to_table(description, E'\n') l
    where l ~* '(visa|sponsor|relocat|permit|blue card|right to work|german|dutch|french|language|salary|compensation|€|£|remote|hybrid|on-?site|office|years)'))) avg_prefiltered_chars
from posting where closed_at is null and description is not null;
\echo '== freshness: roles posted per day, last 14 days (boards that send a date)'
select count(*) filter (where posted_at > now() - interval '7 days') / 7 per_day_last_7,
  count(*) filter (where posted_at > now() - interval '14 days') / 14 per_day_last_14,
  count(*) filter (where posted_at is null) no_date
from posting where closed_at is null;
\echo '== registers'
select register, count(*) from register_entry group by 1;
select x.country, count(*) roles,
  count(*) filter (where exists (select 1 from company_register r where r.company_id=p.company_id and r.register=x.register)) at_candidate_match,
  count(distinct p.company_id) cos,
  count(distinct p.company_id) filter (where exists (select 1 from company_register r where r.company_id=p.company_id and r.register=x.register)) cos_matched
from posting p join (values ('NL','nl_ind'),('GB','uk_worker')) x(country, register) on x.country=any(p.countries)
where p.closed_at is null group by 1;
\echo '== last run'
select id, kind, started_at, finished_at, stats from run order by id desc limit 3;
select c.ats, s.error, count(*) from source_result s join company c on c.id=s.company_id
where s.run_id=(select max(id) from run where kind='ingest') and not s.ok group by 1, 2 order by 3 desc limit 15;
\echo '== register matching v2 feasibility: does a posting name one of its candidate entities?'
select r.register, count(distinct r.company_id) candidate_companies,
  count(distinct r.company_id) filter (where exists (
    select 1 from posting p where p.company_id = r.company_id and p.closed_at is null
      and position(lower(r.entry_name) in lower(p.description)) > 0)) named_in_a_posting
from company_register r group by 1;
\echo '== concentration: roles held by the 25 and 100 companies with the most roles'
with r as (select x.country, p.company_id, count(*) n from posting p join (values ('NL'),('GB'),('DE')) x(country)
  on x.country = any(p.countries) where p.closed_at is null group by 1, 2),
s as (select country, n, row_number() over (partition by country order by n desc) rk, sum(n) over (partition by country) total from r)
select country, max(total) roles, sum(n) filter (where rk <= 25) top25, sum(n) filter (where rk <= 100) top100, count(*) companies
from s group by 1;
\echo '== postings that mention visas, relocation, permits or the right to work at all'
select count(*) roles,
  count(*) filter (where description ~* '(visa|sponsor|relocat|permit|blue card|right to work|authori[sz]ed to work|work authori[sz]ation|immigra|citizen|global mobility|kennismigrant|residence|aufenthalt|arbeitserlaubnis|umzug)') mentions
from posting where closed_at is null;
\echo '== germany blue card, general threshold'
select count(*) filter (where (pay->>'min')::numeric >= 50700) min_clears_general
from posting where closed_at is null and 'DE' = any(countries) and pay->>'currency' = 'EUR' and pay->>'period' = 'year';
\echo '== regex precision sample: label these by hand'
select setseed(0.42);
select 'offers', array_to_string(countries, ','), signals->'visaQuotes' from (select p.* from posting p join company c on c.id = p.company_id
  where c.origin = 'commoncrawl' and p.closed_at is null and p.signals->>'visa' = 'offers' order by random() limit 40) p;
select 'refuses', array_to_string(countries, ','), signals->'noVisaQuotes' from (select p.* from posting p join company c on c.id = p.company_id
  where c.origin = 'commoncrawl' and p.closed_at is null and p.signals->>'visa' = 'refuses' order by random() limit 30) p;
