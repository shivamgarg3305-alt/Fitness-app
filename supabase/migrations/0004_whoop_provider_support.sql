-- Phase 3: allow WHOOP to be represented in the existing connection registry.
-- OAuth tokens are deliberately NOT stored in wearable_connections; provider tokens
-- must be handled by a server-side integration with encrypted token storage.
alter table public.wearable_connections
  drop constraint if exists wearable_connections_provider_check;

alter table public.wearable_connections
  add constraint wearable_connections_provider_check
  check (provider in (
    'healthkit',
    'health_connect',
    'apple_watch',
    'whoop',
    'fitbit',
    'garmin'
  ));

comment on table public.wearable_connections is
  'Per-user provider connection status only. Never store provider access or refresh tokens in this table.';
