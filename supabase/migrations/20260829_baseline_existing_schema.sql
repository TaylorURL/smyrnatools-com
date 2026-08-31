-- The schema as it actually stands, for the forty-two tables no migration in
-- this repository creates.
--
-- Every one of them was made in the dashboard or by a migration that was never
-- committed, which works exactly as well as a recorded schema until somebody
-- has to rebuild, review, or reason about it. Nine tables had a migration
-- behind them; these forty-two did not, so the tree described a fraction of
-- the database and gave no way to tell which fraction.
--
-- Generated from the live catalogue of project hzudmeptzciqukwlroos on
-- 2026-08-29 -- pg_attribute for the columns and defaults, pg_constraint for
-- the keys and checks, pg_index for the rest of the indexes. It is a record of
-- what is there rather than a change to it: every statement is `if not exists`
-- or guarded, so running it against the live database is a no-op, and running
-- it against an empty one reproduces the schema.
--
-- Two things to know before using it to rebuild:
--
--   Foreign keys here point at public.users and public.plants, which are among
--   the nine tables created by earlier migrations rather than by this file.
--   Those two have to exist first.
--
--   users_tutorials carries an `id uuid not null default gen_random_uuid()`
--   column and no primary key -- only a unique constraint on
--   (user_id, tutorial_id). That is reproduced as found, not corrected; a
--   schema record that silently improves on the schema is not a record.
--
-- Row-level security is enabled on every table below, matching the live
-- instance. The policies themselves are not reproduced here: they are the
-- subject of 20260827_close_crm_public_read.sql,
-- 20260827_close_public_execute_on_message_functions.sql and
-- 20260829_drop_blanket_public_policies.sql, and duplicating them in a
-- baseline would put two records of one thing in the tree.

create table if not exists public.app_install_prompts (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null,
    prompt_type text not null,
    action text not null,
    device_type text,
    reminded_at timestamp with time zone,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    constraint app_install_prompts_action_check CHECK ((action = ANY (ARRAY['dismissed_forever'::text, 'remind_later'::text, 'installed'::text]))),
    constraint app_install_prompts_device_type_check CHECK ((device_type = ANY (ARRAY['ios'::text, 'android'::text, 'desktop'::text]))),
    constraint app_install_prompts_prompt_type_check CHECK ((prompt_type = ANY (ARRAY['mobile_install'::text, 'desktop_tutorial'::text]))),
    constraint app_install_prompts_pkey PRIMARY KEY (id),
    constraint app_install_prompts_user_id_prompt_type_key UNIQUE (user_id, prompt_type)
);
alter table public.app_install_prompts enable row level security;

create table if not exists public.client_errors (
    id bigint not null,
    created_at timestamp with time zone default now(),
    user_id text,
    level text not null default 'error'::text,
    message text not null,
    url text,
    metadata jsonb default '{}'::jsonb,
    constraint client_errors_pkey PRIMARY KEY (id)
);
alter table public.client_errors enable row level security;

create table if not exists public.documents (
    id uuid not null default gen_random_uuid(),
    name text not null,
    file_path text not null,
    file_type text not null,
    file_size bigint not null default 0,
    uploaded_by uuid,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    constraint documents_pkey PRIMARY KEY (id)
);
alter table public.documents enable row level security;

create table if not exists public.heavy_equipment (
    id uuid not null default gen_random_uuid(),
    identifying_number text not null,
    assigned_plant text not null,
    equipment_type text not null,
    status text not null,
    last_service_date timestamp with time zone,
    year_made integer,
    equipment_make text,
    equipment_model text,
    hours_mileage numeric,
    condition_rating integer,
    cleanliness_rating integer,
    created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
    updated_at timestamp with time zone,
    updated_last timestamp with time zone,
    updated_by uuid,
    hours numeric,
    constraint heavy_equipment_cleanliness_rating_check CHECK (((cleanliness_rating >= 1) AND (cleanliness_rating <= 5))),
    constraint heavy_equipment_condition_rating_check CHECK (((condition_rating >= 1) AND (condition_rating <= 5))),
    constraint heavy_equipment_hours_mileage_check CHECK ((hours_mileage >= (0)::numeric)),
    constraint heavy_equipment_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'In Shop'::text, 'Spare'::text, 'Retired'::text]))),
    constraint heavy_equipment_year_made_check CHECK (((year_made >= 1900) AND ((year_made)::numeric <= EXTRACT(year FROM CURRENT_DATE)))),
    constraint heavy_equipment_pkey PRIMARY KEY (id),
    constraint heavy_equipment_identifying_number_key UNIQUE (identifying_number)
);
alter table public.heavy_equipment enable row level security;

