-- Creates the customer_call_log table for the Plan -> Call List tab and
-- the get_call_list_roster() function that aggregates dormant customers
-- (poured in past year, but not in past 30 days) for dispatcher cold-calls.

create extension if not exists "pgcrypto";

create table if not exists public.customer_call_log (
    id              uuid primary key default gen_random_uuid(),
    customer_num    text not null,
    customer_name   text,
    contact_name    text,
    phone           text,
    outcome         text not null check (
        outcome in ('no_answer', 'booked', 'not_interested', 'will_book_again', 'note')
    ),
    comment         text,
    created_by      uuid,
    created_by_name text,
    created_at      timestamptz not null default now()
);

create index if not exists idx_customer_call_log_customer
    on public.customer_call_log (customer_num);

create index if not exists idx_customer_call_log_created_at
    on public.customer_call_log (created_at desc);

alter table public.customer_call_log enable row level security;

drop policy if exists "customer_call_log_all" on public.customer_call_log;
create policy "customer_call_log_all"
    on public.customer_call_log
    for all
    using (true)
    with check (true);

-- Aggregator: one row per dormant customer, joined with their most recent
-- call log entry. Filters to customers who poured in the last 365 days but
-- whose last pour was at least 30 days ago.
create or replace function public.get_call_list_roster()
returns table (
    customer_num         text,
    customer_name        text,
    contact_name         text,
    phone                text,
    last_pour_date       date,
    pour_days_last_year  integer,
    days_since_last_pour integer,
    last_call_at         timestamptz,
    last_call_outcome    text,
    last_call_by_name    text,
    last_call_comment    text,
    call_count_last_30   integer
)
language sql
stable
as $$
    with latest_contact as (
        select distinct on (d.customer_num)
            d.customer_num,
            d.customer as customer_name,
            d.contact  as contact_name,
            d.phone
        from public.dispatch_data d
        where d.customer_num is not null
          and d.customer_num <> ''
          and d.order_date >= (current_date - interval '365 days')
        order by d.customer_num, d.order_date desc, d.ticket_time desc nulls last
    ),
    pour_summary as (
        select
            d.customer_num,
            max(d.order_date) as last_pour_date,
            count(distinct d.order_date) as pour_days_last_year
        from public.dispatch_data d
        where d.customer_num is not null
          and d.customer_num <> ''
          and d.order_date >= (current_date - interval '365 days')
          and d.order_date < current_date
        group by d.customer_num
    ),
    last_log as (
        select distinct on (l.customer_num)
            l.customer_num,
            l.created_at      as last_call_at,
            l.outcome         as last_call_outcome,
            l.created_by_name as last_call_by_name,
            l.comment         as last_call_comment
        from public.customer_call_log l
        order by l.customer_num, l.created_at desc
    ),
    calls_30 as (
        select l.customer_num, count(*)::integer as call_count_last_30
        from public.customer_call_log l
        where l.created_at >= (current_date - interval '30 days')
        group by l.customer_num
    )
    select
        p.customer_num,
        coalesce(lc.customer_name, '')                    as customer_name,
        nullif(lc.contact_name, '')                       as contact_name,
        nullif(lc.phone, '')                              as phone,
        p.last_pour_date,
        p.pour_days_last_year::integer,
        (current_date - p.last_pour_date)::integer        as days_since_last_pour,
        ll.last_call_at,
        ll.last_call_outcome,
        ll.last_call_by_name,
        ll.last_call_comment,
        coalesce(c30.call_count_last_30, 0)               as call_count_last_30
    from pour_summary p
    left join latest_contact lc on lc.customer_num = p.customer_num
    left join last_log       ll on ll.customer_num = p.customer_num
    left join calls_30      c30 on c30.customer_num = p.customer_num
    where p.last_pour_date <= (current_date - interval '30 days')
    order by p.last_pour_date asc, lc.customer_name asc;
$$;

grant execute on function public.get_call_list_roster() to anon, authenticated, service_role;
