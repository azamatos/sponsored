-- One row per board. The first sweep (2026-10-22) found three ways the same board got two rows:
-- SmartRecruiters slugs are case-insensitive (Devoteam and devoteam), Personio serves every board on both
-- jobs.personio.de and jobs.personio.com, and Greenhouse's EU-hosted boards are read through the same API as the
-- others. The eu flag now means something for Lever only.

create temporary table duplicate on commit drop as
select id from (
  select id, row_number() over (
    partition by ats, lower(slug), case when ats = 'lever' then eu else false end
    order by (origin = 'seed') desc, (status = 'active') desc, eu, id
  ) n
  from company
) c where n > 1;

delete from source_result where company_id in (select id from duplicate);
delete from company_register where company_id in (select id from duplicate);
delete from posting where company_id in (select id from duplicate);
delete from company where id in (select id from duplicate);

update company set slug = lower(slug), eu = case when ats = 'lever' then eu else false end
where slug <> lower(slug) or (eu and ats <> 'lever');