create table if not exists public.heavy_equipment_comments (
    id uuid not null default gen_random_uuid(),
    equipment_id uuid not null,
    text text not null,
    author text not null,
    created_at timestamp with time zone not null default now(),
    constraint equipment_comments_pkey PRIMARY KEY (id)
);
alter table public.heavy_equipment_comments enable row level security;

create table if not exists public.heavy_equipment_history (
    id uuid not null default gen_random_uuid(),
    equipment_id uuid not null,
    field_name text not null,
    old_value text,
    new_value text,
    changed_at timestamp with time zone not null default CURRENT_TIMESTAMP,
    changed_by uuid,
    constraint heavy_equipment_history_field_name_check CHECK ((field_name = ANY (ARRAY['identifying_number'::text, 'assigned_plant'::text, 'assigned_operator'::text, 'equipment_type'::text, 'status'::text, 'last_service_date'::text, 'year_made'::text, 'equipment_make'::text, 'equipment_model'::text, 'hours_mileage'::text, 'condition_rating'::text, 'cleanliness_rating'::text]))),
    constraint heavy_equipment_history_pkey PRIMARY KEY (id)
);
alter table public.heavy_equipment_history enable row level security;

create table if not exists public.heavy_equipment_maintenance (
    id uuid not null default extensions.uuid_generate_v4(),
    equipment_id uuid not null,
    issue text not null,
    severity text not null,
    time_created timestamp with time zone not null default now(),
    time_completed timestamp with time zone,
    created_by uuid,
    constraint heavy_equipment_maintenance_severity_check CHECK ((severity = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text]))),
    constraint heavy_equipment_maintenance_pkey PRIMARY KEY (id)
);
alter table public.heavy_equipment_maintenance enable row level security;

create table if not exists public.messages (
    id uuid not null default gen_random_uuid(),
    sender_id uuid not null,
    recipient_id uuid not null,
    subject text not null default ''::text,
    body bytea not null,
    attachment_type text,
    attachment_meta jsonb,
    is_read boolean not null default false,
    read_at timestamp with time zone,
    created_at timestamp with time zone not null default now(),
    deleted_by_sender boolean not null default false,
    deleted_by_recipient boolean not null default false,
    constraint messages_pkey PRIMARY KEY (id)
);
alter table public.messages enable row level security;

create table if not exists public.mixers (
    id uuid not null default extensions.uuid_generate_v4(),
    truck_number text not null,
    assigned_plant text not null,
    assigned_operator text,
    last_service_date timestamp with time zone,
    last_chip_date timestamp with time zone,
    cleanliness_rating integer,
    created_at timestamp with time zone default CURRENT_TIMESTAMP,
    status text default 'Active'::text,
    updated_at timestamp with time zone,
    updated_by uuid,
    vin text,
    make text,
    model text,
    year text,
    updated_last timestamp with time zone,
    down_in_yard boolean not null default false,
    shop_status text,
    hours numeric,
    constraint mixers_cleanliness_rating_check CHECK (((cleanliness_rating >= 1) AND (cleanliness_rating <= 5))),
    constraint mixers_pkey PRIMARY KEY (id),
    constraint mixers_truck_number_key UNIQUE (truck_number)
);
alter table public.mixers enable row level security;

create table if not exists public.mixers_comments (
    id uuid not null default gen_random_uuid(),
    mixer_id uuid not null,
    text text not null,
    author text not null,
    created_at timestamp with time zone not null default now(),
    constraint mixer_comments_pkey PRIMARY KEY (id)
);
alter table public.mixers_comments enable row level security;

