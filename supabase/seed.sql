-- ============================================================
-- CATEGORIES
-- ============================================================
insert into public.categories (slug, name_en, name_fr, name_ar, icon, color)
values
  ('local-news',    'Local News',    'Actualités Locales',    'أخبار محلية',    'newspaper',    '#3B82F6'),
  ('history',       'History',       'Histoire',              'تاريخ',           'history',      '#8B5CF6'),
  ('education',     'Education',     'Éducation',             'تعليم',           'graduation-cap', '#10B981'),
  ('health',        'Health',        'Santé',                 'صحة',             'heart-pulse',  '#EF4444'),
  ('environment',   'Environment',   'Environnement',         'بيئة',            'leaf',         '#22C55E'),
  ('fishing',       'Fishing',       'Pêche',                 'صيد السمك',       'fish',         '#0EA5E9'),
  ('port',          'Port',          'Port',                  'ميناء',           'anchor',       '#F59E0B'),
  ('railway',       'Railway',       'Chemin de Fer',         'سكة حديد',        'train',        '#6366F1'),
  ('sports',        'Sports',        'Sports',                'رياضة',           'trophy',       '#F97316'),
  ('culture',       'Culture',       'Culture',               'ثقافة',           'palette',      '#EC4899'),
  ('jobs',          'Jobs',          'Emplois',               'وظائف',           'briefcase',    '#6B7280'),
  ('youth',         'Youth',         'Jeunesse',              'شباب',            'sparkles',     '#14B8A6'),
  ('diaspora',      'Diaspora',      'Diaspora',              'مغتربون',         'globe',        '#7C3AED'),
  ('events',        'Events',        'Événements',            'فعاليات',         'calendar',     '#E11D48')
on conflict (slug) do update set
  name_en = excluded.name_en,
  name_fr = excluded.name_fr,
  name_ar = excluded.name_ar,
  icon = excluded.icon,
  color = excluded.color;

-- ============================================================
-- DEMO POSTS (tied to categories, no author initially)
-- ============================================================
insert into public.posts (title, content, category_id, type, status)
values
  (
    'Beach cleanup campaign',
    'Volunteers organized a cleanup around the public beach this weekend. Let us schedule monthly cleanups and add school participation.',
    (select id from public.categories where slug = 'environment'),
    'community', 'published'
  ),
  (
    'Youth AI workshop',
    'A youth coding workshop introduced AI basics and practical tools for students. We need mentors and donated laptops.',
    (select id from public.categories where slug = 'youth'),
    'community', 'published'
  ),
  (
    'Fishing port update',
    'Local fishers shared safety and logistics concerns. A community feedback session is proposed to prioritize improvements.',
    (select id from public.categories where slug = 'fishing'),
    'community', 'published'
  ),
  (
    'Historical railway photo',
    'Residents shared a restored photo from the railway station era and asked for a public memory exhibit.',
    (select id from public.categories where slug = 'railway'),
    'community', 'published'
  ),
  (
    'Community library idea',
    'Families requested a shared reading space near schools. Let us map spaces and partners to launch a pilot library.',
    (select id from public.categories where slug = 'education'),
    'community', 'published'
  );

-- ============================================================
-- DEMO MEMORIES
-- ============================================================
insert into public.memories (title, description, decade, year, location, verification_status, tags)
values
  (
    'Old Railway Station',
    'A gathering place where families welcomed arrivals from the interior. For decades, the railway station served as a social heart.',
    '1970s', 1978, 'Nouadhibou Railway District', 'approved',
    array['railway', 'station', '1970s']
  ),
  (
    'Fishing Port in the 1980s',
    'The port was full of life before sunrise. Nets, ice, and teamwork powered daily livelihoods, creating shared routines across neighborhoods.',
    '1980s', 1984, 'Port Artisanal', 'approved',
    array['fishing', 'port', '1980s']
  ),
  (
    'School Memories',
    'Students remember teachers who emphasized discipline, service, and hope. Many community leaders still credit those lessons.',
    '1990s', 1992, 'Central Nouadhibou', 'approved',
    array['education', 'school', '1990s']
  ),
  (
    'Old Market Photos',
    'Vendors and families turned the market into a social map of the city. These photos preserve faces, rhythms, and small acts of trust.',
    '1990s', 1999, 'Old Market', 'approved',
    array['market', 'culture', '1990s']
  ),
  (
    'Cansado Neighborhood Stories',
    'Residents recall the early days of Cansado, the sense of community, and the small shops that brought everyone together.',
    '1980s', 1985, 'Cansado', 'approved',
    array['neighborhood', 'community', '1980s']
  );

-- ============================================================
-- DEMO IDEAS
-- ============================================================
insert into public.ideas (title, description, status, category_id)
values
  (
    'Public Library and Study Hub',
    'Create a community reading space with internet access, mentorship hours, and volunteer-led tutoring for students of all ages.',
    'submitted',
    (select id from public.categories where slug = 'education')
  ),
  (
    'Monthly Beach Cleanup Program',
    'Coordinate schools, youth clubs, and local businesses for recurring cleanup actions with clearly assigned zones and schedules.',
    'under_review',
    (select id from public.categories where slug = 'environment')
  ),
  (
    'Youth Coding Club',
    'Weekly coding sessions focused on practical problem solving, civic app development, and digital literacy for teenagers.',
    'accepted',
    (select id from public.categories where slug = 'youth')
  ),
  (
    'Community Historical Archive Campaign',
    'Collect oral histories, photographs and documents to build a shared digital city archive accessible to future generations.',
    'in_progress',
    (select id from public.categories where slug = 'history')
  ),
  (
    'Diaspora Mentorship Network',
    'Connect Nouadhibou professionals abroad with local youth for career guidance, skill-sharing, and remote volunteering opportunities.',
    'submitted',
    (select id from public.categories where slug = 'diaspora')
  );
