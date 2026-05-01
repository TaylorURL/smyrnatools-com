-- Force a fresh DetailOrderAnalysis + DetailDriver re-parse for today so the
-- new truck-number reassembly logic overwrites any rows that previously
-- captured a fragment ("28") or no truck at all.
select net.http_post(
    url := 'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/dispatch-import',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object(
        'date', current_date::text,
        'reports', jsonb_build_array('DetailOrderAnalysis', 'DetailDriver')
    )
) as request_id;