create table if not exists public.mixers_history (
    id uuid not null default gen_random_uuid(),
    mixer_id uuid not null,
    field_name text not null,
    old_value text,
    new_value text,
    changed_at timestamp with time zone not null default CURRENT_TIMESTAMP,
    changed_by uuid,
    constraint mixer_history_pkey PRIMARY KEY (id)
);
alter table public.mixers_history enable row level security;

create table if not exists public.mixers_images (
    id uuid not null default gen_random_uuid(),
    mixer_id uuid not null,
    part_key text not null,
    file_path text not null,
    uploaded_by uuid not null,
    uploaded_at timestamp with time zone not null default now(),
    constraint mixer_images_pkey PRIMARY KEY (id)
);
alter table public.mixers_images enable row level security;

create table if not exists public.mixers_maintenance (
    id uuid not null,
    mixer_id uuid not null,
    issue text not null,
    severity text not null,
    time_created timestamp with time zone not null default now(),
    time_completed timestamp with time zone,
    created_by uuid,
    constraint mixers_maintenance_severity_check CHECK ((severity = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text]))),
    constraint mixers_maintenance_pkey PRIMARY KEY (id)
);
alter table public.mixers_maintenance enable row level security;

create table if not exists public.notification_reads (
    id uuid not null default gen_random_uuid(),
    notification_id uuid not null,
    user_id uuid not null,
    read_at timestamp with time zone not null default now(),
    deleted_at timestamp with time zone,
    constraint notification_reads_pkey PRIMARY KEY (id),
    constraint notification_reads_notification_id_user_id_key UNIQUE (notification_id, user_id)
);
alter table public.notification_reads enable row level security;

create table if not exists public.notifications (
    id uuid not null default gen_random_uuid(),
    type text not null default 'system'::text,
    title text not null,
    body text,
    severity text not null default 'info'::text,
    target_type text not null default 'all'::text,
    target_value text,
    sender_id uuid,
    link_view text,
    link_context jsonb,
    expires_at timestamp with time zone,
    created_at timestamp with time zone not null default now(),
    constraint notifications_pkey PRIMARY KEY (id)
);
alter table public.notifications enable row level security;

create table if not exists public.operators (
    name text not null,
    plant_code text,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    status text not null default 'Active'::text,
    is_trainer boolean not null default false,
    assigned_trainer text,
    "position" character varying(255),
    employee_id uuid not null,
    smyrna_id text,
    pending_start_date timestamp with time zone,
    rating numeric default '0'::numeric,
    phone text,
    automatic_restriction boolean not null default true,
    constraint operators_pkey PRIMARY KEY (employee_id),
    constraint operators_id_key UNIQUE (employee_id)
);
alter table public.operators enable row level security;

create table if not exists public.operators_comments (
    id uuid not null default gen_random_uuid(),
    operator_id uuid not null,
    text text not null,
    author text not null,
    created_at timestamp with time zone not null default now(),
    constraint operators_comments_pkey PRIMARY KEY (id)
);
alter table public.operators_comments enable row level security;

create table if not exists public.operators_history (
    id uuid not null default gen_random_uuid(),
    operator_id uuid not null,
    field_name text not null,
    old_value text,
    new_value text,
    changed_at timestamp with time zone not null default CURRENT_TIMESTAMP,
    changed_by uuid,
    constraint operators_history_pkey PRIMARY KEY (id)
);
alter table public.operators_history enable row level security;

create table if not exists public.pickup_trucks (
    id uuid not null default extensions.uuid_generate_v4(),
    vin text,
    make text,
    model text,
    year text,
    assigned text,
    mileage integer,
    comments text,
    created_at timestamp with time zone default CURRENT_TIMESTAMP,
    updated_at timestamp with time zone,
    updated_by uuid,
    updated_last timestamp with time zone,
    assigned_plant text,
    status text not null default 'Active'::text,
    constraint pickup_trucks_mileage_check CHECK (((mileage IS NULL) OR (mileage >= 0))),
    constraint pickup_trucks_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Stationary'::text, 'Spare'::text, 'In Shop'::text, 'Retired'::text, 'Sold'::text]))),
    constraint pickup_trucks_pkey PRIMARY KEY (id)
);
alter table public.pickup_trucks enable row level security;

