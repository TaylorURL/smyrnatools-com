-- Tracks per-user "pinned" / "muted" conversation flags so the Messages
-- center can promote favourite threads to the top of the sidebar and
-- suppress notification badges on noisy ones.
--
-- One row per (user, other_user) pair — flags coexist on the same row so
-- the Messages center can fetch both with a single query. RLS is allow-all
-- per the project's custom-session auth model (CLAUDE.md); access control
-- runs in the edge function layer.

create
extension if not exists "pgcrypto";

create table if not exists public.users_pinned_conversations
(
    id
    uuid
    primary
    key
    default
    gen_random_uuid
(
),
    user_id uuid not null,
    other_user_id uuid not null,
    pinned boolean not null default false,
    muted boolean not null default false,
    created_at timestamptz not null default now
(
),
    updated_at timestamptz not null default now
(
),
    unique
(
    user_id,
    other_user_id
)
    );

create index if not exists idx_users_pinned_conversations_user_id
    on public.users_pinned_conversations (user_id);

create index if not exists idx_users_pinned_conversations_pinned
    on public.users_pinned_conversations (user_id)
    where pinned = true;

create index if not exists idx_users_pinned_conversations_muted
    on public.users_pinned_conversations (user_id)
    where muted = true;

alter table public.users_pinned_conversations enable row level security;

drop
policy if exists "users_pinned_conversations_all" on public.users_pinned_conversations;
create
policy "users_pinned_conversations_all"
    on public.users_pinned_conversations
    for all
    using (true)
    with check (true);

-- Touch updated_at on every flag change so the client can drive a "last
-- updated" hint inside the conversation context rail without an extra
-- column on every read.
create
or replace function public.touch_users_pinned_conversations_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at
:= now();
return new;
end;
$$;

drop trigger if exists trg_users_pinned_conversations_updated_at on public.users_pinned_conversations;
create trigger trg_users_pinned_conversations_updated_at
    before update
    on public.users_pinned_conversations
    for each row
    execute function public.touch_users_pinned_conversations_updated_at();
