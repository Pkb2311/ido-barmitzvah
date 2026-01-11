-- Fix schema so the app routes work reliably

-- 1) posts table expected columns
alter table if exists public.posts
  add column if not exists approved boolean not null default true;

alter table if exists public.posts
  add column if not exists owner_token text;

alter table if exists public.posts
  add column if not exists editable_until timestamptz;

-- 2) site_settings key/value table
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- default settings
insert into public.site_settings(key, value)
values (
  'site',
  jsonb_build_object(
    'require_approval', true,
    'ui', jsonb_build_object(
      'theme', jsonb_build_object(
        'send_color', '#2ecc71',
        'default_color', '#ff9500',
        'danger_color', '#ff3b30',
        'bg', '#0b1020',
        'card_bg', 'rgba(255,255,255,0.04)'
      ),
      'buttons', jsonb_build_object(
        'upload', jsonb_build_object('show', true, 'label', 'העלאת תמונה/וידאו', 'color', 'default'),
        'camera', jsonb_build_object('show', true, 'label', '📸 צילום תמונה', 'color', 'default'),
        'link',   jsonb_build_object('show', true, 'label', '🔗 צרף קישור', 'color', 'default'),
        'remove', jsonb_build_object('show', true, 'label', 'הסר קובץ', 'color', 'danger'),
        'refresh',jsonb_build_object('show', true, 'label', 'רענון', 'color', 'default')
      )
    )
  )
)
on conflict (key) do nothing;

-- optional: keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
before update on public.site_settings
for each row execute procedure public.set_updated_at();