create table if not exists public.pickup_trucks_comments (
    id uuid not null default gen_random_uuid(),
    truck_id uuid not null,
    text text not null,
    author text not null,
    created_at timestamp with time zone not null default now(),
    constraint pickup_trucks_comments_pkey PRIMARY KEY (id)
);
alter table public.pickup_trucks_comments enable row level security;

create table if not exists public.pickup_trucks_history (
    id uuid not null default gen_random_uuid(),
    truck_id uuid not null,
    field_name text not null,
    old_value text,
    new_value text,
    changed_at timestamp with time zone not null default CURRENT_TIMESTAMP,
    changed_by uuid,
    constraint pickup_trucks_history_pkey PRIMARY KEY (id)
);
alter table public.pickup_trucks_history enable row level security;

create table if not exists public.pickup_trucks_maintenance (
    id uuid not null default extensions.uuid_generate_v4(),
    truck_id uuid not null,
    issue text not null,
    severity text not null,
    time_created timestamp with time zone not null default now(),
    time_completed timestamp with time zone,
    created_by uuid,
    constraint pickup_trucks_maintenance_severity_check CHECK ((severity = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text]))),
    constraint pickup_trucks_maintenance_pkey PRIMARY KEY (id)
);
alter table public.pickup_trucks_maintenance enable row level security;

create table if not exists public.quality_issues (
    id uuid not null default gen_random_uuid(),
    title text not null,
    description text,
    plant_code text,
    region_code text,
    status text not null default 'active'::text,
    severity text,
    cost_to_close numeric(12,2),
    opened_at timestamp with time zone not null default now(),
    closed_at timestamp with time zone,
    created_by uuid,
    updated_at timestamp with time zone not null default now(),
    updated_by uuid,
    constraint quality_issues_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    constraint quality_issues_status_check CHECK ((status = ANY (ARRAY['active'::text, 'follow_up'::text, 'holding'::text, 'closed'::text]))),
    constraint quality_issues_pkey PRIMARY KEY (id)
);
alter table public.quality_issues enable row level security;

create table if not exists public.quality_issues_comments (
    id uuid not null default gen_random_uuid(),
    issue_id uuid not null,
    body text not null,
    created_at timestamp with time zone not null default now(),
    created_by uuid,
    constraint quality_issues_comments_pkey PRIMARY KEY (id)
);
alter table public.quality_issues_comments enable row level security;

create table if not exists public.quality_issues_history (
    id uuid not null default gen_random_uuid(),
    issue_id uuid not null,
    field_name text not null,
    old_value text,
    new_value text,
    changed_at timestamp with time zone not null default now(),
    changed_by uuid,
    constraint quality_issues_history_pkey PRIMARY KEY (id)
);
alter table public.quality_issues_history enable row level security;

create table if not exists public.regions (
    id uuid not null default gen_random_uuid(),
    region_code text not null,
    region_name text not null,
    created_at timestamp with time zone default CURRENT_TIMESTAMP,
    updated_at timestamp with time zone default CURRENT_TIMESTAMP,
    type text not null default 'Concrete'::text,
    constraint regions_pkey PRIMARY KEY (id),
    constraint regions_region_code_key UNIQUE (region_code)
);
alter table public.regions enable row level security;

create table if not exists public.regions_plants (
    region_id uuid not null,
    plant_code text not null,
    created_at timestamp with time zone default CURRENT_TIMESTAMP,
    districts jsonb[],
    constraint region_plants_pkey PRIMARY KEY (region_id, plant_code)
);
alter table public.regions_plants enable row level security;

create table if not exists public.tractors (
    id uuid not null default extensions.uuid_generate_v4(),
    truck_number text not null,
    assigned_plant text not null,
    assigned_operator text,
    cleanliness_rating integer,
    status text default 'Active'::text,
    has_blower boolean not null,
    last_service_date timestamp with time zone,
    created_at timestamp with time zone default CURRENT_TIMESTAMP,
    updated_at timestamp with time zone default CURRENT_TIMESTAMP,
    updated_last timestamp with time zone,
    updated_by uuid,
    vin text,
    make text,
    model text,
    year text,
    last_chip_date timestamp with time zone,
    freight text,
    hours numeric,
    constraint tractors_cleanliness_rating_check CHECK (((cleanliness_rating >= 1) AND (cleanliness_rating <= 5))),
    constraint tractors_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'In Shop'::text, 'Spare'::text, 'Retired'::text]))),
    constraint tractors_pkey PRIMARY KEY (id),
    constraint tractors_truck_number_key UNIQUE (truck_number)
);
alter table public.tractors enable row level security;

