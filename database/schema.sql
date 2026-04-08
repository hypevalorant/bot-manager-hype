-- PostgreSQL schema inicial para o Bot Manager SaaS

create extension if not exists "pgcrypto";

create table customers (
  id uuid primary key default gen_random_uuid(),
  discord_user_id text not null unique,
  discord_username text,
  email text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  source_slug text not null,
  runtime_type text not null default 'docker',
  app_pool_key text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  code text not null,
  billing_interval text not null check (billing_interval in ('weekly', 'monthly')),
  interval_count integer not null default 1,
  price_cents integer not null,
  currency text not null default 'BRL',
  grace_days integer not null default 3,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, code)
);

create table discord_apps (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  app_pool_key text not null,
  discord_application_id text not null unique,
  discord_bot_user_id text unique,
  app_name text not null,
  client_id text not null,
  client_secret_encrypted text not null,
  bot_token_encrypted text not null,
  team_id text,
  public_key text,
  pool_status text not null default 'available'
    check (pool_status in ('available', 'allocated', 'disabled', 'recycling', 'quarantine')),
  last_rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  plan_id uuid not null references plans(id) on delete restrict,
  status text not null
    check (status in ('pending', 'active', 'past_due', 'grace', 'suspended', 'cancelled', 'expired', 'deleted')),
  commercial_owner_discord_user_id text not null,
  started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_customer_id_idx on subscriptions(customer_id);
create index subscriptions_status_idx on subscriptions(status);
create index subscriptions_period_end_idx on subscriptions(current_period_end);

create table bot_instances (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null unique references subscriptions(id) on delete cascade,
  discord_app_id uuid not null references discord_apps(id) on delete restrict,
  source_slug text not null,
  source_version text not null,
  hosting_provider text not null default 'squarecloud',
  hosting_account_id text,
  hosting_app_id text,
  runtime_node text,
  container_id text,
  install_url text,
  assigned_guild_id text,
  status text not null
    check (status in ('provisioning', 'running', 'stopped', 'suspended', 'expired', 'deleted', 'failed')),
  health_status text not null default 'unknown'
    check (health_status in ('unknown', 'healthy', 'degraded', 'unhealthy')),
  last_heartbeat_at timestamptz,
  expires_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bot_instances_status_idx on bot_instances(status);
create index bot_instances_expires_at_idx on bot_instances(expires_at);

create table bot_instance_config (
  id uuid primary key default gen_random_uuid(),
  bot_instance_id uuid not null references bot_instances(id) on delete cascade,
  config_version integer not null default 1,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  provider text not null,
  product_slug text not null,
  plan_code text not null,
  payment_url text,
  pix_code text,
  qr_code_image text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  checkout_session_id uuid references checkout_sessions(id) on delete set null,
  provider text not null,
  provider_payment_id text not null,
  provider_status text not null,
  purpose text not null default 'activation'
    check (purpose in ('activation', 'renewal')),
  amount_cents integer not null,
  currency text not null default 'BRL',
  raw_payload jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  payment_id uuid references payments(id) on delete set null,
  status text not null
    check (status in ('open', 'paid', 'failed', 'cancelled', 'refunded')),
  due_at timestamptz not null,
  amount_cents integer not null,
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table install_sessions (
  id uuid primary key default gen_random_uuid(),
  bot_instance_id uuid not null references bot_instances(id) on delete cascade,
  oauth_state text not null unique,
  invite_url text not null,
  status text not null default 'created'
    check (status in ('created', 'consumed', 'expired')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table notification_jobs (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  channel text not null check (channel in ('discord_dm', 'discord_channel', 'email', 'webhook')),
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table instance_events (
  id uuid primary key default gen_random_uuid(),
  bot_instance_id uuid not null references bot_instances(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index instance_events_bot_instance_id_idx on instance_events(bot_instance_id);
create index instance_events_event_type_idx on instance_events(event_type);

create table if not exists manager_state_snapshots (
  snapshot_key text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
