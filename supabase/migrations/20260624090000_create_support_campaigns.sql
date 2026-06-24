-- Community support campaigns for I ❤️ NDB.
-- Phase 1 launches five official verified campaigns only.

create table if not exists public.support_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  emoji text not null default '🤝',
  title text not null,
  description text not null,
  long_description text not null default '',
  goal_amount numeric(12,2) not null default 0 check (goal_amount >= 0),
  raised_amount numeric(12,2) not null default 0 check (raised_amount >= 0),
  contributors_count integer not null default 0 check (contributors_count >= 0),
  volunteers_count integer not null default 0 check (volunteers_count >= 0),
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  organizer text not null default 'I ❤️ NDB',
  verified boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  last_update_at timestamptz not null default now(),
  material_needs text[] not null default '{}',
  impact_points text[] not null default '{}',
  final_report text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_campaign_updates (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.support_campaigns(id) on delete cascade,
  title text not null,
  body text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.support_campaign_photos (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.support_campaigns(id) on delete cascade,
  image_url text not null,
  storage_path text,
  caption text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.support_contributions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.support_campaigns(id) on delete cascade,
  contributor_id uuid references public.profiles(id) on delete set null,
  contribution_type text not null check (contribution_type in ('money', 'volunteer', 'materials')),
  amount numeric(12,2) check (amount is null or amount > 0),
  material_description text,
  volunteer_message text,
  status text not null default 'pledged' check (status in ('pledged', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_support_campaigns_status_sort
  on public.support_campaigns(status, sort_order);

create index if not exists idx_support_updates_campaign_created
  on public.support_campaign_updates(campaign_id, created_at desc);

create index if not exists idx_support_photos_campaign_created
  on public.support_campaign_photos(campaign_id, created_at desc);

create index if not exists idx_support_contributions_campaign_created
  on public.support_contributions(campaign_id, created_at desc);

alter table public.support_campaigns enable row level security;
alter table public.support_campaign_updates enable row level security;
alter table public.support_campaign_photos enable row level security;
alter table public.support_contributions enable row level security;

drop policy if exists "support_campaigns_public_read" on public.support_campaigns;
create policy "support_campaigns_public_read"
  on public.support_campaigns for select
  to anon, authenticated
  using (true);

drop policy if exists "support_updates_public_read" on public.support_campaign_updates;
create policy "support_updates_public_read"
  on public.support_campaign_updates for select
  to anon, authenticated
  using (true);

drop policy if exists "support_photos_public_read" on public.support_campaign_photos;
create policy "support_photos_public_read"
  on public.support_campaign_photos for select
  to anon, authenticated
  using (true);

drop policy if exists "support_contributions_insert_authenticated" on public.support_contributions;
create policy "support_contributions_insert_authenticated"
  on public.support_contributions for insert
  to authenticated
  with check (contributor_id = auth.uid());

drop policy if exists "support_contributions_select_own_or_admin" on public.support_contributions;
create policy "support_contributions_select_own_or_admin"
  on public.support_contributions for select
  to authenticated
  using (
    contributor_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "support_campaigns_admin_all" on public.support_campaigns;
create policy "support_campaigns_admin_all"
  on public.support_campaigns for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "support_updates_admin_all" on public.support_campaign_updates;
create policy "support_updates_admin_all"
  on public.support_campaign_updates for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "support_photos_admin_all" on public.support_campaign_photos;
create policy "support_photos_admin_all"
  on public.support_campaign_photos for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into public.support_campaigns (
  slug, emoji, title, description, long_description, goal_amount, raised_amount,
  contributors_count, volunteers_count, status, organizer, verified,
  starts_at, ends_at, last_update_at, material_needs, impact_points, sort_order
) values
  ('water', '💧', 'السقاية', 'كل قطرة تصنع فرقاً', 'حملة موثقة لتوفير الماء للأسر والنقاط المجتمعية التي تحتاج إلى دعم عاجل في نواذيبو.', 50000, 37500, 125, 18, 'active', 'I ❤️ NDB', true, '2026-06-01', '2026-07-31', now(), array['قنينات ماء','خزانات صغيرة','وسائل نقل'], array['12 نقطة ماء مدعومة','45 أسرة استفادت','3 أحياء تمت تغطيتها'], 1),
  ('education', '🎒', 'دعم التعليم', 'استثمر في مستقبل أبنائنا', 'مبادرة لتوفير الحقائب والدفاتر واللوازم المدرسية للتلاميذ الأكثر احتياجاً.', 80000, 46200, 98, 24, 'active', 'I ❤️ NDB', true, '2026-06-05', '2026-08-20', now(), array['دفاتر','حقائب','أقلام','كتب'], array['100 حقيبة مدرسية قيد التجهيز','40 تلميذاً استفادوا من الدفعة الأولى'], 2),
  ('families', '🍲', 'دعم الأسر', 'يداً بيد لدعم الأسر الأكثر احتياجاً', 'حملة لتجميع مساهمات مالية ومواد غذائية وملابس للأسر التي تحتاج إلى سند مجتمعي.', 65000, 28100, 76, 15, 'active', 'I ❤️ NDB', true, '2026-06-10', '2026-08-05', now(), array['مواد غذائية','ملابس','بطانيات','حليب أطفال'], array['50 أسرة ضمن قائمة التوزيع','20 سلة غذائية جاهزة'], 3),
  ('clean-nouadhibou', '🧹', 'نظافة نواذيبو', 'مدينة أجمل تبدأ من أحيائنا', 'تنسيق حملات تطوعية ومستلزمات تنظيف لتحسين الفضاءات العامة والأحياء.', 40000, 19000, 61, 42, 'active', 'I ❤️ NDB', true, '2026-06-12', '2026-07-25', now(), array['أكياس نظافة','قفازات','مجارف','دهانات'], array['3 أحياء محددة للتدخل','42 متطوعاً مسجلاً'], 4),
  ('health', '🏥', 'العلاج والصحة', 'المساعدة في الوصول إلى العلاج والرعاية', 'دعم الحالات الصحية المجتمعية بتنسيق موثق وشفاف مع متابعة التحديثات والأثر.', 120000, 52500, 87, 9, 'active', 'I ❤️ NDB', true, '2026-06-15', '2026-09-01', now(), array['أدوية','مستلزمات إسعاف','نقل للحالات','مرافقة تطوعية'], array['7 حالات قيد المتابعة','مستلزمات إسعاف أولية مطلوبة'], 5)
on conflict (slug) do update set
  emoji = excluded.emoji,
  title = excluded.title,
  description = excluded.description,
  long_description = excluded.long_description,
  goal_amount = excluded.goal_amount,
  material_needs = excluded.material_needs,
  impact_points = excluded.impact_points,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.support_campaign_updates (campaign_id, title, body)
select c.id, update_row.title, update_row.body
from public.support_campaigns c
join (values
  ('education', 'تحديث رقم 1', 'تم شراء 100 دفتر.'),
  ('education', 'تحديث رقم 2', 'تم توزيع المستلزمات على 40 تلميذاً.'),
  ('clean-nouadhibou', 'تحديث رقم 1', 'تم تحديد أول ثلاث نقاط تدخل مع المتطوعين.')
) as update_row(slug, title, body) on update_row.slug = c.slug
where not exists (
  select 1 from public.support_campaign_updates existing
  where existing.campaign_id = c.id
    and existing.title = update_row.title
);