create table if not exists public.tractors_comments (
    id uuid not null default gen_random_uuid(),
    tractor_id uuid not null,
    text text not null,
    author text not null,
    created_at timestamp with time zone default now(),
    constraint tractor_comments_pkey PRIMARY KEY (id)
);
alter table public.tractors_comments enable row level security;

create table if not exists public.tractors_history (
    id uuid not null default gen_random_uuid(),
    tractor_id uuid not null,
    field_name text not null,
    old_value text,
    new_value text,
    changed_at timestamp with time zone not null default CURRENT_TIMESTAMP,
    changed_by uuid,
    constraint tractor_history_pkey PRIMARY KEY (id)
);
alter table public.tractors_history enable row level security;

create table if not exists public.tractors_maintenance (
    id uuid not null default extensions.uuid_generate_v4(),
    tractor_id uuid not null,
    issue text not null,
    severity text not null,
    time_created timestamp with time zone not null default now(),
    time_completed timestamp with time zone,
    created_by uuid,
    constraint tractors_maintenance_severity_check CHECK ((severity = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text]))),
    constraint tractors_maintenance_pkey PRIMARY KEY (id)
);
alter table public.tractors_maintenance enable row level security;

create table if not exists public.trailers (
    id uuid not null default extensions.uuid_generate_v4(),
    trailer_number text not null,
    assigned_plant text not null,
    trailer_type text not null,
    assigned_tractor text,
    cleanliness_rating integer,
    created_at timestamp with time zone not null default CURRENT_TIMESTAMP,
    updated_at timestamp with time zone not null default CURRENT_TIMESTAMP,
    updated_last timestamp with time zone,
    updated_by uuid,
    status text default 'Active'::text,
    constraint trailers_cleanliness_rating_check CHECK (((cleanliness_rating >= 1) AND (cleanliness_rating <= 5))),
    constraint trailers_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'In Shop'::text, 'Spare'::text, 'Retired'::text]))),
    constraint trailers_trailer_type_check CHECK ((trailer_type = ANY (ARRAY['Cement'::text, 'End Dump'::text]))),
    constraint trailers_pkey PRIMARY KEY (id),
    constraint trailers_trailer_number_key UNIQUE (trailer_number)
);
alter table public.trailers enable row level security;

create table if not exists public.trailers_comments (
    id uuid not null default gen_random_uuid(),
    trailer_id uuid not null,
    text text not null,
    author text not null,
    created_at timestamp with time zone not null default now(),
    constraint trailer_comments_pkey PRIMARY KEY (id)
);
alter table public.trailers_comments enable row level security;

create table if not exists public.trailers_history (
    id uuid not null default gen_random_uuid(),
    trailer_id uuid not null,
    field_name text not null,
    old_value text,
    new_value text,
    changed_at timestamp with time zone not null default CURRENT_TIMESTAMP,
    changed_by uuid,
    constraint trailer_history_pkey PRIMARY KEY (id)
);
alter table public.trailers_history enable row level security;

create table if not exists public.trailers_maintenance (
    id uuid not null default extensions.uuid_generate_v4(),
    trailer_id uuid not null,
    issue text not null,
    severity text not null,
    time_created timestamp with time zone not null default now(),
    time_completed timestamp with time zone,
    created_by uuid,
    constraint trailers_maintenance_severity_check CHECK ((severity = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text]))),
    constraint trailers_maintenance_pkey PRIMARY KEY (id)
);
alter table public.trailers_maintenance enable row level security;

create table if not exists public.users_permissions (
    id uuid not null default gen_random_uuid(),
    role_id uuid not null,
    user_id uuid not null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    constraint accounts_permissions_pkey PRIMARY KEY (id)
);
alter table public.users_permissions enable row level security;

