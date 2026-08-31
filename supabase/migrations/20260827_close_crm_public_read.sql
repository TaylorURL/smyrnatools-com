-- Close public read on the six CRM tables.
--
-- Each carried a policy granted to PUBLIC with a qualifier of `true`, and a
-- SELECT grant to anon on top of it. Row-level security was enabled on all six,
-- which is what made them read as protected in every check that counts policies
-- rather than reading them: a policy of `true` for PUBLIC grants everyone the
-- access the switch was turned on to withhold. Between them the tables hold 689
-- customer accounts and their contacts, calls, follow-ups and opportunities, and
-- reaching them needed only the publishable key, which ships in the page.
--
-- Nothing loses access. The one reader is the call-list-service edge function,
-- which builds its client from SUPABASE_SERVICE_ROLE_KEY; the service role
-- bypasses row-level security altogether and never consulted these policies. The
-- replacements are scoped to authenticated rather than dropped outright so that
-- any signed-in path added later reads the same way it would have before.

revoke all on public.crm_accounts from anon;
revoke all on public.crm_pins from anon;
revoke all on public.customer_contacts from anon;
revoke all on public.customer_followups from anon;
revoke all on public.customer_interactions from anon;
revoke all on public.customer_opportunities from anon;

drop policy if exists "crm_accounts_all" on public.crm_accounts;
drop policy if exists "crm_pins_all" on public.crm_pins;
drop policy if exists "customer_contacts_all" on public.customer_contacts;
drop policy if exists "customer_followups_all" on public.customer_followups;
drop policy if exists "customer_call_log_all" on public.customer_interactions;
drop policy if exists "customer_opportunities_all" on public.customer_opportunities;

create policy "crm_accounts_authenticated" on public.crm_accounts
    for all to authenticated using (true) with check (true);
create policy "crm_pins_authenticated" on public.crm_pins
    for all to authenticated using (true) with check (true);
create policy "customer_contacts_authenticated" on public.customer_contacts
    for all to authenticated using (true) with check (true);
create policy "customer_followups_authenticated" on public.customer_followups
    for all to authenticated using (true) with check (true);
create policy "customer_opportunities_authenticated" on public.customer_opportunities
    for all to authenticated using (true) with check (true);

-- customer_interactions already carries an authenticated select policy, so it
-- gains only the write half here.
create policy "customer_interactions_authenticated" on public.customer_interactions
    for all to authenticated using (true) with check (true);
