begin;

create schema if not exists identity;
create schema if not exists platform;
create schema if not exists learning;
create schema if not exists operations;
create schema if not exists content;

create table if not exists identity.users (
  id bigserial primary key,
  username text not null unique,
  username_key text not null unique,
  display_name text not null,
  password_hash text not null,
  status text not null default 'active' check (status in ('active', 'disabled', 'archived')),
  primary_domain_key text not null default 'core_operator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists identity.sessions (
  token text primary key,
  user_id bigint not null references identity.users(id) on delete cascade,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_identity_sessions_user_id on identity.sessions(user_id);
create index if not exists idx_identity_sessions_expires_at on identity.sessions(expires_at);

create table if not exists platform.domains (
  key text primary key,
  label text not null,
  description text not null,
  theme_key text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists platform.capabilities (
  key text primary key,
  label text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists platform.domain_capabilities (
  domain_key text not null references platform.domains(key) on delete cascade,
  capability_key text not null references platform.capabilities(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (domain_key, capability_key)
);

create table if not exists platform.user_domain_memberships (
  id bigserial primary key,
  user_id bigint not null references identity.users(id) on delete cascade,
  domain_key text not null references platform.domains(key) on delete cascade,
  membership_status text not null default 'active' check (membership_status in ('active', 'inactive', 'invited')),
  proficiency_level text not null default 'foundation' check (proficiency_level in ('foundation', 'intermediate', 'advanced', 'expert')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, domain_key)
);

create index if not exists idx_platform_user_domain_memberships_user_id
  on platform.user_domain_memberships(user_id);

create table if not exists platform.user_capabilities (
  id bigserial primary key,
  user_id bigint not null references identity.users(id) on delete cascade,
  capability_key text not null references platform.capabilities(key) on delete cascade,
  source text not null default 'domain_membership',
  created_at timestamptz not null default now(),
  unique (user_id, capability_key)
);

create table if not exists platform.user_preferences (
  user_id bigint primary key references identity.users(id) on delete cascade,
  preferred_domain_key text references platform.domains(key) on delete set null,
  dashboard_density text not null default 'comfortable' check (dashboard_density in ('comfortable', 'compact')),
  locale text not null default 'tr-TR',
  timezone text not null default 'Europe/Istanbul',
  preferences_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists content.profile_specialties (
  id bigserial primary key,
  user_id bigint not null references identity.users(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists content.profile_tools (
  id bigserial primary key,
  user_id bigint not null references identity.users(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists content.portfolio_profiles (
  user_id bigint primary key references identity.users(id) on delete cascade,
  headline text not null default '',
  bio text not null default '',
  location text not null default '',
  website text not null default '',
  avatar_asset_path text,
  updated_at timestamptz not null default now()
);

create table if not exists content.portfolio_certifications (
  id bigserial primary key,
  user_id bigint not null references identity.users(id) on delete cascade,
  title text not null,
  issuer text not null default '',
  credential_id text,
  verification_url text,
  status text not null default 'active' check (status in ('active', 'planned', 'expired', 'archived')),
  issued_at date,
  expires_at date,
  asset_path text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content.portfolio_education (
  id bigserial primary key,
  user_id bigint not null references identity.users(id) on delete cascade,
  title text not null,
  institution text not null default '',
  track text not null default '',
  status text not null default 'active' check (status in ('active', 'completed', 'planned', 'archived')),
  started_at date,
  ended_at date,
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists learning.tracks (
  id bigserial primary key,
  domain_key text not null references platform.domains(key) on delete cascade,
  slug text not null unique,
  title text not null,
  summary text not null default '',
  difficulty text not null default 'foundation' check (difficulty in ('foundation', 'intermediate', 'advanced', 'expert')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists learning.modules (
  id bigserial primary key,
  track_id bigint not null references learning.tracks(id) on delete cascade,
  slug text not null,
  title text not null,
  summary text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (track_id, slug)
);

create table if not exists learning.lessons (
  id bigserial primary key,
  module_id bigint not null references learning.modules(id) on delete cascade,
  slug text not null,
  title text not null,
  mission_json jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (module_id, slug)
);

create table if not exists learning.lesson_progress (
  id bigserial primary key,
  user_id bigint not null references identity.users(id) on delete cascade,
  lesson_id bigint not null references learning.lessons(id) on delete cascade,
  status text not null default 'locked' check (status in ('locked', 'active', 'completed', 'archived')),
  score numeric(5,2),
  hint_count integer not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists operations.telemetry_events (
  id bigserial primary key,
  external_key text unique,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  attack_type text not null,
  protocol text,
  target_port integer,
  source_ip inet,
  source_country text not null default '',
  node_label text not null default '',
  region_label text not null default '',
  event_status text not null default 'active' check (event_status in ('active', 'contained', 'dismissed', 'promoted')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_operations_telemetry_events_occurred_at
  on operations.telemetry_events(occurred_at desc);

create index if not exists idx_operations_telemetry_events_severity
  on operations.telemetry_events(severity);

create table if not exists operations.incidents (
  id bigserial primary key,
  incident_key text not null unique,
  source_event_id bigint references operations.telemetry_events(id) on delete set null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  summary text not null default '',
  status text not null default 'open' check (status in ('open', 'investigating', 'contained', 'dismissed', 'archived')),
  created_by_user_id bigint references identity.users(id) on delete set null,
  assigned_user_id bigint references identity.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists operations.reports (
  id bigserial primary key,
  report_key text unique,
  source_event_id bigint references operations.telemetry_events(id) on delete set null,
  source_incident_id bigint references operations.incidents(id) on delete set null,
  created_by_user_id bigint not null references identity.users(id) on delete cascade,
  title text not null,
  content text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'active' check (status in ('active', 'archived')),
  tags_json jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_operations_reports_status on operations.reports(status);
create index if not exists idx_operations_reports_created_by_user_id on operations.reports(created_by_user_id);
create index if not exists idx_operations_reports_created_at on operations.reports(created_at desc);

create table if not exists operations.report_actions (
  id bigserial primary key,
  report_id bigint not null references operations.reports(id) on delete cascade,
  actor_user_id bigint references identity.users(id) on delete set null,
  action text not null check (action in ('create', 'archive')),
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into platform.domains (key, label, description, theme_key)
values
  ('core_operator', 'Core Operator', 'Kimlik, onboarding ve ortak operator omurgası.', 'matrix-green'),
  ('blue_team', 'Blue Team', 'SOC, telemetry, incident response ve savunma operasyonları.', 'blue-cyan'),
  ('red_team', 'Red Team', 'Adversary simulation, recon ve saldırı zinciri çalışma alanı.', 'ember-red'),
  ('threat_research', 'Threat Research', 'Threat intel, reverse engineering ve ileri araştırma alanı.', 'obsidian-violet'),
  ('white_team', 'White Team', 'Audit, governance ve secure architecture alanı.', 'silver-gold')
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description,
  theme_key = excluded.theme_key;

insert into platform.capabilities (key, label, description)
values
  ('view_dashboard', 'Dashboard Görüntüleme', 'Operasyon dashboard yüzeylerine erişim.'),
  ('manage_reports', 'Rapor Yönetimi', 'Rapor oluşturma ve arşivleme yetkisi.'),
  ('manage_incidents', 'Vaka Yönetimi', 'Incident ve case akışlarını yönetme yetkisi.'),
  ('access_training', 'Eğitim Erişimi', 'Track, modül ve lesson içeriklerine erişim.'),
  ('manage_profile', 'Profil Yönetimi', 'Profil, sertifika ve eğitim kayıtlarını yönetme yetkisi.'),
  ('access_research', 'Araştırma Erişimi', 'Threat research ve reverse engineering yüzeylerine erişim.')
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description;

insert into platform.domain_capabilities (domain_key, capability_key)
values
  ('core_operator', 'manage_profile'),
  ('core_operator', 'access_training'),
  ('blue_team', 'view_dashboard'),
  ('blue_team', 'manage_reports'),
  ('blue_team', 'manage_incidents'),
  ('red_team', 'access_training'),
  ('red_team', 'view_dashboard'),
  ('threat_research', 'access_research'),
  ('threat_research', 'manage_reports'),
  ('white_team', 'manage_reports')
on conflict (domain_key, capability_key) do nothing;

commit;