create table if not exists public.users_pinned_conversations (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null,
    other_user_id uuid not null,
    pinned boolean not null default false,
    muted boolean not null default false,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    constraint users_pinned_conversations_pkey PRIMARY KEY (id),
    constraint users_pinned_conversations_user_id_other_user_id_key UNIQUE (user_id, other_user_id)
);
alter table public.users_pinned_conversations enable row level security;

create table if not exists public.users_presence (
    user_id uuid not null,
    is_online boolean default true,
    last_seen timestamp without time zone default CURRENT_TIMESTAMP,
    updated_at timestamp without time zone default CURRENT_TIMESTAMP,
    last_activity timestamp with time zone default now(),
    device_type text default 'desktop'::text,
    active_devices jsonb default '{}'::jsonb,
    constraint users_presence_pkey PRIMARY KEY (user_id)
);
alter table public.users_presence enable row level security;

create table if not exists public.users_profiles (
    id uuid not null,
    first_name text not null,
    last_name text not null,
    plant_code text not null,
    created_at text not null,
    updated_at text not null,
    regions text[] not null default '{}'::text[],
    additional_assigned_plants text[],
    constraint profiles_pkey PRIMARY KEY (id)
);
alter table public.users_profiles enable row level security;

create table if not exists public.users_roles (
    id uuid not null default gen_random_uuid(),
    name text not null,
    permissions text[] not null,
    weight integer not null default 0,
    constraint accounts_roles_pkey PRIMARY KEY (id),
    constraint accounts_roles_name_key UNIQUE (name)
);
alter table public.users_roles enable row level security;

create table if not exists public.users_sessions (
    id text not null,
    user_id uuid not null,
    browser text,
    os text,
    device text,
    user_agent text,
    last_active timestamp with time zone not null default now(),
    created_at timestamp with time zone not null default now(),
    constraint users_sessions_pkey PRIMARY KEY (id)
);
alter table public.users_sessions enable row level security;

create table if not exists public.users_tutorials (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null,
    tutorial_id text not null,
    dismissed_at timestamp with time zone not null default CURRENT_TIMESTAMP,
    constraint users_tutorials_user_id_tutorial_id_key UNIQUE (user_id, tutorial_id)
);
alter table public.users_tutorials enable row level security;

-- Foreign keys, added after every table exists.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'documents_uploaded_by_fkey' and conrelid = 'public.documents'::regclass) then
    alter table public.documents add constraint documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'heavy_equipment_assigned_plant_fkey' and conrelid = 'public.heavy_equipment'::regclass) then
    alter table public.heavy_equipment add constraint heavy_equipment_assigned_plant_fkey FOREIGN KEY (assigned_plant) REFERENCES plants(plant_code) ON DELETE RESTRICT;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'heavy_equipment_history_equipment_id_fkey' and conrelid = 'public.heavy_equipment_history'::regclass) then
    alter table public.heavy_equipment_history add constraint heavy_equipment_history_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES heavy_equipment(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'heavy_equipment_maintenance_equipment_id_fkey' and conrelid = 'public.heavy_equipment_maintenance'::regclass) then
    alter table public.heavy_equipment_maintenance add constraint heavy_equipment_maintenance_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES heavy_equipment(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_recipient_id_fkey' and conrelid = 'public.messages'::regclass) then
    alter table public.messages add constraint messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_sender_id_fkey' and conrelid = 'public.messages'::regclass) then
    alter table public.messages add constraint messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mixers_assigned_plant_fkey' and conrelid = 'public.mixers'::regclass) then
    alter table public.mixers add constraint mixers_assigned_plant_fkey FOREIGN KEY (assigned_plant) REFERENCES plants(plant_code) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mixer_comments_mixer_id_fkey' and conrelid = 'public.mixers_comments'::regclass) then
    alter table public.mixers_comments add constraint mixer_comments_mixer_id_fkey FOREIGN KEY (mixer_id) REFERENCES mixers(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mixer_history_mixer_id_fkey' and conrelid = 'public.mixers_history'::regclass) then
    alter table public.mixers_history add constraint mixer_history_mixer_id_fkey FOREIGN KEY (mixer_id) REFERENCES mixers(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mixer_images_uploaded_by_fkey' and conrelid = 'public.mixers_images'::regclass) then
    alter table public.mixers_images add constraint mixer_images_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notification_reads_notification_id_fkey' and conrelid = 'public.notification_reads'::regclass) then
    alter table public.notification_reads add constraint notification_reads_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'operators_history_operator_id_fkey' and conrelid = 'public.operators_history'::regclass) then
    alter table public.operators_history add constraint operators_history_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES operators(employee_id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pickup_trucks_assigned_plant_fkey' and conrelid = 'public.pickup_trucks'::regclass) then
    alter table public.pickup_trucks add constraint pickup_trucks_assigned_plant_fkey FOREIGN KEY (assigned_plant) REFERENCES plants(plant_code) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pickup_trucks_comments_truck_id_fkey' and conrelid = 'public.pickup_trucks_comments'::regclass) then
    alter table public.pickup_trucks_comments add constraint pickup_trucks_comments_truck_id_fkey FOREIGN KEY (truck_id) REFERENCES pickup_trucks(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pickup_trucks_history_truck_id_fkey' and conrelid = 'public.pickup_trucks_history'::regclass) then
    alter table public.pickup_trucks_history add constraint pickup_trucks_history_truck_id_fkey FOREIGN KEY (truck_id) REFERENCES pickup_trucks(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pickup_trucks_maintenance_truck_id_fkey' and conrelid = 'public.pickup_trucks_maintenance'::regclass) then
    alter table public.pickup_trucks_maintenance add constraint pickup_trucks_maintenance_truck_id_fkey FOREIGN KEY (truck_id) REFERENCES pickup_trucks(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'quality_issues_comments_issue_id_fkey' and conrelid = 'public.quality_issues_comments'::regclass) then
    alter table public.quality_issues_comments add constraint quality_issues_comments_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES quality_issues(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'quality_issues_history_issue_id_fkey' and conrelid = 'public.quality_issues_history'::regclass) then
    alter table public.quality_issues_history add constraint quality_issues_history_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES quality_issues(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'region_plants_plant_code_fkey' and conrelid = 'public.regions_plants'::regclass) then
    alter table public.regions_plants add constraint region_plants_plant_code_fkey FOREIGN KEY (plant_code) REFERENCES plants(plant_code);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'region_plants_region_id_fkey' and conrelid = 'public.regions_plants'::regclass) then
    alter table public.regions_plants add constraint region_plants_region_id_fkey FOREIGN KEY (region_id) REFERENCES regions(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tractors_assigned_plant_fkey' and conrelid = 'public.tractors'::regclass) then
    alter table public.tractors add constraint tractors_assigned_plant_fkey FOREIGN KEY (assigned_plant) REFERENCES plants(plant_code) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tractor_comments_tractor_id_fkey' and conrelid = 'public.tractors_comments'::regclass) then
    alter table public.tractors_comments add constraint tractor_comments_tractor_id_fkey FOREIGN KEY (tractor_id) REFERENCES tractors(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tractor_history_tractor_id_fkey' and conrelid = 'public.tractors_history'::regclass) then
    alter table public.tractors_history add constraint tractor_history_tractor_id_fkey FOREIGN KEY (tractor_id) REFERENCES tractors(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tractors_maintenance_tractor_id_fkey' and conrelid = 'public.tractors_maintenance'::regclass) then
    alter table public.tractors_maintenance add constraint tractors_maintenance_tractor_id_fkey FOREIGN KEY (tractor_id) REFERENCES tractors(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trailer_history_trailer_id_fkey' and conrelid = 'public.trailers_history'::regclass) then
    alter table public.trailers_history add constraint trailer_history_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES trailers(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trailers_maintenance_trailer_id_fkey' and conrelid = 'public.trailers_maintenance'::regclass) then
    alter table public.trailers_maintenance add constraint trailers_maintenance_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES trailers(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounts_permissions_role_id_fkey' and conrelid = 'public.users_permissions'::regclass) then
    alter table public.users_permissions add constraint accounts_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES users_roles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounts_permissions_user_id_fkey' and conrelid = 'public.users_permissions'::regclass) then
    alter table public.users_permissions add constraint accounts_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_presence_user_id_fkey' and conrelid = 'public.users_presence'::regclass) then
    alter table public.users_presence add constraint users_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_id_fkey' and conrelid = 'public.users_profiles'::regclass) then
    alter table public.users_profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_sessions_user_id_fkey' and conrelid = 'public.users_sessions'::regclass) then
    alter table public.users_sessions add constraint users_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  end if;
end $$;

-- Secondary indexes.
create index if not exists idx_app_install_prompts_action ON public.app_install_prompts USING btree (action);
create index if not exists idx_app_install_prompts_reminded_at ON public.app_install_prompts USING btree (reminded_at);
create index if not exists idx_app_install_prompts_user_id ON public.app_install_prompts USING btree (user_id);
create index if not exists idx_client_errors_created_at ON public.client_errors USING btree (created_at DESC);
create index if not exists idx_client_errors_level ON public.client_errors USING btree (level);
create index if not exists idx_messages_recipient_id ON public.messages USING btree (recipient_id, created_at DESC) WHERE (deleted_by_recipient = false);
create index if not exists idx_messages_sender_id ON public.messages USING btree (sender_id, created_at DESC) WHERE (deleted_by_sender = false);
create index if not exists idx_messages_recipient_unread ON public.messages USING btree (recipient_id) WHERE ((is_read = false) AND (deleted_by_recipient = false));
create index if not exists idx_messages_created_at ON public.messages USING btree (created_at DESC);
create index if not exists idx_mixer_history_changed_at ON public.mixers_history USING btree (changed_at);
create index if not exists idx_mixer_history_mixer_id ON public.mixers_history USING btree (mixer_id);
create index if not exists idx_notification_reads_user ON public.notification_reads USING btree (user_id);
create index if not exists idx_notifications_created_at ON public.notifications USING btree (created_at DESC);
create index if not exists idx_notifications_target ON public.notifications USING btree (target_type, target_value);
create index if not exists idx_operators_history_changed_at ON public.operators_history USING btree (changed_at);
create index if not exists idx_operators_history_operator_id ON public.operators_history USING btree (operator_id);
create index if not exists pickup_trucks_assigned_idx ON public.pickup_trucks USING btree (assigned);
create index if not exists pickup_trucks_assigned_plant_idx ON public.pickup_trucks USING btree (assigned_plant);
create index if not exists pickup_trucks_make_model_idx ON public.pickup_trucks USING btree (make, model);
create index if not exists pickup_trucks_status_idx ON public.pickup_trucks USING btree (status);
create index if not exists pickup_trucks_vin_idx ON public.pickup_trucks USING btree (vin);
create index if not exists idx_pickup_trucks_history_changed_at ON public.pickup_trucks_history USING btree (changed_at);
create index if not exists idx_pickup_trucks_history_truck_id ON public.pickup_trucks_history USING btree (truck_id);
create index if not exists idx_quality_issues_status ON public.quality_issues USING btree (status);
create index if not exists idx_quality_issues_region ON public.quality_issues USING btree (region_code);
create index if not exists idx_quality_issues_plant ON public.quality_issues USING btree (plant_code);
create index if not exists idx_quality_issues_opened ON public.quality_issues USING btree (opened_at DESC);
create index if not exists idx_quality_issues_comments_issue ON public.quality_issues_comments USING btree (issue_id);
create index if not exists idx_quality_issues_history_issue ON public.quality_issues_history USING btree (issue_id);
create index if not exists idx_users_pinned_conversations_user_id ON public.users_pinned_conversations USING btree (user_id);
create index if not exists idx_users_pinned_conversations_pinned ON public.users_pinned_conversations USING btree (user_id) WHERE (pinned = true);
create index if not exists idx_users_pinned_conversations_muted ON public.users_pinned_conversations USING btree (user_id) WHERE (muted = true);
create index if not exists idx_users_presence_last_seen ON public.users_presence USING btree (last_seen);
create index if not exists idx_users_presence_online ON public.users_presence USING btree (is_online);
create index if not exists idx_users_sessions_last_active ON public.users_sessions USING btree (last_active DESC);
create index if not exists idx_users_sessions_user_id ON public.users_sessions USING btree (user_id);
create index if not exists idx_users_tutorials_user_id ON public.users_tutorials USING btree (user_id);
create index if not exists idx_users_tutorials_tutorial_id ON public.users_tutorials USING btree (tutorial_id);
